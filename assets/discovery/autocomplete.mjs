const BASE='https://csebihpaychdkanjjsmz.supabase.co';
const KEY='sb_publishable_BM4ZQtOCUhjg7VqyFGJGRw_eFyTgI4j';
export function suggestionHref(row){
 if(!row||typeof row.slug!=='string'||!row.slug||! /^[a-z_]+$/.test(row.entity_type||''))return null;
 return '/'+(row.entity_type==='travel_place'?'travel-place':row.entity_type)+'/'+encodeURIComponent(row.slug);
}
// The same anonymous public search contract used by Zoi's command palette.
export async function searchSuggestions(query,filters={},signal,fetchImpl=fetch){
 const read=async f=>{const response=await fetchImpl(BASE+'/rest/v1/rpc/explore_search',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json'},signal,body:JSON.stringify({p_q:query.trim().slice(0,200),p_type:f.type||null,p_city:f.city||null,p_country:f.country||null,p_limit:8,p_offset:0})});if(!response.ok)throw Error('search_unavailable');const rows=await response.json();if(!Array.isArray(rows))throw Error('search_unavailable');const term=query.trim().toLocaleLowerCase();const rank=r=>{const n=String(r.name||'').toLocaleLowerCase();return n===term?0:n.startsWith(term)?1:n.includes(term)?2:3;};return rows.filter(suggestionHref).sort((a,b)=>rank(a)-rank(b)).slice(0,6).map(r=>({name:String(r.name||'Listing'),city:String(r.city||''),country:String(r.country||''),type:String(r.entity_type),href:suggestionHref(r)}));};
 if(query.trim().length<2)return{rows:[],outside:false};
 const rows=await read(filters);if(rows.length||!(filters.type||filters.city||filters.country))return{rows,outside:false};
 return{rows:await read({}),outside:true};
}
export function suggestionController({search=searchSuggestions,onState,delay=180,timeoutMs=6000,retryDelay=160}){
 let version=0,timer,controller;
 const cancel=()=>{version++;clearTimeout(timer);controller?.abort();};
 const run=(query,filters={})=>{
  cancel();const current=version;
  if(query.trim().length<2){onState({status:'closed',rows:[]});return;}
  onState({status:'loading',rows:[]});
  const attempt=async(retried=false)=>{
   if(current!==version)return;
   controller=new AbortController();const request=controller;
   let timeout;
   try{
    // Race as well as abort: an unresponsive transport must not trap the UI.
    const result=await Promise.race([
     search(query,filters,request.signal),
     new Promise((_,reject)=>{timeout=setTimeout(()=>{request.abort();reject(Error('search_timeout'));},timeoutMs);})
    ]);
    if(current===version)onState({status:'ready',...result});
   }catch(error){
    if(current!==version)return;
    if(!retried)timer=setTimeout(()=>attempt(true),retryDelay);
    else onState({status:'error',rows:[]});
   }finally{clearTimeout(timeout);}
  };
  timer=setTimeout(()=>attempt(),delay);
 };
 return{run,cancel};
}
export function attachAutocomplete(input,{filters=()=>({}),search=searchSuggestions,onSubmit=()=>{}}={}){
 const doc=input.ownerDocument,box=doc.createElement('div');box.className='discovery-suggestions';box.hidden=true;input.closest('.sbar').after(box);
 const note=doc.createElement('div');note.className='suggestion-status';note.setAttribute('role','status');note.setAttribute('aria-live','polite');
 const list=doc.createElement('div');list.id='explore-suggestions';list.setAttribute('role','listbox');list.setAttribute('aria-label','Suggested listings');
 box.append(note,list);input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',list.id);input.setAttribute('aria-expanded','false');
 let rows=[],active=-1,lastFilters="";
 const request=()=>{lastFilters=JSON.stringify(filters());queue.run(input.value,filters());};
 const close=()=>{queue.cancel();box.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;};
 const choose=i=>{if(rows[i]){close();doc.defaultView.location.assign(rows[i].href);}};
 const select=i=>{active=i;Array.from(list.children).forEach((el,index)=>el.setAttribute('aria-selected',String(index===i)));if(i>=0){input.setAttribute('aria-activedescendant','explore-suggestion-'+i);list.children[i]?.scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');};
 const queue=suggestionController({search,onState:state=>{rows=state.rows||[];active=-1;input.removeAttribute('aria-activedescendant');list.replaceChildren();box.hidden=state.status==='closed';input.setAttribute('aria-expanded',String(!box.hidden));note.replaceChildren();
 note.textContent=state.status==='loading'?'Finding matches…':state.status==='error'?'Suggestions could not load. ':rows.length?(state.outside?'Matches outside your selected filters — opening a page keeps your search filters.':'Suggested pages'):'No matching pages. Press Search to explore or change your filters.';
 if(state.status==='error'){const retry=doc.createElement('button');retry.type='button';retry.textContent='Retry';retry.addEventListener('click',()=>queue.run(input.value,filters()));note.append(retry);}
 rows.forEach((row,i)=>{const option=doc.createElement('div');option.id='explore-suggestion-'+i;option.setAttribute('role','option');option.setAttribute('aria-selected','false');const title=doc.createElement('strong');title.textContent=row.name;const sub=doc.createElement('span');sub.textContent=[row.type.replaceAll('_',' '),row.city,row.country].filter(Boolean).join(' · ');option.append(title,sub);option.addEventListener('pointerdown',e=>e.preventDefault());option.addEventListener('click',()=>choose(i));list.append(option);});
 }});
 input.addEventListener('input',request);input.addEventListener('focus',request);
 input.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();}else if(!box.hidden&&rows.length&&['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();select(event.key==='ArrowDown'?(active+1)%rows.length:(active<0?rows.length-1:(active-1+rows.length)%rows.length));}else if(event.key==='Enter'){event.preventDefault();if(!box.hidden&&active>=0)choose(active);else{close();onSubmit();}}else if(event.key==='Tab')close();});
 doc.addEventListener('pointerdown',event=>{if(event.target!==input&&!box.contains(event.target))close();});
 return{close,refresh:()=>{if(doc.activeElement===input&&JSON.stringify(filters())!==lastFilters)request();}};
}
