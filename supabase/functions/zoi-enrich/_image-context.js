// Machine-image context only. This classifies a URL; it never rewrites signed
// URLs, fetches third-party content, or overrides an explicit owner's choice.
export function auxiliaryImage(value,hint=''){
 if(typeof value!=='string'||value.length>3000)return false;
 let decoded=value;for(let i=0;i<2;i++){try{const next=decodeURIComponent(decoded);if(next===decoded)break;decoded=next;}catch{break;}}
 // Stored-source audit: these exact provider assets are interface artwork or
 // rate documents, not photographs of a venue. Keep other OG images eligible.
 try{
  const u=new URL(decoded),host=u.hostname.toLowerCase(),path=u.pathname;
  // Visually reviewed official share image is a screenshot of the website UI.
  if(['alexiourealtyny.com','www.alexiourealtyny.com'].includes(host)&&path==='/wp-content/uploads/2024/10/fb.jpg')return true;
  // Translation controls are interface assets, not artist or venue photographs.
  if(/\/wp-content\/plugins\/(?:qtranslate(?:-x)?|polylang|sitepress-multilingual-cms)\/(?:[^/]+\/)*flags?\//i.test(path))return true;
  if(['agfg.com.au','www.agfg.com.au'].includes(host)&&/^\/images\/layout\/tb-(?:facebook|instagram)\.png$/i.test(path))return true;
  // Reviewed 27×24 full/half rating stars from the published restaurant source.
  // Exact source path avoids excluding a Star Hotel's genuine photography.
  if(['tastygreekcorner.co.uk','www.tastygreekcorner.co.uk'].includes(host)&&/^\/imgs\/star(?:_half)?\.png$/i.test(path))return true;
  // Other sites require explicit rating-widget context, not merely "star" in a name.
  const ratingStar=/(?:^|\/)star(?:[-_](?:half|full|empty|filled))?\.(?:png|svg|webp)$/i.test(path);
  if(ratingStar&&(/\/(?:ratings?|rating[-_]widgets?|review[-_]widgets?)\//i.test(path)||/\b(?:rating[-_ ]+(?:star|icon)|(?:full|half|empty|filled)[-_ ]+rating[-_ ]+star)\b/i.test(String(hint).slice(0,1000))))return true;
  if(host==='cdn.trustindex.io'&&/^\/assets\/platform\/Google\/star\/[^/]+\.svg$/i.test(path))return true;
  if(['gocsa.org.au','www.gocsa.org.au'].includes(host)&&/^\/wp-content\/uploads\/\d{4}\/\d{2}\/GOCSA_Default-Social-Share(?:-\d+x\d+)?\.png$/i.test(path))return true;
  if(['calgaryhellenic.ca','www.calgaryhellenic.ca'].includes(host)&&/^\/wp-content\/uploads\/2026\/05\/(?:Lower_Hall_)?rental_rates_2026(?:-\d+x\d+)?\.jpg$/i.test(path))return true;
 }catch{}
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
