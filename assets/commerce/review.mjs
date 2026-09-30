export const REVIEW_LIFETIME_MS=120000;
export const basketScope=items=>JSON.stringify(items.map(({id,quantity})=>({id,quantity})));
export function reviewedCheckout(result,items,now=Date.now()){return{...result,checkedAt:now,scope:basketScope(items)};}
export function reviewCurrent(review,items,now=Date.now()){return !!review&&Number.isFinite(review.checkedAt)&&now>=review.checkedAt&&now-review.checkedAt<REVIEW_LIFETIME_MS&&review.scope===basketScope(items);}
