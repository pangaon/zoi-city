const { chromium } = require("playwright-core"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const actor = "11111111-1111-4111-8111-111111111111",
  profile = "22222222-2222-4222-8222-222222222222",
  base = "https://csebihpaychdkanjjsmz.supabase.co";
const listing = (i, name, city = "Toronto", country = "Canada") => ({
  id: "33333333-3333-4333-8333-" + String(i).padStart(12, "0"),
  slug: "place-" + i,
  path: "/business/stale-" + i,
  name,
  city,
  country,
  entity_type: "business",
  description: "A Greek place to visit",
  address: "",
  publish_status: "published",
  profile: {},
  social_links: {},
  latitude: null,
  longitude: null,
});
const a = {
    ...listing(1, "Alpha Taverna"),
    address: "1 Greek Street",
    latitude: 43.66,
    longitude: -79.38,
    geo_precision: "street",
  },
  b = {
    ...listing(2, "Beta Centre"),
    latitude: 43.65,
    longitude: -79.38,
    geo_precision: "city",
  },
  c = listing(3, "Gamma Unmapped"),
  l = listing(4, "London Bakery", "London", "United Kingdom"),
  places = [a, b, c, l];
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_EXECUTABLE_PATH ||
      "/home/codespace/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
    args: ["--no-sandbox"],
  });
  try {
    for (const width of [390, 1440]) {
      let prefs = {
          city: "Toronto",
          country: "Canada",
          topics: ["music"],
          locality_enabled: true,
          version: 1,
        },
        writes = 0,
        losePreferences = false,
        failSearch = false,
        holdSearch = false,
        release,
        proof = true;
      const calls = [],
        errors = [];
      const tileReceipts=[];
      const p = await browser.newPage({
        viewport: { width, height: 1000 },
        hasTouch: width === 390,
        isMobile: width === 390,
      });
      p.on("pageerror", (e) => errors.push(e.message));
      p.on("response",r=>{const u=new URL(r.url());if(u.hostname.endsWith("openfreemap.org") && r.status()===200)tileReceipts.push({host:u.hostname,path:u.pathname,status:200});});
      await p.addInitScript(() => {
        sessionStorage.setItem(
          "zoi.mobile.refresh.v1",
          JSON.stringify({ refresh_token: "fixture" }),
        );
        window.open = (url) => {
          window.openedUrl = url;
          return null;
        };
      });
      await p.route("https://www.zoi.city/assets/**", (r) => {
        const file = path.join(
          process.cwd(),
          new URL(r.request().url()).pathname,
        );
        if (file.endsWith("maplibre-gl.js")) return r.fulfill({contentType:"application/javascript",body:fs.readFileSync(file,"utf8")+"\nconst OriginalMap=maplibregl.Map;maplibregl.Map=class extends OriginalMap{constructor(...args){super(...args);window.__parentActualMap=this;}};"});
        if (fs.existsSync(file))
          return r.fulfill({
            path: file,
            contentType: file.endsWith(".js")
              ? "application/javascript"
              : "text/css",
          });
        return r.abort();
      });
      await p.route(base + "/**", async (r) => {
        const url = r.request().url(),
          name = url.split("/").pop(),
          args = r.request().postDataJSON() || {};
        calls.push({
          name,
          args,
          authorization: r.request().headers().authorization,
        });
        let body = [];
        if (url.includes("/auth/v1/token"))
          body = {
            access_token: "fixture",
            refresh_token: "fixture",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: { id: actor, email: "qa@example.invalid" },
          };
        if (name === "community_me")
          body = {
            ok: true,
            profile: {
              id: profile,
              handle: "maria",
              display_name: "Maria",
              bio: "",
              interests: [],
              version: 1,
              following_count: 0,
              follower_count: 0,
              post_count: 0,
            },
            preferences: prefs,
            blocked: [],
            muted: [],
          };
        if (name === "community_preferences_save") {
          assert.equal(args.p_expected_version, prefs.version);
          writes++;
          prefs = {
            ...args.p_data,
            city: args.p_data.city || null,
            country: args.p_data.country || null,
            version: prefs.version + 1,
          };
          body = { ok: true, preferences: prefs };
          if (losePreferences) {
            losePreferences = false;
            return r.abort("failed");
          }
        }
        if (name === "explore_search") {
          assert(!r.request().headers().authorization?.includes("fixture"));
          if (holdSearch) {
            holdSearch = false;
            await new Promise((r) => (release = r));
          }
          if (failSearch) return r.fulfill({ status: 503, body: "{}" });
          body = places
            .filter(
              (x) =>
                (!args.p_city || x.city === args.p_city) &&
                (!args.p_country || x.country === args.p_country) &&
                (!args.p_type || x.entity_type === args.p_type) &&
                (!args.p_q ||
                  x.name.toLowerCase().includes(args.p_q.toLowerCase())),
            )
            .slice(
              args.p_offset || 0,
              (args.p_offset || 0) + (args.p_limit || 24),
            );
        }
        if (name === "explore_cities")
          body = [
            { city: "Toronto", country: "Canada", n: 10 },
            { city: "London", country: "United Kingdom", n: 2 },
          ];
        if (name === "explore_geo")
          body = args.p_offset
            ? []
            : [a, b].map((x) => ({
                slug: x.slug,
                name: x.name,
                entity_type: x.entity_type,
                city: x.city,
                country: x.country,
                address: x.address,
                lat: x.latitude,
                lng: x.longitude,
                geo_precision: x.geo_precision,
              }));
        if (name === "home_entity")
          body = places.find((x) => x.slug === args.p_slug) || null;
        if (name === "geography_reviewed_point")
          body =
            proof && args.p_listing === a.id
              ? {
                  listing_id: a.id,
                  request_id: "review",
                  precision: "street",
                  latitude: a.latitude,
                  longitude: a.longitude,
                }
              : null;
        if (name === "zoi_me")
          body = {
            authenticated: true,
            profile: { id: profile },
            workspaces: [],
          };
        if (url.includes("/auth/v1/logout")) body = {};
        await r.fulfill({
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      });
      const button = (name) => p.getByRole("button", { name, exact: true }),
        discover = () => p.getByRole("tab", { name: /Discover/ }).click();
      await p.goto(process.env.EXPO_ORIGIN || "http://localhost:8201");
      await discover();
      await p.getByText("Exploring Toronto, Canada", { exact: true }).waitFor();
      await button("Preview Alpha Taverna").waitFor();
      await p
        .getByText("Close to home.", { exact: false })
        .scrollIntoViewIfNeeded();
      await p.screenshot({
        path: "/tmp/native-discovery-parent-home-" + width + ".png",
        fullPage: true,
      });
      assert.equal(await button("Preview London Bakery").count(), 0);
      assert.equal(writes, 0);
      await button("Browse another area").click();
      await p.getByLabel("Browse city").fill("London");
      await button("Use area · London · United Kingdom").click();
      assert.equal(
        await p.getByLabel("Browse country").inputValue(),
        "United Kingdom",
      );
      await button("Explore this area").click();
      await button("Preview London Bakery").waitFor();
      await p.getByText("Temporary area", { exact: true }).waitFor();
      assert.equal(prefs.city, "Toronto");
      assert.equal(writes, 0);
      await button("Back to my home").click();
      await button("Preview Alpha Taverna").waitFor();
      await p.getByLabel("Search Greek places").fill("Alpha");
      await button("Alpha Taverna · Toronto, Canada").waitFor();
      await button("Alpha Taverna · Toronto, Canada").click();
      await p.getByText("Your selected place", { exact: true }).waitFor();
      await button("Directions · address on file").click();
      assert.match(
        await p.evaluate(() => window.openedUrl),
        /1%20Greek%20Street/,
      );
      await button("Open this place").click();
      await button("← Back").waitFor();
      await button("← Back").click();
      await button("Close selected place").waitFor();
      await button("Close selected place").click();
      await p.getByLabel("Search Greek places").fill("");
      await button("Search").click();
      await button("Map").click();
      await p
        .getByText(
          "1 street-level places in this search. Approximate and unmapped places remain in the list.",
          { exact: true },
        )
        .waitFor();
      await p
        .getByText("Opening the map…", { exact: true })
        .waitFor({ state: "hidden", timeout: 30000 });
      await button("Map place · Alpha Taverna").waitFor();
      assert.equal(await button("Map place · Beta Centre").count(), 0);
      assert.equal(await button("Map place · Gamma Unmapped").count(), 0);
      const canvas = p.locator(".maplibregl-canvas");
      await canvas.scrollIntoViewIfNeeded();
      const box = await canvas.boundingBox();
      if (width === 390)
        await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      else await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await button("Directions · reviewed pin").waitFor();
      await button("Directions · reviewed pin").click();
      assert.match(await p.evaluate(() => window.openedUrl), /43.66%2C-79.38/);
      await button("Focus this pin").click();
      await canvas.scrollIntoViewIfNeeded();
      await p.waitForFunction(() => window.__parentActualMap?.areTilesLoaded() && window.__parentActualMap?.isStyleLoaded() && !window.__parentActualMap?.isMoving(), {timeout:30000});
      assert.ok(tileReceipts.length>0,"Actual public basemap 200 responses must load");
      console.log("INDEPENDENT basemap200 receipts",width,JSON.stringify(tileReceipts.slice(0,12)),"count",tileReceipts.length);
      console.log("INDEPENDENT tile/style/camera gate",width,await p.evaluate(() => ({tilesLoaded:window.__parentActualMap.areTilesLoaded(),styleLoaded:window.__parentActualMap.isStyleLoaded(),moving:window.__parentActualMap.isMoving(),center:window.__parentActualMap.getCenter().toArray(),zoom:window.__parentActualMap.getZoom()})));
      await p.screenshot({
        path: "/tmp/native-discovery-parent-settled-map-" + width + ".png",
        fullPage: true,
      });
      await button("Preview Beta Centre").click();
      await p
        .getByText("Approximate area · no precise pin", { exact: true })
        .first()
        .waitFor();
      await button("Find this place in Maps").click();
      assert.match(await p.evaluate(() => window.openedUrl), /maps\/search/);
      assert(!(await p.evaluate(() => window.openedUrl)).includes("43.65"));
      await button("Preview Gamma Unmapped").click();
      await p
        .getByText("Map position not available", { exact: true })
        .first()
        .waitFor();
      await button("Close selected place").click();
      await button("Home preferences").click();
      await p.getByLabel("Private preferred city").waitFor();
      assert.equal(await p.getByLabel("Public city").count(), 0);
      await p.getByLabel("Private preferred city").fill("London");
      await button("Use area · London · United Kingdom").click();
      assert.equal(await p.getByLabel("Private preferred city").inputValue(), "London");
      assert.equal(await p.getByLabel("Private preferred country").inputValue(), "United Kingdom");
      losePreferences = true;
      await button("Save private feed preferences").click();
      await p
        .getByText(
          "If a save was interrupted, refresh settings to confirm the saved version before trying again.",
          { exact: true },
        )
        .waitFor();
      assert.equal(writes, 1);
      await button("Refresh community settings").click();
      await p.getByLabel("Private preferred city").waitFor();
      assert.equal(
        await p.getByLabel("Private preferred city").inputValue(),
        "London",
      );
      await button("Back from community settings").click();
      await p
        .getByText("Exploring London, United Kingdom", { exact: true })
        .waitFor();
      await button("Preview London Bakery").waitFor();
      assert.equal(writes, 1);
      await p.reload();
      await discover();
      await p
        .getByText("Exploring London, United Kingdom", { exact: true })
        .waitFor();
      await button("Home preferences").click();
      await p.getByLabel("Private preferred city").fill("");
      await p.getByLabel("Private preferred country").fill("");
      await p
        .getByRole("switch", { name: "Use chosen locality for Near me" })
        .click();
      await button("Save private feed preferences").click();
      await p
        .getByText("Private feed preferences saved.", { exact: true })
        .waitFor();
      assert.equal(prefs.city, null);
      assert.equal(prefs.country, null);
      assert.equal(prefs.locality_enabled, false);
      await button("Back from community settings").click();
      await p.getByText("Exploring Everywhere", { exact: true }).waitFor();
      assert.equal(writes, 2);
      failSearch = true;
      await p.getByLabel("Search Greek places").fill("Gamma");
      await button("Search").click();
      await button("Retry places").waitFor();
      assert.equal(await button("Preview Alpha Taverna").count(), 0);
      failSearch = false;
      await button("Retry places").click();
      await button("Preview Gamma Unmapped").waitFor();
      holdSearch = true;
      await p.getByLabel("Search Greek places").fill("Alpha");
      await button("Search").click();
      for (let i = 0; !release && i < 100; i++)
        await new Promise((r) => setTimeout(r, 10));
      assert(release);
      await p.getByLabel("Search Greek places").fill("London");
      await button("Search").click();
      await button("Preview London Bakery").waitFor();
      release();
      await p.waitForTimeout(100);
      assert.equal(await button("Preview Alpha Taverna").count(), 0);
      await p.getByRole("tab", { name: /Grow/ }).click();
      await button("Sign out").click();
      await button("Sign in").waitFor();
      await discover();
      await p.getByText("Exploring Everywhere", { exact: true }).waitFor();
      await button("Sign in to set home").waitFor();
      assert.equal(
        await p
          .getByText(
            "Your interests: music. Interests shape your Community feed; search stays under your control.",
            { exact: true },
          )
          .count(),
        0,
      );
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      assert.equal(errors.length, 0, errors.join("\n"));
      await p.screenshot({
        path: "/tmp/native-discovery-parent-guest-" + width + ".png",
        fullPage: true,
      });
      console.log(
        "PASS native discovery persisted journey, precision, actual map touch, retry and stale search",
        width,
        JSON.stringify({ writes, calls: calls.length }),
      );
      await p.close();
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
