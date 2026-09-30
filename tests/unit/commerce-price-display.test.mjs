import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshBasketPrices} from '../../assets/commerce/price-display.mjs';
import {receipt,formatPrice} from '../../assets/commerce/model.mjs';
test('validated changed-price review refreshes existing basket rows and currency totals without replacing controls',()=>{
 const items=[{id:'42633200271545',quantity:3,handle:'bag',title:'Bag',variant:'White',price:'1.00',currency:'CAD'},{id:'42633200271546',quantity:1,handle:'card',title:'Card',variant:'Blue',price:'2.00',currency:'EUR'}];
 const result={ok:true,payment_collected:false,checkout_url:'https://buygreek.shop/cart/42633200271545:3,42633200271546:1',lines:items.map((x,i)=>({...x,price:i?'4.00':'69.99',available:true}))};
 const reviewed=receipt(result,items);assert.equal(reviewed.priceChanged,true);
 const rows=items.map(x=>({dataset:{linePrice:x.id},textContent:x.price}));const target={replaceChildren(...nodes){this.nodes=nodes;}};const controls={quantity:3};
 const root={ownerDocument:{createElement:()=>({textContent:''})},querySelectorAll:()=>rows,querySelector:()=>target,controls};
 refreshBasketPrices(root,items.map((x,i)=>({...x,price:reviewed.lines[i].price,currency:reviewed.lines[i].currency})));
 assert.equal(rows[0].textContent,'White · '+formatPrice('69.99','CAD'));assert.equal(rows[1].textContent,'Blue · '+formatPrice('4.00','EUR'));
 assert.deepEqual(target.nodes.map(x=>x.textContent),[formatPrice('209.97','CAD'),formatPrice('4.00','EUR')]);assert.equal(root.controls,controls);assert.equal(items[0].quantity,3);
 assert.throws(()=>receipt({...result,lines:result.lines.map(x=>({...x,available:false}))},items));
});
