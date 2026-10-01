import test from 'node:test';import assert from 'node:assert/strict';
import {singleDefaultVariant,variantLabel,addLine,basket,productLink} from '../../assets/commerce/model.mjs';
const v={id:'123456789',title:'Default Title',available:true,price:'15.00',currency:'CAD'};
const product={handle:'olive-oil',title:'Olive oil',available:true,more_variants:false,variants:[v]};
test('only a complete single-provider default is display-suppressed; raw IDs/price/title remain intact',()=>{
 assert.equal(singleDefaultVariant(product),true);const [line]=addLine([],product,v,2);
 assert.equal(variantLabel(line.variant,line.single_default_variant),'');assert.equal(line.variant,'Default Title');assert.equal(line.id,v.id);assert.equal(line.price,'15.00');assert.equal(line.quantity,2);assert.ok(productLink(product.handle,line.id).endsWith('variant=123456789'));
 assert.equal(basket([line])[0].single_default_variant,true);
 for(const p of [{...product,more_variants:true},{...product,more_variants:undefined},{...product,variants:[v,{...v,id:'987654321',title:'Large'}]},{...product,variants:[{...v,title:'Small'}]}])assert.equal(singleDefaultVariant(p),false);
 assert.equal(variantLabel('Default Title',false),'Default Title');assert.equal(variantLabel('Handmade',true),'Handmade');assert.equal(variantLabel('Default Title','true'),'Default Title');
});
test('current product choice replaces prior presentation metadata on cart merge; old unproven rows stay literal',()=>{
 let rows=addLine([],product,v);rows=addLine(rows,{...product,variants:[v,{...v,id:'987654321',title:'Large'}]},v);assert.equal(rows[0].single_default_variant,false);assert.equal(rows[0].quantity,2);assert.equal(variantLabel(rows[0].variant,rows[0].single_default_variant),'Default Title');
 rows=addLine(rows,product,v);assert.equal(rows[0].single_default_variant,true);assert.equal(rows[0].quantity,3);
 assert.equal(basket([{...rows[0],single_default_variant:undefined}])[0].single_default_variant,false);
});
