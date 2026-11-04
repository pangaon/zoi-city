#!/usr/bin/env node
// Isolated PostgreSQL only. No production URL, credentials or network calls.
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';

const run = promisify(execFile);
const bin = process.env.PG_BIN || ['/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/15/bin'].find(p => existsSync(join(p, 'initdb')));
if (!bin) throw Error('Isolated PostgreSQL binaries required. Set PG_BIN; no production fallback is permitted.');
const dir = mkdtempSync(join(tmpdir(), 'zoi-mesa-pg-'));
const env = { ...process.env, PGHOST: dir, PGPORT: String(process.env.MESA_PG_PORT || 15553), PGDATABASE: 'postgres', PGUSER: 'postgres' };
const owner = '00000000-0000-4000-8000-000000000001', vendor = '00000000-0000-4000-8000-000000000002', outsider = '00000000-0000-4000-8000-000000000003';
const ws = '10000000-0000-4000-8000-000000000001', vws = '10000000-0000-4000-8000-000000000002';
const event = '20000000-0000-4000-8000-000000000001', event2 = '20000000-0000-4000-8000-000000000002', biz = '20000000-0000-4000-8000-000000000003', sameWsBiz = '20000000-0000-4000-8000-000000000004';
const pkg = '30000000-0000-4000-8000-000000000001', app = '40000000-0000-4000-8000-000000000001', app2 = '40000000-0000-4000-8000-000000000002';
const boothId = '50000000-0000-4000-8000-000000000001';
let serial = 0, started = false, checks = 0;
const request = () => '60000000-0000-4000-8000-' + String(++serial).padStart(12, '0');
const literal = s => s === null ? 'null' : "'" + String(s).replaceAll("'", "''") + "'";
const json = v => literal(JSON.stringify(v)) + '::jsonb';
const source = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const sql = (query, actor, role = 'authenticated', session = actor) => actor
  ? `set role ${role};select set_config('request.jwt.claim.sub',${literal(actor)},false);select set_config('request.jwt.claims',${json({ sub: actor, session_id: session })}::text,false);${query}`
  : role === 'anon' ? `set role anon;${query}` : query;
async function query(q, actor, role, session) {
  const r = await run(join(bin, 'psql'), ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql(q, actor, role, session)], { env, timeout: 20000, maxBuffer: 4 * 1024 * 1024 });
  return r.stdout.trim().split('\n').filter(Boolean).at(-1);
}
async function call(name, args, actor = owner) { return JSON.parse(await query(`select public.${name}(${args});`, actor)); }
async function rejects(q, actor, pattern, role, session) {
  await assert.rejects(query(q, actor, role, session), error => { assert.match(error.stderr || error.message, pattern); return true; });
}
function pass(name) { checks++; console.log('PASS ' + name); }
function definition(text, name) {
  const match = new RegExp('create(?: or replace)? function ' + name.replace('.', '\\.') + '\\(', 'i').exec(text);
  assert.ok(match, 'actual authority definition exists: ' + name);
  const tail = text.slice(match.index), opening = /\bAS\s+(\$[a-z_]*\$)/i.exec(tail);
  assert.ok(opening); const end = tail.indexOf(opening[1] + ';', opening.index + opening[0].length);
  assert.ok(end > 0); return tail.slice(0, end + opening[1].length + 1);
}
const physical = (application = app, extra = {}) => ({ id: boothId, label: 'B1', x_m: 5, y_m: 5, width_m: 2, height_m: 3, rotation: 0, application_id: application, ...extra });
const layout = booths => ({ schema: 1, width_m: 30, height_m: 20, booths });
const save = (version, value, req = request(), eid = event) => call('festival_map_save', `${literal(ws)},${literal(eid)},${version},${literal(req)},${json(value)}`);
const publish = (version, req = request(), eid = event) => call('festival_map_publish', `${literal(ws)},${literal(eid)},${version},${literal(req)}`);
const bind = (version, req = request(), listing = biz, workspace = vws, application = app, actor = vendor) => call('festival_vendor_bind', `${literal(application)},${literal(workspace)},${literal(listing)},${version},${literal(req)}`, actor);
const review = (version, action = 'accept', application = app, req = request()) => call('festival_vendor_review', `${literal(ws)},${literal(application)},${version},${literal(action)},${literal(req)}`);
const publicMap = (eid = event) => query(`select public.festival_map_public(${literal(eid)});`, null, 'anon').then(JSON.parse);

try {
  execFileSync(join(bin, 'initdb'), ['-D', join(dir, 'data'), '-U', 'postgres', '-A', 'trust', '--no-locale'], { stdio: 'pipe' });
  execFileSync(join(bin, 'pg_ctl'), ['-D', join(dir, 'data'), '-l', join(dir, 'server.log'), '-o', `-k ${dir} -p ${env.PGPORT} -c listen_addresses=''`, '-w', 'start'], { stdio: 'pipe' });
  started = true;
  await query(`
    create role anon;create role authenticated;create schema auth;create schema zoi;
    create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,deleted_at timestamptz,is_anonymous boolean default false,banned_until timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
    create table zoi.user_profiles(id uuid primary key,auth_user_id uuid unique);
    create table zoi.workspaces(id uuid primary key,owner_profile_id uuid);
    create table zoi.workspace_members(workspace_id uuid,profile_id uuid,role text,primary key(workspace_id,profile_id));
    create table zoi.listings(id uuid primary key,owner_workspace_id uuid,entity_type text,publish_status text,marketplace_status text,moderation_status text,name text,slug text,profile jsonb default '{}');
    create table zoi.listing_claims(listing_id uuid,workspace_id uuid,claim_status text);
    create table zoi.festival_packages(id uuid primary key,workspace_id uuid,event_id uuid,kind text);
    create table zoi.festival_applications(id uuid primary key,package_id uuid,workspace_id uuid,event_id uuid,profile_id uuid,terms jsonb,units integer,status text,version integer,data jsonb,created_at timestamptz default now());
    create table zoi.test_home_projection(listing_id uuid primary key,payload jsonb);
    -- Explicit projection stub: tests the MESA consumer, not the existing public-home pipeline.
    create function public.home_entity(p_slug text)returns jsonb language sql stable security definer set search_path='' as $$
      select jsonb_build_object('id',l.id,'slug',l.slug,'canonical_slug',l.slug,'name',l.name,'entity_type',l.entity_type,'profile',l.profile)||coalesce(p.payload,'{}') from zoi.listings l left join zoi.test_home_projection p on p.listing_id=l.id where l.slug=p_slug and l.publish_status='published' and l.moderation_status in('clean','cleared') and coalesce(l.marketplace_status,'')<>'hidden'
    $$;
    create function zoi.org_actor()returns uuid language sql stable security definer set search_path='' as $$select id from zoi.user_profiles where auth_user_id=auth.uid()$$;
    create function zoi.bizpage_can_edit(w uuid,l uuid)returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from zoi.listings x join zoi.workspace_members m on m.workspace_id=x.owner_workspace_id where x.id=l and x.owner_workspace_id=w and m.profile_id=zoi.org_actor()and m.role in('owner','admin','editor'))$$;
    insert into auth.users(id,email,email_confirmed_at)values('${owner}','owner@example.test',now()),('${vendor}','vendor@example.test',now()),('${outsider}','outsider@example.test',now());
    insert into auth.sessions(id,user_id)select id,id from auth.users;
    insert into zoi.user_profiles select id,id from auth.users;
    insert into zoi.workspaces values('${ws}','${owner}'),('${vws}','${vendor}');
    insert into zoi.workspace_members values('${ws}','${owner}','owner'),('${vws}','${vendor}','owner'),('${ws}','${outsider}','viewer');
    insert into zoi.listings values('${event}','${ws}','event','published','','clean','MESA QA Festival','mesa-qa-festival','{}'),('${event2}','${ws}','organization','published','','clean','MESA QA Organization','mesa-qa-org','{}'),('${biz}','${vws}','business','published','','clean','Public Vendor','public-vendor','{"logo_url":"https://example.test/source-logo.png"}'),('${sameWsBiz}','${ws}','business','published','','clean','Organizer Business','organizer-business','{}');
    insert into zoi.festival_packages values('${pkg}','${ws}','${event}','booth');
    insert into zoi.festival_applications(id,package_id,workspace_id,event_id,profile_id,terms,units,status,version,data)values('${app}','${pkg}','${ws}','${event}','${vendor}','{"kind":"booth"}',1,'approved',1,'{"organisation":"PRIVATE APPLICANT","contact_email":"PRIVATE@example.test","notes":"PRIVATE NOTE"}'),('${app2}','${pkg}','${ws}','${event}','${vendor}','{"kind":"booth"}',1,'approved',1,'{"organisation":"PRIVATE SECOND"}');
  `);
  const authority = source('supabase/migrations/20261001170000_workspace_current_authority.sql');
  for (const name of ['zoi.suite_current_session', 'zoi.suite_lock_session', 'zoi.workspace_current_role', 'zoi.workspace_locked_role']) await query(definition(authority, name));
  await query(`create function zoi.workspace_invitation_email(boolean)returns text language plpgsql security definer set search_path='' as $$begin perform zoi.suite_lock_session();return(select email from auth.users where id=auth.uid()and email_confirmed_at is not null);end$$;`);
  await query(definition(source('supabase/migrations/20261003052809_home_content_current_session.sql'), 'zoi.home_content_authorize'));
  await query(source('supabase/migrations/20261104183348_mesa_festival_maps.sql'));
  pass('migration installs against actual current session/workspace/home-authority bodies');

  assert.deepEqual(await publicMap(), { ok: true, available: false });
  await rejects(`select public.festival_map_operator('${ws}','${event}');`, outsider, /mesa_permission_denied/);
  await rejects(`select public.festival_map_operator('${vws}','${event}');`, vendor, /mesa_event_unavailable/);
  await rejects(`select public.festival_vendor_businesses('${app}');`, owner, /mesa_application_not_owned/);
  await rejects(`select public.festival_map_operator('${ws}','${event}');`, owner, /suite_session_unavailable/, undefined, outsider);
  await rejects('select * from zoi.festival_maps;', vendor, /permission denied/);
  await rejects('select zoi.mesa_map_value(null);', vendor, /permission denied/);
  pass('wrong workspace, unrelated applicant, invalid session and direct private reads denied');

  const choices = await call('festival_vendor_businesses', literal(app), vendor);
  assert.equal(choices.version, 0); assert.equal(choices.choices.length, 1); assert.equal(choices.choices[0].listing_id, biz);
  await rejects(`select public.festival_vendor_bind('${app}','${ws}','${sameWsBiz}',0,'${request()}');`, vendor, /not_authorized|no_access_to_listing/);
  pass('vendor choices and binding use existing business authority rather than typed organization');

  const bindingRequests = [request(), request()];
  const concurrentBinding = await Promise.allSettled(bindingRequests.map(req => bind(0, req)));
  assert.equal(concurrentBinding.filter(r => r.status === 'fulfilled').length, 1);
  assert.match(concurrentBinding.find(r => r.status === 'rejected').reason.stderr, /mesa_version_conflict/);
  const bindingWinner = concurrentBinding.findIndex(r => r.status === 'fulfilled');
  assert.deepEqual(await bind(0, bindingRequests[bindingWinner]), concurrentBinding[bindingWinner].value);
  await assert.rejects(bind(1, bindingRequests[bindingWinner]), /mesa_request_conflict/);
  await query(`delete from zoi.workspace_members where workspace_id='${vws}'and profile_id='${vendor}';`);
  await assert.rejects(bind(0, bindingRequests[bindingWinner]), /not_authorized/);
  await query(`insert into zoi.workspace_members values('${vws}','${vendor}','owner');`);
  assert.equal((await call('festival_vendor_businesses', literal(app), vendor)).binding.state, 'proposed');
  const accepted = await review(1); assert.equal(accepted.binding.version, 2);
  pass('concurrent initial business bindings cannot bypass version0 CAS; organizer acceptance is explicit');

  const firstRequest = request(), first = await save(0, layout([physical()]), firstRequest);
  assert.equal(first.map.version, 1); assert.deepEqual(await save(0, layout([physical()]), firstRequest), first);
  await assert.rejects(save(0, layout([])), /mesa_version_conflict/);
  await assert.rejects(save(0, layout([]), firstRequest), /mesa_request_conflict/);
  assert.equal((await publicMap()).available, false);
  pass('draft save, exact retry, stale version and changed-payload request behavior');

  const initialPublish = await publish(1); assert.equal(initialPublish.map.version, 2);
  let pub = await publicMap(); assert.equal(pub.layout.booths[0].business.name, 'Public Vendor');
  assert.equal(pub.layout.booths[0].business.href, '/business/public-vendor');
  const publicJSON = JSON.stringify(pub);
  for (const privateValue of [app, ws, vws, vendor, 'application_id', 'PRIVATE', 'contact_email', 'draft', 'terms']) assert.ok(!publicJSON.includes(privateValue), privateValue + ' stays private');
  pass('published attendee projection exposes only physical booths and public business identity');

  const draft3 = await save(2, layout([physical(app, { label: 'B2', x_m: 12 })])); assert.equal(draft3.map.version, 3);
  assert.equal((await publicMap()).layout.booths[0].label, 'B1');
  pass('editing a new private draft retains the prior published layout');

  await assert.rejects(save(3, layout([physical(), physical(app, { id: '50000000-0000-4000-8000-000000000002', x_m: 10 })])), /mesa_application_units_exceeded/);
  await assert.rejects(save(3, layout([physical(null), physical(null)])), /mesa_duplicate_booth/);
  await assert.rejects(save(3, layout([physical(null, { x_m: 0 })])), /mesa_booth_outside_site/);
  await assert.rejects(save(3, layout([physical(null, { rotation: 45 })])), /mesa_invalid_rotation/);
  await assert.rejects(save(3, layout([physical(null, { unexpected: 'private' })])), /mesa_invalid_booth/);
  pass('allocation units, unique IDs, bounds, allowed rotation and exact schema validated');

  const overlapping = layout([physical(), physical(null, { id: '50000000-0000-4000-8000-000000000002', x_m: 5.5 })]);
  await save(3, overlapping); await assert.rejects(publish(4), /mesa_booth_collision/);
  assert.equal((await publicMap()).version, 2);
  await save(4, layout([physical()])); await publish(5);
  pass('draft overlaps allowed; publication collision rejects atomically without replacing live snapshot');

  await query(`insert into zoi.test_home_projection values('${biz}','{"owner_content":{"profile":{"logo_url":null,"name":"Published Name"}}}');`);
  pub = await publicMap(); assert.equal(pub.layout.booths[0].business.logo, null); assert.equal(pub.layout.booths[0].business.name, 'Published Name');
  await query(`update zoi.test_home_projection set payload='{"owner_content":{"name":null}}'where listing_id='${biz}';`);
  assert.equal((await publicMap()).layout.booths[0].business, null);
  await query(`delete from zoi.test_home_projection;`);
  pass('published owner names win and explicit logo/name clears do not resurrect source identity');

  await query(`update zoi.festival_applications set status='withdrawn',version=version+1 where id='${app}';`);
  pub = await publicMap(); assert.equal(pub.layout.booths[0].business, null); assert.equal(pub.layout.booths[0].label, 'Booth 1');
  const revoked = await bind(2, request(), null, null); assert.equal(revoked.binding.state, 'revoked');
  await query(`update zoi.festival_applications set status='approved'where id='${app}';`);
  await bind(3); await review(4);
  await query(`update zoi.listings set owner_workspace_id='${ws}'where id='${biz}';`);
  assert.equal((await publicMap()).layout.booths[0].business, null);
  await assert.rejects(bind(5), /no_access_to_listing|mesa_business_unavailable/);
  await query(`update zoi.listings set owner_workspace_id='${vws}'where id='${biz}';`);
  pass('withdrawal, own revoke after closure and changed business ownership remove public representation');

  const firstSaves = await Promise.allSettled([save(0, layout([]), request(), event2), save(0, layout([]), request(), event2)]);
  assert.equal(firstSaves.filter(r => r.status === 'fulfilled').length, 1);
  assert.match(firstSaves.find(r => r.status === 'rejected').reason.stderr, /mesa_version_conflict/);
  await publish(1, request(), event2); assert.equal((await publicMap(event2)).available, true);
  pass('different-request concurrent first saves have one winner; organization hosts preserve festival semantics');

  // Applicant legitimately manages a business in the organizer workspace.
  await query(`insert into zoi.workspace_members values('${ws}','${vendor}','editor');`);
  await bind(0, request(), sameWsBiz, ws, app2);
  const concurrent = await Promise.allSettled([publish(6), bind(1, request(), sameWsBiz, ws, app2)]);
  assert.equal(concurrent.filter(r => r.status === 'fulfilled').length, 2);
  pass('same-workspace vendor bind and organizer publish complete without lock-order deadlock');

  const pkg2 = '30000000-0000-4000-8000-000000000002', pkg3 = '30000000-0000-4000-8000-000000000003';
  const app3 = '40000000-0000-4000-8000-000000000003', app4 = '40000000-0000-4000-8000-000000000004';
  await query(`insert into zoi.festival_packages values('${pkg2}','${ws}','${event2}','booth'),('${pkg3}','${vws}','${biz}','booth');
    insert into zoi.festival_applications(id,package_id,workspace_id,event_id,profile_id,terms,units,status,version,data)values('${app3}','${pkg2}','${ws}','${event2}','${vendor}','{"kind":"booth"}',1,'approved',1,'{}'),('${app4}','${pkg3}','${vws}','${biz}','${owner}','{"kind":"booth"}',1,'approved',1,'{}');`);
  const reversed = await Promise.allSettled([bind(0, request(), biz, vws, app3, vendor), bind(0, request(), event2, ws, app4, owner)]);
  assert.equal(reversed.filter(r => r.status === 'fulfilled').length, 2, reversed.map(r => r.reason?.stderr).join('\n'));
  pass('reversed business-host bindings lock both listing IDs in the same order across different events');

  const homeEditor = query(`begin;set application_name='mesa-home-editor';select id from zoi.user_profiles where id='${vendor}'for update;select pg_sleep(0.3);select zoi.home_content_authorize('${vws}','${biz}');commit;`, vendor, 'postgres');
  let editorWaiting = false;
  for (let i = 0; i < 100; i++) {
    if (Number(await query("select count(*)from pg_stat_activity where application_name='mesa-home-editor'and wait_event='PgSleep';"))) { editorWaiting = true; break; }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.ok(editorWaiting, 'existing home editor holds profile before trying listing');
  const editorAndBind = await Promise.allSettled([homeEditor, bind(2, request(), biz, vws, app2)]);
  assert.equal(editorAndBind.filter(r => r.status === 'fulfilled').length, 2, editorAndBind.map(r => r.reason?.stderr).join('\n'));
  pass('MESA binding preserves existing owner editor profile-before-listing lock order');

  await query(`update zoi.listings set marketplace_status='hidden'where id='${event}';`);
  assert.equal((await publicMap()).available, false);
  await query(`update zoi.listings set marketplace_status='',owner_workspace_id='${vws}'where id='${event}';`);
  assert.equal((await publicMap()).available, false);
  await rejects(`select public.festival_map_operator('${ws}','${event}');`, owner, /mesa_event_unavailable/);
  await query(`update zoi.listings set owner_workspace_id='${ws}'where id='${event}';delete from auth.sessions where user_id='${owner}';`);
  await assert.rejects(save(0, layout([physical()]), firstRequest), /suite_session_unavailable/);
  pass('hidden/transferred hosts and revoked sessions invalidate public/private access, including old receipt retries');

  assert.equal(await query("select count(*)from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='zoi'and c.relname in('festival_maps','festival_vendor_bindings','festival_map_requests','festival_map_audit')and c.relrowsecurity;"), '4');
  assert.ok(Number(await query('select count(*)from zoi.festival_map_audit;')) > 10);
  pass('all four private tables retain RLS and persisted mutations have audit evidence');
  console.log(`MESA isolated PostgreSQL: ${checks} groups passed.`);
} finally {
  if (started) execFileSync(join(bin, 'pg_ctl'), ['-D', join(dir, 'data'), '-m', 'immediate', '-w', 'stop'], { stdio: 'ignore' });
  rmSync(dir, { recursive: true, force: true });
}
