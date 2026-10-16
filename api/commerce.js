import{graph,PRODUCT,product,collection,validateCheckout}from'./_commerce.js';
export default async function handler(req,res){
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');if(req.method==='OPTIONS')return res.status(204).end();
 res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
 const send=(code,data)=>res.status(code).json(data);
 try{
  if(req.method==='POST'){
   const content=String(req.headers?.['content-type']||'');if(!content.startsWith('application/json'))return send(415,{ok:false,error:'json_required'});
   const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body||{});if(raw.length>12000)return send(413,{ok:false,error:'cart_too_large'});const body=typeof req.body==='string'?JSON.parse(raw):req.body;
   if(body?.action!=='checkout')return send(400,{ok:false,error:'invalid_action'});return send(200,await validateCheckout(body.lines));
  }
  if(req.method!=='GET'){res.setHeader('Allow','GET, POST');return send(405,{ok:false,error:'method_not_allowed'});}
  const q=req.query||{},handle=q.handle,cursor=q.cursor,search=q.search,category=q.collection;
  if([handle,cursor,search,category].some(v=>v!==undefined&&typeof v!=='string'))return send(400,{ok:false,error:'invalid_query'});
  if(q.collections!==undefined){
   if(q.collections!=='1'||handle||cursor||search||category)return send(400,{ok:false,error:'invalid_query'});
   const data=await graph('query{collections(first:24,sortKey:TITLE){nodes{handle title image{url altText}} pageInfo{hasNextPage endCursor}}}');
   if(!Array.isArray(data.collections?.nodes))throw Error('store_unavailable');
   res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=60');return send(200,{ok:true,collections:data.collections.nodes.map(collection),page:data.collections.pageInfo,source:'buygreek.shop'});
  }
  if(category!==undefined&&(!/^[-a-zA-Z0-9]{1,200}$/.test(category)||(search&&search.trim())||handle))return send(400,{ok:false,error:'invalid_query'});
  if(handle!==undefined){if(!/^[-a-zA-Z0-9]{1,200}$/.test(handle))return send(400,{ok:false,error:'invalid_handle'});const data=await graph(`query($handle:String!){product(handle:$handle){${PRODUCT}}}`,{handle});if(!data.product)return send(404,{ok:false,error:'product_not_found'});res.setHeader('Cache-Control','public, s-maxage=30, stale-while-revalidate=30');return send(200,{ok:true,product:product(data.product),source:'buygreek.shop'});}
  if((cursor&&(!/^[a-zA-Z0-9+/=_-]{1,1000}$/.test(cursor)))||(search&&search.length>120))return send(400,{ok:false,error:'invalid_query'});
  // Fixed query and variables, never interpolate a visitor's GraphQL or endpoint.
  if(category){
   const data=await graph(`query($handle:String!,$after:String){collection(handle:$handle){handle title products(first:12,after:$after,sortKey:TITLE){nodes{${PRODUCT.replace("variants(first:100)","variants(first:20)")}} pageInfo{hasNextPage endCursor}}}}`,{handle:category,after:cursor||null});
   if(!data.collection)return send(404,{ok:false,error:'collection_not_found'});
   if(data.collection.handle!==category||!Array.isArray(data.collection.products?.nodes))throw Error('store_unavailable');
   res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=60');return send(200,{ok:true,products:data.collection.products.nodes.map(product),collection:{handle:category,title:data.collection.title},page:data.collection.products.pageInfo,source:'buygreek.shop'});
  }
  const term=search?.trim();const query=term?'title:*'+term.replace(/[\\"*:(){}<>]/g,' ').trim().split(/\s+/).join('* AND title:*')+'*':null;
  const data=await graph(`query($after:String,$query:String){products(first:12,after:$after,query:$query,sortKey:TITLE){nodes{${PRODUCT.replace("variants(first:100)","variants(first:20)")}} pageInfo{hasNextPage endCursor}}}`,{after:cursor||null,query});
  if(!Array.isArray(data.products?.nodes))throw Error('store_unavailable');res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=60');return send(200,{ok:true,products:data.products.nodes.map(product),page:data.products.pageInfo,source:'buygreek.shop'});
 }catch(error){if(error instanceof SyntaxError)return send(400,{ok:false,error:'invalid_json'});const code=String(error.message),known=['invalid_cart','invalid_variant','invalid_query','item_unavailable'];return send(known.includes(code)?409:503,{ok:false,error:known.includes(code)?code:'store_unavailable',...(code==='item_unavailable'&&Array.isArray(error.unavailable)?{unavailable:error.unavailable}:{})});}
}
