import{restaurantData,safeUrl,localToday}from'../restaurant/model.mjs';
export{esc,UUID,safeUrl,localToday}from'../restaurant/model.mjs';
const text=v=>typeof v==='string'?v.trim():'';
export function bakeryData(entity,profile={},media={}){const d=restaurantData(entity,profile,media);return {...d,reserve:null,order:[...d.order,...(safeUrl(profile.preorder||profile.order_url,d.website)?[{url:safeUrl(profile.preorder||profile.order_url,d.website),label:'Pre-order with the bakery’s provider'}]:[])].filter((v,i,a)=>a.findIndex(x=>x.url===v.url)===i),specials:(Array.isArray(profile.seasonal)?profile.seasonal:[]).map(v=>text(typeof v==='string'?v:v?.name)).filter(Boolean),catering:text(profile.wholesale)||text(profile.catering)};}
export const OCCASIONS=['Everyday treats','A celebration','A gift','An event','Wholesale enquiry'];
export function bakeryRequest(b,input,today=localToday(b.timezone)){
 const date=text(input.date),occasion=text(input.occasion),details=text(input.details),quantity=Number(input.quantity);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<today||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw Error('Choose today or a valid future date.');
 if(!OCCASIONS.includes(occasion))throw Error('Choose a request type.');if(!details||details.length>600)throw Error('Describe what you would like in 1 to 600 characters.');if(!Number.isInteger(quantity)||quantity<1||quantity>1000)throw Error('Choose 1 to 1,000 items to ask about. This does not indicate stock.');
 const questions=(Array.isArray(input.questions)?input.questions:[]).filter(q=>['Ingredients and allergens','Pickup arrangements','Delivery options','Customisation'].includes(q));
 const summary=`${occasion} · ${quantity} requested items\nPreferred date: ${date}\n${details}`,question=`Hello ${b.name}, could you confirm whether you can prepare ${quantity} items for ${date}? ${details}${questions.length?' I would also like to ask about '+questions.join(', ').toLowerCase()+'.':''} Please confirm the products, total price and collection or delivery arrangements before I order.`;
 return {date,occasion,details,quantity,questions,summary,question,text:`My request for ${b.name}\n${summary}\n\n${question}\n\nDraft only. Nothing has been sent, ordered or paid for.`};
}
