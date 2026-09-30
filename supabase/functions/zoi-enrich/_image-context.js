// Machine-image context only. This classifies a URL; it never rewrites signed
// URLs, fetches third-party content, or overrides an explicit owner's choice.
export function auxiliaryImage(value,hint=''){
 if(typeof value!=='string'||value.length>3000)return false;
 let decoded=value;for(let i=0;i<2;i++){try{const next=decodeURIComponent(decoded);if(next===decoded)break;decoded=next;}catch{break;}}
 // Review widgets proxy Google account pictures through image CDNs. Place
 // photographs under googleusercontent.com/p/ are deliberately not rejected.
 if(/https?:\/\/(?:lh\d+\.)?googleusercontent\.com\/(?:a|a-)\//i.test(decoded))return true;
 if(/https?:\/\/(?:[a-z0-9-]+\.)?gravatar\.com\/avatar\//i.test(decoded))return true;
 if(/https?:\/\/maps\.googleapis\.com\/maps\/api\/staticmap(?:[/?]|$)/i.test(decoded))return true;
 if(/https?:\/\/(?:[a-z0-9-]+\.)?tile\.openstreetmap\.org\//i.test(decoded))return true;
 if(/https?:\/\/api\.mapbox\.com\/styles\/v1\/[^?]+\/static\//i.test(decoded))return true;
 // Restaurant platforms expose a generated address map under this exact route
 // shape. A food photograph merely named "maple" remains a photograph.
 if(/\/maps\/[^?#]+\/\d+\/\d+\.(?:png|jpe?g|webp)(?:[?#]|$)/i.test(decoded))return true;
 return /\b(?:review(?:er)?[-_ ]+(?:avatar|profile[-_ ]?(?:photo|picture|image))|(?:avatar|profile[-_ ]?(?:photo|picture|image))[-_ ]+(?:of[-_ ]+)?reviewer)\b/i.test(String(hint).slice(0,1000));
}
