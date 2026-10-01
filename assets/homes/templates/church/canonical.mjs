import {mountChurch} from './mount.mjs?v=20261001-official-contact';
const root=document.getElementById('church-home'),data=document.getElementById('church-home-content');
if(root&&data){try{const payload=JSON.parse(data.textContent);mountChurch(root,payload.parish,payload.template,payload.design,{preview:false});}catch{const note=document.createElement('p');note.className='section';note.textContent='Interactive parish tools could not load. The official parish links above remain available. Refresh to try again.';root.append(note);}}
