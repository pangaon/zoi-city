// Keep non-Latin place names distinct while preserving existing Latin URLs.
export function placeSlug(value) {
  return String(value == null ? '' : value).toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
}
