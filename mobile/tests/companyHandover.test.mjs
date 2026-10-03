import test from 'node:test';import assert from 'node:assert/strict';
import {reviewCompanyHandover,confirmCompanyHandover,companyTemporaryCopy,shareCompanyHandover} from '../src/companyHandover.ts';
import {organizationRpc} from '../src/organizationWorkflow.ts';import {documentRpc} from '../src/documentScope.ts';import {SessionClient} from '../src/session.ts';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,ws=id(1),actor=id(90),companyId=id(2);
const row=(n,kind,x={})=>({id:id(n),workspace_id:ws,kind,title:kind+n,version:1,status:'open',data:{},...x});
function fixture(){let role='owner',current=true,records=[row(2,'company',{data:{legal_name:null}}),row(3,'project',{company_id:companyId}),row(4,'task',{project_id:id(3),assignee_profile_id:null}),row(5,'contact',{company_id:companyId,data:{email:'private@example.invalid'}}),row(6,'company'),row(7,'contact',{company_id:id(6),data:{email:'foreign@example.invalid'}})];let docs=[{id:id(8),workspace_id:ws,project_id:id(3),current_version:2,title:'Budget'},{id:id(9),workspace_id:ws,project_id:id(99),current_version:1,title:'Other budget'}];const calls=[];
 const scope={workspace:ws,companyId,includeDocuments:false,current:()=>current,read:async(name,args)=>{calls.push({name,args});return name==='ops_records_list'?{ok:true,role,records}:{ok:true,role,projects:[records[1]],documents:docs};}};
 return {scope,calls,records,get docs(){return docs;},set docs(v){docs=v;},setRole(v){role=v;},retire(){current=false;}};
}
test('reviewed selected-company JSON preserves nulls and versions, excludes foreign contacts and unqueried files',async()=>{
 const f=fixture(),review=await reviewCompanyHandover(f.scope);assert.equal(review.packet.company.data.legal_name,null);assert.equal(review.packet.tasks[0].assignee_profile_id,null);assert.equal(review.packet.document_records,null);assert.equal(review.packet.contacts.length,1);assert.equal(review.packet.contacts[0].data.email,'private@example.invalid');assert.equal(f.calls.length,1);
 review.packet.contacts[0].data.email='injected@example.invalid';const result=await confirmCompanyHandover(review,f.scope);assert.equal(result.contacts[0].data.email,'private@example.invalid');assert.match(result.notice,/not a government filing/);
});
test('authorized document metadata includes only saved company project IDs and current versions',async()=>{
 const f=fixture();f.scope.includeDocuments=true;const review=await reviewCompanyHandover(f.scope);assert.deepEqual(review.packet.document_records.map(d=>d.id),[id(8)]);assert.equal(review.packet.document_records[0].current_version,2);assert.equal(f.calls.filter(c=>c.name==='documents_list')[0].args.p_project,null);assert.equal(f.calls.filter(c=>c.name==='ops_records_list').length,2);
});
for(const mode of ['version','owner-clear','assignment-clear','contact-clear','removed-company','role','document-version'])test('confirmation rejects changed '+mode+' before handover',async()=>{
 const f=fixture();if(mode==='document-version')f.scope.includeDocuments=true;const review=await reviewCompanyHandover(f.scope);
 if(mode==='version')f.records[0].version++;
 if(mode==='owner-clear')f.records[0].data.legal_name='Changed';
 if(mode==='assignment-clear')f.records[2].assignee_profile_id=id(20);
 if(mode==='contact-clear')f.records[3].data.email=null;
 if(mode==='removed-company')f.records.splice(0,1);
 if(mode==='role')f.setRole('viewer');
 if(mode==='document-version')f.docs[0].current_version++;
 await assert.rejects(confirmCompanyHandover(review,f.scope),/changed|unavailable/);
});
for(const mode of ['viewer','foreign','duplicate','missing-project'])test('private document review refuses '+mode,async()=>{
 const f=fixture();f.scope.includeDocuments=true;
 if(mode==='viewer')f.setRole('viewer');if(mode==='foreign')f.docs[0].workspace_id=id(99);if(mode==='duplicate')f.docs.push({...f.docs[0]});if(mode==='missing-project')f.records[1].archived_at='now';
 if(mode==='missing-project'){const original=f.scope.read;f.scope.read=async(name,args)=>{const result=await original(name,args);if(name==='documents_list')result.projects=[];return result;};f.records[1].archived_at=null;}
 await assert.rejects(reviewCompanyHandover(f.scope));
});
test('viewer can review saved read-authorized records without accessing private files',async()=>{const f=fixture();f.setRole('viewer');const review=await reviewCompanyHandover(f.scope);assert.equal((await confirmCompanyHandover(review,f.scope)).contacts.length,1);assert.ok(!f.calls.some(c=>c.name==='documents_list'));});
for(const wait of ['token','records','documents'])for(const mode of ['account','workspace','unmount'])test('actual SessionClient handover fences '+wait+' wait then '+mode,async()=>{
 const f=fixture();let release,active=true;
 const client=new SessionClient({read:async()=>null,write:async()=>{},clear:async()=>{}},async(url,init)=>{
  if(url.includes('refresh_token')){if(wait==='token')await new Promise(r=>release=r);return new Response(JSON.stringify({access_token:'new',refresh_token:'refresh',expires_in:3600,user:{id:mode==='account'&&wait==='token'?id(91):actor}}));}
  const name=url.split('/').pop();if(wait==='records'&&name==='ops_records_list'||wait==='documents'&&name==='documents_list')await new Promise(r=>release=r);
  return new Response(JSON.stringify(await f.scope.read(name,JSON.parse(init.body))));
 });client.session={access_token:'valid',refresh_token:'refresh',expires_at:wait==='token'?1:Math.floor(Date.now()/1000)+3600,user:{id:actor}};
 const scope={...f.scope,includeDocuments:wait==='documents',current:()=>active&&client.session?.user.id===actor,read:(name,args)=>name==='documents_list'?documentRpc(client,actor,ws,()=>active,name,args):organizationRpc(client,actor,()=>active,name,args)};
 const pending=reviewCompanyHandover(scope);while(!release)await new Promise(r=>setImmediate(r));if(mode==='account')client.session={...client.session,user:{id:id(91)}};else active=false;release();await assert.rejects(pending,/changed/);
});
test('temporary file cleanup is idempotent and removes the prior copy before replacement',()=>{const copy=companyTemporaryCopy(),removed=[];copy.replace(()=>removed.push(1));copy.replace(()=>removed.push(2));assert.deepEqual(removed,[1]);copy.clear();copy.clear();assert.deepEqual(removed,[1,2]);assert.equal(copy.present(),false);copy.replace(()=>{throw Error('already removed');});copy.clear();assert.equal(copy.present(),false);});
for(const mode of ['success','unavailable','share-failure','availability-scope-change','copy-scope-change','share-scope-change','changed-record'])test('actual native handover adapter '+mode+' protects ephemeral copy',async()=>{
 const f=fixture(),review=await reviewCompanyHandover(f.scope),calls=[];
 const io={available:async()=>{calls.push('available');if(mode==='availability-scope-change')f.retire();return mode!=='unavailable';},create:(text,name)=>{calls.push('create');assert.equal(name,'zoi-company-'+companyId+'.json');assert.equal(JSON.parse(text).contacts.length,1);if(mode==='copy-scope-change')f.retire();return{uri:'file:///controlled-cache/export.json',remove:()=>calls.push('remove')};},share:async uri=>{assert.equal(uri,'file:///controlled-cache/export.json');calls.push('share');if(mode==='share-failure')throw Error('OS share cancelled');if(mode==='share-scope-change')f.retire();}};
 if(mode==='changed-record')f.records[0].version++;
 if(mode==='success')await shareCompanyHandover(review,f.scope,io);else await assert.rejects(shareCompanyHandover(review,f.scope,io));
 if(['unavailable','availability-scope-change','changed-record'].includes(mode))assert.deepEqual(calls,['available']);
 else if(mode==='copy-scope-change')assert.deepEqual(calls,['available','create','remove']);
 else assert.deepEqual(calls,['available','create','share','remove']);
});
