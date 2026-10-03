import {validateReference,validateSections,imageReference} from './venue-reference.mjs';
// Shared serializable venue geometry. Units are metres; no reservation state.
export const VERSION = 1;
const KINDS = new Set(['seat', 'table', 'stage']);
export function createLayout(name = 'My venue', width = 20, depth = 15) {
  return validateLayout({version:VERSION,name,width,depth,objects:[]});
}
export function validateLayout(input) {
  if (!input || input.version !== VERSION) throw new Error('Unsupported venue file version.');
  const {width,depth}=input;
  if (![width,depth].every(n=>Number.isFinite(n)&&n>=4&&n<=100)) throw new Error('Room dimensions must be between 4 and 100 metres.');
  if (typeof input.name!=='string'||!input.name.trim()||input.name.length>100) throw new Error('Enter a venue name of 1–100 characters.');
  if (!Array.isArray(input.objects)||input.objects.length>600) throw new Error('A layout supports up to 600 objects.');
  const sections=validateSections(input.sections??[]),ids=new Set(),labels=new Set();
  const objects=input.objects.map(item=>{
    if (!item||typeof item.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(item.id)||ids.has(item.id)) throw new Error('Every object needs a unique ID.');
    ids.add(item.id);
    if (['accessible','excluded'].some(key=>item[key]!==undefined&&typeof item[key]!=='boolean')) throw new Error('Seat accessibility and exclusion must be true or false.');
    if (!KINDS.has(item.kind)) throw new Error('Unknown venue object type.');
    if (typeof item.label!=='string'||!item.label.trim()||item.label.length>50) throw new Error('Object labels must contain 1–50 characters.');
    if (item.kind==='seat') {
      const label=item.label.trim().toLowerCase();
      if (labels.has(label)) throw new Error('Seat labels must be unique.');
      labels.add(label);
    }
    if (![item.x,item.y,item.width,item.depth,item.height].every(Number.isFinite)) throw new Error('Object dimensions must be finite numbers.');
    if (item.width<=0||item.depth<=0||item.height<=0||item.height>10) throw new Error('Object dimensions must be positive; height is limited to 10 metres.');
    if (item.x<0||item.y<0||item.x+item.width>width+1e-8||item.y+item.depth>depth+1e-8) throw new Error(`${item.label} is outside the room. Move it or enlarge the room.`);
    if(item.section_id!=null&&typeof item.section_id!=='string')throw Error('Section IDs must be text.');
    if(item.view_image!=null)imageReference(item.view_image);
    if((item.section_id||item.view_image)&&item.kind!=='seat')throw Error('Only seats can carry a section or seat-view image.');
    if(item.section_id&&!sections.some(s=>s.id===item.section_id))throw Error('Choose an existing venue section.');
    return {...(item.section_id?{section_id:item.section_id}:{}),...(item.view_image?{view_image:imageReference(item.view_image)}:{}),id:item.id,kind:item.kind,label:item.label.trim(),x:item.x,y:item.y,width:item.width,depth:item.depth,height:item.height,accessible:!!item.accessible,excluded:!!item.excluded};
  });
  for(let i=0;i<objects.length;i++) for(let j=i+1;j<objects.length;j++) {
    const a=objects[i],b=objects[j];
    if(a.x<b.x+b.width-0.01&&a.x+a.width>b.x+0.01&&a.y<b.y+b.depth-0.01&&a.y+a.depth>b.y+0.01) throw new Error(`${a.label} overlaps ${b.label}. Leave space between objects.`);
  }
  return {version:VERSION,name:input.name.trim(),width,depth,objects,...(sections.length?{sections}:{}),...(input.reference!=null?{reference:validateReference(input.reference,width,depth)}:{})};
}
export function seatRows(layout,{rows=3,seats=8,x=2,y=4,gap=1.1,aisle=1.4,prefix='A',idPrefix='row'}={}) {
  if(!Number.isInteger(rows)||rows<1||rows>20||!Number.isInteger(seats)||seats<1||seats>30) throw new Error('Choose 1–20 rows and 1–30 seats per row.');
  if(![x,y,gap,aisle].every(Number.isFinite)||gap<0.8||aisle<0) throw new Error('Invalid seating spacing.');
  if(!/^[A-Z]$/.test(prefix)||prefix.charCodeAt(0)+rows-1>90) throw new Error('Choose a starting row letter that fits before Z.');
  const objects=[];
  for(let r=0;r<rows;r++) for(let s=0;s<seats;s++) objects.push({
    id:`${idPrefix}-${r}-${s}`,kind:'seat',label:`${String.fromCharCode(prefix.charCodeAt(0)+r)}${s+1}`,
    x:x+s*gap+(s>=Math.ceil(seats/2)?aisle:0),y:y+r*1.35,width:0.65,depth:0.65,height:0.85,accessible:false,excluded:false,
  });
  return validateLayout({...layout,objects:[...layout.objects,...objects]});
}
export function updateObjects(layout,ids,patch) {
  const wanted=new Set(ids);
  if(!wanted.size||[...wanted].some(id=>!layout.objects.some(o=>o.id===id))) throw new Error('Select an existing object first.');
  return validateLayout({...layout,objects:layout.objects.map(o=>wanted.has(o.id)?{...o,...patch,id:o.id,kind:o.kind}:o)});
}
export function selectedSeats(layout,ids) {
  const wanted=new Set(ids);
  return layout.objects.filter(o=>o.kind==='seat'&&!o.excluded&&wanted.has(o.id));
}
export function summarize(layout) {
  const seats=layout.objects.filter(o=>o.kind==='seat');
  return {seats:seats.filter(o=>!o.excluded).length,accessible:seats.filter(o=>o.accessible&&!o.excluded).length,excluded:seats.filter(o=>o.excluded).length};
}
export function parseLayout(text) {
  if(typeof text!=='string'||text.length>250000) throw new Error('Venue file is too large. Maximum size is 250 KB.');
  let value;try{value=JSON.parse(text);}catch{throw new Error('Choose a valid venue JSON file.');}
  return validateLayout(value);
}
// Camera projection shared by every object in the 3D preview. The depth value
// supports painter ordering; scale preserves the room's physical proportions.
export function projectPoint(x,y,z,layout,yaw=0.6,tilt=0.8) {
  const dx=x-layout.width/2,dy=y-layout.depth/2;
  const rx=dx*Math.cos(yaw)-dy*Math.sin(yaw),ry=dx*Math.sin(yaw)+dy*Math.cos(yaw);
  const vertical=ry*Math.sin(tilt)-z*Math.cos(tilt);
  const distance=ry*Math.cos(tilt)+z*Math.sin(tilt);
  const scale=580/(Math.hypot(layout.width,layout.depth)+8);
  const perspective=1/(1+distance/(Math.max(layout.width,layout.depth)*4));
  return {x:400+rx*scale*perspective,y:220+vertical*scale*perspective,depth:distance};
}
