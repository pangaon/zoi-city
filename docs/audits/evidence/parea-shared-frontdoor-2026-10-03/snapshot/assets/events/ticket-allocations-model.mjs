// Whole-ticket assignment for a group's draft. Inventory and payment authority stay on the server.
export function ticketAllocations({guestCount,perGuestCents=null,members=[]}={}) {
 if(!Number.isInteger(guestCount)||guestCount<1||guestCount>100)throw Error('Choose a group of 1 to 100 guests.');
 if(perGuestCents!==null&&(!Number.isSafeInteger(perGuestCents)||perGuestCents<1||perGuestCents>100000000))throw Error('Ticket price is invalid.');
 if(!Array.isArray(members)||members.length>100)throw Error('Use up to 100 ticket recipients.');
 const ids=new Set();
 const rows=members.map((member,index)=>{
  if(!member||typeof member.id!=='string'||!member.id||ids.has(member.id))throw Error('Each recipient needs a unique entry.');
  ids.add(member.id);
  const quantity=member.ticket_quantity;
  if(!Number.isInteger(quantity)||quantity<1||quantity>100)throw Error(`Recipient ${index+1} needs a whole number of tickets, from 1 to 100.`);
  const name=typeof member.name==='string'?member.name.trim().slice(0,60):'';
  return {id:member.id,name,ticket_quantity:quantity,subtotalCents:perGuestCents===null?null:quantity*perGuestCents};
 });
 const assigned=rows.reduce((sum,row)=>sum+row.ticket_quantity,0);
 return {rows,assigned,unassigned:Math.max(0,guestCount-assigned),overAssigned:Math.max(0,assigned-guestCount),valid:assigned<=guestCount,complete:assigned===guestCount,totalCents:perGuestCents===null?null:guestCount*perGuestCents};
}
