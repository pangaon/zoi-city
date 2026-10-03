// Public listing/workspace intent only. No credentials, arbitrary redirects or automatic claims.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SLUG=/^[a-z0-9][a-z0-9_-]{0,199}$/;
export function claimDestination({listing,slug,workspace=null}={}){
 if(!UUID.test(listing||'')||!SLUG.test(slug||'')||(workspace!==null&&!UUID.test(workspace)))return null;
 const p=new URLSearchParams();if(workspace)p.set('workspace',workspace);p.set('claim_listing',listing);p.set('claim_slug',slug);return '/explore/?'+p;
}
export function parseClaimDestination(value){
 if(typeof value!=='string'||value.length>600||!value.startsWith('/explore/?'))return null;
 let u;try{u=new URL(value,'https://zoi.invalid');}catch{return null;}
 if(u.origin!=='https://zoi.invalid'||u.pathname!=='/explore/'||u.hash||u.username||u.password)return null;
 const allowed=['claim_listing','claim_slug','workspace'];if([...u.searchParams.keys()].some(k=>!allowed.includes(k)||u.searchParams.getAll(k).length!==1))return null;
 const intent={listing:u.searchParams.get('claim_listing'),slug:u.searchParams.get('claim_slug'),workspace:u.searchParams.get('workspace')};return claimDestination(intent)===value?intent:null;
}
export function socialClaimDestination(url){try{const p=new URL(url,'https://zoi.invalid').searchParams,values=p.getAll('claim_return');return values.length===1&&parseClaimDestination(values[0])?values[0]:null;}catch{return null;}}
export function exploreClaimIntent(url){try{const p=new URL(url,'https://zoi.invalid').searchParams;for(const k of ['claim_listing','claim_slug','workspace'])if(p.getAll(k).length>1)return null;return parseClaimDestination(claimDestination({listing:p.get('claim_listing'),slug:p.get('claim_slug'),workspace:p.get('workspace')}));}catch{return null;}}
export function socialAfterCreation(url,workspace){const previous=socialClaimDestination(url),intent=parseClaimDestination(previous),next=intent&&claimDestination({...intent,workspace});return '/social?workspace='+encodeURIComponent(workspace)+(next?'&claim_return='+encodeURIComponent(next):'');}
export function renderClaimReturn({root,C,url,current,create,signOut,navigate=href=>location.assign(href)}){
 const destination=socialClaimDestination(url);if(!destination)return false;
 root.replaceChildren();const doc=root.ownerDocument,wrap=doc.createElement('div'),card=doc.createElement('section');wrap.className='center';card.className='card';const title=doc.createElement('h1');title.textContent='Continue your ownership request';const description=doc.createElement('p');description.className='sub';description.textContent='You are signed in. Return to the exact listing and choose a workspace you manage. Nothing has been claimed or submitted.';const status=doc.createElement('p');status.setAttribute('role','status');const button=(text,fn)=>{const b=doc.createElement('button');b.type='button';b.className='btn p';b.style.margin='6px';b.textContent=text;b.onclick=()=>{if(!current()){status.textContent='Your account changed. Sign in again before continuing.';b.disabled=true;return;}fn();};return b;};card.append(title,description,button('Continue to listing',()=>navigate(destination)),button('Create a workspace',create),button('Use another account',signOut),status);wrap.append(card);root.append(wrap);return true;
}
