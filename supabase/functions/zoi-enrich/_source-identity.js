/** Machine-source review gate only. No owner fields, fetching, or mutation.
 * A review result is not a finding that a domain is malicious. */
const words=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/<[^>]*>/g,' ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function host(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.hostname.toLowerCase().replace(/^www\./,''):null;}catch{return null;}}
const gamblingIdentity=/\b(?:casino|casinos|gambling|sportsbook|bookmaker|betting|slots|poker|lottery)\b/u;
const generic=new Set(['the','and','company','ltd','inc','llc','business']);
export function assessMachineSourceIdentity({website,finalUrl,name,title='',description=''}={}){
 const original=host(website),final=host(finalUrl);
 if(!original||!final)return{outcome:'review',reason:'invalid_source_identity_url'};
 // Do not guess registrable domains (co.uk, hosted website platforms, etc.).
 // Only the conventional www alias is automatic; legitimate migrations need review.
 if(original!==final)return{outcome:'review',reason:'document_host_changed',original_host:original,final_host:final};
 const expected=words(name),primary=words(`${title} ${description}`);
 const terms=expected.split(' ').filter(x=>x.length>=3&&!generic.has(x));
 const identityPresent=terms.length>0&&terms.every(x=>primary.split(' ').includes(x));
 const wagering=/\b(?:betting|wagering|sportsbook|taruhan|slot online|situs judi|judi online)\b/u.test(primary);
 const payout=/\b(?:jackpot|deposit|withdrawal|progressive|progresif|bonus)\b/u.test(primary);
 if(!gamblingIdentity.test(expected)&&!identityPresent&&wagering&&payout){
  return{outcome:'review',reason:'conflicting_wagering_identity',original_host:original,final_host:final};
 }
 return{outcome:'continue'};
}
