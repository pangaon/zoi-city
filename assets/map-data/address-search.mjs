// Catalogue address search, not a geocoding service. No coordinates are returned.
const BASE='https://csebihpaychdkanjjsmz.supabase.co';
const KEY='sb_publishable_BM4ZQtOCUhjg7VqyFGJGRw_eFyTgI4j';
export async function searchMapAddresses(query,filters={},signal,fetchImpl=fetch){
 const term=String(query||'').trim().slice(0,200);
 if(term.length<3)return{rows:[],outside:false};
 const types=Array.isArray(filters.types)?filters.types:filters.type?[filters.type]:null;
 if(types&&(types.length>32||types.some(t=>typeof t!=='string'||!/^[a-z][a-z_]{0,39}$/.test(t))))throw Error('invalid_search_types');
 if(types&&!types.length)return{rows:[],outside:false};
 const response=await fetchImpl(BASE+'/rest/v1/rpc/explore_map_address_search',{method:'POST',signal,headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json'},body:JSON.stringify({p_q:term,p_city:filters.city||null,p_country:filters.country||null,p_types:types,p_limit:32})});
 if(!response.ok)throw Error('address_search_unavailable');
 const values=await response.json();if(!Array.isArray(values)||values.length>32)throw Error('address_search_unavailable');
 const fold=v=>String(v||'').normalize('NFKC').trim().toLowerCase();
 const country=v=>{const names={ca:'canada',us:'united states',usa:'united states',gr:'greece',au:'australia',uk:'united kingdom',gb:'united kingdom',de:'germany',fr:'france',it:'italy',cy:'cyprus',nl:'netherlands',se:'sweden'};const key=fold(v);return Object.hasOwn(names,key)?names[key]:key;};
 const rows=values.filter(r=>r&&typeof r.id==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(r.id)&&typeof r.slug==='string'&&r.slug.length>0&&r.slug.length<=240&&typeof r.name==='string'&&r.name.length>0&&typeof r.address==='string'&&r.address.trim()&&typeof r.entity_type==='string'&&/^[a-z][a-z_]{0,39}$/.test(r.entity_type)&&(!filters.city||fold(r.city)===fold(filters.city))&&(!filters.country||country(r.country)===country(filters.country))&&(!types||types.includes(r.entity_type))).map(r=>({slug:r.slug,name:r.name,city:String(r.city||''),country:String(r.country||''),type:r.entity_type,address:r.address,href:'/p/'+encodeURIComponent(r.slug)}));
 return{rows,outside:false};
}
