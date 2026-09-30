export const OCCASIONS=['A meal together','A celebration','A family visit'];
export function dateInBochum(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function berlinInstant(date,time){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))throw Error('Choose a valid date and time.');
 const target=Date.parse(date+'T'+time+':00Z');if(!Number.isFinite(target))throw Error('Choose a valid date and time.');
 const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 let stamp=target;for(let i=0;i<4;i++){const p=Object.fromEntries(fmt.formatToParts(new Date(stamp)).map(x=>[x.type,x.value]));const rendered=p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute;if(rendered===date+'T'+time)return new Date(stamp);stamp+=target-Date.parse(rendered+':00Z');}throw Error('That local time does not exist because the clocks change. Choose another time.');
}
export function validatePlan(data,now=new Date()){
 const p={date:String(data.date||''),time:String(data.time||''),party:Number(data.party),occasion:String(data.occasion||'')};
 if(!Number.isInteger(p.party)||p.party<1||p.party>50||!OCCASIONS.includes(p.occasion))throw Error('Choose between 1 and 50 guests and an occasion.');
 const at=berlinInstant(p.date,p.time);if(at.getTime()<=now.getTime())throw Error('Choose a future date and time.');if(at.getTime()>now.getTime()+366*86400000)throw Error('Choose a date within the next year.');return p;
}
export function calendarFile(p,now=new Date()){
 const fmt=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Zoi//Private visit plan//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:avli-'+p.date+'-'+p.time.replace(':','')+'-'+p.party+'@zoi.city','DTSTAMP:'+fmt(now),'DTSTART:'+fmt(berlinInstant(p.date,p.time)),'SUMMARY:Tentative Avli visit - '+p.occasion,'LOCATION:Taverna Avli\\, Luisenstrasse 14\\, 44787 Bochum','DESCRIPTION:Private plan for '+p.party+' guests. No table is reserved. Call +49 234 6404778 to confirm with Avli.','STATUS:TENTATIVE','END:VEVENT','END:VCALENDAR',''].join('\r\n');
}
export function planUrl(plan,origin='https://www.zoi.city'){const u=new URL('/showcase/avli/parea/',origin);for(const [k,v]of Object.entries(plan))u.searchParams.set(k,String(v));u.hash='plan';return u.href;}
