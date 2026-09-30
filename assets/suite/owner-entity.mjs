/** The private editor uses its authorized snapshot, never public search visibility. */
export function ownerEntity(snapshot,{workspace,listing,name='',slug=''}={}){
 if(snapshot?.ok!==true||snapshot.workspace_id!==workspace||snapshot.listing_id!==listing||!/^[a-f0-9]{32}$/.test(snapshot.version||'')||typeof snapshot.entity_type!=='string'||!snapshot.entity_type||!snapshot.base||typeof snapshot.base!=='object'||Array.isArray(snapshot.base)||!snapshot.profile||typeof snapshot.profile!=='object'||Array.isArray(snapshot.profile))throw Error('owner_snapshot_unconfirmed');
 return {...snapshot.base,id:listing,name,slug,entity_type:snapshot.entity_type,category_slug:typeof snapshot.category_slug==='string'?snapshot.category_slug:null,profile:snapshot.profile};
}
