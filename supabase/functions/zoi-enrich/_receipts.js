export function confirmedEnrichmentReceipts(batch,result){
 if(!Array.isArray(result)||result.length!==batch.length)throw Error('enrichment_receipt_unconfirmed');
 const expected=new Set(batch.map(x=>x.slug)),seen=new Set();let applied=0;
 for(const r of result){if(!r||typeof r.slug!=='string'||!expected.has(r.slug)||seen.has(r.slug)||typeof r.applied!=='boolean')throw Error('enrichment_receipt_unconfirmed');seen.add(r.slug);if(r.applied)applied++;}
 return {applied,rejected:result.length-applied};
}
export function enrichmentSample(value){if(value===undefined)return null;if(!Array.isArray(value)||value.length<1||value.length>3||value.some(x=>typeof x!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x))||new Set(value).size!==value.length)throw Error('invalid_enrichment_sample');return value;}
