import test from "node:test";
import assert from "node:assert/strict";
import {
  initialDiscovery,
  discoveryPreferences,
  discoveryArea,
  browseArea,
  discoveryRows,
  discoveryPoints,
  exactPins,
  pointStatus,
  selectedEntity,
  placeDirections,
  discoveryShare,
} from "../src/discovery.ts";
const id = "11111111-1111-4111-8111-111111111111",
  receipt = {
    ok: true,
    profile: { id },
    preferences: {
      city: "Toronto",
      country: "Canada",
      locality_enabled: true,
      topics: ["music"],
      version: 3,
    },
  },
  home = { city: "Toronto", country: "Canada" };
test("saved home applies only to default browsing, global search and temporary city do not overwrite it", () => {
  const s = initialDiscovery();
  assert.equal(discoveryArea(s, home).source, "home");
  assert.equal(
    discoveryArea({ ...s, query: "Signature" }, home).source,
    "global",
  );
  assert.equal(
    discoveryArea({ ...s, source: "global" }, home).source,
    "global",
  );
  assert.deepEqual(
    discoveryArea(
      {
        ...s,
        source: "explicit",
        area: { city: "London", country: "United Kingdom" },
      },
      home,
    ),
    {
      city: "London",
      country: "United Kingdom",
      source: "temporary",
      label: "London, United Kingdom",
    },
  );
  assert.deepEqual(home, { city: "Toronto", country: "Canada" });
});
test("authoritative preference receipt supports explicit clears and sparse account; malformed receipt refused", () => {
  assert.deepEqual(discoveryPreferences(receipt), {
    home,
    topics: ["music"],
    version: 3,
  });
  assert.equal(
    discoveryPreferences({
      ...receipt,
      preferences: { ...receipt.preferences, locality_enabled: false },
    }).home,
    null,
  );
  assert.equal(
    discoveryPreferences({
      ...receipt,
      preferences: {
        city: null,
        country: null,
        locality_enabled: true,
        topics: [],
      },
    }).home,
    null,
  );
  for (const v of [null, { ok: true }, { ...receipt, ok: false }])
    assert.throws(() => discoveryPreferences(v));
});
test("scope inputs literal and public rows must match chosen city/country/current identity", () => {
  assert.deepEqual(browseArea(" London ", "UK"), {
    city: "London",
    country: "UK",
  });
  for (const city of ["", "%", "_", "a\\b"])
    assert.throws(() => browseArea(city, ""));
  const row = {
    id,
    name: "Place",
    slug: "current",
    path: "/business/stale",
    city: "Toronto",
    country: "Canada",
    entity_type: "business",
  };
  assert.equal(
    discoveryRows(
      [
        row,
        row,
        { ...row, id: "bad" },
        { ...row, slug: "other", city: "London" },
        { ...row, slug: "hidden", marketplace_status: "hidden" },
      ],
      home,
      "business",
    ).length,
    1,
  );
});
test("coarse, missing, fake centroids and conflicted street coordinates never become precise pins", () => {
  const base = {
    slug: "a",
    name: "A",
    city: "Toronto",
    country: "Canada",
    lat: 43,
    lng: -79,
    geo_precision: "city",
  };
  let points = discoveryPoints([
    base,
    { ...base, slug: "b", geo_precision: "street", lat: 44 },
    { ...base, slug: "c", geo_precision: "", lat: 45 },
    { ...base, slug: "zero", lat: 0, lng: 0 },
    { ...base, slug: "d", geo_precision: "street", city: "Other" },
  ]);
  assert.equal(exactPins(points).length, 1);
  assert.match(pointStatus(points[0]), /Approximate/);
  assert.match(pointStatus(null), /not available/);
  points = discoveryPoints(
    Array.from({ length: 9 }, (_, i) => ({
      ...base,
      slug: String(i),
      geo_precision: "street",
      address: i + " separate road",
    })),
  );
  assert.equal(exactPins(points).length, 0);
});
test("fresh selected entity must match exact current slug/id and public visibility", () => {
  const entity = {
    id,
    name: "A",
    slug: "current",
    address: "1 Main road",
    city: "Toronto",
    country: "Canada",
    latitude: 43,
    longitude: -79,
    geo_precision: "street",
  };
  assert.equal(
    selectedEntity(entity, "current", id).reviewed_destination,
    null,
  );
  for (const e of [
    { ...entity, id: "bad" },
    { ...entity, publish_status: "draft" },
    { ...entity, marketplace_status: "hidden" },
  ])
    assert.throws(() => selectedEntity(e, "current", id));
  assert.throws(() => selectedEntity(entity, "different"));
  assert.throws(() =>
    selectedEntity(entity, "current", "22222222-2222-4222-8222-222222222222"),
  );
});
test("Directions uses actual same-record reviewed receipt, current address, or explicit provider name search", () => {
  const point = { s: "current", lat: 43, lng: -79, precision: "street" },
    entity = {
      id,
      name: "A",
      slug: "current",
      address: "1 Main road",
      city: "Toronto",
      country: "Canada",
      latitude: 43,
      longitude: -79,
      geo_precision: "street",
      reviewed_destination: {
        listing_id: id,
        request_id: "proof",
        precision: "street",
        latitude: 43,
        longitude: -79,
      },
    };
  assert.equal(placeDirections(entity, point).basis, "reviewed");
  assert.equal(
    placeDirections(
      {
        ...entity,
        reviewed_destination: {
          ...entity.reviewed_destination,
          listing_id: "other",
        },
      },
      point,
    ).basis,
    "address",
  );
  assert.equal(
    placeDirections(
      { ...entity, address: null, reviewed_destination: null },
      point,
    ).basis,
    "name",
  );
  assert.equal(
    placeDirections(
      { ...entity, address: null, city: null, reviewed_destination: null },
      point,
    ),
    null,
  );
  assert.equal(discoveryShare("current"), "https://www.zoi.city/p/current");
  assert(!discoveryShare("current").includes("Toronto"));
});
import { discoveryLink } from "../src/discovery.ts";
test("native discovery/map public links carry explicit intent and canonical place without touching home", () => {
  assert.equal(discoveryLink("/explore/").source, "auto");
  assert.equal(discoveryLink("/explore/map/?place=current").source, "global");
  assert.equal(
    discoveryLink(
      "zoi://explore/map/?city=London&country=United%20Kingdom&place=current",
    ).mode,
    "map",
  );
  assert.equal(discoveryLink("/explore/?q=").source, "global");
  assert.equal(discoveryLink("https://other.invalid/explore/"), null);
  assert.equal(discoveryLink("/explore/map/#12/40/-70"), null);
});
import { nativePinClusters } from "../src/discovery.ts";
test("native viewport clusters count real pins, hide coarse points and split with zoom without jitter", () => {
  const a = { s: "a", lat: 43, lng: -79, precision: "street" },
    b = { s: "b", lat: 43.0001, lng: -79.0001, precision: "street" },
    coarse = { s: "c", lat: 43, lng: -79, precision: "city" },
    region = {
      latitude: 43,
      longitude: -79,
      latitudeDelta: 1,
      longitudeDelta: 1,
    };
  const groups = nativePinClusters([a, b, coarse], region, 350, 340);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].places.length, 2);
  assert.deepEqual(groups[0].places, [a, b]);
  assert.equal(
    nativePinClusters(
      [a, b],
      { ...region, latitudeDelta: 0.0005, longitudeDelta: 0.0005 },
      350,
      340,
    ).length,
    2,
  );
  const world = nativePinClusters(
    [{ s: "near", lat: 0, lng: -179, precision: "street" }],
    { latitude: 0, longitude: 179, latitudeDelta: 5, longitudeDelta: 5 },
    350,
    340,
  );
  assert.equal(world.length, 1);
});
