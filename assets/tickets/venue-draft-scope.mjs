const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// A verified organizer entry supplies its selected workspace. Tokens never enter keys.
export function venueDraftScope({identity,workspace,storage,active=()=>true}) {
 const initial=identity(),space=workspace();
 if(!UUID.test(initial?.actor||'')||!initial?.token||!UUID.test(space||''))throw Error('Choose a signed-in workspace to open this studio.');
 const key='zoi_venue_draft_v2:'+encodeURIComponent(initial.actor)+':'+encodeURIComponent(space);
 function assert(){const now=identity();if(!active()||now?.actor!==initial.actor||now?.token!==initial.token||workspace()!==space)throw Error('Your account or workspace changed. Reopen the studio.');}
 return{workspace:space,key,assert,read(){assert();return storage.getItem(key);},save(value){assert();storage.setItem(key,value);}};
}
