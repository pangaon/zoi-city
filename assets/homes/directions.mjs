import {navigationDestination,navigationURL} from '../map-data/directions.mjs';
/** Public homes route to a published postal address, never a locality/name guess.
 * Coordinates require a fresh server review path; these renderers do not provide it. */
export function publishedDirections(entity={}){
 const destination=navigationDestination({s:entity.slug||entity.s||'published-home',n:entity.name||entity.fullName||entity.n||'Place',addr:entity.address??entity.addr,city:entity.city,country:entity.country});
 return destination?navigationURL(destination,{navigate:false}):null;
}
