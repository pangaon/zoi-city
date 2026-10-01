import test from 'node:test';import assert from 'node:assert/strict';import {basketTotals,basketRead,basketAdd,commerceReceipt,commerceImage,shopLink,initialVariant} from '../src/commerce.ts';
const row={id:'123456789',quantity:3,title:'Large',product_title:'Real product',handle:'real-product',price:'0.10',currency:'CAD',image:null};
test('basket totals preserve decimal precision and separate currencies',()=>{assert.deepEqual(basketTotals([row,{...row,id:'234567890',currency:'EUR',price:'1.000001',quantity:2}]),[{currency:'CAD',amount:'0.30'},{currency:'EUR',amount:'2.000002'}]);});
test('persisted basket rejects duplicate IDs and invalid quantities',()=>{assert.deepEqual(basketRead([row]),[{...row,single_default_variant:false}]);assert.throws(()=>basketRead([row,row]));assert.throws(()=>basketRead([{...row,quantity:21}]));assert.throws(()=>basketRead([{...row,price:'NaN'}]));});
test('adding unavailable options or excessive aggregate quantities fails',()=>{assert.throws(()=>basketAdd([row],{available:true},{...row,available:false},1));assert.throws(()=>basketAdd([row],{available:true},{...row,available:true},20));});
test('fresh checkout must match exact official cart and all quantities',()=>{const value={ok:true,payment_collected:false,pricing_note:'Final price at checkout',lines:[{...row,available:true}],checkout_url:'https://buygreek.shop/cart/123456789:3'};assert.equal(commerceReceipt(value,[row]).checkout_url,value.checkout_url);assert.throws(()=>commerceReceipt({...value,checkout_url:'https://buygreek.shop.evil.test/cart/123456789:3'},[row]));assert.throws(()=>commerceReceipt({...value,lines:[{...row,available:true,quantity:4}]},[row]));assert.throws(()=>commerceReceipt({...value,payment_collected:true},[row]));});
test('product imagery and deep links reject untrusted URLs and invalid identifiers',()=>{assert.equal(commerceImage('https://evil.test/a.jpg'),null);assert.equal(commerceImage('https://cdn.shopify.com/a.jpg'),'https://cdn.shopify.com/a.jpg');assert.deepEqual(shopLink('/shop/?product=olive-oil&variant=123456789'),{product:'olive-oil',variant:'123456789'});assert.equal(shopLink('/shop/?product=../../secret').product,'');});

test('native shared option cannot silently substitute another product variant',()=>{assert.deepEqual(initialVariant([{id:'123456789',available:true}],'999999999'),{id:'',needsChoice:true});});

test('malformed explicit native variant remains an explicit unresolved choice',()=>{const link=shopLink('/shop/?product=olive-oil&variant=bad');assert.deepEqual(initialVariant([{id:'123456789',available:true}],link.variant),{id:'',needsChoice:true});});
test('single default display metadata survives native basket mapping without changing provider title',async()=>{
 const {variantLabel,singleDefaultVariant}=await import('../src/commerce.ts');
 const v={id:'123456789',title:'Default Title',available:true,price:'15.00',currency:'CAD',image:null};
 const p={handle:'oil',title:'Olive oil',available:true,more_variants:false,variants:[v],image:null};
 const rows=basketAdd([],p,v,2);assert.equal(rows[0].title,'Default Title');assert.equal(rows[0].product_title,'Olive oil');assert.equal(rows[0].single_default_variant,true);assert.equal(variantLabel(rows[0].title,rows[0].single_default_variant),'');assert.equal(singleDefaultVariant({...p,variants:[v,{...v,id:'987654321',title:'Large'}]}),false);
 assert.equal(basketRead([{...rows[0],single_default_variant:'true'}])[0].single_default_variant,false);
});
