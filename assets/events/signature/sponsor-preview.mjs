import{TORONTO_PREVIEW_BUSINESSES,sponsorPreviewConfig}from'./sponsor-preview-model.mjs';
export function mountSponsorPreview({root,previewMode=false,eventKey,tableId,allowedTableIds,businessId=TORONTO_PREVIEW_BUSINESSES[0].id,onPlacement,onInspect}={}){
 if(!root)throw Error('Preview host required');if(previewMode!==true){root.replaceChildren();return{setTable(){},open(){},close(){},destroy(){}};}let config=sponsorPreviewConfig({previewMode,eventKey,tableId,allowedTableIds,businessId}),ended=false,opener=null,placed=false,placementEpoch=0,logoEpoch=0,logoKey=null,boundsFrame=null;const abort=new AbortController(),signal=abort.signal;
 if(!document.querySelector('link[data-sponsor-preview]')){const l=document.createElement('link');l.rel='stylesheet';l.href='/assets/events/signature/sponsor-preview.css';l.dataset.sponsorPreview='';document.head.append(l);}root.classList.add('sp-demo');root.innerHTML='<div class="sp-demo-label">Sponsor preview · demonstration only</div><button data-open class="sp-demo-trigger">Explore a sample placement</button><section class="sp-demo-card" hidden aria-label="Demonstration sponsor placement"><header><span>Sponsor preview · demonstration only</span><button data-close aria-label="Close sponsor preview">×</button></header><p data-table></p><label>Preview business<select></select></label><div class="sp-demo-logo" data-logo-state="pending" aria-busy="true"><img alt="" hidden><span data-logo-status role="status"></span></div><h3></h3><p data-description></p><div class="sp-placement-actions"><button type="button" data-inspect>View display on table</button><button type="button" data-remove>Remove test display</button></div><p data-placement-status role="status"></p><a data-profile>Explore this business on Zoi →</a><details><summary>About this demonstration</summary><p>This real Toronto listing is shown only to preview the placement design. No sponsorship, event affiliation, offer or discount is claimed.</p><a data-source target="_blank" rel="noopener noreferrer">Business image source ↗</a></details></section>';
 const q=s=>root.querySelector(s),card=q('.sp-demo-card');for(const b of TORONTO_PREVIEW_BUSINESSES){const o=document.createElement('option');o.value=b.id;o.textContent=b.name;q('select').append(o);}function measureDrawer(){
  boundsFrame=null;if(ended)return;
  const drawer=root.closest('.sv-demo-tools'),viewport=drawer?.closest('.fc-viewport');
  if(!drawer||!viewport)return;
  const box=drawer.getBoundingClientRect(),area=viewport.getBoundingClientRect(),controls=viewport.parentElement?.querySelector('.fc-controls')?.getBoundingClientRect();
  // Anchor before sizing: a bottom-anchored drawer's changing height must not
  // feed its own measured top back into the next available-height calculation.
  const top=Math.max(area.top+12,controls?controls.bottom+8:area.top+12);
  let bottom=area.bottom-12;
  const selection=viewport.closest('.signature-venue')?.querySelector('.sv-inspector');
  if(selection&&selection.getClientRects().length){
   const panel=selection.getBoundingClientRect();
   if(panel.left<box.right&&panel.right>box.left&&panel.bottom>area.top&&panel.top<area.bottom)
    bottom=Math.min(bottom,panel.top-12);
  }
  const height=Math.max(44,Math.floor(bottom-top)),offset=Math.ceil(top-area.top)+'px';
  if(drawer.style.top!==offset)drawer.style.setProperty('top',offset,'important');
  drawer.style.setProperty('bottom','auto','important');
  if(drawer.style.maxHeight!==height+'px')drawer.style.maxHeight=height+'px';
 }
 function scheduleBounds(){if(!ended&&boundsFrame===null)boundsFrame=requestAnimationFrame(measureDrawer);}
 const drawer=root.closest('.sv-demo-tools'),viewport=drawer?.closest('.fc-viewport'),selection=viewport?.closest('.signature-venue')?.querySelector('.sv-inspector');
 const observer=typeof ResizeObserver==='function'?new ResizeObserver(scheduleBounds):null;
 for(const element of [drawer,viewport,selection])if(element)observer?.observe(element);
 drawer?.addEventListener('toggle',scheduleBounds,{signal});
 window.addEventListener('resize',scheduleBounds,{signal});document.addEventListener('fullscreenchange',scheduleBounds,{signal});scheduleBounds();
 function updateLogo(b){
  const key=b.id+'|'+b.image;if(key===logoKey)return;logoKey=key;
  const epoch=++logoEpoch,host=q('.sp-demo-logo'),status=q('[data-logo-status]'),image=document.createElement('img');
  image.alt=b.name+' logo';image.hidden=true;host.dataset.logoState='pending';host.setAttribute('aria-busy','true');
  status.textContent=b.name+' · Loading logo…';
  function settle(loaded){
   if(ended||epoch!==logoEpoch||image!==host.querySelector('img'))return;
   host.dataset.logoState=loaded?'loaded':'unavailable';host.setAttribute('aria-busy','false');image.hidden=!loaded;
   status.textContent=loaded?'':b.name+' · Logo unavailable';scheduleBounds();
  }
  image.addEventListener('load',()=>settle(image.naturalWidth>0),{signal,once:true});
  image.addEventListener('error',()=>settle(false),{signal,once:true});
  host.querySelector('img').replaceWith(image);image.src=b.image;
  if(image.complete&&image.naturalWidth>0)settle(true);
 }
 function update(){const b=config.business;q('[data-table]').textContent='Table '+config.tableId+' · sample placement';q('select').value=b.id;updateLogo(b);q('h3').textContent=b.name;q('[data-description]').textContent=b.description;q('[data-profile]').href=b.url;q('[data-source]').href=b.source;scheduleBounds();}
 async function place(){const epoch=++placementEpoch;const id=config.tableId;q("[data-placement-status]").textContent="Preparing the test display…";try{const shown=await onPlacement?.({tableId:id,business:config.business});if(ended||epoch!==placementEpoch)return false;placed=shown===true;q("[data-placement-status]").textContent=placed?"TEST display on table "+id+". This is not an approved event sponsorship.":"The room display could not open. The business card remains available.";return placed;}catch{if(!ended&&epoch===placementEpoch){placed=false;q("[data-placement-status]").textContent="The room display could not open. Try again or use the business card.";}return false;}}function close(){card.hidden=true;q('[data-open]').setAttribute('aria-expanded','false');if(opener?.isConnected)opener.focus({preventScroll:true});}function open({trigger}={}){if(ended)return;opener=trigger||q('[data-open]');update();place();card.hidden=false;q('[data-open]').setAttribute('aria-expanded','true');q('[data-close]').focus({preventScroll:true});}q('[data-open]').setAttribute('aria-expanded','false');q('[data-open]').addEventListener('click',()=>open(),{signal});q('[data-close]').addEventListener('click',close,{signal});card.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}},{signal});q('select').addEventListener('change',e=>{config=sponsorPreviewConfig({previewMode,eventKey,tableId:config.tableId,allowedTableIds,businessId:e.target.value});update();place();},{signal});q('[data-inspect]').addEventListener('click',async()=>{if(await place())onInspect?.();},{signal});q('[data-remove]').addEventListener('click',()=>{placementEpoch++;placed=false;onPlacement?.(null);q('[data-placement-status]').textContent='Test display removed from the room.';},{signal});return{open,close,setTable(id){if(ended)return;config=sponsorPreviewConfig({previewMode,eventKey,tableId:String(id),allowedTableIds,businessId:config.business.id});if(!card.hidden)update();if(placed)place();},destroy(){ended=true;placementEpoch++;logoEpoch++;observer?.disconnect();if(boundsFrame!==null)cancelAnimationFrame(boundsFrame);abort.abort();root.replaceChildren();root.classList.remove('sp-demo');}};
}
