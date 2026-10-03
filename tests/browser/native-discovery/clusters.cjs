const { chromium } = require("playwright-core"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const base = "https://csebihpaychdkanjjsmz.supabase.co";
const places = [
  ["alpha", "Alpha", 43.66, -79.38],
  ["beta", "Beta", 43.6601, -79.3801],
].map(([slug, name, latitude, longitude], i) => ({
  id: `33333333-3333-4333-8333-${String(i + 1).padStart(12, "0")}`,
  slug,
  name,
  latitude,
  longitude,
  entity_type: "business",
  city: "Toronto",
  country: "Canada",
  geo_precision: "street",
}));
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_EXECUTABLE_PATH ||
      "/home/codespace/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
    args: ["--no-sandbox"],
  });
  try {
    for (const width of [390, 1440]) {
      const p = await browser.newPage({
          viewport: { width, height: 1000 },
          isMobile: width === 390,
          hasTouch: width === 390,
        }),
        errors = [];
      let failSDK = true,
        sdkFailures = 0,
        privateCalls = 0;
      p.on("pageerror", (e) => errors.push(e.message));
      await p.route("https://www.zoi.city/assets/**", async (r) => {
        const file = path.join(
          process.cwd(),
          new URL(r.request().url()).pathname,
        );
        if (file.endsWith("maplibre-gl.js")) {
          if (failSDK) {
            failSDK = false;
            sdkFailures++;
            return r.abort("failed");
          }
          return r.fulfill({
            contentType: "application/javascript",
            body:
              fs.readFileSync(file, "utf8") +
              "\nconst OriginalMap=maplibregl.Map;maplibregl.Map=class extends OriginalMap{constructor(...args){super(...args);window.__fixtureMap=this;}};",
          });
        }
        return fs.existsSync(file) ? r.fulfill({ path: file }) : r.abort();
      });
      await p.route(base + "/**", (r) => {
        const name = r.request().url().split("/").pop(),
          args = r.request().postDataJSON() || {};
        if (name.startsWith("community_")) privateCalls++;
        let body = [];
        if (name === "explore_search") body = places;
        if (name === "explore_cities")
          body = [{ city: "Toronto", country: "Canada" }];
        if (name === "explore_geo")
          body = args.p_offset
            ? []
            : places.map((x) => ({ ...x, lat: x.latitude, lng: x.longitude }));
        if (name === "home_entity")
          body = places.find((x) => x.slug === args.p_slug) || null;
        return r.fulfill({
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      });
      const button = (name) => p.getByRole("button", { name, exact: true });
      await p.goto(process.env.EXPO_ORIGIN || "http://localhost:8201");
      await p.getByRole("tab", { name: /Discover/ }).click();
      await button("Map").click();
      await p
        .getByText("The interactive map could not load.", { exact: true })
        .waitFor();
      await button("Retry interactive map").click();
      await p
        .getByText("Opening the map…", { exact: true })
        .waitFor({ state: "hidden", timeout: 30000 });
      await p.waitForFunction(() =>
        window.__fixtureMap
          ?.queryRenderedFeatures({ layers: ["zoi-clusters"] })
          ?.some((f) => f.properties.point_count === 2),
      );
      assert.equal(sdkFailures, 1);
      assert.equal(privateCalls, 0);
      const canvas = p.locator(".maplibregl-canvas");
      await canvas.scrollIntoViewIfNeeded();
      const before = await p.evaluate(() => window.__fixtureMap.getZoom()),
        position = await p.evaluate(() => {
          const m = window.__fixtureMap,
            f = m.queryRenderedFeatures({ layers: ["zoi-clusters"] })[0],
            v = m.project(f.geometry.coordinates);
          return { x: v.x, y: v.y };
        }),
        box = await canvas.boundingBox();
      if (width === 390)
        await p.touchscreen.tap(box.x + position.x, box.y + position.y);
      else await p.mouse.click(box.x + position.x, box.y + position.y);
      await p.waitForFunction(
        (z) => window.__fixtureMap.getZoom() > z + 1,
        before,
      );
      await p.waitForFunction(
        () =>
          window.__fixtureMap.queryRenderedFeatures({ layers: ["zoi-pins"] })
            .length >= 2,
      );
      assert.equal(await button("Close selected place").count(), 0);
      const pin = await p.evaluate(() => {
        const m = window.__fixtureMap,
          v = m.project([-79.38, 43.66]);
        return { x: v.x, y: v.y };
      });
      if (width === 390) await p.touchscreen.tap(box.x + pin.x, box.y + pin.y);
      else await p.mouse.click(box.x + pin.x, box.y + pin.y);
      await p.getByText("Your selected place", { exact: true }).waitFor();
      await button("Open this place").waitFor();
      await canvas.scrollIntoViewIfNeeded();
      await p.screenshot({
        path: `/tmp/native-discovery-cluster-${width}.png`,
        fullPage: true,
      });
      assert.deepEqual(errors, []);
      await p.close();
      console.log(
        `PASS actual MapLibre cluster expands on ${width === 390 ? "touch" : "mouse"}, exact pin selection and failed SDK retry ${width}`,
      );
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
