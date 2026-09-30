import {eventRoomPlan,eventTablePreference} from './room-plans.mjs';
export function mountEventRoom(entity,root=document){
 const config=eventRoomPlan(entity),host=root.querySelector('[data-event-room]'),opener=root.querySelector('[data-open-event-room]');
 if(!config||!host||!opener)return()=>{};
 const events=new AbortController(),signal=events.signal,status=root.querySelector('[data-event-room-status]'),next=root.querySelector('[data-continue-event-room]'),field=root.querySelector('[name="preferred_table"]');let scene=null,disposed=false,selected=null;
 function choose(table){selected=table?eventTablePreference(entity,table.id):null;if(field)field.value=selected?.id||'';next.disabled=!selected;next.textContent=selected?'Continue with table '+selected.id+' →':'Choose a table to continue';status.textContent=selected?'Table '+selected.id+' selected as a preference. No seats are held.':'Choose a table to explore.';const result=root.querySelector('#request-result');if(result)result.hidden=true;}
 opener.addEventListener('click',async()=>{opener.disabled=true;status.textContent='Opening the interactive room…';host.hidden=false;try{const {mountRoomScene}=await import('./room-scene.mjs?v=20260930-room-ready');if(disposed)return;scene?.destroy();scene=await mountRoomScene(host,{...config,onSelect:choose,onContinue:continueWithTable});if(disposed){scene?.destroy();return;}opener.hidden=true;status.textContent='Drag to explore the room, or choose a table number. Selection is a preference.';}catch{if(!disposed){status.textContent='The interactive room could not load. Try again or open the original seating plan below.';opener.textContent='Try the interactive room again';}}finally{if(!disposed)opener.disabled=false;}},{signal});
 function continueWithTable(){if(!selected)return;const form=root.querySelector('#request-form');form?.scrollIntoView({behavior:globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});form?.querySelector('[name="quantity"]')?.focus({preventScroll:true});}
 next.addEventListener('click',continueWithTable,{signal});
 root.querySelector('[data-clear-event-table]')?.addEventListener('click',()=>{choose(null);scene?.select(null);},{signal});
 return()=>{disposed=true;events.abort();scene?.destroy();};
}
