import {inspectMedia,mediaDigest} from '../community/media-rules.mjs';

export const COMPOSITION_MAX_BYTES=5*1024*1024;
const keys=['schema','width','height','layout','fit','crop','brand','title','body','background','foreground','accent','textScale'];
const color=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
const bounded=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
const exact=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>allowed.includes(key))&&allowed.every(key=>Object.hasOwn(value,key));
function luminance(hex){const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
export function compositionContrast(a,b){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function imageComposition(input={}){
 const value={schema:1,width:1080,height:1080,layout:'split',fit:'cover',crop:{x:.5,y:.5,zoom:1},brand:'',title:'',body:'',background:'#102b42',foreground:'#ffffff',accent:'#57c9ff',textScale:1,...input};
 if(!exact(value,keys)||value.schema!==1||!Number.isInteger(value.width)||!Number.isInteger(value.height)||!bounded(value.width,320,2048)||!bounded(value.height,320,2048)||!['split','overlay'].includes(value.layout)||!['cover','contain'].includes(value.fit)||!exact(value.crop,['x','y','zoom'])||!bounded(value.crop.x,0,1)||!bounded(value.crop.y,0,1)||!bounded(value.crop.zoom,1,4)||!bounded(value.textScale,.7,1.5)||!['background','foreground','accent'].every(k=>color(value[k])))throw Error('Choose a supported image size, layout, crop and colors.');
 for(const [key,max]of[['brand',120],['title',180],['body',600]])if(typeof value[key]!=='string'||value[key].length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value[key]))throw Error('Check the '+key+' text length.');
 if(compositionContrast(value.background,value.foreground)<4.5)throw Error('Choose text and background colors with stronger contrast.');
 return structuredClone(value);
}
export function cropRectangle(sourceWidth,sourceHeight,width,height,crop={x:.5,y:.5,zoom:1}){
 if(![sourceWidth,sourceHeight,width,height].every(v=>Number.isFinite(v)&&v>0)||!bounded(crop.x,0,1)||!bounded(crop.y,0,1)||!bounded(crop.zoom,1,4))throw Error('The image crop is unavailable.');
 const scale=Math.max(width/sourceWidth,height/sourceHeight)*crop.zoom,w=width/scale,h=height/scale;
 return{x:(sourceWidth-w)*crop.x,y:(sourceHeight-h)*crop.y,width:w,height:h};
}
export function compositionLayout(recipe){
 const r=imageComposition(recipe),w=r.width,h=r.height;
 if(![r.brand,r.title,r.body].some(text=>text.trim()))return{image:{x:0,y:0,width:w,height:h},text:null};
 if(r.layout==='overlay'){const panelHeight=h*.43;return{image:{x:0,y:0,width:w,height:h},text:{x:0,y:h-panelHeight,width:w,height:panelHeight}};}
 if(w/h>=1.5){const split=Math.round(w*.57);return{image:{x:0,y:0,width:split,height:h},text:{x:split,y:0,width:w-split,height:h}};}
 const split=Math.round(h*.57);return{image:{x:0,y:0,width:w,height:split},text:{x:0,y:split,width:w,height:h-split}};
}
function linesFor(ctx,text,width){
 if(!text)return[];
 const result=[];
 for(const paragraph of text.split('\n')){
  if(!paragraph){result.push('');continue;}
  let line='';
  const parts=paragraph.match(/\S+\s*|\s+/gu)||[];
  for(const part of parts){
   if(ctx.measureText(line+part.trimEnd()).width<=width){line+=part;continue;}
   if(line.trimEnd()){result.push(line.trimEnd());line='';}
   if(ctx.measureText(part.trimEnd()).width<=width){line=part;continue;}
   const chars=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(part.trimEnd())].map(s=>s.segment):Array.from(part.trimEnd());
   for(const char of chars){if(line&&ctx.measureText(line+char).width>width){result.push(line);line='';}line+=char;}
   if(/\s$/u.test(part))line+=' ';
  }
  if(line.trimEnd())result.push(line.trimEnd());
 }
 return result;
}
export function renderImageComposition(canvas,image,recipe){
 const r=imageComposition(recipe),sourceWidth=image?.naturalWidth||image?.width,sourceHeight=image?.naturalHeight||image?.height;
 if(!Number.isInteger(sourceWidth)||!Number.isInteger(sourceHeight)||sourceWidth<1||sourceHeight<1||sourceWidth*sourceHeight>40000000)throw Error('The original image could not be decoded.');
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Image editing is unavailable in this browser.');
 canvas.width=r.width;canvas.height=r.height;ctx.fillStyle=r.background;ctx.fillRect(0,0,r.width,r.height);
 const layout=compositionLayout(r),frame=layout.image;
 if(r.fit==='cover'){const c=cropRectangle(sourceWidth,sourceHeight,frame.width,frame.height,r.crop);ctx.drawImage(image,c.x,c.y,c.width,c.height,frame.x,frame.y,frame.width,frame.height);}
 else{const scale=Math.min(frame.width/sourceWidth,frame.height/sourceHeight),w=sourceWidth*scale,h=sourceHeight*scale;ctx.drawImage(image,frame.x+(frame.width-w)/2,frame.y+(frame.height-h)/2,w,h);}
 if(!layout.text)return{recipe:r,layout,blocks:[]};
 const panel=layout.text,pad=Math.round(Math.min(r.width,r.height)*.038),width=panel.width-2*pad;
 ctx.fillStyle=r.background;ctx.fillRect(panel.x,panel.y,panel.width,panel.height);ctx.fillStyle=r.accent;ctx.fillRect(panel.x+pad,panel.y+pad,Math.min(width*.22,100),Math.max(3,pad*.1));
 let y=panel.y+pad*1.65;const maxY=panel.y+panel.height-pad,blocks=[];
 const basis=Math.min(r.width,panel.width*2),definitions=[['brand',.034,700],['title',.07,750],['body',.04,400]];
 for(const [key,ratio,weight]of definitions){
  if(!r[key])continue;
  const size=Math.max(12,Math.round(basis*ratio*r.textScale)),lineHeight=Math.round(size*1.25);ctx.font=weight+' '+size+'px system-ui, sans-serif';ctx.textBaseline='top';ctx.fillStyle=r.foreground;
  const lines=linesFor(ctx,r[key],width);if(y+lines.length*lineHeight>maxY)throw Error('The text does not fit. Reduce Text size, shorten it, or choose a taller image.');
  const block={key,text:r[key],lines,fontSize:size,lineHeight,x:panel.x+pad,y};blocks.push(block);for(const line of lines){ctx.fillText(line,block.x,y);y+=lineHeight;}y+=Math.round(size*.45);
 }
 return{recipe:r,layout,blocks};
}
export async function compositionPNG(canvas,image,recipe){
 const rendered=renderImageComposition(canvas,image,recipe);
 const blob=await new Promise((resolve,reject)=>{try{canvas.toBlob(value=>value?resolve(value):reject(Error('The PNG could not be exported. Try again.')),'image/png');}catch{reject(Error('This image cannot be exported. Choose an image from your files or workspace library.'));}});
 if(blob.type!=='image/png'||blob.size>COMPOSITION_MAX_BYTES)throw Error('The PNG exceeds the 5 MiB upload limit. Choose a smaller image size.');
 const bytes=new Uint8Array(await blob.arrayBuffer()),metadata=inspectMedia(bytes,'image/png');
 if(metadata.width!==rendered.recipe.width||metadata.height!==rendered.recipe.height)throw Error('The exported image size could not be confirmed.');
 return{blob,sha256:await mediaDigest(bytes),size:bytes.length,width:metadata.width,height:metadata.height,recipe:rendered.recipe};
}
