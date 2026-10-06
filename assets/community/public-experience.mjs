// Presentation only: existing Community and Music handlers own every action.
const root=document.querySelector('#agora');
function enhance(){
 const main=root?.querySelector('.ag-main');
 if(!main||main.querySelector('.ag-public-welcome'))return Boolean(main);
 const mark=root.querySelector('.ag-logo>span');
 if(mark){const logo=document.createElement('img');logo.src='/assets/brand/zoi-logo.png';logo.alt='';logo.width=40;logo.height=40;logo.className='ag-public-brand';mark.replaceWith(logo);}
 const welcome=document.createElement('section');
 welcome.className='ag-public-welcome';welcome.setAttribute('aria-labelledby','ag-public-title');
 welcome.innerHTML='<p class="ag-public-eyebrow">Community · Open to everyone</p><h2 id="ag-public-title">Your people.<br><em>Your wider world.</em></h2><p class="ag-public-intro">Find a familiar voice, share a new perspective, or discover something worth passing on. There’s a place for you here.</p><div class="ag-public-actions"><a href="#conversations" class="ag-primary">Browse conversations <span aria-hidden="true">↓</span></a><button class="ag-subtle" data-zm-open>Visit the listening room <span aria-hidden="true">↗</span></button></div><p class="ag-public-note">Browse freely. Sign in when you want to take part.</p>';
 main.querySelector('.ag-heading').before(welcome);
 const heading=main.querySelector('[data-feed]');heading.id='conversations';heading.tabIndex=-1;
 welcome.querySelector('a').addEventListener('click',()=>heading.focus({preventScroll:true}));
 return true;
}
if(!enhance()&&root){const observer=new MutationObserver(()=>{if(enhance())observer.disconnect()});observer.observe(root,{childList:true,subtree:true});}
