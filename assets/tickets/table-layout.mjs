import {validateLayout} from './venue-model.mjs';
const overlap=(a,b,gap=.25)=>a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.depth+gap&&a.y+a.depth+gap>b.y;
const nextNumber=layout=>Math.max(0,...layout.objects.filter(o=>o.kind==='table').map(o=>Number(/^Table (\d+)$/.exec(o.label)?.[1])||0))+1;
export function addPlacedObject(input,{kind='table',width=1.8,depth=1.8,height=.75,id=crypto.randomUUID()}={}){
 const layout=validateLayout(input);if(!['table','stage'].includes(kind)||![width,depth,height].every(n=>Number.isFinite(n)&&n>0))throw Error('Choose valid furniture dimensions.');
 const object={id,kind,label:kind==='table'?`Table ${nextNumber(layout)}`:'Stage',width,depth,height};
 for(let y=.5;y+depth<=layout.depth-.5;y+=.25)for(let x=.5;x+width<=layout.width-.5;x+=.25){const candidate={...object,x,y};if(!layout.objects.some(o=>overlap(candidate,o)))return validateLayout({...layout,objects:[...layout.objects,candidate]});}
 throw Error('There is no clear space for this object. Move furniture or enlarge the room.');
}
export function tableGrid(input,{count=100,columns=10,width=1.8,depth=1.8,gap=1,expand=false,idPrefix=crypto.randomUUID()}={}){
 const layout=validateLayout(input);
 if(!Number.isInteger(count)||count<1||count>500||!Number.isInteger(columns)||columns<1||columns>30||![width,depth,gap].every(Number.isFinite)||width<.5||width>10||depth<.5||depth>10||gap<.25||gap>5)throw Error('Use 1–500 tables, 1–30 columns and valid table sizes and spacing.');
 if(layout.objects.length+count>600)throw Error('This layout would exceed the 600-object limit.');
 columns=Math.min(columns,count);const rows=Math.ceil(count/columns),startY=layout.objects.length?Math.max(...layout.objects.map(o=>o.y+o.depth))+gap:.5;
 const neededWidth=columns*width+(columns-1)*gap+1,neededDepth=startY+rows*depth+(rows-1)*gap+.5;
 if(!expand&&(neededWidth>layout.width||neededDepth>layout.depth))throw Error(`This arrangement needs at least ${neededWidth.toFixed(1)} × ${neededDepth.toFixed(1)} m. Reduce the number or spacing, or allow the room to expand.`);
 const roomWidth=expand?Math.max(layout.width,neededWidth):layout.width,roomDepth=expand?Math.max(layout.depth,neededDepth):layout.depth;
 if(roomWidth>100||roomDepth>100)throw Error('The arrangement exceeds the 100 m room limit. Use fewer tables or columns.');
 const startX=(roomWidth-(neededWidth-1))/2,first=nextNumber(layout);
 const objects=Array.from({length:count},(_,i)=>({id:`${idPrefix}-${i}`,kind:'table',label:`Table ${first+i}`,x:startX+(i%columns)*(width+gap),y:startY+Math.floor(i/columns)*(depth+gap),width,depth,height:.75}));
 return validateLayout({...layout,width:roomWidth,depth:roomDepth,objects:[...layout.objects,...objects]});
}
export function duplicateFurniture(input,ids){let layout=validateLayout(input);const selected=layout.objects.filter(o=>ids.includes(o.id));if(!selected.length||selected.some(o=>!['table','stage'].includes(o.kind)))throw Error('Choose tables or stages to duplicate.');for(const o of selected)layout=addPlacedObject(layout,{kind:o.kind,width:o.width,depth:o.depth,height:o.height});return layout;}
