import {FIXED,NAMEDAYS,feastsOn,nameDaysOn,seasonsFor,orthodoxPascha,iso,resolveFeastDate} from './_orthocal.js';
// Fixed commemorations follow the parish's calendar; the Paschal cycle stays on
// the civil date. Reference: OCA Church Year and Essential Orthodox Christian Beliefs.
const DAY=86400000;
function validDay(day){const n=Date.parse(day+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(day||'')||!Number.isFinite(n)||iso(n)!==day)throw Error('Invalid civil date');return n;}
function oldOffset(day){const d=new Date(validDay(day)),year=d.getUTCFullYear()-(d.getUTCMonth()<2?1:0),c=Math.floor(year/100);return c-Math.floor(c/4)-2;}
export function parishDay(day,style='new'){
 const ms=validDay(day),old=style==='old',fixedDay=old?iso(ms-oldOffset(day)*DAY):day;
 // Old-calendar fixed commemorations are kept on their Julian civil date.
 // Do not apply a new-calendar transfer before offsetting, which double-shifts it.
 const fixed=old?FIXED.filter(f=>f.md===fixedDay.slice(5)&&!f.civic).map(f=>({...f,kind:'fixed'})):feastsOn(day).filter(f=>f.kind==='fixed'&&!f.civic),moveable=feastsOn(day).filter(f=>f.kind==='moveable');
 const md=fixedDay.slice(5),year=Number(day.slice(0,4));
 const paschaOffset=(ms-orthodoxPascha(year))/DAY;
 const seasons=seasonsFor(day).filter(s=>!['dormition_fast','nativity_fast','twelve_days','apostles_fast'].includes(s));
 if(paschaOffset>=-70&&paschaOffset<=-64)seasons.push('fast_free_week');
 if(md>='08-01'&&md<='08-14')seasons.push('dormition_fast');
 if(md>='11-15'&&md<='12-24')seasons.push('nativity_fast');
 if(md>='12-25'||md<='01-04')seasons.push('twelve_days');
 if(ms>=orthodoxPascha(year)+57*DAY&&md<='06-28')seasons.push('apostles_fast');
 const fastFree=['bright_week','pentecost_period','fast_free_week','twelve_days'].some(s=>seasons.includes(s));
 const seasonal=['great_lent','holy_week','dormition_fast','nativity_fast','apostles_fast'].some(s=>seasons.includes(s));
 const weekly=[3,5].includes(new Date(ms).getUTCDay());
 return {day,fixedDay,calendar_style:old?'old':'new',calendar_note:old?'Julian fixed commemorations; confirm transferred observances with your parish.':'GOARCH new-calendar reference, including St George transfer; local parish observance can differ.',feasts:[...moveable,...fixed],namedays:old?(NAMEDAYS[fixedDay.slice(5)]||[]):nameDaysOn(day),seasons,fast:!fastFree&&(seasonal||weekly||['01-05','08-29','09-14'].includes(md))};
}
export function upcomingParishFeasts(day,count=75,style='new'){
 const from=validDay(day),rows=[];for(let i=0;i<Math.min(Math.max(count,0),366);i++){const date=iso(from+i*DAY);for(const feast of parishDay(date,style).feasts)rows.push({...feast,date});}return rows;
}
export function patronalDate(feast,year,style='new'){
 if(!feast||typeof feast!=='object')return null;
 const date=style==='old'&&feast.key==='st_george'?`${year}-04-23`:resolveFeastDate(feast,year);if(!date)return null;
 try{validDay(date);}catch{return null;}
 if(style!=='old'||feast.kind==='moveable')return date;
 return iso(validDay(date)+oldOffset(date)*DAY);
}
