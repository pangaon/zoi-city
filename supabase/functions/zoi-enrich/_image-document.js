// Bounded static image occurrences with inherited document roles. A malformed
// document yields no image proposal; this never evaluates source code/CSS.
const SPACE=/[\t\n\f\r ]/;
const voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const decode=s=>s.replace(/&(?:amp|quot|apos|lt|gt);|&#(?:[0-9]+|x[0-9a-f]+);/gi,x=>{const named={'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'};if(named[x.toLowerCase()]!==undefined)return named[x.toLowerCase()];const n=x[2].toLowerCase()==='x'?parseInt(x.slice(3,-1),16):Number(x.slice(2,-1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';});
const raw=new Set(['script','style','textarea','title','xmp','iframe','noembed','noframes','noscript']);
/** Small static CSS subset, never a CSS engine. All URL tokens are inventoried
 * with quote/comment/function boundaries. Unknown opacity/escaped syntax is
 * conservative review evidence, never visibility authority. */
export function imageStyleEvidence(input=''){
 const refused=reason=>({valid:false,hidden:true,urls:[],backgrounds:[],reasons:[reason]});
 if(typeof input!=='string'||input.length>16384)return refused('inline_style_budget');
 let text='',quote='';
 for(let i=0;i<input.length;i++){
  const c=input[i];if(c==='\\')return refused('escaped_css_requires_rendering');
  if(quote){if(/[\n\r\f]/.test(c))return refused('invalid_css_string');text+=c;if(c===quote)quote='';continue;}
  if(c==='"'||c==="'"){quote=c;text+=c;continue;}
  if(c==='/'&&input[i+1]==='*'){const end=input.indexOf('*/',i+2);if(end<0)return refused('unclosed_css_comment');text+=' ';i=end+1;continue;}
  if(/[\x00-\x08\x0b\x0e-\x1f]/.test(c))return refused('invalid_css_control');text+=c;
 }
 if(quote)return refused('invalid_css_string');
 const declarations=[];let start=0,depth=0;quote='';
 for(let i=0;i<=text.length;i++){
  const c=text[i];if(quote){if(c===quote)quote='';continue;}if(c==='"'||c==="'"){quote=c;continue;}
  if(c==='('){if(++depth>32)return refused('css_function_budget');}else if(c===')'){if(--depth<0)return refused('invalid_css_function');}
  if((c===';'||i===text.length)&&depth===0){const item=text.slice(start,i).trim();start=i+1;if(item){const colon=item.indexOf(':');if(colon<1)return refused('invalid_css_declaration');const property=item.slice(0,colon).trim().toLowerCase(),value=item.slice(colon+1).trim().replace(/\s*!\s*important\s*$/i,'').trim();if(!/^(?:--)?[a-z_-][a-z0-9_-]*$/i.test(property)||!value)return refused('invalid_css_declaration');declarations.push({property,value});if(declarations.length>128)return refused('css_declaration_budget');}}
 }
 if(depth||quote)return refused('invalid_css_function');
 const urls=[],backgrounds=[],reasons=[];let hidden=false;
 for(const {property,value}of declarations){
  if(property==='opacity'){
   const numeric=/^[+-]?(?:[0-9]*\.[0-9]+|[0-9]+\.?[0-9]*)(?:[eE][+-]?[0-9]+)?%?$/.test(value)?Number(value.replace(/%$/,'')):NaN;
   if(!Number.isFinite(numeric)||numeric<=0){hidden=true;reasons.push(Number.isFinite(numeric)?'zero_or_negative_opacity':'opacity_requires_rendering');}
  }
  if(['display','visibility','content-visibility'].includes(property)){
   // Visibility is authority only for this explicit literal subset. Variables,
   // functions, CSS-wide keywords and unknown values require rendered review.
   const literal=value.toLowerCase().split(/[\t\n\f\r ]+/).join(' ');
   const positive=property==='display'?['block','inline','inline-block','flow-root','contents','flex','inline-flex','grid','inline-grid','list-item'].includes(literal):literal==='visible';
   if(!positive){hidden=true;reasons.push(['none','hidden','collapse'].includes(literal)?'hidden_css_declaration':property+'_requires_rendering');}
  }
  if(['left','top'].includes(property)&&/^-[0-9.e+]+(?:px|em|rem)$/i.test(value)&&parseFloat(value)<=-1000){hidden=true;reasons.push('offscreen_css_position');}
  // Literal URL tokens, including all comma-separated layers and nested image
  // functions. Quoted text mentioning url(...) never becomes a declaration.
  let at=0;
  while(at<value.length){const c=value[at];if(c==='"'||c==="'"){const end=value.indexOf(c,at+1);if(end<0)return refused('invalid_css_string');at=end+1;continue;}
   const word=/^[a-z_-][a-z0-9_-]*/i.exec(value.slice(at));if(!word){at++;continue;}at+=word[0].length;
   if(word[0].toLowerCase()!=='url'||value[at]!=='(')continue;at++;while(SPACE.test(value[at]||'')&&at<value.length)at++;
   let url='';if(value[at]==='"'||value[at]==="'"){const q=value[at++],end=value.indexOf(q,at);if(end<0)return refused('invalid_css_url');url=value.slice(at,end);at=end+1;while(SPACE.test(value[at]||'')&&at<value.length)at++;if(value[at]!==')')return refused('invalid_css_url');at++;}
   else{const end=value.indexOf(')',at);if(end<0)return refused('invalid_css_url');url=value.slice(at,end).trim();if(/[\t\n\f\r ()'"<>]/.test(url))return refused('invalid_css_url');at=end+1;}
   if(!url||url.length>3000||urls.length>=64)return refused('css_url_budget');urls.push(url);if(['background','background-image'].includes(property))backgrounds.push(url);
  }
 }
 return{valid:true,hidden,urls,backgrounds,reasons};
}
export function imageDocumentElements(html){
 const refused=()=>Object.defineProperty([],'valid',{value:false});
 if(typeof html!=='string'||html.length>1500000)return refused();
 /** @type {Array<{tag:string,attrs:Record<string,string>,excluded:boolean,start:number,end:number,raw:string,body?:string,styleEvidence?:ReturnType<typeof imageStyleEvidence>,exclusion_reasons?:string[]}>} */
 const result=[];const stack=[];let pos=0,tokens=0;
 // Distinguish a valid empty document from a refused partial parse. Callers
 // must not revive structured/meta images after a failed whole-document scan.
 Object.defineProperty(result,'valid',{value:true});
 try{while(pos<html.length){
  if(++tokens>50000||stack.length>128)throw Error();
  const start=html.indexOf('<',pos);if(start<0)break;
  if(html.startsWith('<!--',start)){const end=html.indexOf('-->',start+4);if(end<0)throw Error();pos=end+3;continue;}
  if(/^<!|^<\?/.test(html.slice(start,start+2))){const end=html.indexOf('>',start+2);if(end<0)throw Error();pos=end+1;continue;}
  let at=start+1,close=false;if(html[at]==='/'){close=true;at++;}
  const match=/^[A-Za-z][A-Za-z0-9:-]*/.exec(html.slice(at));if(!match){pos=at;continue;}
  const tag=match[0].toLowerCase();at+=match[0].length;if(at<html.length&&!/[\t\n\f\r />]/.test(html[at]))throw Error();
  /** @type {Record<string,string>} */
  const attrs={};let self=false,duplicate=false;
  while(at<html.length){while(SPACE.test(html[at]||'')&&at<html.length)at++;if(html[at]==='>'){at++;break;}if(html[at]==='/'&&html[at+1]==='>'){self=true;at+=2;break;}if(close)throw Error();
   const m=/^[^\t\n\f\r =<>\x00-\x1f'"`/]+/.exec(html.slice(at));if(!m)throw Error();const key=m[0].toLowerCase();at+=m[0].length;
   while(SPACE.test(html[at]||'')&&at<html.length)at++;let value='';
   if(html[at]==='='){at++;while(SPACE.test(html[at]||'')&&at<html.length)at++;const q=html[at];if(q==='"'||q==="'"){const end=html.indexOf(q,at+1);if(end<0)throw Error();value=html.slice(at+1,end);at=end+1;}else{const v=/^[^\t\n\f\r <>`'"=]+/.exec(html.slice(at));if(!v)throw Error();value=v[0];at+=value.length;}}
   if(Object.hasOwn(attrs,key)){duplicate=true;}else attrs[key]=decode(value);
  }
  if(html[at-1]!=='>')throw Error();pos=at;
  if(close){const index=stack.findLastIndex(x=>x.tag===tag);if(index>=0){const boundary=stack.findLastIndex(x=>['template','svg','math'].includes(x.tag));if(index<boundary)continue;stack.splice(index);}continue;}
  const classes=(attrs.class||'').split(/[\t\n\f\r ]+/),styleEvidence=imageStyleEvidence(attrs.style||''),roles=(attrs.role||'').toLowerCase().split(/[\t\n\f\r ]+/);
  const hidden=styleEvidence.hidden||Object.hasOwn(attrs,'popover')||['dialog','details'].includes(tag)&&!Object.hasOwn(attrs,'open')||Object.hasOwn(attrs,'hidden')||Object.hasOwn(attrs,'inert')||(attrs['aria-hidden']||'').toLowerCase()==='true';
  const structural=['footer','nav','template','svg','math','video','audio','select'].includes(tag)||roles.some(role=>['navigation','contentinfo'].includes(role))||classes.some(c=>['eventlist-event','related-post','related-posts'].includes(c));
  const excluded=duplicate||stack.some(x=>x.excluded)||hidden||structural;
  const exclusion_reasons=[...styleEvidence.reasons,...(Object.hasOwn(attrs,'popover')?['native_popover_static_closed']:[]),...(structural?['structural_image_role']:[]),...(duplicate?['duplicate_html_attribute']:[])];
  result.push({tag,attrs,excluded,start,end:at,raw:html.slice(start,at),styleEvidence,exclusion_reasons});if(result.length>20000)throw Error();
  if(tag==='plaintext')break;
  if(raw.has(tag)){const re=new RegExp('</'+tag+'[\\t\\n\\f\\r ]*>','gi');re.lastIndex=at;const end=re.exec(html);if(!end)break;if(tag==='script')result.at(-1).body=html.slice(at,end.index);pos=re.lastIndex;continue;}
  if(!voids.has(tag)&&(!self||!['svg','math'].includes(tag)))stack.push({tag,excluded});
 }return result;}catch{return refused();}
}
