type ProfileLike={
 food?:{family?:string}|null;type?:string;category?:string;name?:string;profile?:Record<string,any>;
 serviceOfferings?:{items?:unknown[]};bookingListing?:string;inquiryListing?:string;
 website?:string;phoneHref?:string|null;address?:string;location?:string;gallery?:string[];description?:string;socials?:unknown[];
 publishedDesign?:{template?:string;section_order?:string[];hidden_sections?:string[];copy?:Record<string,string>}|null;
};
export type ClientHomeFamily='restaurant'|'bakery'|'grooming'|'hospitality'|'parish'|'arts'|'professional'|'organization'|'directory';
const object=(value:unknown):Record<string,any>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,any>:{};
function color(value:unknown){
 if(typeof value!=='string'||!/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value))return'';
 let hex=value.slice(1);if(hex.length===3)hex=[...hex].map(x=>x+x).join('');
 const rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
 const luminance=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
 return (1.05/(luminance+.05))>=4.5?'#'+hex.toUpperCase():'';
}
function contrastRatio(foreground:string,background:string){
 const luminance=(value:string)=>{let hex=value.slice(1);if(hex.length===3)hex=[...hex].map(x=>x+x).join('');const rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]};
 const a=luminance(foreground),b=luminance(background);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
export function clientHomeFamily(profile:ProfileLike):ClientHomeFamily{
 const category=(profile.category||'').toLowerCase(),type=(profile.type||'').toLowerCase(),name=(profile.name||'').toLowerCase(),identity=category+' '+type+' '+name;
 if(profile.food?.family==='bakery')return'bakery';
 if(profile.food)return'restaurant';
 if(/barber|salon|groom|beaut|spa/.test(identity)||profile.serviceOfferings?.items?.length&&/hair|hairdresser/.test(identity))return'grooming';
 if(/hotel|stay|inn|resort|accommodation|hospitality|venue/.test(category+' '+type))return'hospitality';
 if(/church|parish|orthodox|monastery|diocese/.test(category+' '+type))return'parish';
 if(/artist|music|performer|photograph|film|arts|gallery|creative/.test(category+' '+type))return'arts';
 if(/architect|engineer|law|legal|doctor|health|account|consult|professional/.test(category+' '+type)||type==='professional')return'professional';
 if(/organization|association|community|consulate|school|nonprofit/.test(category+' '+type))return'organization';
 if(profile.serviceOfferings?.items?.length)return'professional';
 return'directory';
}
export function clientHomeDesign(profile:ProfileLike,dark=false){
 const family=clientHomeFamily(profile),brand=object(object(profile.profile).brand);
 const template=profile.publishedDesign?.template||null;
 const darkSurface=dark||family==='grooming'||template==='concierge';
 const custom=color(brand.primary||brand.primary_color||brand.accent||object(brand.colors).primary);
 const palettes={
  restaurant:['#F7F4ED','#152925','#536D4D','#FFFFFF','#DDD8C9'],
  bakery:['#F8F3EA','#332720','#8C5C37','#FFFFFF','#E7D8C4'],
  grooming:['#14191C','#F5F2ED','#85502D','#FFFFFF','#343A3C'],
  hospitality:['#EFF5F1','#19343A','#49665E','#FFFFFF','#D1E0DB'],
  parish:['#F6F4EA','#2D3328','#737A50','#FFFFFF','#DEDCCB'],
  arts:['#F8F3ED','#252B3C','#914B35','#FFFFFF','#E5D8CF'],
  professional:['#F1F4F8','#18273B','#315C87','#FFFFFF','#D7DFE8'],
  organization:['#F4F5F2','#24352F','#477A68','#FFFFFF','#DAE2DD'],
  directory:['#F4F6F9','#1D2C40','#1F64CD','#FFFFFF','#DCE3EB'],
 } as const;
 const templatePalettes={table:['#FAF5EC','#28251F','#8A5736','#FFFFFF','#E7DCCB'],parea:['#F5F3E9','#2B3224','#687448','#FFFFFF','#E2DFCD']} as const;
 const row=template==='table'?templatePalettes.table:template==='parea'?templatePalettes.parea:palettes[family],background=darkSurface?(family==='grooming'?'#101416':template==='concierge'?'#091725':'#0D1A28'):row[0],ink=darkSurface?'#F5F5F1':row[1],surface=darkSurface?(family==='grooming'?'#1B2022':template==='concierge'?'#10263A':'#14263A'):row[3],line=darkSurface?'#33465A':row[4];
 const darkAccent=({restaurant:'#A9BC93',bakery:'#DDB28A',grooming:'#DEA87E',hospitality:'#98C3B6',parish:'#C7CA8E',arts:'#E6A48B',professional:'#92BDE8',organization:'#92C2AE',directory:'#8AB9FF'} as const)[family],darkPrimary=({restaurant:'#3A6349',bakery:'#805431',grooming:'#94603A',hospitality:'#3C6259',parish:'#606238',arts:'#965C45',professional:'#3675A7',organization:'#3B725F',directory:'#2767BC'} as const)[family],accent=darkSurface?(contrastRatio(custom||darkAccent,background)>=4.5?(custom||darkAccent):darkAccent):(custom||row[2]),candidate=custom||row[2],primaryColor=darkSurface?(contrastRatio(candidate,surface)>=3?candidate:darkPrimary):candidate;
 const available:{key:string;label:string;ownerSection:string}[]=[];
 if(profile.food)available.push({key:'offerings',label:'Menu',ownerSection:'offerings'});
 else if(profile.serviceOfferings?.items?.length)available.push({key:'offerings',label:family==='grooming'?'Services':'Work',ownerSection:'offerings'});
 if(profile.gallery?.length)available.push({key:'gallery',label:family==='arts'?'Portfolio':'Photos',ownerSection:'gallery'});
 if(profile.description||profile.publishedDesign?.copy?.intro)available.push({key:'about',label:family==='parish'?'Community':'About',ownerSection:'intro'});
 if(profile.bookingListing)available.push({key:'booking',label:'Booking',ownerSection:'calendar'});
 if(profile.address||profile.location)available.push({key:'visit',label:'Visit',ownerSection:'contact'});
 if(profile.socials?.length)available.push({key:'contact',label:'Connect',ownerSection:'socials'});
 const owner=profile.publishedDesign,hidden=new Set(owner?.hidden_sections||[]),savedOrder=owner?.section_order||[];
 const ownerOrdered=[...savedOrder,...available.map(x=>x.ownerSection)].filter((x,index,list)=>list.indexOf(x)===index);
 const display=owner?[...ownerOrdered,...available.map(x=>x.ownerSection)].filter((x,index,list)=>list.indexOf(x)===index).flatMap(section=>{
  if(hidden.has(section)&&!(section==='offerings'&&profile.food)&&!(section==='calendar'&&profile.bookingListing))return[];
  return available.filter(item=>item.ownerSection===section);
 }):available;
 const tabs=display.map(({key,label,ownerSection})=>({key,label:ownerSection==='offerings'?(owner?.copy?.offerings_title?.trim()||label):ownerSection==='gallery'?(owner?.copy?.gallery_title?.trim()||label):ownerSection==='calendar'?(owner?.copy?.calendar_title?.trim()||'Times'):ownerSection==='socials'?(owner?.copy?.contact_title?.trim()||label):label,ownerSection}));
 const primary=profile.bookingListing?'Check availability':profile.food?'View menu':profile.inquiryListing?(family==='grooming'?'Enquire about a service':'Send an enquiry'):profile.website?'Visit website':profile.phoneHref?'Call':profile.address||profile.location?'Get directions':'';
 return{family,background,ink,muted:darkSurface?'#B8C5D2':'#5D6874',accent,primaryColor,surface,line,tabs:tabs.slice(0,4),contentOrder:display.map(x=>x.key),copy:owner?.copy||{},template,primary};
}
