/** Raw-source triage shared by enrichment and per-listing audit reports.
 * A JS application shell is not evidence that a business has no photos/menu.
 * This module never executes source JavaScript or upgrades crawl success to QA.
 */
export function inspectSourceDocument(html) {
 const doc=String(html||'');
 const body=doc.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i)?.[1]||doc;
 const visible=body.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').replace(/<[^>]+>/g,' ').replace(/&(?:[a-z]+|#\d+|#x[a-f0-9]+);/gi,' ').replace(/\s+/g,' ').trim();
 const title=(doc.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1]||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
 // A generic phrase alone may be legitimate marketing; require the challenge
 // document title together with its short verification instruction.
 const challenge=/^(?:one moment,? please|just a moment)[.!…\s]*$/i.test(title)&&visible.length<500&&/\b(?:please wait while your request is being verified|checking your browser|verify you are human)\b/i.test(visible);
 const scripts=/<script\b[^>]*(?:src\s*=|type\s*=\s*["']module)/i.test(doc);
 const mount=/<(?:div|main)\b[^>]*\bid\s*=\s*["'](?:root|app|__next|__nuxt)["'][^>]*>\s*<\/(?:div|main)\s*>/i.test(body);
 const required=/enable\s+javascript|javascript\s+(?:is\s+)?required|requires?\s+javascript/i.test(doc);
 const substantive=/<(?:img|video|iframe)\b|<a\b[^>]*href\s*=\s*["'](?:tel:|mailto:)/i.test(body);
 const shell=scripts&&(mount||required)&&visible.length<100&&!substantive;
 return {requires_rendering:!challenge&&shell,source_state:challenge?'source_challenge':shell?'javascript_shell':'html_available',visible_text_length:visible.length};
}
export function sourceRepairIssue(html) {
 const inspected=inspectSourceDocument(html);
 if(inspected.source_state==='source_challenge')return{criterion:'source_content',specialist:'enrichment',reason:'source_challenge',next_action:'The source returned a verification page. Retry permitted public access later or request approved source material; do not treat the challenge as listing content.',...inspected};
 return inspected.requires_rendering?{criterion:'source_content',specialist:'enrichment',reason:'javascript_render_required',next_action:'Capture the permitted rendered official source, validate identity, and re-extract through the shared pipeline.',...inspected}:null;
}
