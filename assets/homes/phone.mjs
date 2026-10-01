import {placeholderPhone} from '../../supabase/functions/zoi-enrich/_phone.js';
// Presentation-only dial target. No country inference or ownership verification.
// Retain the original display string separately when this returns null.
export function phoneTarget(value) {
 if(typeof value!=='string'||placeholderPhone(value))return null;
 let number=value.trim(),extension='';
 const ext=number.match(/(?:\s*(?:ext\.?|extension|x)\s*|;ext=)(\d{1,8})$/i);
 if(ext){extension=ext[1];number=number.slice(0,ext.index).trim();}
 if(!/^[+\d ().-]+$/.test(number))return null;
 const compact=number.replace(/[ ().-]/g,'');
 if(!/^\+?\d{5,20}$/.test(compact)||/^\+0/.test(compact)||/^0+$/.test(compact.replace(/^\+/,'')))return null;
 return compact+(extension?';ext='+extension:'');
}
export function phoneHref(value){const target=phoneTarget(value);return target?'tel:'+target:null;}
