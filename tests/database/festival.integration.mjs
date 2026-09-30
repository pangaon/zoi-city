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
const port=15489;const env={...process.env,PGHOST:dir,PGPORT:String(port),PGDATABASE:'postgres'};
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
 await query(`alter table zoi.user_profiles add column display_name text;alter table zoi.listings add column name text default 'QA host';update zoi.workspace_members set role='viewer' where profile_id='${member}';`);
 for(const file of ['20260930001738_business_operations_foundation.sql','20260930014346_private_business_inquiries.sql','20260930020814_festival_packages_and_applications.sql'])await query(readFileSync(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
 const call=(fn,args,user=actor)=>query(`select public.${fn}(${args});`,user).then(JSON.parse),j=x=>literal(JSON.stringify(x))+'::jsonb',req=n=>`80000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const pkg=req(1),offer={event_id:event,kind:'booth',name:'Community booth',description:'Two metre space',benefits:['Listed exhibitor'],price_cents:10000,currency:'EUR',capacity:2,closes_at:new Date(Date.now()+7*86400000).toISOString(),timezone:'Europe/Athens',active:true};
 await rejects(`select public.festival_package_save('${ws}','${pkg}',0,${j(offer)});`,member,/festival_permission_denied/);pass('viewer cannot publish commercial offers');
 const copies=await Promise.all([call('festival_package_save',`'${ws}','${pkg}',0,${j(offer)}`),call('festival_package_save',`'${ws}','${pkg}',0,${j(offer)}`)]);assert.equal(copies[0].package.id,copies[1].package.id);assert.equal(await query('select count(*) from zoi.festival_packages;'),'1');pass('concurrent offer creation retries produce one version');
 let catalog=await call('festival_catalog',`'${event}'`);assert.equal(catalog.packages[0].remaining,2);assert.equal(catalog.packages[0].payment_collected,false);assert.match(catalog.packages[0].offer_url,/offer=/);pass('public availability exposes real allocation and application-only capability');
 const form={organisation:'Greek crafts',contact_name:'Applicant',contact_email:'qa@example.invalid',category:'crafts',units:2,notes:'Handmade products'};
 const args=`'${pkg}',1,'${req(2)}',${j(form)}`;const sends=await Promise.all([call('festival_apply',args,other),call('festival_apply',args,other)]);let a=sends[0].application;assert.equal(a.id,sends[1].application.id);assert.equal(await query('select count(*) from zoi.inquiry_threads;'),'1');assert.equal((await call('inquiry_thread',`'${a.inquiry_id}'`,other)).messages.length,1);pass('application and private communication thread created exactly once');
 a=(await call('festival_application_edit',`'${a.id}',1,${j({...form,notes:'Handmade ceramic products'})}`,other)).application;assert.equal(a.version,2);assert.equal(a.total_cents,20000);pass('applicant edits own pending details with original quote preserved');
 await rejects(`select public.festival_application_edit('${a.id}',2,${j(form)});`,member,/festival_permission_denied/);await rejects(`select public.festival_operator('${ws}');`,member,/festival_permission_denied/);pass('customer and workspace privacy deny unrelated viewers');
 const b=(await call('festival_apply',`'${pkg}',1,'${req(3)}',${j({...form,organisation:'Owner test vendor'})}`)).application;
 const approvals=await Promise.allSettled([call('festival_application_decide',`'${ws}','${a.id}',2,'approve',''`),call('festival_application_decide',`'${ws}','${b.id}',1,'approve',''`)]);assert.equal(approvals.filter(r=>r.status==='fulfilled').length,1);const winner=approvals.find(r=>r.status==='fulfilled').value.application;assert.equal((await call('festival_catalog',`'${event}'`)).packages[0].remaining,0);pass('concurrent reviews cannot oversell the final two units');
 await rejects(`select public.festival_package_save('${ws}','${pkg}',1,${j({...offer,capacity:1})});`,actor,/festival_capacity_below_allocations/);pass('offer editing cannot undercut allocated booth capacity');
 const updated=(await call('festival_package_save',`'${ws}','${pkg}',1,${j({...offer,price_cents:15000,description:'Future revised offer'})}`)).package;
 const mine=(await call('festival_my_applications','null',winner.profile_id)).applications.find(x=>x.id===winner.id);assert.equal(mine.terms.price_cents,10000);assert.equal(mine.total_cents,20000);assert.equal((await call('festival_catalog',`'${event}'`)).packages[0].price_cents,15000);pass('published offer updates immediately while accepted terms remain immutable');
 await call('festival_application_withdraw',`'${winner.id}',${winner.version},'Cannot attend'`,winner.profile_id);assert.equal((await call('festival_catalog',`'${event}'`)).packages[0].remaining,2);pass('withdrawal releases approved capacity and retains history');
 await call('festival_package_save',`'${ws}','${pkg}',2,${j({...offer,price_cents:15000,active:false})}`);assert.equal((await call('festival_catalog',`'${event}'`)).available,false);await rejects(`select public.festival_apply('${pkg}',3,'${req(8)}',${j(form)});`,member,/festival_offer_unavailable/);pass('pausing offer removes public availability and stops new applications');
 const pending=winner.id===a.id?b:a;await call('festival_application_decide',`'${ws}','${pending.id}',${pending.version},'approve',''`);pass('organizer can finish reviewing submitted requests after offer pause');
 await query(`update zoi.listings set marketplace_status='hidden' where id='${event}';`);assert.equal((await call('festival_catalog',`'${event}'`)).available,false);assert.equal((await call('festival_operator',`'${ws}'`)).events.length,0);await rejects(`select public.festival_package_save('${ws}','${pkg}',3,${j(offer)});`,actor,/festival_event_unavailable/);pass('hidden host blocks public offers and further publication');
 await call('festival_application_withdraw',`'${pending.id}',${pending.version+1},'Private withdrawal after host hidden'`,pending.profile_id);pass('customer can withdraw after host hides without trapping allocation');
 const retry=(await call('festival_package_save',`'${ws}','${pkg}',0,${j(offer)}`)).package;assert.equal(retry.version,3);pass('exact creation retry returns existing offer after publication is hidden');
 await query(`update zoi.listings set marketplace_status='active',owner_workspace_id=null where id='${event}';`);assert.equal((await call('festival_catalog',`'${event}'`)).available,false);await rejects(`select public.festival_package_save('${ws}','${pkg}',3,${j(offer)});`,actor,/festival_event_unavailable/);pass('ownership transfer removes public offers and blocks former owner publication');
 await rejects(`select public.festival_package_save('${ws}','${req(20)}',0,${j({...offer,closes_at:'infinity'})});`,actor,/festival_timezone_required/);await rejects(`select public.festival_package_save('${ws}','${req(21)}',null,${j({...offer,closes_at:'2027-01-01T12:00:00'})});`,actor,/festival_timezone_required/);pass('deadline rejects infinity and timezone-ambiguous timestamps');
 await rejects('select * from zoi.festival_applications;',other,/permission denied/);assert.ok((await call('festival_operator',`'${ws}'`)).audit.length>=8);pass('application data stays private and changes have actor audit');
 console.log(`${checks} festival database checks passed`);
}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}
