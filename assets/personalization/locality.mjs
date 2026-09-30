import {sessionIdentity} from '../community/session-state.mjs';
import {TOPICS,UUID} from '../community/view-model.mjs';
const text=value=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,120):'';
export function privateLocality(receipt){
 if(receipt?.ok!==true||!UUID.test(receipt.profile?.id||''))throw Error('preferences_unconfirmed');
 const p=receipt.preferences||{},city=text(p.city),country=text(p.country);
 return{home:p.locality_enabled===true&&(city||country)?{city,country}:null,topics:Array.isArray(p.topics)?[...new Set(p.topics.filter(t=>TOPICS.includes(t)))].slice(0,8):[],version:Number.isSafeInteger(p.version)&&p.version>=0?p.version:0};
}
export function resolveLocality(url,home){
 const u=new URL(url,'https://www.zoi.city'),p=u.searchParams;
 // Searching elsewhere, a shared place, map viewport, or explicit global mode
 // must never be silently narrowed by the account's saved home.
 if(p.get('scope')==='global'&&!['city','country','region','q','place'].some(k=>p.get(k)))return{source:'global',city:'',country:'',label:'Everywhere'};
 if(['city','country','region','q','place'].some(k=>p.has(k))||u.hash)return{source:'explicit',city:text(p.get('city')),country:text(p.get('country')),label:[text(p.get('city')),text(p.get('country'))].filter(Boolean).join(', ')||'Your selected search'};
 if(home&&(text(home.city)||text(home.country)))return{source:'home',city:text(home.city),country:text(home.country),label:[text(home.city),text(home.country)].filter(Boolean).join(', ')};
 return{source:'global',city:'',country:'',label:'Everywhere'};
}
// History stores only the explicit browse URL, never the account's home value.
// Generated map viewport hashes must not turn an implicit home into a new destination.
export function mapHistoryIntent(url,state){const current=new URL(url,'https://www.zoi.city');try{const saved=new URL(state?.zoiMapIntent,current);if(typeof state?.zoiMapIntent==='string'&&saved.origin===current.origin&&saved.pathname===current.pathname)return saved.href;}catch{}return current.href;}
export function homeDestination(url,home){
 const u=new URL(url,'https://www.zoi.city');for(const key of ['q','city','country','region','place','scope'])u.searchParams.delete(key);u.hash='';
 // Returning home restores the private default; it does not put home in a share URL.
 return u.pathname+u.search;
}
// Private, memory-only projection. Never persists home, topics, tokens or IDs to
// localStorage; no preference writer is called by browsing or this reader.
export function createLocalityReader({core,onChange=()=>{},fetchImpl=fetch,events=globalThis,pollMs=1000,read=null}={}){
 if(!core?.auth)throw Error('account_unavailable');
 let account=sessionIdentity(core),epoch=0,controller=null,dead=false,state={status:'guest',home:null,topics:[],version:0};
 const emit=value=>{state=value;onChange({...state,home:state.home?{...state.home}:null,topics:[...state.topics]});};
 const clear=status=>emit({status,home:null,topics:[],version:0});
 const perform=read||(async(signal)=>{if(!await core.auth.ensureFresh())throw Error('signed_out');if(signal.aborted)throw Error('cancelled');const token=core.auth.token();if(!token)throw Error('signed_out');const r=await fetchImpl(core.BASE+'/rest/v1/rpc/community_me',{method:'POST',headers:{apikey:core.KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}',signal,cache:'no-store',credentials:'omit'});if(!r.ok)throw Error('preferences_unavailable');return r.json();});
 async function refresh(){
  const mine=++epoch,previousAccount=account;controller?.abort();controller=null;account=sessionIdentity(core);if(dead)return;if(!account){clear('guest');return;}
  const owner=account;controller=new AbortController();const request=controller;if(previousAccount===owner&&(state.status==='ready'||state.status==='loading'))emit({...state,status:'loading'});else clear('loading');const timeout=setTimeout(()=>request.abort(),10000);
  try{const receipt=await perform(request.signal);if(dead||mine!==epoch||owner!==sessionIdentity(core)||request.signal.aborted)return;emit({status:'ready',...privateLocality(receipt)});}catch(error){if(!dead&&mine===epoch&&owner===sessionIdentity(core))clear('error');}finally{clearTimeout(timeout);}
 }
 function checkAccount(){if(dead)return;if(sessionIdentity(core)!==account){epoch++;controller?.abort();clear('guest');void refresh();}}
 const authChange=()=>{checkAccount();};const focus=()=>{if(dead)return;if(sessionIdentity(core)!==account)checkAccount();else if(account)void refresh();};const storage=event=>{if(!event.key||event.key===core.keys?.auth)checkAccount();};
 events.addEventListener?.('zoi:auth-change',authChange);events.addEventListener?.('storage',storage);events.addEventListener?.('focus',focus);
 const timer=pollMs>0?setInterval(checkAccount,pollMs):null;
 return{refresh,checkAccount,snapshot:()=>({...state,home:state.home?{...state.home}:null,topics:[...state.topics]}),destroy(){if(dead)return;dead=true;epoch++;controller?.abort();if(timer)clearInterval(timer);events.removeEventListener?.('zoi:auth-change',authChange);events.removeEventListener?.('storage',storage);events.removeEventListener?.('focus',focus);clear('guest');}};
}

export function mountLocalityControl({core,container,getURL=()=>location.href,onChange=()=>{},onNavigate=href=>{location.href=href;},...readerOptions}){
 const doc=container.ownerDocument;let snapshot={status:'guest',home:null,topics:[],version:0},reader;
 container.classList.add('zoi-locality');container.setAttribute('aria-label','Your discovery location');
 function paint(){const context=resolveLocality(getURL(),snapshot.home);container.replaceChildren();const label=doc.createElement('span');label.textContent='Exploring '+context.label+(context.source==='home'?' · Your saved home':'');container.append(label);
 const button=(label,action)=>{const b=doc.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',action);container.append(b);};
 if(snapshot.home&&context.source!=='home')button('Back to home',()=>onNavigate(homeDestination(getURL(),snapshot.home)));
 if(context.source!=='global')button('Everywhere',()=>{const u=new URL(getURL(),'https://www.zoi.city');for(const key of ['city','country','region','place','q'])u.searchParams.delete(key);u.hash='';u.searchParams.set('scope','global');onNavigate(u.pathname+u.search);});
 if(snapshot.status==='error')button('Retry home preferences',()=>reader.refresh());
 const manage=doc.createElement('a');manage.href='/community/?preferences=1';manage.textContent=snapshot.status==='guest'?'Personalize in Community':'Location preferences';container.append(manage);
 }
 reader=createLocalityReader({core,...readerOptions,onChange:value=>{snapshot=value;paint();onChange(value);}});paint();void reader.refresh();
 return{refresh:paint,getHome:()=>snapshot.home?{...snapshot.home}:null,destroy:()=>{reader.destroy();container.replaceChildren();}};
}
