export const SHOPIFY_ORIGIN='https://buygreek.shop';
export type ShopifyStoreProps={initialProduct?:string;initialVariant?:string;back:()=>void};
export type ShopifyNavigation={kind:'store'|'browser';url:string;host:string}|{kind:'blocked'};
export function shopifyNavigation(value:unknown):ShopifyNavigation{
 if(typeof value!=='string'||value.length>8192||/[\\\x00-\x20\x7f]/.test(value))return{kind:'blocked'};
 try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port)return{kind:'blocked'};
  return{kind:u.origin===SHOPIFY_ORIGIN?'store':'browser',url:u.href,host:u.hostname};
 }catch{return{kind:'blocked'};}
}
export function shopifyInitialURL(product='',variant=''){
 if(product&&!/^[a-zA-Z0-9-]{1,200}$/.test(product))throw Error('This product link is invalid. Open the store to find it.');
 if(variant&&!/^\d{8,20}$/.test(variant))throw Error('This product option link is invalid. Open the store to choose an option.');
 if(variant&&!product)throw Error('Choose a product before opening its option.');
 return SHOPIFY_ORIGIN+(product?'/products/'+encodeURIComponent(product)+(variant?'?variant='+variant:''):'/');
}

export function shopifyCartURL(){return SHOPIFY_ORIGIN+'/cart';}
