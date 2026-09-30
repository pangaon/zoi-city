import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const container = process.env.ZOI_TEST_POSTGRES_CONTAINER;
const migration = readFileSync(new URL('../../supabase/migrations/20260930000829_atomic_community_publish.sql', import.meta.url), 'utf8');
let database = 'postgres';
function sql(query) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', database, '-X', '-At', '-v', 'ON_ERROR_STOP=1']);
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.on('error', reject);
    child.on('close', code => code ? reject(new Error(stderr)) : resolve(stdout.trim()));
    child.stdin.end(query);
  });
}
const author = '00000000-0000-0000-0000-000000000001';
const user = '00000000-0000-0000-0000-000000000011';
const stranger = '00000000-0000-0000-0000-000000000012';
const workspace = '00000000-0000-0000-0000-000000000021';
const post = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const asUser = `SET ROLE authenticated; SET request.jwt.claim.sub='${user}';`;
const asWorker = 'SET ROLE service_role;';
const call = id => `SELECT public.feed_publish_social_post('${id}');`;
const worker = id => `SELECT public.feed_publish_scheduled_post('${id}');`;
const insert = (n, channels = "ARRAY['zoi']", body = "'Actual caption'") =>
  `INSERT INTO zoi.social_posts(id,workspace_id,author_profile,body,channels,scheduled_at,status) VALUES('${post(n)}','${workspace}','${author}',${body},${channels},now()-interval '1 second','scheduled');`;

test('atomic community publication against PostgreSQL', { skip: !container }, async t => {
  // Dedicated ephemeral container only. Never accepts a production URL.
  const testDatabase = 'community_test_' + process.pid;
  await sql('CREATE DATABASE ' + testDatabase);
  database = testDatabase;
  t.after(async () => { database = 'postgres'; await sql('DROP DATABASE ' + testDatabase); });
  await sql(`
    DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE SCHEMA auth; CREATE SCHEMA zoi;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated,service_role;
    CREATE TABLE zoi.user_profiles(id uuid PRIMARY KEY,auth_user_id uuid NOT NULL);
    CREATE TABLE zoi.social_posts(id uuid PRIMARY KEY,workspace_id uuid,author_profile uuid,body text,channels text[],scheduled_at timestamptz,status text CHECK(status IN('draft','scheduled','published','failed')),media jsonb DEFAULT '[]',nameday_ref text,meta jsonb DEFAULT '{}',published_at timestamptz,updated_at timestamptz);
    CREATE TABLE zoi.feed_posts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),profile_id uuid,body text CHECK(length(body) BETWEEN 1 AND 1000),nameday_ref text,media jsonb,created_at timestamptz DEFAULT now());
    CREATE FUNCTION zoi.is_ws_member(p_id uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT p_id='${workspace}'::uuid AND auth.uid()='${user}'::uuid $$;
    INSERT INTO zoi.user_profiles VALUES('${author}','${user}');
  `);
  await sql(migration);
  await t.test('concurrent browser and worker publish exactly once', async () => {
    await sql(insert(101));
    await Promise.all([sql(asUser + call(post(101))),sql(asWorker + worker(post(101)))]);
    assert.equal(await sql('SELECT count(*) FROM zoi.feed_posts;'),'1');
    assert.equal(await sql(`SELECT status FROM zoi.social_posts WHERE id='${post(101)}';`),'published');
  });
  await t.test('editable metadata cannot erase delivery idempotency', async () => {
    await sql(`UPDATE zoi.social_posts SET meta='{}',status='scheduled' WHERE id='${post(101)}';`);
    assert.equal(await sql(`SET ROLE service_role; SELECT count(*) FROM public.feed_due_community_post_ids();`),'SET\n0');
    const result = await sql(asUser + call(post(101)));
    assert.match(result, /"already_published": true/);
    assert.equal(await sql('SELECT count(*) FROM zoi.feed_posts;'),'1');
  });
  await t.test('mixed-network delivery retains external scheduling', async () => {
    await sql(insert(102, "ARRAY['zoi','facebook']"));
    await sql(asWorker + worker(post(102)));
    assert.equal(await sql(`SELECT status FROM zoi.social_posts WHERE id='${post(102)}';`),'scheduled');
  });
  await t.test('normalises object media to feed URL strings and uses channel override', async () => {
    await sql(insert(103) + `UPDATE zoi.social_posts SET media='[{"type":"image","url":"https://csebihpaychdkanjjsmz.supabase.co/storage/v1/object/public/media/image.jpg"}]',meta='{"per_network_overrides":{"zoi":{"body":"Community-specific caption"}}}' WHERE id='${post(103)}';`);
    await sql(asUser + call(post(103)));
    assert.equal(await sql("SELECT body FROM zoi.feed_posts WHERE body='Community-specific caption';"),'Community-specific caption');
    assert.match(await sql("SELECT media FROM zoi.feed_posts WHERE body='Community-specific caption';"), /^\["https:/);
  });
  await t.test('rejects unauthorised workspace access and worker impersonation', async () => {
    await sql(insert(104));
    await assert.rejects(sql(`SET ROLE authenticated; SET request.jwt.claim.sub='${stranger}';` + call(post(104))), /not_authorized/);
    await assert.rejects(sql(asUser + worker(post(104))), /permission denied/);
    await assert.rejects(sql('SET ROLE anon;' + call(post(104))), /permission denied/);
  });
  await t.test('requires actual author even for workspace member', async () => {
    await sql(`UPDATE zoi.social_posts SET author_profile='${stranger}' WHERE id='${post(104)}';`);
    await assert.rejects(sql(asUser + call(post(104))), /not_post_author/);
  });
  await t.test('rolls back rejected media and oversized content without receipts', async () => {
    await sql(insert(105) + `UPDATE zoi.social_posts SET media='["https://external.test/picture.jpg"]' WHERE id='${post(105)}';`);
    await assert.rejects(sql(asWorker + worker(post(105))), /upload_images_before/);
    await sql(insert(106, "ARRAY['zoi']", "repeat('a',1001)"));
    await assert.rejects(sql(asWorker + worker(post(106))), /1_to_1000/);
    assert.equal(await sql(`SELECT count(*) FROM zoi.community_post_deliveries WHERE social_post_id IN ('${post(105)}','${post(106)}');`),'0');
  });
  await t.test('cannot publish drafts or future scheduled posts', async () => {
    await sql(insert(107) + `UPDATE zoi.social_posts SET scheduled_at=now()+interval '1 day' WHERE id='${post(107)}';`);
    await assert.rejects(sql(asWorker + worker(post(107))), /post_not_due/);
    await sql(`UPDATE zoi.social_posts SET status='draft',scheduled_at=now() WHERE id='${post(107)}';`);
    await assert.rejects(sql(asUser + call(post(107))), /post_not_due/);
  });
  await t.test('unverified legacy metadata cannot fabricate a publication receipt', async () => {
    await sql(insert(108) + `UPDATE zoi.social_posts SET meta='{"community":{"ok":true}}' WHERE id='${post(108)}';`);
    await assert.rejects(sql(asWorker + worker(post(108))), /legacy_delivery_requires_review/);
  });
  await t.test('rate limiting rejects the sixth new delivery in a minute', async () => {
    await sql(insert(109) + insert(110) + insert(111));
    await sql(asWorker + worker(post(109)));
    await sql(asWorker + worker(post(110)));
    await assert.rejects(sql(asWorker + worker(post(111))), /rate_limited/);
    assert.equal(await sql('SELECT count(*) FROM zoi.feed_posts;'),'5');
  });
  await t.test('ledger is inaccessible to ordinary API callers', async () => {
    await assert.rejects(sql('SET ROLE authenticated; SELECT * FROM zoi.community_post_deliveries;'), /permission denied/);
  });
});
