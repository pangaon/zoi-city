import {formatPrice,totals} from './model.mjs';
// Use only the validated review's current basket; keep quantities and controls intact.
export function refreshBasketPrices(root,items){
 for(const node of root.querySelectorAll('[data-line-price]')){
  const line=items.find(item=>item.id===node.dataset.linePrice);
  if(line)node.textContent=line.variant+' · '+formatPrice(line.price,line.currency);
 }
 const target=root.querySelector('[data-basket-totals]');
 if(target){const nodes=totals(items).map(total=>{const p=root.ownerDocument.createElement('p');p.textContent=formatPrice(total.amount,total.currency);return p;});target.replaceChildren(...nodes);}
}
