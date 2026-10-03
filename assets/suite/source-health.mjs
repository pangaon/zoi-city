import {officialSiteURL, officialSourceQuarantined, selectedOfficialWebsite} from '../enrichment/official-source-policy.mjs';

const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const own=(value,key)=>Object.hasOwn(object(value),key);
function websiteChoice(entity){
  const owner=object(entity?.owner_content),profile=object(entity?.profile);
  for(const layer of [owner,object(owner.profile),profile])if(own(layer,'website'))return{owner:true,value:layer.website};
  return{owner:false,value:entity?.website};
}
function sourceHost(value){try{return new URL(officialSiteURL(value)).hostname;}catch{return '';}}

/** Saved authority and editable draft are deliberately separate. No source fetch or writer. */
export function sourceReviewState(entity,draft=''){
  const chosen=websiteChoice(entity),receipt=object(entity?.profile?._enrich);
  const published=selectedOfficialWebsite(entity),held=officialSourceQuarantined(entity);
  const rawDraft=typeof draft==='string'?draft.trim():'';
  const validDraft=!rawDraft||!!officialSiteURL(rawDraft);
  const state=chosen.owner?(published?'owner-url':'owner-clear'):(held?'import-held':published?'import-url':'no-url');
  return{state,published,owner:chosen.owner,held,sourceHost:sourceHost(receipt.source_url),
    draft:rawDraft,validDraft,changed:rawDraft!==(typeof chosen.value==='string'?chosen.value.trim():''),
    title:{'owner-url':'Your published website','owner-clear':'Website link removed','import-held':'Imported website needs review','import-url':'Review your website','no-url':'Add your official website'}[state]};
}

/** Actions edit the existing Page details draft; its existing Save page owns publication. */
export function mountSourceReview(root,{entity,getDraft,onUse,onFocus,isCurrent=()=>true}={}){
  const doc=root.ownerDocument,controller=new AbortController();let saved=entity;
  const card=doc.createElement('section');card.className='zoi-source-review';card.setAttribute('aria-label','Website and source review');
  const tag=doc.createElement('p');tag.className='zoi-source-review-eyebrow';tag.textContent='YOUR BUSINESS HOME';
  const heading=doc.createElement('h3'),description=doc.createElement('p'),address=doc.createElement('p'),source=doc.createElement('p');
  description.className='zoi-source-review-description';address.className='zoi-source-review-address';source.className='zoi-source-review-origin';
  const actions=doc.createElement('div');actions.className='zoi-source-review-actions';
  function button(label,action){const node=doc.createElement('button');node.type='button';node.textContent=label;node.addEventListener('click',()=>{if(!controller.signal.aborted&&isCurrent())action();},{signal:controller.signal});actions.appendChild(node);return node;}
  button('Review website address',()=>onFocus?.());
  const restore=button('Use saved choice',()=>{const state=sourceReviewState(saved,getDraft?.());onUse?.(state.published);update();});
  const remove=button('Remove website link',()=>{onUse?.('');update();});
  const note=doc.createElement('p');note.className='zoi-source-review-note';note.setAttribute('role','status');note.setAttribute('aria-live','polite');
  card.append(tag,heading,description,address,source,actions,note);root.replaceChildren(card);
  function update(next){
    if(controller.signal.aborted||!isCurrent())return;if(next)saved=next;
    const state=sourceReviewState(saved,getDraft?.());heading.textContent=state.title;
    description.textContent=state.owner?(state.published?'This is your saved choice. Imported details do not replace it.':'Your saved choice removes the public website link. Imported details do not bring it back.'):
      state.held?'The imported website or organization details need review. The imported link is withheld from public actions. You can choose the address customers should use.':
      state.published?'Check that this address belongs to your business. Saving Page details makes the address your choice.':'Choose the address customers should use, or leave the website link empty.';
    address.textContent=state.published||'No website link is currently selected for public actions.';
    source.textContent=state.sourceHost?'Imported source: '+state.sourceHost:'';source.hidden=!state.sourceHost;
    restore.hidden=!state.changed;remove.disabled=!state.draft;
    note.textContent=!state.validDraft?'Enter a complete http(s) website address without a username or password.':state.changed?
      (state.draft?'Website change is in your draft. Save page to publish it.':'Website removal is in your draft. Save page to publish it.'):
      'Reviewing an address does not verify its ownership or refresh imported content.';
    card.dataset.sourceState=state.state;
  }
  update();
  return{update,dispose(){controller.abort();root.replaceChildren();}};
}
