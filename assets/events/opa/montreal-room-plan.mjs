// Transcribed from OPA's published 1548 × 903 seating artwork.
// Pixel geometry is relative placement, not surveyed dimensions or ticket inventory.
export const MONTREAL_PLAN_SOURCE=Object.freeze({url:'http://www.opaproductions.com/images/events/Fl.Plan_MTL_Ploutarchos-Andromachi_NP_V1-929.jpg',image:'/assets/events/opa/montreal-2027-floor-plan.jpg',sha256:'c0e26bce8af5c4c8f6cb47b9101cc49231723b6a68766d53e5f23a8505f48556',width:1548,height:903,room:{x:36,y:42,width:1470,height:654},stage:[{x:530,y:128},{x:586,y:128},{x:586,y:57},{x:959,y:57},{x:959,y:128},{x:1017,y:128},{x:1017,y:188},{x:530,y:188}],bars:[{x:187,y:42,width:82,height:35},{x:1276,y:42,width:82,height:35}],foh:{x:714,y:644,width:125,height:51},notes:'All tables set for 10 persons unless indicated otherwise. Black tablecloths and chair covers everywhere.',dateNotice:'The published artwork says 26 March 2027; the source webpage still refers to 2026. Confirm the date with OPA before booking.'});
export const MONTREAL_CATEGORIES=Object.freeze({red:{label:'Red marker',color:'#ef3041'},blue:{label:'Blue marker',color:'#00aeef'},yellow:{label:'Yellow marker',color:'#fff200'},pink:{label:'Pink marker',color:'#f4b5d4'},purple:{label:'Purple marker',color:'#a94fa7'},green:{label:'Green marker',color:'#40b45a'},black:{label:'Black marker',color:'#151515'}});
const positions=[];
const add=(id,x,y,category,rotation=0)=>positions.push(Object.freeze({id:String(id),x,y,width:28,length:90,rotation,category,sourceCapacity:10}));
// Front horizontal tables on either side of the stage.
[[112,170,'black'],[98,271,'green'],[68,372,'pink'],[52,473,'blue'],[51,1073,'blue'],[67,1175,'pink'],[97,1277,'green'],[111,1382,'black']].forEach(([id,x,category])=>add(id,x,170,category,90));
// Centre labels preserve the publisher's alphanumeric IDs and deliberate gaps.
const frontX=[546,588,630,672,714,756,798,840,882,924,964,1004];
[1,2,3,4,5,6,7,8,9,10,'10A','10B'].forEach((id,i)=>add(id,frontX[i],242,'red'));
[11,12,13,14,15,16,17,18,19,20,'20A','20B'].forEach((id,i)=>add(id,frontX[i],351,'red'));
const rearX=[550,603,652,702,753,803,853,904,954,1004];
rearX.forEach((x,i)=>add(21+i,x,461,'blue'));
rearX.forEach((x,i)=>add(31+i,x,565,'yellow'));
const left=[
 [[114,'black'],[100,'green'],[84,'green'],[70,'pink'],[54,'purple']],
 [[116,'black'],[102,'green'],[86,'green'],[72,'pink'],[56,'blue']],
 [[118,'black'],[104,'green'],[88,'green'],[74,'pink'],[58,'blue']],
 [[120,'black'],[106,'green'],[90,'green'],[76,'pink'],[60,'yellow']],
 [[122,'black'],[108,'green'],[92,'green'],[78,'pink'],[62,'pink']]
];
const right=[
 [[53,'purple'],[69,'pink'],[83,'green'],[99,'green'],[113,'black']],
 [[55,'blue'],[71,'pink'],[85,'green'],[101,'green'],[115,'black']],
 [[57,'blue'],[73,'pink'],[87,'green'],[103,'green'],[117,'black']],
 [[59,'yellow'],[75,'pink'],[89,'green'],[105,'green'],[119,'black']],
 [[61,'pink'],[77,'pink'],[91,'green'],[107,'blue'],[121,'black']]
];
const sideY=[247,337,424,511,596];
left.forEach((row,r)=>row.forEach(([id,category],c)=>add(id,[138,226,312,394,476][c],sideY[r],category,45)));
right.forEach((row,r)=>row.forEach(([id,category],c)=>add(id,[1073,1161,1249,1337,1429][c],sideY[r],category,-45)));
export const MONTREAL_TABLES=Object.freeze(positions);
export function montrealTable(id){return MONTREAL_TABLES.find(t=>t.id===String(id))||null;}
