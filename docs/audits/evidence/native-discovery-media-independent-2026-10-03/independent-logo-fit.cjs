const { chromium } = require("playwright-core"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const evidence = path.join(
    process.cwd(),
    "docs/audits/evidence/native-discovery-media-producer-2026-10-03",
  ),
  home = JSON.parse(
    fs.readFileSync(path.join(evidence, "home_entity.json")),
  ).body,
  card = JSON.parse(
    fs.readFileSync(path.join(evidence, "explore_search.json")),
  ).body.find((x) => x.id === home.id),
  images = JSON.parse(
    fs.readFileSync(path.join(evidence, "source-images.json")),
  ).images,
  copy = (x) => JSON.parse(JSON.stringify(x)),
  base = "https://csebihpaychdkanjjsmz.supabase.co",
  out = process.env.QA_OUTPUT_DIR || evidence;
const fake = "https://native-media.example.test/interior.jpg";
const cases = [
  "actual",
  "owner-photo",
  "owner-clear",
  "website-edit",
  "website-clear",
  "quarantine",
  "all-clear",
  "sparse",
  "poster",
  "gallery-only",
  "broken-image",
  "logo-only",
];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_EXECUTABLE_PATH ||
      "/home/codespace/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
    args: ["--no-sandbox"],
  });
  const { PUBLIC_KEY } = await import("../../../mobile/src/session.ts");
  try {
    for (const width of [1440])
      for (const mode of ["owner-clear"]) {
        let row = copy(card),
          entity = copy(home);
        const edit = (fn) => {
          fn(row.media_input);
          fn(entity);
        };
        if (mode === "owner-photo")
          edit((e) => (e.owner_content = { photo_url: fake }));
        if (mode === "owner-clear")
          edit((e) => (e.owner_content = { photo_url: null }));
        if (mode === "website-edit")
          edit(
            (e) => (e.owner_content = { website: "https://different.test/" }),
          );
        if (mode === "website-clear")
          edit((e) => (e.owner_content = { website: null }));
        if (mode === "quarantine")
          edit(
            (e) =>
              (e.profile._enrich = {
                ...e.profile._enrich,
                source_kind: "association_member",
              }),
          );
        if (mode === "all-clear")
          edit(
            (e) =>
              (e.owner_content = {
                photo_url: null,
                logo_url: null,
                profile: { gallery: [] },
              }),
          );
        if (mode === "sparse") {
          row = {
            ...row,
            id: "33333333-3333-4333-8333-000000000001",
            name: "Sparse Greek place",
            slug: "sparse-greek-place",
            media_input: {
              website: null,
              photo_url: null,
              profile: {},
              owner_content: {},
            },
          };
          entity = {
            ...row,
            profile: {},
            owner_content: {},
            canonical_slug: row.slug,
          };
          delete entity.media_input;
        }
        if (mode === "poster")
          edit(
            (e) =>
              (e.owner_content = {
                photo_url: fake,
                profile: { hero_url: fake, hero_kind: "event_poster" },
              }),
          );
        if (mode === "gallery-only")
          edit((e) => {
            e.website = "https://different.test/";
            e.profile = {
              _enrich: {
                source_url: e.website,
                photo_urls: [fake],
                photo_roles: [{ url: fake, role: "gallery_only" }],
              },
            };
            e.photo_url = null;
            e.owner_content = {};
          });
        if (mode === "broken-image")
          edit(
            (e) =>
              (e.owner_content = {
                photo_url: "https://native-media.example.test/unavailable.jpg",
              }),
          );
        if (mode === "logo-only")
          edit((e) => (e.owner_content = { photo_url: null, logo_url: fake }));
        const p = await browser.newPage({
            viewport: { width, height: 1100 },
            isMobile: width === 390,
            hasTouch: width === 390,
          }),
          calls = [],
          errors = [];
        p.on("pageerror", (e) => errors.push(e.message));
        for (const i of images)
          await p.route(i.url, (r) =>
            r.fulfill({
              path: path.join(evidence, "signature-" + i.role + ".img"),
              contentType: i.contentType,
            }),
          );
        await p.route(fake, (r) =>
          r.fulfill({
            path: path.join(evidence, "signature-hero.img"),
            contentType: "image/jpeg",
          }),
        );
        await p.route(
          "https://native-media.example.test/unavailable.jpg",
          (r) => r.fulfill({ status: 404, body: "" }),
        );
        await p.route(base + "/**", (r) => {
          const name = r.request().url().split("/").pop(),
            args = r.request().postDataJSON() || {};
          calls.push({
            name,
            args,
            authorization: r.request().headers().authorization,
          });
          let body = [];
          if (name === "explore_search") body = [row];
          if (name === "explore_geo") body = [];
          if (name === "explore_cities") body = [];
          if (name === "home_entity") body = entity;
          if (name === "geography_reviewed_point") body = null;
          return r.fulfill({
            contentType: "application/json",
            body: JSON.stringify(body),
          });
        });
        await p.goto(process.env.EXPO_ORIGIN || "http://localhost:8205");
        await p.getByRole("tab", { name: /Discover/ }).click();
        await p
          .getByRole("button", { name: "Preview " + row.name, exact: true })
          .waitFor();
        const expected =
          mode === "actual"
            ? images[0].url
            : mode === "owner-photo" ||
                mode === "poster" ||
                mode === "logo-only"
              ? fake
              : mode === "owner-clear"
                ? images[1].url
                : null;
        if (expected)
          await p.waitForFunction(
            (url) =>
              Array.from(document.querySelectorAll("img")).some(
                (x) => x.src === url && x.complete && x.naturalWidth > 0,
              ),
            expected,
          );
        if (!expected)
          await p.waitForFunction(
            () =>
              !Array.from(document.querySelectorAll("img")).some((x) =>
                x.src.includes("static.wixstatic.com/media/"),
              ),
          );
        await p
          .getByRole("button", { name: "Preview " + row.name, exact: true })
          .click();
        await p.getByText("Your selected place", { exact: true }).waitFor();
        await p
          .getByRole("button", { name: "Open this place", exact: true })
          .waitFor();
        if (expected) {
          await p.waitForFunction(
            (url) =>
              Array.from(document.querySelectorAll("img")).filter(
                (x) => x.src === url && x.complete && x.naturalWidth > 0,
              ).length >= 2,
            expected,
          );
        }
        if (!expected)
          await p.waitForFunction(
            () =>
              !Array.from(document.querySelectorAll("img")).some(
                (x) =>
                  x.src.includes("static.wixstatic.com/media/") ||
                  x.src.includes("native-media.example.test/"),
              ),
          );
        if (
          mode === "actual" ||
          mode === "owner-clear" ||
          mode === "poster" ||
          mode === "sparse"
        ) {
          await p
            .getByText("Your selected place", { exact: true })
            .evaluate((el) => el.scrollIntoView({ block: "start" }));
          await p.screenshot({
            path: path.join(out, `${mode}-${width}.png`),
            fullPage: true,
          });
        }
        if (mode === "actual") {
          // Current public owner edits must replace already-decoded bytes in the
          // same mounted application, then a source change must remove them.
          edit((e) => (e.owner_content = { photo_url: fake }));
          await p
            .getByRole("button", { name: "Close selected place", exact: true })
            .click();
          await p.getByRole("button", { name: "Search", exact: true }).click();
          await p.waitForFunction(
            (url) =>
              Array.from(document.querySelectorAll("img")).some(
                (x) => x.src === url && x.complete && x.naturalWidth > 0,
              ),
            fake,
          );
          await p
            .getByRole("button", { name: "Preview " + row.name, exact: true })
            .click();
          await p.waitForFunction(
            (url) =>
              Array.from(document.querySelectorAll("img")).filter(
                (x) => x.src === url && x.complete && x.naturalWidth > 0,
              ).length >= 2,
            fake,
          );
          edit(
            (e) => (e.owner_content = { website: "https://different.test/" }),
          );
          await p
            .getByRole("button", { name: "Close selected place", exact: true })
            .click();
          await p.getByRole("button", { name: "Search", exact: true }).click();
          await p
            .getByRole("button", { name: "Preview " + row.name, exact: true })
            .click();
          await p
            .getByRole("button", { name: "Open this place", exact: true })
            .waitFor();
          await p.waitForFunction(
            () =>
              !Array.from(document.querySelectorAll("img")).some(
                (x) =>
                  x.src.includes("static.wixstatic.com/media/") ||
                  x.src.includes("native-media.example.test/"),
              ),
          );
        }
        assert.equal(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
        );
        assert.deepEqual(errors, []);
        assert(calls.some((x) => x.name === "home_entity"));
        for (const call of calls) {
          const token = call.authorization?.split(" ")[1];
          if (token)
            assert.equal(
              token,
              PUBLIC_KEY,
              "Public native reads must never carry private account credentials",
            );
        }
        assert(
          calls.every((x) =>
            [
              "explore_search",
              "explore_geo",
              "explore_cities",
              "home_entity",
              "geography_reviewed_point",
            ].includes(x.name),
          ),
          JSON.stringify(calls.map((x) => x.name)),
        );
        fs.writeFileSync(
          path.join(out, `${mode}-${width}.json`),
          JSON.stringify({ width, mode, expected, calls, errors, decoded: await p.evaluate(() => Array.from(document.querySelectorAll('img')).map(x => ({src:x.src,naturalWidth:x.naturalWidth,naturalHeight:x.naturalHeight,width:x.getBoundingClientRect().width,height:x.getBoundingClientRect().height,objectFit:getComputedStyle(x).objectFit}))) }, null, 2) +
            "\n",
        );
        await p.close();
        console.log(
          "PASS actual native Discovery card/detail media",
          mode,
          width,
        );
      }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
