const OCCASIONS=['Just the two of us','A catch-up with friends','Something to celebrate','A family evening','A meal on my own'];
const PREFERENCES=['Courtyard seating','Dietary questions','Accessibility'];
export function bochumToday(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function makePlan(data,today=bochumToday()){
 if(!OCCASIONS.includes(data.occasion)||!Number.isInteger(Number(data.party))||Number(data.party)<1||Number(data.party)>12)throw Error('Please choose an occasion and party size.');
 if(typeof data.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(data.date)||data.date<today)throw Error('Please choose today or a future day.');
 const instant=new Date(data.date+'T12:00:00Z');if(!Number.isFinite(instant.getTime())||instant.toISOString().slice(0,10)!==data.date)throw Error('Please choose a valid date.');
 const preferences=Array.isArray(data.preferences)?[...new Set(data.preferences.filter(p=>PREFERENCES.includes(p)))]:[];
 const dateLabel=new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(instant);
 const party=Number(data.party),partyLabel=party===12?'12 or more people':party===1?'1 person':party+' people';
 const questions={ 'Courtyard seating':'Would courtyard seating be possible?', 'Dietary questions':'Could we discuss dietary requirements before reserving?', 'Accessibility':'Could you help us check the access and seating arrangements?' };
 const script=`Hello Avli, I’d like to ask about a table for ${partyLabel} on ${dateLabel}. ${data.occasion==='Something to celebrate'?'We have something to celebrate. ':''}What times would be possible?${preferences.length?' '+preferences.map(p=>questions[p]).join(' '):''}`;
 const occasionLabel=(data.occasion==='Just the two of us'&&party!==2)||(data.occasion==='A meal on my own'&&party!==1)?'An evening together':data.occasion;
 const summary=`${occasionLabel} · ${partyLabel}\n${dateLabel} · Bochum`;
 return {occasion:data.occasion,party,date:data.date,preferences,dateLabel,partyLabel,summary,script,text:`My Avli evening\n${summary}\n\n${script}\n\nCall +49 234 6404778 from 15:00, Bochum time.\nLuisenstraße 14, 44787 Bochum\nThis is a personal plan, not a confirmed reservation.\nhttps://avli.de/`};
}
if(typeof document!=='undefined'){
 const $=s=>document.querySelector(s),planner=$('#planner'),gallery=$('#gallery'),form=$('#plan-form'),result=$('#plan-result'),storageKey='zoi.avli.visit.v1';let current=null,photo=0,toastTimer;
 const photos=[['0368','Blue doors, courtyard views.','A table looking through blue doors into Avli’s courtyard'],['0249','It’s the little details.','A rose and a lantern on a table in Avli’s courtyard'],['0362','A table set for good company.','Wine and glasses on a table at Avli'],['0338','A moment at Avli.','A man playing a stringed instrument at Avli']];
 function status(text){$('#page-status').textContent=text;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#page-status').textContent='',4500);}
 function open(dialog){dialog.showModal();document.body.style.overflow='hidden';}
 [planner,gallery].forEach(dialog=>{dialog.addEventListener('close',()=>document.body.style.overflow='');dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});});
 document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>$('#'+button.dataset.close).close()));
 function fill(plan){form.elements.occasion.value=plan.occasion;form.elements.party.value=String(plan.party);form.elements.date.value=plan.date;form.querySelectorAll('[name=preference]').forEach(input=>input.checked=plan.preferences.includes(input.value));}
 function showResult(plan,focus=true){current=plan;form.hidden=true;result.hidden=false;$('.planner-intro').hidden=true;$('#planner-title').hidden=true;$('#plan-summary').textContent=plan.summary;$('#plan-summary').style.whiteSpace='pre-line';$('#call-script').textContent=plan.script;if(focus){$('#result-title').tabIndex=-1;$('#result-title').focus();}}
 function edit(){form.hidden=false;result.hidden=true;$('.planner-intro').hidden=false;$('#planner-title').hidden=false;$('#planner-status').textContent='';form.elements.occasion.focus();}
 function openPlan(occasion){form.elements.date.min=bochumToday();$('#planner-status').textContent='';if(occasion){form.elements.occasion.value=occasion;if(occasion==='A meal on my own')form.elements.party.value='1';edit();}open(planner);}
 document.querySelectorAll('[data-open-plan]').forEach(button=>button.addEventListener('click',()=>openPlan()));
 document.querySelectorAll('[data-occasion]').forEach(button=>button.addEventListener('click',()=>openPlan(button.dataset.occasion)));
 form.addEventListener('submit',e=>{e.preventDefault();try{const data=new FormData(form),plan=makePlan({occasion:data.get('occasion'),party:data.get('party'),date:data.get('date'),preferences:data.getAll('preference')});showResult(plan);try{localStorage.setItem(storageKey,JSON.stringify({occasion:plan.occasion,party:plan.party,date:plan.date,preferences:plan.preferences}));$('#planner-status').textContent='Your plan is saved in this browser.';}catch{$('#planner-status').textContent='Your plan is ready. Browser storage is unavailable, so copy it to keep it.';}}catch(error){$('#planner-status').textContent=error.message;}});
 $('#edit-plan').addEventListener('click',edit);
 $('#clear-plan').addEventListener('click',()=>{try{localStorage.removeItem(storageKey);}catch{}current=null;form.reset();edit();$('#planner-status').textContent='Saved plan cleared from this browser.';});
 $('#copy-plan').addEventListener('click',async()=>{if(!current)return;try{await navigator.clipboard.writeText(current.text);$('#planner-status').textContent='Your plan is copied. Share it with your company.';}catch{$('#planner-status').textContent='Copy is unavailable in this browser. Select the plan text above to copy it.';}});
 try{const saved=localStorage.getItem(storageKey);if(saved){const plan=makePlan(JSON.parse(saved));fill(plan);showResult(plan,false);}}catch{try{localStorage.removeItem(storageKey);}catch{}}
 function showPhoto(delta=0){photo=(photo+delta+photos.length)%photos.length;const [id,caption,alt]=photos[photo];$('#gallery-photo').src=`https://avli.de/wp-content/uploads/2024/05/DSC_${id}-copy.jpg`;$('#gallery-photo').alt=alt;$('#gallery-caption').textContent=caption;$('#gallery-count').textContent=`${photo+1} / ${photos.length}`;}
 ['#gallery-open','#gallery-more'].forEach(id=>$(id).addEventListener('click',()=>{showPhoto();open(gallery);}));$('#gallery-prev').addEventListener('click',()=>showPhoto(-1));$('#gallery-next').addEventListener('click',()=>showPhoto(1));gallery.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();showPhoto(e.key==='ArrowRight'?1:-1);}});
 $('#share-place').addEventListener('click',async()=>{const url=location.origin+location.pathname;try{if(navigator.share)await navigator.share({title:'A Greek evening at Taverna Avli',text:'A little Greece in the heart of Bochum.',url});else{await navigator.clipboard.writeText(url);status('Link copied. Bring someone along.');}}catch(error){if(error.name!=='AbortError')status('Share this page using your browser’s address bar.');}});
}
