import test from "node:test";
import assert from "node:assert/strict";
import { discoveryPrivateRpc } from "../src/discoveryScope.ts";
import { SessionClient } from "../src/session.ts";
const actor = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
for (const name of ["community_me", "community_preferences_save"])
  for (const wait of ["refresh", "response"])
    for (const mode of ["account", "unmount", "unchanged"])
      test(name + " " + wait + " " + mode, async () => {
        let release,
          current = true,
          calls = 0;
        const client = new SessionClient(
          {
            read: async () => null,
            write: async () => {},
            clear: async () => {},
          },
          async (url, init) => {
            if (url.includes("refresh_token")) {
              if (wait === "refresh") await new Promise((r) => (release = r));
              return new Response(
                JSON.stringify({
                  access_token: "new",
                  refresh_token: "r",
                  expires_in: 3600,
                  user: { id: mode === "account" ? other : actor },
                }),
              );
            }
            calls++;
            if (wait === "response") await new Promise((r) => (release = r));
            return new Response(JSON.stringify({ ok: true }));
          },
        );
        client.session = {
          access_token: "old",
          refresh_token: "r",
          expires_at:
            wait === "refresh" ? 1 : Math.floor(Date.now() / 1000) + 3600,
          user: { id: actor },
        };
        const p = discoveryPrivateRpc(
          client,
          actor,
          () => current,
          name,
          name === "community_me"
            ? {}
            : {
                p_expected_version: 1,
                p_data: {
                  city: null,
                  country: null,
                  locality_enabled: false,
                  topics: [],
                },
              },
        );
        while (!release) await new Promise((r) => setImmediate(r));
        if (mode === "account" && wait === "response")
          client.session = { ...client.session, user: { id: other } };
        if (mode === "unmount") current = false;
        release();
        if (mode === "unchanged") {
          assert.equal((await p).ok, true);
          assert.equal(calls, 1);
        } else {
          await assert.rejects(p, /changed/);
          assert.equal(calls, wait === "refresh" ? 0 : 1);
        }
      });
test("no unknown mutations or malformed preference versions dispatch", async () => {
  const c = {
    session: { user: { id: actor } },
    token: async () => assert.fail("no token"),
    request: async () => assert.fail("no dispatch"),
  };
  for (const [name, args] of [
    ["community_me", { foreign: true }],
    ["feed_create", {}],
    ["community_preferences_save", { p_expected_version: -1, p_data: {} }],
    ["community_profile_save", { p_expected_version: 1, p_data: [] }],
  ])
    await assert.rejects(discoveryPrivateRpc(c, actor, () => true, name, args));
});
