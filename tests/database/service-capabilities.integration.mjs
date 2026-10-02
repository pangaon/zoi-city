import {readFileSync} from 'node:fs';
const baseline=new URL('./event-service-lifecycle.integration.mjs',import.meta.url);
let source=readFileSync(baseline,'utf8');source=source.slice(0,source.indexOf('const before=await q(')).replaceAll('15527','15529');
async function cases(){
 const capMigration=readFileSync(new URL('../../supabase/migrations/20261002220000_event_service_installed_capabilities.sql',import.meta.url),'utf8');
 await q(capMigration,false);
 const cap=()=>json(`select public.event_service_capabilities('${ws}',null)`);
 let result=await cap();assert.deepEqual(result.capabilities,{menu:1,setup:1,queue:1,lifecycle:0});assert.equal(result.auth_user_id,actor);assert.equal(result.actor_profile_id,profile);assert.equal(result.version,1);console.log('PASS partial stack permits baseline only, exact actor/profile/workspace');
 await q(readFileSync(new URL('../../supabase/migrations/20261001174000_event_service_cash_reconciliation.sql',import.meta.url),'utf8'),false);
 result=await cap();assert.deepEqual(result.capabilities,{menu:1,setup:1,queue:1,lifecycle:1});console.log('PASS full reviewed stack including reconciliation');
 await json(`select public.kds_ticket_advance('${ws}','${bar.order_id}','preparing')`);const consumed=await q(`select consumed from zoi.event_service_stock where session_id='${sid}'and menu_item_id='${bottle}'`,false);assert.equal(consumed,'1');await json(`select public.kds_ticket_advance('${ws}','${bar.order_id}','preparing')`);assert.equal(await q(`select consumed from zoi.event_service_stock where session_id='${sid}'and menu_item_id='${bottle}'`,false),consumed);assert.equal((await json(`select public.kds_ticket_advance('${ws}','${bar.order_id}','cancelled')`)).error,'invalid_transition');console.log('PASS installed legacy KDS consumes service stock once, never cancels charged orders');

 const guest=await asGuest(`select public.event_service_capabilities(null,'${event}')`);assert.equal(guest.role,'guest');assert.equal(guest.event_id,event);assert.deepEqual(guest.capabilities,{menu:0,setup:0,queue:0,lifecycle:1});
 await assert.rejects(json(`select public.event_service_capabilities(null,null)`),/exact_service_context/);await assert.rejects(json(`select public.event_service_capabilities('${ws}','${event}')`),/exact_service_context/);console.log('PASS guest current event scope, ambiguous context refused');
 for(const mode of['DISABLE','ENABLE REPLICA']){
  await q(`alter table public.event_orders ${mode} trigger event_service_order_transition`,false);assert.equal((await cap()).capabilities.lifecycle,0);await q('alter table public.event_orders enable trigger event_service_order_transition',false);
 }
 await q('alter table public.table_tabs disable trigger event_service_tab_consistency',false);assert.equal((await cap()).capabilities.lifecycle,0);await q('alter table public.table_tabs enable trigger event_service_tab_consistency',false);assert.equal((await cap()).capabilities.lifecycle,1);console.log('PASS disabled/replica-only ledger and reconciliation triggers close capability');
 const def=await json(`select to_json(pg_get_functiondef('public.event_service_cash_record(uuid,uuid,integer,text,integer,uuid,text,boolean,uuid)'::regprocedure))`);
 await q(def.replace('BEGIN','BEGIN /* changed reviewed body */'),false);
 assert.equal((await cap()).capabilities.lifecycle,0);await q(def,false);assert.equal((await cap()).capabilities.lifecycle,1);console.log('PASS changed required function source closes capability');
 for(const signature of ['zoi.suite_lock_session()','zoi.workspace_locked_role(uuid)']){
  const original=JSON.parse(await q(`select to_json(pg_get_functiondef('${signature}'::regprocedure))`,false));
  await q(original.replace(/\bbegin\b/i,'begin /* authority drift */'),false);
  await assert.rejects(cap(),/service_capability_unavailable/);await q(original,false);
  await q(`grant execute on function ${signature} to authenticated`,false);
  await assert.rejects(cap(),/service_capability_unavailable/);await q(`revoke execute on function ${signature} from authenticated`,false);
  assert.equal((await cap()).capabilities.lifecycle,1);
 }
 console.log('PASS exact current authority source and private grants required before capability identity');
 await q('grant select on zoi.event_service_cash_ledger to authenticated',false);assert.equal((await cap()).capabilities.lifecycle,0);await q('revoke select on zoi.event_service_cash_ledger from authenticated',false);
 await q(`update zoi.workspace_members set role='viewer'where workspace_id='${ws}'and profile_id='${profile}'`,false);assert.deepEqual((await cap()).capabilities,{menu:0,setup:0,queue:0,lifecycle:0});await q(`update zoi.workspace_members set role='owner'where workspace_id='${ws}'and profile_id='${profile}'`,false);
 await q(`update auth.sessions set not_after=clock_timestamp()where id='${session}'`,false);await assert.rejects(cap(),/session_unavailable/);await q(`update auth.sessions set not_after=null where id='${session}'`,false);console.log('PASS unexpected direct table grant, viewer and expired session fail closed');
 await q('revoke execute on function public.event_service_cash_view(uuid,uuid) from authenticated',false);assert.equal((await cap()).capabilities.lifecycle,0);await q('grant execute on function public.event_service_cash_view(uuid,uuid) to authenticated',false);assert.equal((await cap()).capabilities.lifecycle,1);
 await assert.rejects(q(`set role anon;select public.event_service_capabilities('${ws}',null)`,false),/permission denied/);await assert.rejects(q(`select zoi.service_installed_stage('cash')`),/permission denied/);console.log('PASS public/private capability ACL');
}
source+='await ('+cases.toString()+')();\n}finally{if(started)execFileSync(join(bin,"pg_ctl"),["-D",join(dir,"data"),"-m","immediate","-w","stop"],{stdio:"ignore"});rmSync(dir,{recursive:true,force:true});}';
source=source.replaceAll('import.meta.url',JSON.stringify(baseline.href));await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
