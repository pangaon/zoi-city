/** Source scope, not an identity verification. A diocese homepage cannot provide
 * a parish's contacts, media or social accounts. No crawler or mutation here. */
const plain=value=>String(value??'').replace(/<[^>]*>/g,' ').replace(/&#(?:0*39|x0*27);/gi,"'").replace(/&amp;/gi,'&').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const institution=/(?:\b(?:archdioces\w*|dioces\w*|arcidioces\w*|arhidioce\w*|metropolis|metropolia|patriarch\w*|eparch\w*|exarch\w*|esarcato|federation|society)\b|αρχιεπισκοπ|μητροπολ|πατριαρχ|επισκοπ)/iu;
function rootPage(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&/^\/(?:(?:en|el|gr|it|fr|de)\/?)?(?:index\.(?:html?|php))?$/i.test(u.pathname)?u:null;}catch{return null;}}
function headings(html){const head=html.match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/i)?.[1]||'';const chunks=[head.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1]||'',html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i)?.[1]||''];for(const tag of head.matchAll(/<meta\b[^>]*>/gi)){const attributes={};for(const a of tag[0].matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs))attributes[a[1].toLowerCase()]=a[3];if(['og:title','og:description','description'].includes((attributes.property||attributes.name||'').toLowerCase()))chunks.push(attributes.content||'');}return plain(chunks.join(' '));}
// Compare the complete parish name, not loose first/last words or a substring.
// A city/site suffix separated from the name is common in real page titles.
function primaryMatches(expected,actual){
 if(actual===expected)return true;
 const segments=actual.split(/\s*[|•·]\s*|\s+[–—-]\s+/u);
 if(segments.length<2||segments[0]!==expected)return false;
 // A list naming another parish is not a single-parish identity heading.
 return !/(?:\b(?:parish|parrocchia|church)\b|ενορι)/iu.test(segments.slice(1).join(' '));
}
export function churchSourceScope(row,html='',finalUrl=row?.website){
 const expected=plain(row?.name);
 if(row?.entity_type!=='church'||(institution.test(expected)&&!/(parish|parrocchia|ενορι)/iu.test(expected)))return{handled:false};
 const source=rootPage(finalUrl);if(!source)return{handled:false};
 const known=source.hostname.replace(/^www\./,'')==='ortodossia.it';
 const document=String(html).slice(0,1500000);
 const primary=[document.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1],document.match(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i)?.[1]].filter(Boolean).map(plain);
 if(!known&&expected&&primary.some(value=>primaryMatches(expected,value)))return{handled:false};
 const branded=html&&institution.test(headings(document));
 if(!known&&!branded)return{handled:false};
 return{handled:true,skipSupplementary:true,profile:{crawl_status:'error',status:'error',blocked:'true',blocked_reason:'source_scope_mismatch',last_error:'source_scope_mismatch',source_scope:'parish_on_institution_site',scope_review_required:true},provenance:{source_scope:'institution_homepage_not_parish_identity'}};
}
