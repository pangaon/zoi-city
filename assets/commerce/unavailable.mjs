// A failed inventory check is actionable only for exact requested line identities.
export function unavailableLines(value,requested){
 if(value?.ok!==false||value.error!=='item_unavailable'||!Array.isArray(value.unavailable)||!value.unavailable.length||value.unavailable.length>requested.length)return [];
 const seen=new Set(),rows=[];
 for(const row of value.unavailable){
  const item=requested.find(x=>x.id===row?.id);
  if(!item||seen.has(row.id)||row.quantity!==item.quantity||(row.handle!==null&&(!/^[-a-zA-Z0-9]{1,200}$/.test(row.handle)||row.handle!==item.handle)))return [];
  seen.add(row.id);rows.push({id:row.id,quantity:row.quantity,handle:row.handle});
 }
 return rows;
}
