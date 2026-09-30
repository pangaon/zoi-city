// Planning arithmetic only. These functions never reserve inventory or collect money.
const cents=(n,allowZero=true)=>{if(!Number.isSafeInteger(n)||n<(allowZero?0:1)||n>100000000)throw Error('Enter a valid amount in cents.');return n;};
const guests=n=>{if(!Number.isInteger(n)||n<1||n>100)throw Error('Choose a group of 1 to 100 guests.');return n;};
export function ticketSubtotal(perGuestCents,guestCount){return cents(cents(perGuestCents,false)*guests(guestCount));}
export function splitEqually(totalCents,count){cents(totalCents);guests(count);const each=Math.floor(totalCents/count),remainder=totalCents%count;return Array.from({length:count},(_,i)=>each+(i<remainder?1:0));}
export function validateCustomSplit(totalCents,amounts){cents(totalCents);if(!Array.isArray(amounts))throw Error('Enter each guest’s share.');guests(amounts.length);amounts.forEach(n=>cents(n));const sum=amounts.reduce((a,b)=>a+b,0);return {valid:sum===totalCents,assignedCents:sum,remainingCents:totalCents-sum};}
export function parseAmount(value){if(typeof value!=='string'||!/^\d{1,7}(?:\.\d{1,2})?$/.test(value.trim()))throw Error('Enter an amount with up to two decimal places.');const [whole,fraction='']=value.trim().split('.');return cents(Number(whole)*100+Number(fraction.padEnd(2,'0')));}
export function checkoutReadiness(config={}){const missing=[];if(config.organizerApproved!==true)missing.push('Organizer approval');if(config.inventoryConnected!==true)missing.push('Live table inventory');if(config.pricesConfirmed!==true)missing.push('Confirmed ticket prices');if(!/^[A-Z]{3}$/.test(config.currency||''))missing.push('Currency');if(config.feesConfirmed!==true)missing.push('Taxes and fees');if(config.policiesConfirmed!==true)missing.push('Ticket and cancellation policies');if(config.capacityConfirmed!==true)missing.push('Table and booth capacities');if(config.paymentConnected!==true)missing.push('Payment connection');return {ready:missing.length===0,missing};}
export function sponsorForPlacement(value,{placementId,now=Date.now()}={}){
 if(!value||value.approved!==true||value.placementId!==placementId||typeof value.name!=='string'||!value.name.trim()||value.name.length>120)return null;
 const start=Date.parse(value.startsAt),end=Date.parse(value.endsAt);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||now<start||now>=end)return null;
 let url;try{url=new URL(value.url,'https://www.zoi.city');if(url.protocol!=='https:'||url.username||url.password)return null;}catch{return null;}
 return {name:value.name.trim(),url:url.href,label:'Sponsored',offer:typeof value.offer==='string'?value.offer.trim().slice(0,240):''};
}
