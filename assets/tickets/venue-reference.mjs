// Documentary organizer-supplied images, never inferred views or geometry.
export function safeVenueImage(value){
 if(typeof value!=='string'||value.length>2048||/[\u0000-\u0020<>"\\]/.test(value)||/%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(value))throw Error('Use a public HTTPS JPG, PNG, WebP or AVIF image URL.');
 if(!/^https:\/\/(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}(?::443)?\/[^?#]*\.(?:jpe?g|png|webp|avif)(?:\?[^#]*)?$/i.test(value))throw Error('Use a public HTTPS raster image URL.');
 let u;try{u=new URL(value);}catch{throw Error('Use a complete HTTPS image URL.');}
 if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||u.hash||!/^https:\/\//.test(value)||!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(u.hostname)||/(?:^|\.)(?:localhost|local|internal|test|invalid)$/i.test(u.hostname)||!/\.(?:jpe?g|png|webp|avif)$/i.test(u.pathname))throw Error('Use a public HTTPS JPG, PNG, WebP or AVIF image URL.');
 return value;
}
export function imageReference(input){if(!input||typeof input!=='object'||typeof input.caption!=='string'||!input.caption.trim()||input.caption.length>240)throw Error('Describe the organizer-provided image in 1–240 characters.');return {url:safeVenueImage(input.url),caption:input.caption.trim()};}
export function referenceDimensions(reference){
 const w=reference?.pixel_width,h=reference?.pixel_height,c=reference?.calibration;
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<16||h<16||w>20000||h>20000||!c||![c.x1,c.y1,c.x2,c.y2,c.distance_m].every(Number.isFinite)||c.x1<0||c.x2<0||c.y1<0||c.y2<0||c.x1>w||c.x2>w||c.y1>h||c.y2>h||c.distance_m<0.1||c.distance_m>100)throw Error('Enter image dimensions and two valid pixel points with a measured distance of 0.1–100 metres.');
 const pixels=Math.hypot(c.x2-c.x1,c.y2-c.y1);if(pixels<1)throw Error('Calibration points must be at least one pixel apart.');const metresPerPixel=c.distance_m/pixels,width=w*metresPerPixel,depth=h*metresPerPixel;
 if(width<0.1||depth<0.1||width>100||depth>100)throw Error('The calibrated image extent must be between 0.1 and 100 metres.');return {width,depth,metresPerPixel};
}
export function validateReference(input,width,depth){const image=imageReference(input),size=referenceDimensions(input);if(size.width>width+1e-8||size.depth>depth+1e-8)throw Error('The calibrated drawing does not fit the room. Apply its dimensions or enlarge the room.');const c=input.calibration;return {...image,pixel_width:input.pixel_width,pixel_height:input.pixel_height,calibration:{x1:c.x1,y1:c.y1,x2:c.x2,y2:c.y2,distance_m:c.distance_m}};}
export function validateSections(input=[]){if(!Array.isArray(input)||input.length>60)throw Error('Use at most 60 venue sections.');const ids=new Set(),labels=new Set();return input.map(s=>{if(!s||typeof s.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(s.id)||ids.has(s.id)||typeof s.label!=='string'||!s.label.trim()||s.label.length>50||labels.has(s.label.trim().toLowerCase()))throw Error('Sections need unique IDs and labels of 1–50 characters.');ids.add(s.id);labels.add(s.label.trim().toLowerCase());return{id:s.id,label:s.label.trim(),...(s.view_image!=null?{view_image:imageReference(s.view_image)}:{})};});}
export function layoutViewImage(layout,object){if(!object||object.kind!=='seat')return null;if(object.view_image)return{...object.view_image,source:'seat',label:object.label};const section=layout.sections?.find(s=>s.id===object.section_id);return section?.view_image?{...section.view_image,source:'section',label:section.label}:null;}

export function layoutsEqual(a,b){const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;return JSON.stringify(canonical(a))===JSON.stringify(canonical(b));}
