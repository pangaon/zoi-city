/** Raw-source triage shared by enrichment and per-listing audit reports.
 * A JS application shell is not evidence that a business has no photos/menu.
 * This module never executes source JavaScript or upgrades crawl success to QA.
 */
export function inspectSourceDocument(html) {
 const doc=String(html||'');
 const body=doc.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i)?.[1]||doc;
 const visible=body.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').replace(/<[^>]+>/g,' ').replace(/&(?:[a-z]+|#\d+|#x[a-f0-9]+);/gi,' ').replace(/\s+/g,' ').trim();
 const scripts=/<script\b[^>]*(?:src\s*=|type\s*=\s*["']module)/i.test(doc);
 const mount=/<(?:div|main)\b[^>]*\bid\s*=\s*["'](?:root|app|__next|__nuxt)["'][^>]*>\s*<\/(?:div|main)\s*>/i.test(body);
 const required=/enable\s+javascript|javascript\s+(?:is\s+)?required|requires?\s+javascript/i.test(doc);
 const substantive=/<(?:img|video|iframe)\b|<a\b[^>]*href\s*=\s*["'](?:tel:|mailto:)/i.test(body);
 const shell=scripts&&(mount||required)&&visible.length<100&&!substantive;
 return {requires_rendering:shell,source_state:shell?'javascript_shell':'html_available',visible_text_length:visible.length};
}
export function sourceRepairIssue(html) {
 const inspected=inspectSourceDocument(html);
 return inspected.requires_rendering?{criterion:'source_content',specialist:'enrichment',reason:'javascript_render_required',next_action:'Capture the permitted rendered official source, validate identity, and re-extract through the shared pipeline.',...inspected}:null;
}
