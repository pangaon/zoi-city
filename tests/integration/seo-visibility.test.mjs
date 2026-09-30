import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
const container=process.env.ZOI_TEST_POSTGRES_CONTAINER;let database='postgres';
function sql(query){return new Promise((resolve,reject)=>{const c=spawn('docker',['exec','-i',container,'psql','-U','postgres','-d',database,'-XAt','-v','ON_ERROR_STOP=1']);let out='',err='';c.stdout.on('data',d=>out+=d);c.stderr.on('data',d=>err+=d);c.on('error',reject);c.on('close',code=>code?reject(new Error(err)):resolve(out.trim()));c.stdin.end(query);});}
test('published search and stable sitemap contracts',{skip:!container},async t=>{
 const db='seo_visibility_'+process.pid;await sql('CREATE DATABASE '+db);database=db;t.after(async()=>{database='postgres';await sql('DROP DATABASE '+db)});
 await sql(`CREATE SCHEMA zoi;CREATE TABLE zoi.categories(id uuid,slug text);CREATE FUNCTION zoi.place_path(bigint) RETURNS text LANGUAGE sql AS $$SELECT '/in/greece'$$;
 CREATE TABLE zoi.listings(id uuid DEFAULT gen_random_uuid(),slug text,name text,entity_type text DEFAULT 'business',publish_status text DEFAULT 'published',marketplace_status text DEFAULT 'none',updated_at timestamptz DEFAULT now(),created_at timestamptz DEFAULT now(),city text DEFAULT 'Athens',region text DEFAULT 'Attica',country text DEFAULT 'Greece',address text,phone text,website text,latitude numeric,longitude numeric,description text,rating numeric,rating_count integer,price_range text,meta_title text,meta_description text,social_links jsonb,profile jsonb DEFAULT '{}',primary_category_id uuid,place_id bigint,region_id bigint,trust_score numeric,owner_workspace_id uuid,geo_precision text);CREATE FUNCTION zoi.profile_completeness(uuid) RETURNS jsonb LANGUAGE sql AS $$SELECT '{"complete":true}'::jsonb$$;`);
 await sql(readFileSync(new URL('../../supabase/migrations/20260930003844_public_search_visibility_and_sitemap.sql',import.meta.url),'utf8'));
 await sql(readFileSync(new URL('../../supabase/migrations/20260930004013_bound_canonical_normalization_work.sql',import.meta.url),'utf8'));
 await sql(readFileSync(new URL('../../supabase/migrations/20260930005210_public_related_visibility.sql',import.meta.url),'utf8'));
 await sql(`CREATE TABLE zoi.booking_settings(listing_id uuid,workspace_id uuid,enabled boolean);CREATE TABLE zoi.org_programs(id uuid,workspace_id uuid,status text);CREATE TABLE zoi.org_shifts(program_id uuid,workspace_id uuid,status text,starts_at timestamptz);`);
 await sql(readFileSync(new URL('../../supabase/migrations/20260930010316_public_home_workflow_actions.sql',import.meta.url),'utf8'));
 // Reconcile an applied body whose control-plane receipt was lost, without duplicating objects.
 await sql(readFileSync(new URL('../../supabase/migrations/20260930010316_public_home_workflow_actions.sql',import.meta.url),'utf8'));
 await t.test('draft, hidden, pending and archived entities are not public',async()=>{
  await sql(`INSERT INTO zoi.listings(slug,name,publish_status) VALUES('draft','Draft','draft'),('pending','Pending','pending_review'),('hidden','Hidden','hidden'),('archived','Archived','archived'),('public','Public','published');INSERT INTO zoi.listings(slug,name,marketplace_status)VALUES('market-hidden','Hidden marketplace','hidden');`);
  assert.equal(await sql('SELECT count(*) FROM public.seo_index();'),'1');
  assert.equal(await sql("SELECT bool_and(public.seo_entity(slug) IS NULL) FROM zoi.listings WHERE slug<>'public';"),'t');
  assert.equal(await sql("SELECT public.seo_entity('public')->>'name';"),'Public');
  assert.equal(await sql("SELECT count(*) FROM public.seo_related('public');"),'0');
  assert.equal(await sql("SELECT count(*) FROM public.seo_related('draft');"),'0');
  assert.equal(await sql("SELECT public.listing_completeness('market-hidden') IS NULL;"),'t');
  await sql("INSERT INTO zoi.listings(slug,name) VALUES('public-neighbor','Public neighbor');");
  assert.equal(await sql("SELECT string_agg(slug,',') FROM public.seo_related('public');"),'public-neighbor');
 });
 await t.test('distinct Greek names and different geographic branches survive canonicalization',async()=>{
  await sql(`TRUNCATE zoi.listings;INSERT INTO zoi.listings(slug,name,address)VALUES('greek-one','Αθηνά','1 Main'),('greek-two','Ελλάδα','1 Main'),('branch-one','Greek Bakery','1 Main'),('branch-two','Greek Bakery','2 Main');INSERT INTO zoi.listings(slug,name,address,country,region)VALUES('branch-us','Greek Bakery','1 Main','United States','Georgia');`);
  assert.equal(await sql('SELECT count(*) FROM public.seo_index();'),'5');
  assert.equal(await sql("SELECT public.seo_entity('branch-us')->>'canonical_slug';"),'branch-us');
 });
 await t.test('true duplicate at same address has one deterministic canonical page',async()=>{
  await sql(`INSERT INTO zoi.listings(slug,name,address,website)VALUES('preferred','Greek Bakery Athens','1 Main','https://example.invalid');`);
  assert.equal(await sql('SELECT count(*) FROM public.seo_index();'),'5');
  assert.equal(await sql("SELECT public.seo_entity('branch-one')->>'canonical_slug';"),'preferred');
 });
 await t.test('literal city punctuation never becomes a regex or breaks rendering',async()=>{
  await sql("INSERT INTO zoi.listings(slug,name,city)VALUES('punctuation','Bakery [City','[City');");
  assert.equal(await sql("SELECT public.seo_entity('punctuation')->>'name';"),'Bakery [City');
 });
 await t.test('pagination is stable across timestamp updates and stats match index',async()=>{
  const first=await sql('SELECT string_agg(slug,\',\') FROM public.seo_index(2,0);');
  await sql("UPDATE zoi.listings SET updated_at=now()+interval '1 day' WHERE slug='greek-two';");
  assert.equal(await sql('SELECT string_agg(slug,\',\') FROM public.seo_index(2,0);'),first);
  assert.equal(await sql("SELECT (public.seo_sitemap_stats()->>'count')::integer=(SELECT count(*) FROM public.seo_index());"),'t');
  assert.equal(await sql('SELECT count(*) FROM (SELECT slug FROM public.seo_index(2,0) INTERSECT SELECT slug FROM public.seo_index(2,2))x;'),'0');
 });
 await t.test('public home actions follow enabled ownership and published upcoming programs',async()=>{
  const ws='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002';
  await sql(`INSERT INTO zoi.listings(slug,name,owner_workspace_id)VALUES('workflow-home','Workflow Home','${ws}');INSERT INTO zoi.booking_settings SELECT id,'${ws}',true FROM zoi.listings WHERE slug='workflow-home';INSERT INTO zoi.org_programs VALUES('${ws}','${ws}','draft');INSERT INTO zoi.org_shifts VALUES('${ws}','${ws}','scheduled',now()+interval '1 day');`);
  assert.match(await sql("SELECT public.seo_entity('workflow-home')->>'booking_url';"),/^\/book\/\?listing=/);
  assert.equal(await sql("SELECT public.seo_entity('workflow-home') ? 'volunteer_url';"),'f');
  await sql(`UPDATE zoi.org_programs SET status='published';`);
  assert.equal(await sql("SELECT public.seo_entity('workflow-home')->>'volunteer_url';"),'/volunteer/?workspace='+ws);
  await sql(`UPDATE zoi.booking_settings SET workspace_id='${other}';UPDATE zoi.org_shifts SET status='cancelled';`);
  assert.equal(await sql("SELECT public.seo_entity('workflow-home') ?| array['booking_url','volunteer_url'];"),'f');
  await sql("UPDATE zoi.listings SET publish_status='draft' WHERE slug='workflow-home';");
  assert.equal(await sql("SELECT public.seo_entity('workflow-home') IS NULL;"),'t');
 });
 await t.test('public grants expose only reviewed public entry points',async()=>{
  assert.equal(await sql("SELECT has_function_privilege('anon','zoi.seo_canonical_rows()','EXECUTE');"),'f');
  assert.equal(await sql("SELECT has_function_privilege('anon','public.seo_index(integer,integer)','EXECUTE');"),'t');
 });
});
