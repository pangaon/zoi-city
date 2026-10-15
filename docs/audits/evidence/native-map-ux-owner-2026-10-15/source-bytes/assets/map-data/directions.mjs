import { publishedAddressLookup, validCoordinates } from './loader.mjs';
/** Navigation is performed by the named provider; Zoi never invents a route or ETA. */
export const TRAVEL_MODES = Object.freeze([
  { value: 'driving', label: 'Drive' }, { value: 'walking', label: 'Walk' },
  { value: 'bicycling', label: 'Cycle' }, { value: 'transit', label: 'Transit' },
]);
const clean = value => typeof value === 'string' ? value.replace(/<[^>]*>/g, '').replace(/[\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim() : '';
export function navigationDestination(place, { reviewed = false } = {}) {
  if (!place) return null;
  const lat = place.lat, lng = place.lng;
  if (reviewed && typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && validCoordinates({lat,lng}))
    return { value: `${lat},${lng}`, basis: 'reviewed', label: clean(place.n || place.name) || 'Reviewed destination' };
  const address = clean(place.addr ?? place.address);
  if (!address || !publishedAddressLookup({...place,s:place.s||'destination',n:place.n||place.name||'Destination',addr:address})) return null;
  const value = [address, clean(place.city), clean(place.country)].filter(Boolean).join(', ');
  if (value.length > 1000) return null;
  return { value, basis: 'address', label: value };
}
export function navigationURL(destination, { origin = '', mode = 'driving', navigate = true } = {}) {
  if (!destination || !['address', 'reviewed'].includes(destination.basis) || !clean(destination.value)) return null;
  if (!TRAVEL_MODES.some(item => item.value === mode)) throw Error('Choose a supported travel mode.');
  const start = clean(origin);
  if (start.length > 700) throw Error('The starting address is too long.');
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1'); url.searchParams.set('destination', destination.value);
  url.searchParams.set('travelmode', mode);
  if (start) url.searchParams.set('origin', start);
  if (navigate && start) url.searchParams.set('dir_action', 'navigate');
  if (url.href.length > 2048) throw Error('The directions link is too long. Shorten the starting address.');
  return url.href;
}
export function mountDirections(root, { place, reviewed = false, document: suppliedDocument } = {}) {
  const doc = suppliedDocument || root.ownerDocument;
  let destination = navigationDestination(place, { reviewed });
  const make = (tag, text) => { const element = doc.createElement(tag); if (text) element.textContent = text; return element; };
  root.className = 'm-directions';
  const details = make('details'), summary = make('summary', 'Plan directions'), body = make('div'), dest = make('p');
  const startLabel = make('label', 'Start'), start = make('input');
  start.type = 'text'; start.placeholder = 'Current location in Google Maps'; start.maxLength = 700; start.autocomplete = 'street-address';
  startLabel.append(start);
  const modeLabel = make('label', 'Travel'), mode = make('select');
  for (const item of TRAVEL_MODES) { const option = make('option', item.label); option.value = item.value; mode.append(option); }
  mode.value = 'driving'; modeLabel.append(mode);
  const link = make('a', 'Open directions in Google Maps ↗'); link.target = '_blank'; link.rel = 'noopener noreferrer';
  const note = make('p'), status = make('p'); status.setAttribute('role', 'status');
  const sync = () => {
    root.hidden = !destination;
    if (!destination) { link.removeAttribute?.('href'); return; }
    dest.textContent = 'To: ' + destination.label;
    note.textContent = destination.basis === 'reviewed'
      ? 'Uses the reviewed destination. Google Maps calculates routes, travel times and available navigation.'
      : 'Uses the published address. Check the destination in Google Maps before starting; this map pin is not verified.';
    try { const url = navigationURL(destination, { origin: start.value || '', mode: mode.value || 'driving' }); link.href = url; link.removeAttribute?.('aria-disabled'); status.textContent = ''; }
    catch (error) { link.removeAttribute?.('href'); link.setAttribute('aria-disabled', 'true'); status.textContent = error.message; }
  };
  start.addEventListener('input', sync); mode.addEventListener('change', sync);
  body.append(dest, startLabel, modeLabel, link, note, status); details.append(summary, body); root.append(details); sync();
  return { update(next, options = {}) { destination = navigationDestination(next, options); sync(); }, destroy() { root.replaceChildren(); } };
}
