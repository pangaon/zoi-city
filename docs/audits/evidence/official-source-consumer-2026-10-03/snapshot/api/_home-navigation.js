// Opt in before external styles load: incoming cross-document snapshots need
// eligibility during initial document reveal, not after a family stylesheet.
// Existing inline policy remains authoritative; no global error interception.
export function withHomeNavigation(html) {
  if (typeof html !== 'string') return html;
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/i);
  if (!head || [...head[1].matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].some(style => /@view-transition\s*\{/i.test(style[1]))) return html;
  return html.replace(/<head\b[^>]*>/i, '$&<style data-zoi-navigation>@view-transition{navigation:auto}@media(prefers-reduced-motion:reduce){@view-transition{navigation:none}}</style>');
}
