// This plan is memory-only. Only individual server receipts establish saved guests.
export function rosterTotals(rows, remaining) {
 const planned=rows.filter(r=>['draft','saving'].includes(r.status)).reduce((sum,r)=>sum+r.quantity,0);
 return {planned,remaining,after:remaining-planned,valid:Number.isInteger(remaining)&&remaining>=0&&planned<=remaining};
}
export function addRosterGuest(rows,{id,label,quantity},remaining) {
 label=String(label||'').trim();quantity=Number(quantity);
 if(!label||label.length>80||!Number.isInteger(quantity)||quantity<1||quantity>100||rows.length>=100||rows.some(r=>r.id===id))throw Error('Use a name and a whole-ticket quantity within your allocation.');
 const next=[...rows,{id,label,quantity,status:'draft',link:null}];
 if(!rosterTotals(next,remaining).valid)throw Error('Your plan exceeds the tickets remaining in this allocation.');
 return next;
}
export function confirmRosterGuest(rows,receipt,origin,event,token) {
 const row=rows.find(r=>r.id===receipt?.guest?.id);
 if(!row||row.status!=='saving'||row.quantity!==receipt.guest.quantity||receipt.guest.status!=='invited'||receipt.payment_collected!==false)throw Error('The recipient receipt does not match this plan.');
 row.status='saved';row.version=receipt.guest.version;row.link=origin+'/tickets/hosts/?event='+encodeURIComponent(event)+'#claim='+token;
 return row;
}
export function reconcileRoster(rows,guests){for(const row of rows){if(!['saved','accepted','unavailable'].includes(row.status))continue;const guest=guests.find(g=>g.id===row.id);if(guest?.status==='accepted'&&guest.quantity===row.quantity){row.status='accepted';row.link=null;}else if(!guest||guest.status==='revoked'||guest.version!==row.version){row.status='unavailable';row.link=null;}}}
export function rosterHtml(rows,{remaining,money,esc,reviewed,locked,workspace}) {
 const totals=rosterTotals(rows,remaining),drafts=rows.filter(r=>r.status==='draft');
 return '<section class="parea-plan" data-roster><h3>Get your parea ready</h3><p>Plan everyone’s ticket quantity together, then create their private links. Each recipient is saved separately.</p><div class="host-summary"><strong>'+rows.filter(r=>r.status==='saved'||r.status==='accepted').reduce((n,r)=>n+r.quantity,0)+' tickets saved</strong><strong>'+totals.planned+' tickets planned</strong><strong>'+totals.after+' left after this plan</strong></div>'+
 '<ol class="parea-roster">'+rows.map(r=>'<li><div><strong>'+esc(r.label)+'</strong><p>'+r.quantity+' tickets · '+esc(money(r.quantity))+'</p><span>'+({draft:'Not saved',saving:'Checking saved result',saved:'Link ready · not sent',accepted:'Accepted · not a payment',unavailable:'Changed · check current guest list'}[r.status])+'</span></div>'+(r.status==='draft'&&!locked?'<button type="button" data-roster-remove="'+esc(r.id)+'">Remove '+esc(r.label)+'</button>':r.status==='saved'&&!locked?'<button type="button" data-roster-share="'+esc(r.id)+'">Share with '+esc(r.label)+'</button>':'')+'</li>').join('')+'</ol>'+
 (!reviewed&&!locked?'<form data-form="roster">'+(workspace?'<div data-workspace-contacts></div>':'')+'<label>Recipient name<input name="label" required maxlength="80" autocomplete="off"></label><label>Tickets for this recipient<input name="quantity" required type="number" min="1" max="'+Math.max(1,totals.after)+'" value="1"></label><button '+(totals.after<1?'disabled':'')+'>Add to parea plan</button></form>':'')+
 (drafts.length&&!locked?'<p>'+ (reviewed?'Review each recipient and quantity above. This creates claim links, not payments or admission tickets.':'Review the whole plan before any tickets are assigned.')+'</p><div class="host-actions"><button data-action="'+(reviewed?'roster-save':'roster-review')+'" '+(!totals.valid?'disabled':'')+'>'+(reviewed?'Create '+drafts.length+' private links':'Review parea plan')+'</button>'+(reviewed?'<button data-action="roster-edit">Edit plan</button>':'')+'</div>':'')+
 '<p><small>Names, drafts and private links stay only in this open page. Saved guests remain on your table after reload; use Replace claim link for an unclaimed guest if needed. A pending request must be checked before continuing.</small></p></section>';
}
