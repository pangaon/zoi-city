#!/usr/bin/env node
// Real isolated PostgreSQL transactions; no Supabase/network calls.
// Requires PostgreSQL16 server binaries installed. Run explicitly with node.
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
import {createLayout,seatRows} from '../../assets/tickets/venue-model.mjs';
const run=promisify(execFile),dir=mkdtempSync(join(tmpdir(),'zoi-seats-pg-')),bin=process.env.PG_BIN||'/usr/lib/postgresql/16/bin';
const port=15481;const env={...process.env,PGHOST:dir,PGPORT:String(port),PGDATABASE:'postgres'};
const actor='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',member='00000000-0000-4000-8000-000000000003',ws='10000000-0000-4000-8000-000000000001',event='20000000-0000-4000-8000-000000000001';
const literal=x=>"'"+String(x).replace(/'/g,"''")+"'";
const sql=(query,user)=>`${user?`set role authenticated;select set_config('request.jwt.claim.sub','${user}',false);`:''}${query}`;
async function query(q,user){const r=await run(join(bin,'psql'),['-X','-qAt','-v','ON_ERROR_STOP=1','-c',sql(q,user)],{env});return r.stdout.trim().split('\n').filter(Boolean).at(-1);}
async function rejects(q,user,pattern){try{await query(q,user);assert.fail('Expected SQL rejection');}catch(e){assert.match(e.stderr||e.message,pattern);}}
let started=false,checks=0;
const pass=name=>{checks++;console.log('PASS '+name);};
try{
 execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-A','trust','--no-locale'],{stdio:'ignore'});
 execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'server.log'),'-o',`-k ${dir} -p ${port} -c listen_addresses=''`,'-w','start'],{stdio:'ignore'});started=true;
 await query(readFileSync(new URL('./venue-fixture.sql',import.meta.url),'utf8'));
 await query(readFileSync(new URL('../../supabase/migrations/20260930001839_venue_plans_and_atomic_seat_holds.sql',import.meta.url),'utf8'));
 const bookingFixture="alter table zoi.listings add column name text default 'QA business';create table public.menu_items(id uuid default gen_random_uuid(),workspace_id uuid,name text,description text,price_cents integer,currency text,station text,is_available boolean,sort_order integer);";
 await query(bookingFixture);
 await query(readFileSync(new URL('../../supabase/migrations/20260930004059_booking_services_resources_and_reservations.sql',import.meta.url),'utf8'));
 const call=(fn,args,user=actor)=>query(`select public.${fn}(${args});`,user).then(JSON.parse);
 await call('booking_settings_save',`'${ws}',0,'${event}','Europe/Athens','EUR',true`);
 await rejects(`select public.booking_settings_save('${ws}',1,'${event}','Europe/Athens','EUR',true);`,member,/workspace_permission_denied/);
 await rejects(`select public.booking_settings_save('${ws}',0,'${event}','Europe/Athens','EUR',true);`,actor,/version_conflict/);pass('owner settings with real timezone and optimistic version; member rejected');
 await rejects(`select public.booking_item_save('${ws}','service',null,null,'{"name":"QA","duration_minutes":60,"buffer_minutes":0,"price_cents":0,"active":true}');`,actor,/version_conflict/);
 await rejects(`select public.booking_item_save('${ws}','resource',null,null,'{"name":"QA","kind":"staff","capacity":1,"active":true}');`,actor,/version_conflict/);pass('null creation versions rejected for services and resources');
 const service=(await call('booking_item_save',`'${ws}','service',null,0,'{"name":"Haircut","duration_minutes":60,"buffer_minutes":15,"price_cents":3500,"active":true}'`)).item;
 const staff=(await call('booking_item_save',`'${ws}','resource',null,0,'{"name":"Stylist One","kind":"staff","capacity":1,"active":true}'`)).item;
 const table=(await call('booking_item_save',`'${ws}','resource',null,0,'{"name":"Table One","kind":"table","capacity":4,"active":true}'`)).item;
 const time=new Date(Date.now()+86400000).toISOString();
 const slot=(await call('booking_slot_save',`'${ws}',null,0,'${service.id}','${staff.id}','${time}',true`)).slot;
 const overlap=new Date(Date.parse(time)+65*60000).toISOString();
 await rejects(`select public.booking_slot_save('${ws}',null,0,'${service.id}','${staff.id}','${overlap}',true);`,actor,/availability_overlap/);pass('salon buffer prevents overlapping availability');
 const next=new Date(Date.parse(time)+75*60000).toISOString();
 await call('booking_slot_save',`'${ws}',null,0,'${service.id}','${staff.id}','${next}',true`);pass('adjacent availability after buffer allowed');
 await rejects(`select public.booking_slot_save('${ws}',null,null,'${service.id}','${staff.id}','${time}',true);`,actor,/version_conflict/);pass('null creation version rejected for availability');
 const tableSlot=(await call('booking_slot_save',`'${ws}',null,0,'${service.id}','${table.id}','${time}',true`)).slot;
 await rejects(`select public.booking_create('${tableSlot.id}',gen_random_uuid(),'QA','qa@example.invalid',5,1);`,other,/party_exceeds_capacity/);pass('restaurant party cannot exceed table capacity');
 await rejects(`select public.booking_create('${slot.id}',gen_random_uuid(),'QA','qa@example.invalid',1,0);`,other,/slot_version_conflict/);pass('stale customer time/price version rejected before booking');
 const requestIds=['70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000002'];
 const outcomes=await Promise.allSettled([call('booking_create',`'${slot.id}','${requestIds[0]}','QA','qa@example.invalid',1,1`,actor),call('booking_create',`'${slot.id}','${requestIds[1]}','QA','qa@example.invalid',1,1`,other)]);
 assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);const win=outcomes.findIndex(r=>r.status==='fulfilled'),who=win===0?actor:other,loser=win===0?other:actor,b=outcomes[win].value.booking;
 assert.equal((await call('booking_create',`'${slot.id}','${requestIds[win]}','QA','qa@example.invalid',1,1`,who)).booking.id,b.id);pass('concurrent salon reservations have one winner and idempotent retry');
 await rejects(`select public.booking_create('${tableSlot.id}','${requestIds[win]}','QA','qa@example.invalid',1,1);`,who,/request_id_conflict/);
 await rejects(`select public.booking_status_set('${b.id}',1,'cancelled');`,loser===actor?member:loser,/booking_not_owned/);pass('request reuse and other customer cancellation denied');
 await rejects(`select public.booking_slot_save('${ws}','${slot.id}',1,'${service.id}','${staff.id}','${next}',false);`,actor,/slot_has_reservation/);pass('operator cannot move occupied slot');
 const from=new Date(Date.now()).toISOString(),to=new Date(Date.now()+7*86400000).toISOString();
 const catalog=await call('booking_catalog',`'${event}','${from}','${to}'`,other);assert.equal(catalog.slots.some(s=>s.id===slot.id),false);assert.equal(JSON.stringify(catalog).includes('qa@example'),false);pass('public availability excludes booked slot and customer PII');
 assert.equal((await call('booking_my_list',`'${event}'`,who)).bookings.length,1);
 assert.equal((await call('booking_my_list',`'${event}'`,loser)).bookings.length,0);pass('customer history isolated');
 assert.equal((await call('booking_status_set',`'${b.id}',1,'cancelled'`,who)).booking.status,'cancelled');
 assert.equal((await call('booking_status_set',`'${b.id}',1,'cancelled'`,who)).booking.version,2);
 const rebook=await call('booking_create',`'${slot.id}',gen_random_uuid(),'QA','qa@example.invalid',1,1`,loser);assert.equal(rebook.booking.status,'confirmed');pass('cancellation idempotent and inventory reusable');
 await rejects(`select public.booking_status_set('${rebook.booking.id}',1,'completed');`,actor,/booking_not_started/);
 await rejects(`select public.booking_operator_list('${ws}','${from}','${to}');`,member,/workspace_permission_denied/);
 await rejects('select * from zoi.bookings;',other,/permission denied/);pass('operator roles and private data protected');
 await query(`insert into public.menu_items(workspace_id,name,price_cents,currency,station,is_available,sort_order) values('${ws}','Zeta',100,'EUR','kitchen',true,1),('${ws}','Alpha',200,'EUR','kitchen',true,2);`);
 const alternative='20000000-0000-4000-8000-000000000002';
 await query(`insert into zoi.listings(id,owner_workspace_id,entity_type,publish_status,marketplace_status) values('${alternative}','${ws}','business','published','');`);
 await rejects(`select public.booking_settings_save('${ws}',1,'${alternative}','Europe/Athens','EUR',true);`,actor,/booking_listing_is_immutable/);pass('existing schedule cannot move its customer history to another business');
 await query(`update zoi.listings set owner_workspace_id='10000000-0000-4000-8000-000000000002' where id='${event}';`);
 assert.equal((await call('booking_catalog',`'${event}','${from}','${to}'`)).available,false);
 await rejects(`select public.booking_create('${tableSlot.id}',gen_random_uuid(),'QA','qa@example.invalid',1,1);`,actor,/booking_unavailable/);
 await query(`update zoi.listings set owner_workspace_id='${ws}' where id='${event}';`);pass('transferred business hides old scheduler and rejects stale booking links');
 await rejects('select * from zoi.booking_audit;',other,/permission denied/);
 const operatorView=await call('booking_operator_list',`'${ws}','${from}','${to}'`);assert.equal(operatorView.ok,true);assert.equal(operatorView.services.length,1);assert.equal(operatorView.bookings.length,2);pass('operator sees persisted resources, slots and actual customer bookings');
 assert.equal(operatorView.audit.length,3);assert.equal(operatorView.audit.filter(a=>a.action==='created').length,2);const transition=operatorView.audit.find(a=>a.action==='status_changed');assert.equal(transition.before_status,'confirmed');assert.equal(transition.after_status,'cancelled');assert.equal(transition.actor_profile_id,who);assert.equal(transition.booking_version,2);assert.ok(transition.created_at);pass('private audit records actor/time/transition exactly once for idempotent changes');
 const menu=await call('menu_items_list',`'${ws}'`);assert.deepEqual(menu.items.map(i=>i.name),['Zeta','Alpha']);assert.equal('sort_order' in menu.items[0],false);pass('menu list fixed real sort order with preserved response fields');
 console.log(`# ${checks} booking database checks passed`);
}finally{
 if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'ignore'});
 rmSync(dir,{recursive:true,force:true});
}
