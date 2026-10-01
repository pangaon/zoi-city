import test from 'node:test';import assert from 'node:assert/strict';
import {validateCheckout} from '../../api/_commerce.js';
import {unavailableLines} from '../../assets/commerce/unavailable.mjs';
const rows=[{id:'123456789',quantity:2,handle:'oil'},{id:'987654321',quantity:1,handle:'honey'}];
const raw=(r,available=true)=>({id:'gid://shopify/ProductVariant/'+r.id,title:'Large',availableForSale:available,price:{amount:'10.00',currencyCode:'CAD'},product:{handle:r.handle,title:r.handle,availableForSale:true}});
const source=nodes=>async()=>new Response(JSON.stringify({data:{nodes}}));
test('failed inventory identifies every unavailable requested line without offering checkout',async()=>{
 await assert.rejects(validateCheckout(rows,source([raw(rows[0],false),null])),error=>{assert.equal(error.message,'item_unavailable');assert.deepEqual(error.unavailable,[{...rows[0]},{...rows[1],handle:null}]);assert.equal(error.checkout_url,undefined);assert.deepEqual(unavailableLines({ok:false,error:error.message,unavailable:error.unavailable},rows),error.unavailable);return true;});
 const retry=await validateCheckout([rows[1]],source([raw(rows[1])]));assert.equal(retry.checkout_url,'https://buygreek.shop/cart/987654321:1');assert.equal(retry.payment_collected,false);
});
test('substituted provider identity never produces an actionable unavailable row',async()=>{
 await assert.rejects(validateCheckout([rows[0]],source([raw(rows[1],false)])),/store_unavailable/);
});
test('unavailable reports bind IDs, quantities and product handles; malformed reports fail closed',()=>{
 const body={ok:false,error:'item_unavailable',unavailable:[rows[0]]};assert.deepEqual(unavailableLines(body,rows),[rows[0]]);
 for(const unavailable of [[{...rows[0],id:'222222222'}],[{...rows[0],quantity:1}],[{...rows[0],handle:'different-product'}],[rows[0],rows[0]],[],[{...rows[0],handle:'../../evil'}]])assert.deepEqual(unavailableLines({...body,unavailable},rows),[]);
 assert.deepEqual(unavailableLines({...body,ok:true},rows),[]);
});
test('HTTP checkout failure returns only affected requested lines and no provider checkout',async()=>{
 const {default:handler}=await import('../../api/commerce.js');const original=globalThis.fetch;globalThis.fetch=source([raw(rows[0],false),raw(rows[1])]);
 const res={statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.statusCode=code;return this;},json(value){this.body=value;return this;}};
 try{await handler({method:'POST',headers:{'content-type':'application/json'},body:{action:'checkout',lines:rows}},res);assert.equal(res.statusCode,409);assert.deepEqual(res.body,{ok:false,error:'item_unavailable',unavailable:[rows[0]]});assert.equal(res.headers['Cache-Control'],'no-store');}finally{globalThis.fetch=original;}
});
