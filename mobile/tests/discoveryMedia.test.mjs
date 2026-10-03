import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { discoveryMedia } from "../src/discoveryMedia.ts";
import { publicListingMedia } from "../../assets/discovery/public-listing-media.mjs";

const read = (name) =>
  JSON.parse(
    readFileSync(
      new URL(
        `../../docs/audits/evidence/native-discovery-media-producer-2026-10-03/${name}.json`,
        import.meta.url,
      ),
    ),
  );
const home = read("home_entity").body;
const card = read("explore_search").body.find((row) => row.id === home.id);
const image = "https://example.test/approved/interior.jpg";
const copy = (value) => JSON.parse(JSON.stringify(value));

test("actual public Signature null SQL photo uses exact shared reviewed media on card and selected home", () => {
  assert.equal(home.photo_url, null);
  assert.equal(card.photo_url, null);
  assert(card.media_input);
  for (const row of [card, home]) {
    const model = publicListingMedia(row);
    assert(model.hero);
    assert.deepEqual(discoveryMedia(row), {
      uri: model.hero,
      kind: "hero",
      fit: "cover",
      backdrop: "neutral",
    });
  }
});

test("owner photo edit and explicit null clear follow shared model on both bounded and full entities", () => {
  for (const original of [home, card]) {
    for (const photo of [image, null, ""]) {
      const row = copy(original),
        entity = row.media_input || row;
      entity.owner_content = { photo_url: photo };
      const model = publicListingMedia(row),
        result = discoveryMedia(row);
      assert.equal(result.uri, model.hero || model.logo || null);
      assert.equal(model.hero, photo || null);
      if (!photo) assert.notEqual(result.kind, "hero");
    }
  }
});

test("owner website edit and clears remove old reviewed imagery without a native override", () => {
  for (const website of ["https://different.test/", null, ""]) {
    const row = copy(card);
    row.media_input.owner_content = { website };
    assert.equal(discoveryMedia(row).uri, null);
  }
});

test("raw profile hero clear and owner all-media clear remain explicit", () => {
  const row = copy(home);
  row.profile = { ...row.profile, hero_url: null };
  assert.equal(publicListingMedia(row).hero, null);
  assert.notEqual(discoveryMedia(row).kind, "hero");
  row.owner_content = {
    photo_url: null,
    logo_url: null,
    profile: { gallery: [] },
  };
  assert.equal(discoveryMedia(row).uri, null);
});

test("association/quarantined source cannot regain curated media through native", () => {
  const row = copy(home);
  row.profile._enrich = {
    ...row.profile._enrich,
    source_kind: "association_member",
    hero_url: image,
  };
  assert.equal(discoveryMedia(row).uri, null);
  row.owner_content = { photo_url: image };
  assert.equal(discoveryMedia(row).uri, image);
});

test("sparse, unsafe and failed roles do not infer a photo or leak raw fields", () => {
  for (const row of [
    null,
    {},
    { photo_url: "http://example.test/x.jpg" },
    { photo_url: "https://x:secret@example.test/x.jpg" },
  ]) {
    assert.equal(discoveryMedia(row).uri, null);
    assert.deepEqual(Object.keys(discoveryMedia(row)).sort(), [
      "backdrop",
      "fit",
      "kind",
      "uri",
    ]);
  }
});

test("official logo-only identity uses model fit and backdrop; poster keeps full aspect", () => {
  const row = {
    website: "https://example.test/",
    profile: {
      logo_url: "https://example.test/brand.svg",
      _enrich: { source_url: "https://example.test/", photo_urls: [] },
    },
  };
  assert.deepEqual(discoveryMedia(row), {
    uri: "https://example.test/brand.svg",
    kind: "logo",
    fit: "contain",
    backdrop: "light",
  });
  row.profile.hero_kind = "event_poster";
  row.profile.hero_url = image;
  assert.equal(discoveryMedia(row).kind, "poster");
  assert.equal(discoveryMedia(row).fit, "contain");
});

test("gallery-only or interface artwork cannot become native hero", () => {
  const row = {
    website: "https://example.test/",
    profile: {
      _enrich: {
        source_url: "https://example.test/",
        photo_urls: [image, "https://example.test/icon.svg"],
        photo_roles: [{ url: image, role: "gallery_only" }],
      },
    },
  };
  assert.equal(discoveryMedia(row).uri, null);
});

test("legacy selected logo and sparse selected photo preserve fallback semantics", () => {
  assert.deepEqual(discoveryMedia({ photo_url: image, image_kind: "logo" }), {
    uri: image,
    kind: "logo",
    fit: "contain",
    backdrop: "light",
  });
  assert.equal(discoveryMedia({ photo_url: image }).fit, "cover");
});
