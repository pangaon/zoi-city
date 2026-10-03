const { chromium } = require("playwright-core"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222",
  P = "44444444-4444-4444-8444-444444444444",
  base = "https://csebihpaychdkanjjsmz.supabase.co",
  row = {
    id: "33333333-3333-4333-8333-333333333333",
    slug: "alpha",
    name: "Alpha",
    entity_type: "business",
    city: "Toronto",
    country: "Canada",
    address: "1 Street",
    latitude: 43.66,
    longitude: -79.38,
    geo_precision: "street",
  },
  beta = {
    ...row,
    id: "55555555-5555-4555-8555-555555555555",
    slug: "beta",
    name: "Beta",
    latitude: null,
    longitude: null,
  },
  athens = {
    ...row,
    id: "66666666-6666-4666-8666-666666666666",
    slug: "athens",
    name: "Athens Place",
    city: "Athens",
    country: "Greece",
  };
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_EXECUTABLE_PATH ||
      "/home/codespace/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
    args: ["--no-sandbox"],
  });
  try {
    for (const width of [390, 1440]) {
      let active = A,
        holdMe = true,
        releaseMe,
        holdSelected = false,
        releaseSelected,
        failedMe = false,
        badMe = false,
        failedSelected = false,
        failedMap = true,
        writes = 0;
      const p = await browser.newPage({ viewport: { width, height: 1000 } });
      await p.addInitScript(() =>
        sessionStorage.setItem(
          "zoi.mobile.refresh.v1",
          JSON.stringify({ refresh_token: "fixture" }),
        ),
      );
      await p.route("https://www.zoi.city/assets/**", (r) =>
        r.fulfill({
          path: path.join(process.cwd(), new URL(r.request().url()).pathname),
        }),
      );
      await p.route(base + "/**", async (r) => {
        const url = r.request().url(),
          name = url.split("/").pop(),
          a = r.request().postDataJSON() || {};
        let body = [];
        if (
          name === "community_preferences_save" ||
          name === "community_profile_save"
        ) {
          writes++;
          assert.fail("No preference writes in a read-only browse journey");
        }
        if (url.includes("/auth/v1/token")) {
          if (url.includes("grant_type=password")) active = B;
          body = {
            access_token: active,
            refresh_token: "fixture",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: { id: active, email: "qa@example.invalid" },
          };
        }
        if (name === "zoi_me")
          body = { authenticated: true, profile: { id: P }, workspaces: [] };
        if (name === "community_me") {
          const actor = r.request().headers().authorization.split(" ")[1],
            city = actor === A ? "Toronto" : "Athens",
            country = actor === A ? "Canada" : "Greece";
          if (holdMe) {
            holdMe = false;
            await new Promise((r) => (releaseMe = r));
          }
          if (failedMe) return r.fulfill({ status: 503, body: "{}" });
          body = {
            ok: true,
            profile: {
              id: badMe ? "invalid" : P,
              handle: "maria",
              display_name: "Maria",
              bio: "",
              interests: [],
              version: 1,
              following_count: 0,
              follower_count: 0,
              post_count: 0,
            },
            preferences: {
              city,
              country,
              topics: [],
              locality_enabled: true,
              version: 1,
            },
            blocked: [],
            muted: [],
          };
        }
        if (name === "explore_search")
          body = [row, beta, athens].filter(
            (x) =>
              (!a.p_city || x.city === a.p_city) &&
              (!a.p_country || x.country === a.p_country),
          );
        if (name === "home_entity") {
          if (holdSelected && a.p_slug === "alpha") {
            holdSelected = false;
            await new Promise((r) => (releaseSelected = r));
          }
          if (failedSelected) return r.fulfill({ status: 404, body: "{}" });
          body = a.p_slug === "beta" ? beta : row;
        }
        if (name === "explore_geo") {
          if (a.p_offset === 0)
            body = [
              {
                slug: "alpha",
                name: "Alpha",
                entity_type: "business",
                city: "Toronto",
                country: "Canada",
                address: row.address,
                lat: 43.66,
                lng: -79.38,
                geo_precision: "street",
              },
              ...Array.from({ length: 999 }, (_, i) => ({
                slug: "coarse-" + i,
                name: "Coarse " + i,
                entity_type: "business",
                city: "Toronto",
                country: "Canada",
                lat: 43.65,
                lng: -79.4,
                geo_precision: "city",
              })),
            ];
          else if (failedMap && a.p_offset === 1000)
            return r.fulfill({ status: 503, body: "{}" });
        }
        await r.fulfill({
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      });
      const button = (name) => p.getByRole("button", { name, exact: true }),
        discover = () => p.getByRole("tab", { name: /Discover/ }).click();
      await p.goto(process.env.EXPO_ORIGIN || "http://localhost:8201");
      await discover();
      for (let i = 0; !releaseMe && i < 100; i++)
        await new Promise((r) => setTimeout(r, 10));
      assert(releaseMe);
      await p.getByRole("tab", { name: /Grow/ }).click();
      await button("Sign out").click();
      await button("Sign in").waitFor();
      releaseMe();
      await discover();
      await p.getByText("Exploring Everywhere", { exact: true }).waitFor();
      assert.equal(
        await p.getByText("Exploring Toronto, Canada", { exact: true }).count(),
        0,
      );
      await button("Sign in to set home").click();
      await p.getByLabel("Email address").fill("other@example.invalid");
      await p.getByLabel("Password", { exact: true }).fill("fixture");
      await button("Sign in").click();
      await button("Sign out").waitFor();
      await discover();
      await p.getByText("Exploring Athens, Greece", { exact: true }).waitFor();
      await button("Preview Athens Place").waitFor();
      assert.equal(await button("Preview Alpha").count(), 0);
      failedMe = true;
      await p.getByRole("tab", { name: /Home/ }).click();
      await discover();
      await button("Retry home preferences").waitFor();
      await p.getByText("Exploring Everywhere", { exact: true }).waitFor();
      failedMe = false;
      badMe = true;
      await button("Retry home preferences").click();
      await p
        .getByText(/Your home preferences could not be confirmed/)
        .waitFor();
      badMe = false;
      await button("Retry home preferences").click();
      await p.getByText("Exploring Athens, Greece", { exact: true }).waitFor();
      await button("Everywhere").click();
      await button("Preview Alpha").waitFor();
      holdSelected = true;
      await button("Preview Alpha").click();
      for (let i = 0; !releaseSelected && i < 100; i++)
        await new Promise((r) => setTimeout(r, 10));
      assert(releaseSelected);
      await button("Preview Beta").click();
      await p.waitForFunction(
        () =>
          Array.from(document.querySelectorAll("div")).filter(
            (x) => x.childNodes.length === 1 && x.textContent === "Beta",
          ).length >= 2,
      );
      releaseSelected();
      await p.waitForTimeout(100);
      assert.equal(await p.getByText("Alpha", { exact: true }).count(), 1);
      failedSelected = true;
      await button("Preview Alpha").click();
      await button("Retry selected place").waitFor();
      assert.equal(await button("Open this place").count(), 0);
      assert.equal(await button("Directions · address on file").count(), 0);
      failedSelected = false;
      await button("Retry selected place").click();
      await button("Open this place").waitFor();
      await button("Close selected place").click();
      await button("Map").click();
      await button("Retry map positions").waitFor();
      assert.equal(await button("Map place · Alpha").count(), 0);
      await p
        .getByText(
          "0 street-level places in this search. Approximate and unmapped places remain in the list.",
          { exact: true },
        )
        .waitFor();
      failedMap = false;
      await button("Retry map positions").click();
      await button("Map place · Alpha").waitFor();
      assert.equal(writes, 0);
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      console.log(
        "PASS native discovery private wait/account switch, malformed/failed home, stale/denied selection and incomplete map",
        width,
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
