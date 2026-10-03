import {mountPosterComposer} from './poster-composer.mjs';
// A single accessible modal shared by event pages and business homes.
export function openPosterDialog(event,{opener=document.activeElement}={}){
 const dialog=document.createElement('dialog');dialog.className='zoi-poster-dialog';dialog.setAttribute('aria-label','Share this event with your people');
 // Critical modal geometry keeps the panel usable before the shared stylesheet arrives.
 Object.assign(dialog.style,{width:'min(900px, calc(100vw - 24px))',maxHeight:'calc(100dvh - 24px)',padding:'0',border:'0',borderRadius:'24px',background:'#edf7fd',overflow:'auto',boxSizing:'border-box'});
 const host=document.createElement('div');dialog.append(host);document.body.append(dialog);let destroyed=false;
 const destroy=()=>{if(destroyed)return;destroyed=true;composer.destroy();dialog.remove();if(opener?.isConnected)opener.focus({preventScroll:true});};
 const composer=mountPosterComposer({root:host,event,onClose:()=>dialog.close()});
 dialog.addEventListener('close',destroy,{once:true});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
 dialog.showModal();host.querySelector('[data-close]')?.focus();return{destroy};
}
