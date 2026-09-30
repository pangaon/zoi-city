import{mountEventActions}from'./client.mjs';
const root=document.getElementById('event-home'),data=document.getElementById('event-home-content');if(root&&data){try{mountEventActions(JSON.parse(data.textContent).entity,root)}catch{const note=document.createElement('p');note.textContent='Planning tools could not load. Refresh to retry; official contact links remain available.';root.append(note)}}
