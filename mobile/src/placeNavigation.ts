/** Native profile reads use the current public listing slug, not a legacy SEO alias. */
export function placeDestination(place:{slug?:unknown;path?:unknown}):string|null{
 if(typeof place.slug==='string'&&place.slug.trim()&&place.slug.length<=240)return '/p/'+encodeURIComponent(place.slug.trim());
 if(typeof place.path==='string'&&/^\/(?:p|business|professional|church|organization|creator|artist|school|venue|vendor|event|sports|travel-place)\/[^/?#]+$/.test(place.path))return place.path;
 return null;
}
