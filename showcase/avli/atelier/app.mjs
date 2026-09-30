export const AVLI={id:'fda14b06-88d1-4d5e-b7f5-bc87a9210ce9',slug:'taverna-avli-bochum',name:'Taverna Avli',website:'https://avli.de/',address:'Taverna Avli, Luisenstraße 14, 44787 Bochum, Germany',phone:'+492346404778',email:'avli@avli.de',checked:'2026-09-30',menu:'https://avli.de/speisen-getraenke/',contact:'https://avli.de/kontakt-anfahrt/',socials:[],hours_note:'The official website displays conflicting hours; confirm directly with the restaurant.'};
export const PHOTOS=[
 {url:'https://avli.de/wp-content/uploads/2024/05/DSC_0368-copy.jpg',alt:'A dining table beside blue doors opening toward Avli’s courtyard',caption:'Inside & out · Photograph from Avli’s website.'},
 {url:'https://avli.de/wp-content/uploads/2024/05/DSC_0338-copy-1024x682.jpg',alt:'A man holding a guitar at Avli, from the restaurant’s photo collection',caption:'A moment at Avli · Website photograph, not an upcoming performance announcement.'},
 {url:'https://avli.de/wp-content/uploads/2024/05/DSC_0249-copy.jpg',alt:'A rose and table settings in Avli’s dining area',caption:'At the table · Photograph from Avli’s website.'},
 {url:'https://avli.de/wp-content/uploads/2024/05/DSC_0362-copy.jpg',alt:'Wine glasses and a bottle on a set table at Avli',caption:'A table at Avli · Photograph from the restaurant’s website.'}
];
if(typeof document!=='undefined'){
 const notice=document.querySelector('#notice');let timer;function tell(text){notice.textContent=text;clearTimeout(timer);timer=setTimeout(()=>notice.textContent='',5000);}
 async function copy(text,label){try{if(!navigator.clipboard?.writeText)throw Error('unavailable');await navigator.clipboard.writeText(text);tell(label);}catch{tell('Copy is unavailable in this browser. Select and copy the address or page link directly.');}}
 document.querySelector('#copy-address').addEventListener('click',()=>copy(AVLI.address,'Address copied.'));
 document.querySelector('#share').addEventListener('click',async()=>{try{if(navigator.share)await navigator.share({title:'Taverna Avli · Zoi',text:'A Greek courtyard in Bochum.',url:location.href});else await copy(location.href,'Page link copied.');}catch(e){if(e?.name!=='AbortError')tell('Sharing is unavailable. You can copy the page address from your browser.');}});
 const dialog=document.querySelector('#photo-dialog'),large=document.querySelector('#large-photo'),caption=document.querySelector('#photo-caption');let active=0;
 function show(index){large.style.visibility='';large.dataset.failed='';dialog.querySelector('.image-unavailable')?.remove();active=(index+PHOTOS.length)%PHOTOS.length;large.src=PHOTOS[active].url;large.alt=PHOTOS[active].alt;caption.textContent=PHOTOS[active].caption;}
 for(const button of document.querySelectorAll('[data-photo]'))button.addEventListener('click',()=>{show(Number(button.dataset.photo));dialog.showModal();document.querySelector('#close-photo').focus();});
 document.querySelector('#close-photo').addEventListener('click',()=>dialog.close());document.querySelector('#previous-photo').addEventListener('click',()=>show(active-1));document.querySelector('#next-photo').addEventListener('click',()=>show(active+1));
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
 dialog.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();show(active-1);}if(e.key==='ArrowRight'){e.preventDefault();show(active+1);}});
 for(const img of document.querySelectorAll('img'))img.addEventListener('error',()=>{if(img.dataset.failed)return;img.dataset.failed='true';img.style.visibility='hidden';const fallback=document.createElement('span');fallback.className='image-unavailable';fallback.textContent=img.alt+' · Image temporarily unavailable from the restaurant website.';img.parentElement.append(fallback);});
}
