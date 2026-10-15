/** Machine-source review gate only. No owner fields, fetching, or mutation.
 * A review result is not a finding that a domain is malicious. */
const words=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/<[^>]*>/g,' ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function host(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.hostname.toLowerCase().replace(/^www\./,''):null;}catch{return null;}}
const gamblingIdentity=/(?:^| )(?:casino|casinos|gambling|sportsbook|bookmaker|betting|slots|poker|lottery|καζίνο|καζινο)(?: |$)/u;
const generic=new Set(['the','and','company','ltd','inc','llc','business']);
/** @param {{website?:string,finalUrl?:string,name?:string,title?:string,description?:string}} [input] */
export function assessMachineSourceIdentity({website,finalUrl,name,title='',description=''}={}){
 const original=host(website),final=host(finalUrl);
 if(!original||!final)return{outcome:'review',reason:'invalid_source_identity_url'};
 // Do not guess registrable domains (co.uk, hosted website platforms, etc.).
 // Only the conventional www alias is automatic; legitimate migrations need review.
 if(original!==final)return{outcome:'review',reason:'document_host_changed',original_host:original,final_host:final};
 const expected=words(name),primary=words(`${title} ${description}`);
 const terms=expected.split(' ').filter(x=>x.length>=3&&!generic.has(x));
 const identityPresent=terms.length>0&&terms.every(x=>primary.split(' ').includes(x));
 // A domain-sale notice describes the registered address, not this client's
 // offering. A matching stale business title must not turn parking copy into facts.
 const parked=/\b(?:this domain(?: name)? (?:may be |might be |could be |is |has been )?(?:available |listed )?for sale|buy this domain(?: name)?|this domain(?: name)? (?:is |has been )?parked|parked domain(?: name)?|this domain(?: name)? has expired)\b/u.test(primary);
 if(parked)return{outcome:'review',reason:'parked_or_for_sale_source',original_host:original,final_host:final};
 const wagering=/\b(?:betting|wagering|sportsbook|taruhan|slot online|situs judi|judi online)\b/u.test(primary);
 const payout=/\b(?:jackpots?|deposits?|withdrawals?|progressive|progresif|bonus|bonuses)\b/u.test(primary);
 // Casino-night events and a restaurant's bonus dessert are not replacement
 // evidence. Require explicit casino/slot identity plus monetary gaming language.
 const positiveRealMoney=/\breal money\b/u.test(primary.replace(/\b(?:no|without|not for) real money\b/gu,''));
 const monetaryGaming=/\b(?:rtp|free spins?|online casinos?|welcome bonus|deposit bonus|cash bonus|bonus spins)\b/u.test(primary)||positiveRealMoney;
 const monetaryCasino=/\b(?:casino|casinos|gambling|slots)\b/u.test(primary)&&monetaryGaming;
 // Explicit play-money community events/lessons can discuss slots or RTP. That
 // exception cannot erase a separate positive real-money claim or cash offer.
 const noMoney=/\b(?:play money|pretend money|(?:no|without|not for) (?:real )?money)\b/u.test(primary);
 const communityOrLesson=/\b(?:fundraiser|fundraising|charity)\b/u.test(primary)
  ||/\b(?:probability|statistics|maths?)\b/u.test(primary)&&/\b(?:lesson|classroom|class|education|educational)\b/u.test(primary);
 const positiveMoney=positiveRealMoney||/\b(?:welcome bonus|deposit bonus|cash bonus|cash payouts?|cash prizes|minimum deposit|withdrawals?)\b/u.test(primary);
 const nonMoneyEvent=noMoney&&communityOrLesson&&!positiveMoney;
 if(!gamblingIdentity.test(expected)&&!identityPresent&&!nonMoneyEvent&&(wagering&&payout||monetaryCasino)){
  return{outcome:'review',reason:'conflicting_wagering_identity',original_host:original,final_host:final};
 }
 return{outcome:'continue'};
}
