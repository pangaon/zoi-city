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

/** Reviewed multi-location homepage: a named branch cannot inherit the first
 * popup's contacts. Keep prior evidence through the existing error apply path. */
export function chainBranchSourceScope(row,html='',finalUrl=row?.website){
 if(!['business','vendor'].includes(row?.entity_type)||!/^fournos bakery\s+\S/i.test(plain(row?.name)))return{handled:false};
 const source=rootPage(finalUrl);
 if(!source||source.hostname.replace(/^www\./,'')!=='fournos.co.za')return{handled:false};
 const document=String(html).slice(0,1500000),titles=[...document.matchAll(/<div\b[^>]*class\s*=\s*["'][^"']*\bpum-title\b[^"']*["'][^>]*>([\s\S]*?)<\/div\s*>/gi)];
 const locations=new Set(),phones=new Set();
 for(let i=0;i<titles.length;i++){
  const title=plain(titles[i][1]);if(!title||title==='head office')continue;
  const start=titles[i].index+titles[i][0].length,end=Math.min(titles[i+1]?.index??document.length,start+6000);
  const phone=document.slice(start,end).match(/href\s*=\s*["']tel:(\+?[\d ()-]+)["']/i)?.[1]?.replace(/[^+\d]/g,'');
  if(phone&&/^\+?\d{7,15}$/.test(phone)){locations.add(title);phones.add(phone);}
 }
 if(locations.size<2||phones.size<2)return{handled:false};
 return{handled:true,skipSupplementary:true,profile:{crawl_status:'error',status:'error',blocked:'true',blocked_reason:'source_scope_mismatch',last_error:'source_scope_mismatch',source_scope:'branch_on_multilocation_homepage',scope_review_required:true},provenance:{source_scope:'multiple_branch_contact_blocks_require_exact_branch_extraction'}};
}
