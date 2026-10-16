// Synchronize requirement records without resetting the maintained execution board.
import {readFileSync,writeFileSync,renameSync,unlinkSync,existsSync,statSync,chmodSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReport} from './ledger.mjs';
const groups=[['homes','Individual business and creator homes'],['research','Website research and enrichment'],['maps','Maps and directions'],['creative','AI and creative tools'],['publishing','Social publishing and email'],['websites','Websites, SEO and analytics'],['community','Community, posts, reels and messaging'],['operations','Shops, bookings and events'],['owners','Owner workspaces'],['mobile','Mobile apps'],['security','Security and reliability']];
function group(text){if(/founder|dashboard|delivery board|whole vision|preserve|definition of done/i.test(text))return 'owners';if(/map|geograph|coordinate|directions|address|location.accur/i.test(text))return 'maps';if(/native|mobile|iphone|ipad|android|ios|expo/i.test(text))return 'mobile';if(/security|permissions|privacy|tenant|secret|vulnerabil|backup|reliab|authorization|idempoten|recovery|hardening/i.test(text))return 'security';if(/enrich|crawl|research|source|incoming lead|client brief/i.test(text))return 'research';if(/social|email|inbox|campaign|publish.*channel|distribution|communications/i.test(text))return 'publishing';if(/studio|creative|\bai\b|video edit|transcrip|template.layer|canva|caption|brand kit/i.test(text))return 'creative';if(/seo|aeo|analytics|metrics|website.*scan|indexing|search engine/i.test(text))return 'websites';if(/community|parea|reels|stories|follow|reaction|messaging|network/i.test(text))return 'community';if(/owner|workspace|company|ownr|draft|preview|version|approv/i.test(text))return 'owners';if(/booking|shop|commerce|event|ticket|inventory|payment|service|league|festival|recipe|enrol|volunteer|appointment/i.test(text))return 'operations';return 'homes';}
function lane(g){return ['homes','research','maps'].includes(g)?'client_research':g==='mobile'?'native_mobile':g==='security'?'integration_release':'connected_operations';}
function test(g,text){const common='Verify this exact outcome: '+text;const cases={maps:['Match authoritative source identity/address to stored coordinates and guarded receipt','Read actual public API and inspect marker at close zoom in affected regions and across the date line','Select destination and exercise truthful web/native directions; distinguish external handoff from embedded routing'],research:['Capture verified primary and relevant service/contact/media sources for populated, sparse and branch records','Compare extracted offering, provenance and explicit unknowns to actual public API and rendered home','Verify owner edits/clears and blocked-source recovery are preserved'],homes:['Compare source offering, identity and imagery with the canonical home for populated and sparse clients','Open every relevant offering/media/customer action at390px and desktop, including errors and keyboard focus','Edit as authorized owner, privately preview, publish and verify public/native readback'],creative:['Use actual client identity and authorized assets as inputs','Execute, persist an editable output, reopen it and reuse it in the correct campaign','Verify provider confirmation where applicable, cancellation, denied access and recovery'],publishing:['Carry client/campaign/consent context from approved content to execution','Use an explicitly authorized safe test environment and confirm actual provider acceptance/downstream reporting','Revoke access or consent, retry an uncertain response and verify no duplicate send or false delivery'],operations:['Exercise actual supported customer transaction/enquiry with isolated data','Verify authorized persisted operator state, real inventory/provider confirmation where required and customer readback','Exercise concurrency, expiry, cancellation, duplicate requests and failure recovery without real charges'],mobile:['Build or update the exact integrated commit and record its included changes','Install the resulting artifact and exercise the actual customer flow/deep link/account switch','Separate Expo-web/simulator/physical-device/store evidence and verify safe recovery'],security:['Exercise actual database/API authorization with wrong actor, tenant, missing/revoked session and stale state','Verify private information and credentials are inaccessible, including caches and artifacts','Run required security/regression/release gates and deployed failure/recovery checks']};return [common,...(cases[g]||['Exercise actual current authenticated input→persisted execution→visible result with correct client context','Verify390px/desktop and intended native continuation, plus denied/stale/failed/retry behavior','Verify deployed identity and independent customer journey evidence before live-and-verified'])];}

const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const clone=value=>JSON.parse(JSON.stringify(value));
function records(rows,label){
 if(!Array.isArray(rows))throw Error(label+' must be an array');
 const index=new Map();
 for(const row of rows){if(!row||typeof row!=='object'||typeof row.id!=='string'||!row.id||index.has(row.id))throw Error(label+' has a missing or duplicate ID');index.set(row.id,row);}
 return index;
}
function defaults(item){
 const g=group(item.area+' '+item.text);
 return {...item,customer_outcome:item.text,group:g,missing_implementation_or_defect:'Requirement-level deployed customer acceptance is not yet attached; implementation state must be checked before a completion claim.',dependencies:['research','homes','maps'].includes(g)?['Verified exact client/source identity','Owner-safe canonical data and public projection']:['Current account/session/tenant authority','Canonical persisted workflow and required provider readiness'],responsible_workstream:lane(g),acceptance_test:test(g,item.text),release_destination:g==='mobile'?'Exact-commit Android/iOS build/update and existing authorized installation channel':g==='research'||g==='maps'?'Reviewed database/worker plus www.zoi.city and exact native release':'www.zoi.city canonical customer/owner route plus intended native journey',current_evidence:item.evidence,remaining_work:['Implement missing behavior or reconcile current source','Independently exercise the required customer journey','Integrate, release and verify deployed behavior'],scope_status:'not started',implementation_status:'not yet individually assessed'};
}
export function synchronizeQueue(board,scope,report,{now=new Date().toISOString()}={}){
 if(!board||typeof board!=='object'||Array.isArray(board))throw Error('Invalid execution board');
 const prior=records(board.execution_queue,'Current execution queue'),incoming=records(report?.items,'Requirement report');
 for(const item of incoming.values())if(['source','area','text'].some(key=>typeof item[key]!=='string'||!item[key])||!Array.isArray(item.evidence))throw Error('Invalid requirement report record '+item.id);
 const removed=[...prior.keys()].filter(id=>!incoming.has(id));
 if(removed.length)throw Error('Requirement sync would remove recorded IDs; explicit reconciliation is required: '+removed.slice(0,10).join(', '));
 const next=clone(board),added=[];
 // Keep existing priority/order and every maintained field, including explicit
 // empty/null values. Reported evidence/status never supersedes the board.
 next.execution_queue=[...prior.values()].map(old=>{
  const item=incoming.get(old.id);
  for(const key of ['source','area','text'])if(own(old,key)&&old[key]!==item[key])throw Error('Requirement identity changed for existing ID '+old.id);
  return clone(old);
 });
 for(const item of incoming.values())if(!prior.has(item.id)){next.execution_queue.push(defaults(item));added.push(item.id);}
 const currentGroups=own(board,'groups')?records(board.groups,'Current groups'):new Map();
 next.groups=[...currentGroups.values()].map(value=>({...clone(value),total_requirements:next.execution_queue.filter(item=>item.group===value.id).length}));
 const labels=new Map(groups);
 for(const item of next.execution_queue)if(typeof item.group==='string'&&!currentGroups.has(item.group)){
  currentGroups.set(item.group,{});next.groups.push({id:item.group,label:labels.get(item.group)||item.group,total_requirements:next.execution_queue.filter(row=>row.group===item.group).length,status:'not assessed'});
 }
 next.updated_at=now;
 if(!own(next,'authoritative'))next.authoritative=true;
 if(!own(next,'scope_source'))next.scope_source='docs/recovery-scope.json';
 if(!own(next,'latest_user_instruction')&&typeof scope?.latest_execution_instruction?.instruction==='string')next.latest_user_instruction=scope.latest_execution_instruction.instruction;
 if(!own(next,'rule'))next.rule='This is the one authoritative execution queue. No requirement is live-and-verified without deployed customer acceptance.';
 next.scope_version=createHash('sha256').update(JSON.stringify(next.execution_queue.map(x=>[x.id,x.customer_outcome]))).digest('hex');
 if(!own(next,'scope_change'))next.scope_change={previous_count:prior.size,current_count:next.execution_queue.length,reason:'Requirement sync added '+added.length+' recorded statement(s); existing work and acceptance are preserved. This is not a completion percentage.'};
 next.scope_statement_count=next.execution_queue.length;
 return next;
}
export function synchronizeQueueFiles({root=process.cwd(),now=new Date().toISOString()}={}){
 const boardPath=resolve(root,'docs/recovery-delivery-board.json'),scopePath=resolve(root,'docs/recovery-scope.json');
 const original=readFileSync(boardPath,'utf8'),scopeBytes=readFileSync(scopePath,'utf8');
 const board=JSON.parse(original),scope=JSON.parse(scopeBytes),report=buildReport({root,now});
 const next=synchronizeQueue(board,scope,report,{now});
 const temporary=boardPath+'.'+randomUUID()+'.tmp';
 try{
  writeFileSync(temporary,JSON.stringify(next,null,2)+'\n',{flag:'wx',mode:statSync(boardPath).mode&0o777});
  chmodSync(temporary,statSync(boardPath).mode&0o777);
  // Refuse an already-observed concurrent edit; operators still use one board
  // writer at a time. This is not a lock/CAS protocol for external editors.
  if(readFileSync(boardPath,'utf8')!==original||readFileSync(scopePath,'utf8')!==scopeBytes)throw Error('Board or scope changed during synchronization; no update was applied');
  renameSync(temporary,boardPath);
 }finally{if(existsSync(temporary))unlinkSync(temporary);}
 return next;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const board=synchronizeQueueFiles();console.log(JSON.stringify({authoritative_board:'docs/recovery-delivery-board.json',requirements:board.execution_queue.length,groups:board.groups.length,lanes:Object.keys(board.lanes||{})}));}
 catch(error){console.error('Queue synchronization refused: '+error.message);process.exitCode=1;}
}
