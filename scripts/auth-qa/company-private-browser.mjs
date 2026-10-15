import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {QA} from './session.mjs';
import {companyBrowserFence,SYNTHETIC} from './company-private-browser-policy.mjs';
const exec=promisify(execFile);
export async function closeBrowser(cli){try{await cli(['close']);}catch{throw Error('qa_browser_cleanup_failed');}}
export async function browserCompanyPrivate({session,company,expiresAt},{binary='agent-browser',onStage=()=>{}}={}){
 let stage='browser_open';const mark=value=>{stage=value;onStage(value);};
 const fence=companyBrowserFence(company,{expiresAt});
 const name='zoi-company-private-qa-'+process.pid;let socket;let seq=0;const pending=new Map();let attached;let blocked=0;
 const env={...process.env};for(const key of Object.keys(env))if(/SUPABASE|TOKEN|SECRET|PASSWORD|AGENT_BROWSER/.test(key))delete env[key];
 const cli=async args=>{try{return(await exec(binary,['--session',name,...args],{env,timeout:45000,maxBuffer:100000})).stdout.trim();}catch{throw Error('qa_browser_command_failed');}};
 function command(method,params={},sessionId=attached){return new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error('qa_browser_timeout'));},20000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
 try{
  mark('browser_open');await cli(['open','about:blank']);mark('browser_endpoint');const endpoint=await cli(['get','cdp-url']);if(!/^ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[a-f0-9-]+$/.test(endpoint))throw Error('qa_browser_endpoint');
  mark('browser_connect');socket=new WebSocket(endpoint);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=()=>reject(Error('qa_browser_connect'));});
  socket.onmessage=async event=>{let m;try{m=JSON.parse(event.data);}catch{return;}if(m.id){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error('qa_browser_protocol')):p.resolve(m.result);}return;}
   if(m.method==='Fetch.requestPaused'){const permitted=fence.allow(m.params.request);if(!permitted)blocked++;try{await command(permitted?'Fetch.continueRequest':'Fetch.failRequest',permitted?{requestId:m.params.requestId}:{requestId:m.params.requestId,errorReason:'BlockedByClient'},m.sessionId);}catch{}}
  };
  mark('browser_attach');const targets=await command('Target.getTargets');const target=targets.targetInfos.find(x=>x.type==='page'&&x.url==='about:blank');if(!target)throw Error('qa_browser_target');attached=(await command('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;
  await command('Page.enable');await command('Network.enable');await command('Network.setBypassServiceWorker',{bypass:true});await command('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
  // All browser storage stays in JS memory. No session is sent via argv, disk, URL or artifacts.
  const source=`(()=>{if(location.origin!==${JSON.stringify(QA.site)})return;const values=new Map([['zoi_auth',${JSON.stringify(JSON.stringify({...session,user_id:QA.user}))}],['zoi_ws',${JSON.stringify(QA.workspace)}]]);const memory={getItem:k=>values.get(String(k))??null,setItem:(k,v)=>values.set(String(k),String(v)),removeItem:k=>values.delete(String(k)),clear:()=>values.clear(),key:i=>[...values.keys()][i]??null,get length(){return values.size}};Object.defineProperty(window,'localStorage',{value:memory});Object.defineProperty(window,'sessionStorage',{value:memory});if(navigator.serviceWorker)navigator.serviceWorker.register=()=>Promise.reject(Error('QA service worker disabled'));})();`;
  await command('Page.addScriptToEvaluateOnNewDocument',{source});
  mark('browser_navigation');await command('Page.navigate',{url:QA.site+'/social/?workspace='+QA.workspace+'&company_private='+company+'#operations/company/'+company});
  const evalValue=async expression=>{const result=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error('qa_browser_evaluation');return result.result.value;};
  mark('browser_ready');const deadline=Date.now()+45000;let ready=false;while(Date.now()<deadline){ready=await evalValue("!!window.ZoiCore?.auth?.isSignedIn() && !!document.querySelector('#workspace-context-name') && !!document.querySelector('.zprivate')");if(ready)break;await new Promise(r=>setTimeout(r,500));}if(!ready)throw Error('qa_workspace_ui_unavailable');
  mark('browser_identity');const browserIdentity=await evalValue(`(async()=>{const m=await ZoiCore.api.rpc('zoi_me',{}, {auth:'require'});return m.authenticated===true&&m.profile?.id===${JSON.stringify(QA.profile)}&&m.workspaces?.some(w=>w.id===${JSON.stringify(QA.workspace)}&&w.role==='owner');})()`);if(browserIdentity!==true)throw Error('qa_browser_identity');
  async function waitFor(expression){const end=Date.now()+25000;while(Date.now()<end){if(await evalValue(expression))return;await new Promise(r=>setTimeout(r,250));}throw Error('company_qa_ui_timeout');}
  const click=async label=>{await waitFor(`[...document.querySelectorAll('.zprivate button')].some(x=>x.textContent.trim()===${JSON.stringify(label)}&&!x.disabled)`);await evalValue(`(()=>{const b=[...document.querySelectorAll('.zprivate button')].find(x=>x.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)throw Error('button');b.click();return true;})()`);};
  const fill=async(title)=>{await waitFor(`!!document.querySelector('.zprivate-form [name=title]:not(:disabled)')&&!!document.querySelector('.zprivate-form button[type=submit]:not(:disabled)')`);await evalValue(`(()=>{const f=document.querySelector('.zprivate-form');if(!f)throw Error('form');const values=${JSON.stringify({...SYNTHETIC,title})};for(const[k,v]of Object.entries(values)){const n=f.elements.namedItem(k);if(n)n.value=v;}f.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.zprivate-form').requestSubmit();return true;})()`);};
  await waitFor(`[...document.querySelectorAll('.zprivate button')].some(x=>x.textContent==='New meeting minute'&&!x.disabled)`);
  mark('minute_create');await click('New meeting minute');await fill(SYNTHETIC.title);
  await waitFor(`document.querySelector('.zprivate-message')?.textContent.includes('Saved version 1.')`);
  const record=await evalValue(`(async()=>{const r=await ZoiCore.api.rpc('company_private_list',{p_workspace:${JSON.stringify(QA.workspace)},p_company:${JSON.stringify(company)},p_kind:'minute',p_archived:false,p_limit:32,p_offset:0},{auth:'require'});if(r?.total!==1||r.records?.[0]?.data?.title!==${JSON.stringify(SYNTHETIC.title)})throw Error('scope');return r.records[0].id;})()`);fence.record(record);
  mark('minute_edit');await fill(SYNTHETIC.edited);await waitFor(`document.querySelector('.zprivate-message')?.textContent.includes('Saved version 2.')`);
  mark('minute_history');await waitFor(`document.querySelector('.zprivate-history')?.textContent.includes('Version 2')&&document.querySelector('.zprivate-history')?.textContent.includes('Version 1')`);
  mark('minute_receipt');const request=fence.requests()[1];const receipt=await evalValue(`(async()=>{const r=await ZoiCore.api.rpc('company_private_request',{p_workspace:${JSON.stringify(QA.workspace)},p_company:${JSON.stringify(company)},p_request:${JSON.stringify(request)},p_cancel_if_missing:false},{auth:'require'});return r.state==='saved'&&r.version===2&&r.record_id===${JSON.stringify(record)};})()`);if(!receipt)throw Error('company_qa_receipt');
  mark('page_reload');await command('Page.reload',{ignoreCache:true});await waitFor(`!!document.querySelector('[data-o="private-company"], [data-company-private]')||[...document.querySelectorAll('#mount button')].some(b=>b.textContent.trim()==='Private company records')`);
  await evalValue(`(()=>{const b=[...document.querySelectorAll('#mount button')].find(b=>b.textContent.trim()==='Private company records');if(!b)throw Error('button');b.click();return true;})()`);
  await waitFor(`[...document.querySelectorAll('.zprivate-record')].some(b=>b.textContent.includes(${JSON.stringify(SYNTHETIC.edited)}))`);
  mark('record_reopen');await evalValue(`document.querySelector('.zprivate-record').click()`);await waitFor(`document.querySelector('.zprivate-form [name="title"]')?.value===${JSON.stringify(SYNTHETIC.edited)}`);
  mark('record_reload');await click('Reload current record');await waitFor(`document.querySelector('.zprivate-form [name="title"]')?.value===${JSON.stringify(SYNTHETIC.edited)}`);
  await command('Page.handleJavaScriptDialog',{accept:true}).catch(()=>{});
  // Native confirmation is intercepted only for these fixed synthetic record actions.
  await evalValue('window.confirm=()=>true');
  mark('minute_archive');await click('Archive record');await waitFor(`document.querySelector('.zprivate-message')?.textContent.includes('Saved version 3.')`);
  mark('minute_restore');await click('Restore record');await waitFor(`document.querySelector('.zprivate-message')?.textContent.includes('Saved version 4.')`);
  mark('minute_final_archive');await click('Archive record');await waitFor(`document.querySelector('.zprivate-message')?.textContent.includes('Saved version 5.')`);
  if(fence.count()!==5)throw Error('company_qa_write_count');
  return{authenticated:true,workspace_matched:true,minute_created:true,minute_edited:true,history_visible:true,receipt_verified:true,page_reloaded:true,record_reloaded:true,archived:true,restored:true,final_record_archived:true,five_private_mutations:true,no_provider_calls:true};
 }catch(error){throw Object.assign(Error('company_browser_unconfirmed'),{qaStage:stage});}finally{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('qa_browser_closed'));}pending.clear();socket?.close();await closeBrowser(cli);}
}
