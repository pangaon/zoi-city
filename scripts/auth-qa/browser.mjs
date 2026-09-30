import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {QA,permittedRequest} from './session.mjs';
const exec=promisify(execFile);
export async function closeBrowser(cli){try{await cli(['close']);}catch{throw Error('qa_browser_cleanup_failed');}}
export async function browserRead({session,listing},{binary='agent-browser'}={}){
 const name='zoi-readonly-qa-'+process.pid;let socket;let seq=0;const pending=new Map();let attached;let blocked=0;
 const env={...process.env};for(const key of Object.keys(env))if(/SUPABASE|TOKEN|SECRET|PASSWORD|AGENT_BROWSER/.test(key))delete env[key];
 const cli=async args=>{try{return(await exec(binary,['--session',name,...args],{env,timeout:45000,maxBuffer:100000})).stdout.trim();}catch{throw Error('qa_browser_command_failed');}};
 function command(method,params={},sessionId=attached){return new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error('qa_browser_timeout'));},20000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
 try{
  await cli(['open','about:blank']);const endpoint=await cli(['get','cdp-url']);if(!/^ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[a-f0-9-]+$/.test(endpoint))throw Error('qa_browser_endpoint');
  socket=new WebSocket(endpoint);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=()=>reject(Error('qa_browser_connect'));});
  socket.onmessage=async event=>{let m;try{m=JSON.parse(event.data);}catch{return;}if(m.id){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error('qa_browser_protocol')):p.resolve(m.result);}return;}
   if(m.method==='Fetch.requestPaused'){const permitted=permittedRequest(m.params.request,listing);if(!permitted)blocked++;try{await command(permitted?'Fetch.continueRequest':'Fetch.failRequest',permitted?{requestId:m.params.requestId}:{requestId:m.params.requestId,errorReason:'BlockedByClient'},m.sessionId);}catch{}}
  };
  const targets=await command('Target.getTargets');const target=targets.targetInfos.find(x=>x.type==='page'&&x.url==='about:blank');if(!target)throw Error('qa_browser_target');attached=(await command('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;
  await command('Page.enable');await command('Network.enable');await command('Network.setBypassServiceWorker',{bypass:true});await command('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
  // All browser storage stays in JS memory. No session is sent via argv, disk, URL or artifacts.
  const source=`(()=>{if(location.origin!==${JSON.stringify(QA.site)})return;const values=new Map([['zoi_auth',${JSON.stringify(JSON.stringify(session))}],['zoi_ws',${JSON.stringify(QA.workspace)}]]);const memory={getItem:k=>values.get(String(k))??null,setItem:(k,v)=>values.set(String(k),String(v)),removeItem:k=>values.delete(String(k)),clear:()=>values.clear(),key:i=>[...values.keys()][i]??null,get length(){return values.size}};Object.defineProperty(window,'localStorage',{value:memory});Object.defineProperty(window,'sessionStorage',{value:memory});if(navigator.serviceWorker)navigator.serviceWorker.register=()=>Promise.reject(Error('QA service worker disabled'));})();`;
  await command('Page.addScriptToEvaluateOnNewDocument',{source});
  await command('Page.navigate',{url:QA.site+'/social/?workspace='+QA.workspace+'#bizpage'});
  const evalValue=async expression=>{const result=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error('qa_browser_evaluation');return result.result.value;};
  const deadline=Date.now()+45000;let ready=false;while(Date.now()<deadline){ready=await evalValue("!!window.ZoiCore?.auth?.isSignedIn() && !!document.querySelector('#workspace-context-name') && !!document.querySelector('#mount .zp-claim, #mount .zp-input')");if(ready)break;await new Promise(r=>setTimeout(r,500));}if(!ready)throw Error('qa_workspace_ui_unavailable');
  const browserIdentity=await evalValue(`(async()=>{const m=await ZoiCore.api.rpc('zoi_me',{}, {auth:'require'});return m.authenticated===true&&m.profile?.id===${JSON.stringify(QA.profile)}&&m.workspaces?.some(w=>w.id===${JSON.stringify(QA.workspace)}&&w.role==='owner');})()`);if(browserIdentity!==true)throw Error('qa_browser_identity');
  if(listing){const found=await evalValue(`(async()=>{const r=await ZoiCore.api.rpc('home_content_get',{p_workspace:${JSON.stringify(QA.workspace)},p_listing:${JSON.stringify(listing)}},{auth:'require'});return r?.ok===true&&r.workspace_id===${JSON.stringify(QA.workspace)}&&r.listing_id===${JSON.stringify(listing)};})()`);if(found!==true)throw Error('qa_browser_home_read');}
  const widths=[];for(const width of[390,1440]){await command('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});await new Promise(r=>setTimeout(r,200));widths.push({width,overflow:await evalValue('document.documentElement.scrollWidth>innerWidth+1')});}
  if(widths.some(x=>x.overflow))throw Error('qa_workspace_overflow');
  return{authenticated:true,profile_matched:true,workspace_matched:true,core_loaded:true,workspace_ui:true,home_read:listing?'passed':'not_exercised_no_owned_qa_listing',widths,blocked_requests:blocked,mutating_business_requests:0};
 }finally{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('qa_browser_closed'));}pending.clear();socket?.close();await closeBrowser(cli);}
}
