import { communityTopics } from "./community.ts";
import {
  hasStreetPosition,
  hasReviewedPosition,
  isMappableRow,
  validatePositionCohorts,
} from "../../assets/map-data/loader.mjs";
import { placeDestination } from "./placeNavigation.ts";
export type Area = { city: string; country: string };
export type DiscoveryState = {
  input: string;
  query: string;
  type: string;
  area: Area | null;
  source: "auto" | "global" | "explicit";
  mode: "list" | "map";
  selected: string;
};
export const initialDiscovery = (): DiscoveryState => ({
  input: "",
  query: "",
  type: "",
  area: null,
  source: "auto",
  mode: "list",
  selected: "",
});
export const cleanLocation = (v: unknown) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .trim()
        .slice(0, 120)
    : "";
const uuid = (v: unknown) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const fold = (v: unknown) =>
  cleanLocation(v).normalize("NFKC").toLocaleLowerCase();
/** Same private-locality contract as web. Only an authenticated receipt supplies home. */
export function discoveryPreferences(v: any) {
  if (v?.ok !== true || !uuid(v.profile?.id))
    throw Error("Your home preferences could not be confirmed.");
  const p = v.preferences || {},
    city = cleanLocation(p.city),
    country = cleanLocation(p.country);
  return {
    home:
      p.locality_enabled === true && (city || country)
        ? { city, country }
        : null,
    topics: Array.isArray(p.topics)
      ? [
          ...new Set(
            p.topics.filter((t: string) => communityTopics.includes(t)),
          ),
        ].slice(0, 8)
      : [],
    version: Number.isSafeInteger(p.version) && p.version >= 0 ? p.version : 0,
  };
}
export function discoveryArea(state: DiscoveryState, home: Area | null) {
  const area =
    state.source === "explicit"
      ? state.area
      : state.source === "auto" && !state.query.trim()
        ? home
        : null;
  return {
    city: area?.city || "",
    country: area?.country || "",
    source:
      state.source === "explicit" ? "temporary" : area ? "home" : "global",
    label: area
      ? [area.city, area.country].filter(Boolean).join(", ")
      : "Everywhere",
  };
}
export function browseArea(city: unknown, country: unknown): Area {
  const area = { city: cleanLocation(city), country: cleanLocation(country) };
  if ((!area.city && !area.country) || /[_%\\]/.test(area.city + area.country))
    throw Error("Choose a city or country name.");
  return area;
}
export function discoveryRows(value: any, area: Area, type: string) {
  if (!Array.isArray(value) || value.length > 48)
    throw Error("These places could not be confirmed.");
  const seen = new Set<string>();
  return value
    .filter(
      (r) =>
        r &&
        uuid(r.id) &&
        typeof r.slug === "string" &&
        r.slug.length <= 240 &&
        r.slug &&
        typeof r.name === "string" &&
        r.name &&
        placeDestination(r) &&
        (!type || r.entity_type === type) &&
        (!area.city || fold(r.city) === fold(area.city)) &&
        (!area.country || fold(r.country) === fold(area.country)) &&
        r.marketplace_status !== "hidden" &&
        (!r.publish_status || r.publish_status === "published"),
    )
    .filter((r) => {
      if (seen.has(r.slug)) return false;
      seen.add(r.slug);
      return true;
    });
}
export function discoveryPoints(rows: any[]) {
  const seen = new Set<string>();
  return validatePositionCohorts(
    rows
      .filter(isMappableRow)
      .filter((r) => {
        if (seen.has(r.slug)) return false;
        seen.add(r.slug);
        return true;
      })
      .map((r) => ({
        s: r.slug,
        n: cleanLocation(r.name),
        t: r.entity_type || "business",
        city: cleanLocation(r.city),
        country: cleanLocation(r.country),
        cat: r.category_slug || "",
        lat: Number(r.lat),
        lng: Number(r.lng),
        addr: r.address || "",
        precision: r.geo_precision || "",
      })),
  );
}
export function scopedPoints(
  points: any[],
  area: Area,
  type: string,
  query: string,
) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return points.filter(
    (p) =>
      (!type || p.t === type) &&
      (!area.city || fold(p.city) === fold(area.city)) &&
      (!area.country || fold(p.country) === fold(area.country)) &&
      words.every((word) =>
        [p.n, p.city, p.country, p.cat, p.t]
          .join(" ")
          .toLocaleLowerCase()
          .includes(word),
      ),
  );
}
export function pointStatus(point: any) {
  return hasStreetPosition(point)
    ? "Street-level position"
    : point
      ? "Approximate area · no precise pin"
      : "Map position not available";
}
export function exactPins(points: any[]) {
  return points.filter(hasStreetPosition);
}
export function selectedEntity(value: any, slug: string, id?: string) {
  const e = Array.isArray(value) ? value[0] : value;
  if (
    !e ||
    !uuid(e.id) ||
    typeof e.name !== "string" ||
    (e.slug !== slug && e.canonical_slug !== slug) ||
    (id && e.id !== id) ||
    e.marketplace_status === "hidden" ||
    (e.publish_status && e.publish_status !== "published")
  )
    throw Error("This place is no longer available. Refresh your search.");
  return { ...e, reviewed_destination: null };
}
export function placeDirections(entity: any, point: any) {
  if (!entity || !uuid(entity.id)) return null;
  const confirmed = point && hasReviewedPosition(point, entity);
  const address = cleanLocation(entity.address),
    city = cleanLocation(entity.city),
    country = cleanLocation(entity.country);
  if (confirmed)
    return {
      url:
        "https://www.google.com/maps/dir/?api=1&destination=" +
        encodeURIComponent(point.lat + "," + point.lng),
      label: "Directions · reviewed pin",
      basis: "reviewed",
    };
  if (address)
    return {
      url:
        "https://www.google.com/maps/dir/?api=1&destination=" +
        encodeURIComponent([address, city, country].filter(Boolean).join(", ")),
      label: "Directions · address on file",
      basis: "address",
    };
  if (city)
    return {
      url:
        "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent(
          [entity.name, city, country].filter(Boolean).join(", "),
        ),
      label: "Find this place in Maps",
      basis: "name",
    };
  return null;
}
export function discoveryShare(slug: string) {
  return "https://www.zoi.city/p/" + encodeURIComponent(slug);
}
/** Shared public links express browsing intent, never overwrite account preferences. */
export function discoveryLink(value: string): DiscoveryState | null {
  try {
    const raw = value.startsWith("zoi://")
        ? "https://www.zoi.city/" + value.slice(6)
        : value,
      u = new URL(raw, "https://www.zoi.city");
    if (
      u.origin !== "https://www.zoi.city" ||
      !/^\/(?:discover|explore)(?:\/map)?\/?$/.test(u.pathname) ||
      u.hash
    )
      return null;
    const p = u.searchParams,
      s = initialDiscovery();
    s.mode = u.pathname.includes("/map") ? "map" : "list";
    s.input = s.query =
      typeof p.get("q") === "string" ? p.get("q")!.trim().slice(0, 200) : "";
    const city = cleanLocation(p.get("city")),
      country = cleanLocation(p.get("country"));
    if (city || country) {
      s.area = browseArea(city, country);
      s.source = "explicit";
    } else if (
      p.has("q") ||
      p.get("scope") === "global" ||
      u.pathname.includes("/map")
    )
      s.source = "global";
    const type = p.get("type") || p.get("t") || "";
    s.type = /^[a-z][a-z_]{0,39}$/.test(type) ? type : "";
    const place = p.get("place");
    if (place && place.length <= 240 && !/[\u0000-\u001f]/.test(place))
      s.selected = place;
    return s;
  } catch {
    return null;
  }
}
/** Visual clusters contain real street positions; their count is never a business pin. */
export function nativePinClusters(
  points: any[],
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  },
  width: number,
  height: number,
) {
  const wrap = (lng: number) => ((lng - region.longitude + 540) % 360) - 180,
    groups = new Map<string, any[]>();
  for (const point of exactPins(points)) {
    const x = wrap(point.lng),
      y = point.lat - region.latitude;
    if (
      Math.abs(x) > region.longitudeDelta / 2 ||
      Math.abs(y) > region.latitudeDelta / 2
    )
      continue;
    const key =
      Math.floor(
        ((x / Math.max(region.longitudeDelta, 0.000001) + 0.5) * width) / 44,
      ) +
      ":" +
      Math.floor(
        ((0.5 - y / Math.max(region.latitudeDelta, 0.000001)) * height) / 44,
      );
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(point);
  }
  return [...groups.entries()].map(([key, places]) => ({
    key,
    places,
    latitude: places.reduce((sum, p) => sum + p.lat, 0) / places.length,
    longitude:
      ((region.longitude +
        places.reduce((sum, p) => sum + wrap(p.lng), 0) / places.length +
        540) %
        360) -
      180,
  }));
}
