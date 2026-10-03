/** Public country/city names only. Search choices never save a member's home. */
export function cityChoices(rows,country=''){
 if(!Array.isArray(rows))throw Error('city_response_unavailable');
 const choices=new Map();
 for(const row of rows){
  if(!row||typeof row.city!=='string'||typeof row.country!=='string')continue;
  const city=row.city.trim(),name=row.country.trim();
  if(!city||!name||(country&&name!==country))continue;
  const key=name+'\n'+city;
  if(!choices.has(key))choices.set(key,{city,country:name});
 }
 return [...choices.values()].sort((a,b)=>a.city.localeCompare(b.city));
}
export function countryChoices(rows){
 if(!Array.isArray(rows))throw Error('country_response_unavailable');
 return [...new Set(rows.map(r=>typeof r?.country==='string'?r.country.trim():'').filter(Boolean))].sort((a,b)=>a.localeCompare(b));
}
export function mountCityPicker({trigger,current=()=>({}),onChoose,read}){
 const doc=trigger.ownerDocument,dialog=doc.createElement('dialog');dialog.className='directory-city-picker';dialog.setAttribute('aria-labelledby','directory-city-title');
 dialog.innerHTML='<header><h2 id="directory-city-title">Choose your area</h2><button type="button" data-close aria-label="Close area picker">×</button></header><p data-current></p><label>Country<select data-country aria-label="Country for city search"><option value="">Choose a country</option></select></label><label>City<input type="search" role="combobox" aria-autocomplete="list" aria-controls="directory-city-results" aria-expanded="false" data-query placeholder="Start typing a city…" autocomplete="off" aria-label="Find a city"></label><p role="status" aria-live="polite" data-status></p><button type="button" data-retry hidden>Retry loading places</button><div id="directory-city-results" data-choices role="listbox" aria-label="Matching cities"></div><footer><button type="button" data-country-all disabled>Every city in this country</button><button type="button" data-global>Everywhere</button></footer>';
 doc.body.append(dialog);
 const q=s=>dialog.querySelector(s),country=q('[data-country]'),query=q('[data-query]'),status=q('[data-status]'),choices=q('[data-choices]'),retry=q('[data-retry]'),all=q('[data-country-all]');
 let generation=0,controller=null,cities=[],matches=[],active=-1,activeCountry='',phase='countries';
 const cancel=()=>{generation++;controller?.abort();};
 const close=()=>{cancel();dialog.close();trigger.focus();};
 const choose=value=>{close();onChoose(value);};
 const render=()=>{choices.replaceChildren();active=-1;query.removeAttribute('aria-activedescendant');const term=query.value.trim().toLocaleLowerCase();const allMatches=cities.filter(x=>!term||x.city.toLocaleLowerCase().includes(term));matches=allMatches.slice(0,50);query.setAttribute('aria-expanded',String(!!activeCountry&&matches.length>0));
  if(!activeCountry){status.textContent='Choose a country to browse its cities.';return;}
  status.textContent=allMatches.length?allMatches.length+' matching '+(allMatches.length===1?'city':'cities'):'No matching cities. Try another spelling or country.';
  for(const [index,row] of matches.entries()){const button=doc.createElement('button');button.type='button';button.id='directory-city-option-'+index;button.setAttribute('role','option');button.setAttribute('aria-selected','false');button.textContent=row.city;button.addEventListener('click',()=>choose(row));choices.append(button);}
  if(allMatches.length>50)status.textContent+=' Showing the first 50. Keep typing to narrow the list.';
 };
 async function load(){
  cancel();const version=generation;controller=new AbortController();matches=[];active=-1;query.removeAttribute('aria-activedescendant');query.setAttribute('aria-expanded','false');retry.hidden=true;choices.replaceChildren();status.textContent=phase==='countries'?'Loading countries…':'Loading cities…';query.disabled=true;all.disabled=true;
  try{
   if(phase==='countries'){
    const rows=await read('explore_regions',{p_country:null},controller.signal);if(version!==generation||!dialog.open)return;
    const names=countryChoices(rows);country.replaceChildren(new Option('Choose a country',''));
    for(const name of names)country.append(new Option(name,name));
    const selected=current().country||'';if(names.includes(selected))country.value=selected;
    if(country.value){phase='cities';await load();return;}
    cities=[];activeCountry='';render();
   }else{
    const selected=country.value,rows=await read('explore_region_cities',{p_country:selected,p_region:null},controller.signal);if(version!==generation||!dialog.open||selected!==country.value)return;
    cities=cityChoices(rows,selected);activeCountry=selected;query.disabled=false;all.disabled=false;all.textContent='Every city in '+selected;render();query.focus();
   }
  }catch(error){if(version!==generation||!dialog.open)return;status.textContent=phase==='countries'?'Countries could not load. Your current search has not changed.':'Cities could not load. Your current search has not changed.';retry.hidden=false;}
 }
 trigger.addEventListener('click',()=>{cancel();cities=[];activeCountry='';phase='countries';query.value='';const selected=current();q('[data-current]').textContent=selected.city?'Current search: '+[selected.city,selected.country].filter(Boolean).join(', '):selected.country?'Current search: '+selected.country:'Current search: Everywhere';dialog.showModal();country.focus();load();});
 q('[data-close]').addEventListener('click',close);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 country.addEventListener('change',()=>{cities=[];activeCountry='';query.value='';if(country.value){phase='cities';load();}else{cancel();retry.hidden=true;query.disabled=true;all.disabled=true;render();}});
 query.addEventListener('input',render);query.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp'].includes(event.key)&&matches.length){event.preventDefault();active=event.key==='ArrowDown'?(active+1)%matches.length:(active<0?matches.length-1:(active-1+matches.length)%matches.length);Array.from(choices.children).forEach((el,i)=>el.setAttribute('aria-selected',String(i===active)));query.setAttribute('aria-activedescendant','directory-city-option-'+active);choices.children[active]?.scrollIntoView({block:'nearest'});}else if(event.key==='Enter'&&active>=0){event.preventDefault();choose(matches[active]);}});retry.addEventListener('click',load);all.addEventListener('click',()=>{if(activeCountry)choose({city:'',country:activeCountry});});q('[data-global]').addEventListener('click',()=>choose({city:'',country:''}));
 return{close,destroy(){cancel();dialog.remove();}};
}
