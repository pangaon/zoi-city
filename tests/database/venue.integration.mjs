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
const port=15480;const env={...process.env,PGHOST:dir,PGPORT:String(port),PGDATABASE:'postgres'};
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
 const layout=JSON.stringify(seatRows(createLayout()));
 const saved=JSON.parse(await query(`select public.venue_plan_save('${ws}',null,0,${literal(layout)});`,actor));
 assert.equal(saved.revision,1);pass('owner saves real revision1');
 await rejects(`select public.venue_plan_get('${ws}','${saved.plan_id}');`,other,/workspace_permission_denied/);
 await rejects(`select public.venue_plan_save('${ws}','${saved.plan_id}',1,${literal(layout)});`,member,/workspace_permission_denied/);pass('cross-workspace reads and member writes denied');
 await query(`select public.venue_plan_save('${ws}','${saved.plan_id}',1,${literal(layout)});`,actor);
 await rejects(`select public.venue_plan_save('${ws}','${saved.plan_id}',1,${literal(layout)});`,actor,/revision_conflict/);pass('stale revision cannot overwrite current draft');
 await rejects(`select public.venue_plan_publish('${ws}','${saved.plan_id}',2,'${event}',1);`,actor,/seat_inventory_not_enabled/);pass('publication disabled until deployment verification');
 await query('update zoi.seating_runtime set enabled=true;');
 await query(`select public.venue_plan_publish('${ws}','${saved.plan_id}',2,'${event}',1);`,actor);
 const requests=['30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002'];
 const outcomes=await Promise.allSettled([query(`select public.tickets_seat_hold('${event}',array['row-0-0'],'${requests[0]}');`,actor),query(`select public.tickets_seat_hold('${event}',array['row-0-0'],'${requests[1]}');`,other)]);
 assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal(outcomes.filter(r=>r.status==='rejected').length,1);pass('concurrent competing holds produce exactly one winner');
 const win=outcomes.findIndex(r=>r.status==='fulfilled'),who=win===0?actor:other,loser=win===0?other:actor;
 const hold=JSON.parse(outcomes[win].value);
 const duplicate=JSON.parse(await query(`select public.tickets_seat_hold('${event}',array['row-0-0'],'${requests[win]}');`,who));assert.equal(duplicate.hold_id,hold.hold_id);pass('idempotent hold returns same hold');
 await rejects(`select public.tickets_seat_release('${hold.hold_id}');`,loser,/hold_not_owned/);
 await rejects(`select public.tickets_seat_reserve('${hold.hold_id}','Test','test@example.com');`,loser,/hold_not_owned/);pass('other account cannot release or spend hold');
 await rejects(`select public.tickets_reserve('${event}',1,'Test','test@example.com',1);`,who,/choose_seats_for_this_event/);
 assert.equal(await query('select reserved from zoi.ticket_types where id=1;'),'0');pass('legacy reservation bypass rejected and counter rolled back');
 const receipt=JSON.parse(await query(`select public.tickets_seat_reserve('${hold.hold_id}','Test','test@example.com');`,who));
 const repeat=JSON.parse(await query(`select public.tickets_seat_reserve('${hold.hold_id}','Test','test@example.com');`,who));
 assert.equal(receipt.code,repeat.code);assert.equal(await query('select count(*) from zoi.ticket_reservations;'),'1');assert.equal(await query('select reserved from zoi.ticket_types where id=1;'),'1');pass('reservation and repeat commit exactly one real receipt/counter');
 const h2=JSON.parse(await query(`select public.tickets_seat_hold('${event}',array['row-0-1'],'40000000-0000-4000-8000-000000000001');`,loser));
 await query(`update zoi.seat_holds set expires_at=now()-interval '1 second' where id='${h2.hold_id}';`);
 await rejects(`select public.tickets_seat_reserve('${h2.hold_id}','Test','test@example.com');`,loser,/hold_expired/);
 const reclaimed=JSON.parse(await query(`select public.tickets_seat_hold('${event}',array['row-0-1'],'40000000-0000-4000-8000-000000000002');`,who));pass('expired hold cannot spend and seat can be reclaimed');
 await query(`create function public.test_bad_receipt() returns trigger language plpgsql as $$begin new.code:=null;return new;end$$;create trigger zz_test_bad_receipt before insert on zoi.ticket_reservations for each row execute function public.test_bad_receipt();`);
 await rejects(`select public.tickets_seat_reserve('${reclaimed.hold_id}','Test','test@example.com');`,who,/reservation_not_confirmed/);
 assert.equal(await query('select reserved from zoi.ticket_types where id=1;'),'1');assert.equal(await query('select count(*) from zoi.ticket_reservations;'),'1');
 assert.equal(await query(`select status from zoi.seat_holds where id='${reclaimed.hold_id}';`),'active');pass('invalid receipt rolls back inventory and reservation atomically');
 await query('drop trigger zz_test_bad_receipt on zoi.ticket_reservations;');
 await query(`select public.tickets_seat_release('${reclaimed.hold_id}');`,who);await query(`select public.tickets_seat_release('${reclaimed.hold_id}');`,who);pass('release is safe to repeat');
 await rejects('select * from zoi.seat_holds;',actor,/permission denied/);pass('private hold table remains inaccessible');
 await rejects('update zoi.ticket_types set price_cents=500 where id=1;',undefined,/published_seating_tier_is_immutable/);pass('seated free tier cannot silently become paid');
 const history=JSON.parse(await query(`select public.tickets_seat_status('${event}');`,who));assert.equal(history.reservations.length,1);assert.equal(history.reservations[0].receipt.code,receipt.code);pass('signed-in account restores its reservation receipt');
 const stranger=loser===actor?member:loser;
 await rejects(`select public.tickets_seat_cancel('${hold.hold_id}');`,stranger,/hold_not_owned/);
 const cancelled=JSON.parse(await query(`select public.tickets_seat_cancel('${hold.hold_id}');`,who));assert.equal(cancelled.cancelled,true);
 await query(`select public.tickets_seat_cancel('${hold.hold_id}');`,who);
 assert.equal(await query('select reserved from zoi.ticket_types where id=1;'),'0');
 assert.equal(await query(`select status from zoi.ticket_reservations where seat_hold_id='${hold.hold_id}';`),'cancelled');
 assert.equal(await query("select count(*) from zoi.seat_inventory where reservation_code is not null;"),'0');pass('cancellation is authorized, atomic and idempotent');
 await query(`select public.tickets_seat_release('${hold.hold_id}');`,who);
 assert.equal(await query(`select status from zoi.seat_holds where id='${hold.hold_id}';`),'cancelled');
 assert.equal(JSON.parse(await query(`select public.tickets_seat_cancel('${hold.hold_id}');`,who)).cancelled,true);
 await rejects(`update zoi.ticket_reservations set status='reserved' where seat_hold_id='${hold.hold_id}';`,undefined,/cancelled_seat_reservation_is_final/);
 await rejects(`update zoi.ticket_reservations set checked_in_at=now() where seat_hold_id='${hold.hold_id}';`,undefined,/cancelled_seat_reservation_is_final/);
 pass('cancelled reservation remains terminal after release, retry and check-in attempts');
 assert.equal(JSON.parse(await query(`select public.tickets_checkin('${ws}','${receipt.code}');`,actor)).error,'reservation_cancelled');
 const hc=JSON.parse(await query(`select public.tickets_seat_hold('${event}',array['row-0-2'],'60000000-0000-4000-8000-000000000001');`,actor));
 const rc=JSON.parse(await query(`select public.tickets_seat_reserve('${hc.hold_id}','Test','test@example.com');`,actor));
 await rejects(`select public.tickets_checkin('${ws}','${rc.code}');`,member,/workspace_permission_denied/);
 const scans=await Promise.all([query(`select public.tickets_checkin('${ws}','${rc.code}');`,actor),query(`select public.tickets_checkin('${ws}','${rc.code}');`,actor)]);
 assert.deepEqual(scans.map(s=>JSON.parse(s).already).sort(),[false,true]);
 await rejects(`select public.tickets_seat_cancel('${hc.hold_id}');`,actor,/reservation_cannot_be_cancelled/);
 pass('check-in rejects cancelled tickets, requires admin, serializes duplicate scans and blocks later cancellation');
 console.log(`# ${checks} database checks passed`);
}finally{
 if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'ignore'});
 rmSync(dir,{recursive:true,force:true});
}
