const { chromium } = require("playwright-core"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises");
const id = (n) => "41000000-0000-4000-8000-" + String(n).padStart(12, "0"),
  A = id(1),
  B = id(2),
  P = id(3),
  Q = id(4),
  event = id(5),
  allocation = id(6),
  table = id(7),
  out = process.env.QA_OUTPUT_DIR || "/tmp/native-parea-journey",
  origin = process.env.EXPO_ORIGIN || "http://localhost:8204";
(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_EXECUTABLE_PATH ||
      "/home/codespace/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
    args: ["--no-sandbox"],
  });
  try {
    for (const width of [390, 1440]) {
      let actor = A,
        profile = P,
        guests = [],
        receipts = new Map(),
        policy = {
          event_id: event,
          version: 1,
          allow_pay_at_door: true,
          allow_pay_online: false,
          online_connected: false,
          response_open: true,
          response_deadline: null,
        },
        choice = null,
        loseGuest = false,
        loseClaim = false,
        loseChoice = false,
        empty = false,
        expired = false,
        deny = false,
        held = false,
        release;
      const calls = [],
        shares = [],
        errors = [];
      const p = await browser.newPage({
        viewport: { width, height: 1100 },
        hasTouch: width === 390,
        isMobile: width === 390,
      });
      p.on("pageerror", (e) => errors.push(e.message));
      await p.addInitScript(() => {
        sessionStorage.setItem(
          "zoi.mobile.refresh.v1",
          JSON.stringify({ refresh_token: "fixture" }),
        );
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: async (value) => {
            window.lastShare = value;
          },
        });
      });
      await p.route(
        "https://csebihpaychdkanjjsmz.supabase.co/**",
        async (r) => {
          const url = r.request().url(),
            name = url.split("/").pop(),
            args = r.request().postDataJSON();
          calls.push({ name, args, actor });
          let body = [];
          const a = {
            id: allocation,
            event_id: event,
            table_id: table,
            host_profile_id: P,
            quota: 10,
            version: 1,
            label: "Table 10",
            status: "active",
            expires_at: expired
              ? "2000-01-01T00:00:00Z"
              : "2099-01-01T12:00:00Z",
            price_per_guest_cents: 27500,
            currency: "CAD",
          };
          if (url.includes("/auth/v1/token"))
            body = {
              access_token: "fixture",
              refresh_token: "fixture",
              expires_at: Math.floor(Date.now() / 1000) + 3600,
              user: {
                id: actor,
                email: actor === A ? "host@example.test" : "guest@example.test",
              },
            };
          if (name === "zoi_me")
            body = {
              authenticated: true,
              profile: { id: profile },
              workspaces: [],
            };
          if (name === "explore_search")
            body = [
              { id: event, name: "Parea journey event", entity_type: "event" },
            ];
          if (name === "tickets_event_public")
            body = { id: event, name: "Parea journey event" };
          if (name === "tickets_seat_map") body = { available: false };
          if (name === "tickets_seat_status")
            body = {
              server_time: new Date().toISOString(),
              active_hold: null,
              reservations: [],
            };
          if (name === "event_host_list")
            body = { ok: true, allocations: actor === A && !empty ? [a] : [] };
          if (name === "event_host_get") {
            if (held) {
              held = false;
              await new Promise((res) => (release = res));
            }
            if (deny) return r.fulfill({ status: 403, body: "{}" });
            body = {
              ok: true,
              payment_collected: false,
              allocation: a,
              guests: guests.map(({ token, ...g }) => g),
            };
          }
          if (name === "event_host_guest_save") {
            assert.equal(actor, A);
            assert(!expired);
            assert.equal(args.p_allocation, allocation);
            assert.match(args.p_token, /^[a-f0-9]{64}$/);
            const previous = guests.find((g) => g.id === args.p_guest);
            assert.equal(args.p_expected_version, previous?.version || 0);
            assert(!previous || previous.status === "invited");
            const g = {
              id: args.p_guest,
              label: args.p_label,
              quantity: args.p_quantity,
              version: args.p_expected_version + 1,
              status: "invited",
              token: args.p_token,
            };
            guests = [...guests.filter((g) => g.id !== args.p_guest), g];
            body = {
              ok: true,
              guest: {
                id: g.id,
                label: g.label,
                quantity: g.quantity,
                version: g.version,
                status: g.status,
              },
              payment_collected: false,
            };
            receipts.set(args.p_request, body);
            if (loseGuest) {
              loseGuest = false;
              return r.abort("failed");
            }
          }
          if (name === "event_host_receipt")
            body = {
              ok: true,
              found: receipts.has(args.p_request),
              receipt: receipts.get(args.p_request) || null,
            };
          if (name === "event_host_request_cancel") {
            body = {
              ok: true,
              found: true,
              receipt: receipts.get(args.p_request) || {
                ok: false,
                error: "request_cancelled",
                request_id: args.p_request,
                kind: args.p_kind,
                payment_collected: false,
                ticket_issued: false,
              },
            };
            receipts.set(args.p_request, body.receipt);
          }
          if (name === "event_host_claim_preview") {
            const g = guests.find((g) => g.token === args.p_token);
            if (!g || expired) return r.fulfill({ status: 409, body: "{}" });
            body = {
              ok: true,
              event_id: event,
              event_name: "Parea journey event",
              table_id: table,
              table_label: "Table 10",
              quantity: g.quantity,
              status: g.status,
              expires_at: a.expires_at,
              price_per_guest_cents: 27500,
              currency: "CAD",
              payment_collected: false,
              ticket_issued: false,
            };
          }
          if (name === "event_host_claim") {
            assert.equal(actor, B);
            const g = guests.find((g) => g.token === args.p_token);
            assert(g);
            g.status = "accepted";
            g.claimant = B;
            body = {
              ok: true,
              event_id: event,
              table_id: table,
              guest_id: g.id,
              quantity: g.quantity,
              status: "accepted",
              price_per_guest_cents: 27500,
              currency: "CAD",
              payment_collected: false,
              ticket_issued: false,
            };
            receipts.set(args.p_request, body);
            if (loseClaim) {
              loseClaim = false;
              return r.abort("failed");
            }
          }
          if (name === "event_guest_payment_options")
            body = {
              ok: true,
              total: guests.filter((g) => g.claimant === actor).length,
              guests: guests
                .filter((g) => g.claimant === actor)
                .map((g) => ({
                  guest_id: g.id,
                  event_id: event,
                  table_label: "Table 10",
                  quantity: g.quantity,
                  price_per_guest_cents: 27500,
                  currency: "CAD",
                  expires_at: a.expires_at,
                  policy,
                  choice,
                })),
              payment_collected: false,
              ticket_issued: false,
            };
          if (name === "event_guest_payment_choose") {
            assert.equal(actor, B);
            assert.equal(policy.response_open, true);
            assert.equal(args.p_expected_policy_version, policy.version);
            choice = {
              method: "pay_at_door",
              status: "unpaid",
              version: (choice?.version || 0) + 1,
              policy_version: policy.version,
            };
            const g = guests.find((g) => g.id === args.p_guest);
            body = {
              ok: true,
              request_id: args.p_request,
              scope: { guest: g.id },
              event_id: event,
              guest_id: g.id,
              quantity: g.quantity,
              price_per_guest_cents: 27500,
              currency: "CAD",
              choice,
              payment_collected: false,
              ticket_issued: false,
            };
            receipts.set(args.p_request, body);
            if (loseChoice) {
              loseChoice = false;
              return r.abort("failed");
            }
          }
          if (name === "event_payment_request")
            body = {
              ok: true,
              request_id: args.p_request,
              kind: args.p_kind,
              scope: args.p_scope,
              found: receipts.has(args.p_request),
              receipt: receipts.get(args.p_request) || null,
            };
          await r.fulfill({
            contentType: "application/json",
            body: JSON.stringify(body),
          });
        },
      );
      const button = (name) => p.getByRole("button", { name, exact: true }),
        enter = async () => {
          await p.getByRole("tab", { name: /Events/ }).click();
          const b = p.getByRole("button", { name: /Parea journey event/ });
          await b
            .or(p.getByText("Get your parea ready", { exact: true }))
            .first()
            .waitFor();
          if (await b.count()) await b.click();
          await button("Refresh my parea").waitFor();
          await p.waitForFunction(
            () =>
              !Array.from(document.querySelectorAll('[role="button"]')).some(
                (x) => x.textContent === "Checking current details…",
              ),
          );
        };
      await p.goto(origin);
      await enter();
      empty = true;
      await button("Refresh my parea").click();
      await p.getByText(/No active table is assigned/).waitFor();
      assert.equal(await button("Organise this table").count(), 0);
      empty = false;
      expired = true;
      await button("Refresh my parea").click();
      await button("Organise this table").waitFor();
      assert.equal(await button("Organise this table").isDisabled(), true);
      expired = false;
      await button("Refresh my parea").click();
      await button("Organise this table").click();
      await button("+ Add someone").waitFor();
      held = true;
      await button("Refresh selected table").click();
      while (!release) await new Promise((r) => setTimeout(r, 10));
      await p.getByRole("tab", { name: /Grow/ }).click();
      await button("Sign out").click();
      release();
      release = null;
      await p.getByRole("tab", { name: /Events/ }).click();
      await p.getByText("Parea journey event", { exact: true }).waitFor();
      assert.equal(
        await p.getByText("Get your parea ready", { exact: true }).count(),
        0,
      );
      assert.equal(
        calls.filter((c) => c.name === "event_host_guest_save").length,
        0,
      );
      actor = B;
      profile = Q;
      await p.reload();
      await enter();
      assert.equal(await button("Organise this table").count(), 0);
      assert.equal(
        await p.getByRole("textbox", { name: /Recipient name/ }).count(),
        0,
      );
      actor = A;
      profile = P;
      await p.reload();
      await enter();
      await button("Organise this table").click();
      await button("+ Add someone").click();
      await p
        .getByRole("textbox", { name: /Recipient name/ })
        .fill("Private friend");
      await p.getByRole("textbox", { name: /Ticket quantity/ }).fill("3");
      await button("Review whole ticket plan").click();
      await button("Confirm and save personal invitations").click();
      await button("Share invitation for Private friend").waitFor();
      await p.evaluate(() =>
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: undefined,
        }),
      );
      await button("Share invitation for Private friend").click();
      await p.getByText(/Sharing did not open/).waitFor();
      await button("Show private link for Private friend").click();
      await button("Hide private link").waitFor();
      assert((await p.locator("body").innerText()).includes(guests[0].token));
      await button("Hide private link").click();
      const privateToken = guests[0].token;
      guests[0].version++;
      guests[0].token = "e".repeat(64);
      await button("Show private link for Private friend").click();
      await p
        .getByRole("alert")
        .filter({ hasText: /could not be confirmed/ })
        .waitFor();
      assert(!(await p.locator("body").innerText()).includes(privateToken));
      await button("Refresh my parea").click();
      await button("Prepare new private link for Private friend").waitFor();
      assert.equal(
        await button("Share invitation for Private friend").count(),
        0,
      );
      // Restore only a nonsecret unknown request; the real UI requires a lookup before cancellation.
      const nonce = id(80);
      await p.evaluate(
        ({ actor, event, nonce }) =>
          localStorage.setItem(
            "zoi.native-parea." + actor + "." + event + ".host",
            JSON.stringify({ kind: "claim", request: nonce }),
          ),
        { actor, event, nonce },
      );
      await p.reload();
      await enter();
      await button("Check saved invitation result").waitFor();
      assert.equal(
        await button("Cancel if no invitation was saved").count(),
        0,
      );
      await button("Check saved invitation result").click();
      await button("Cancel if no invitation was saved").waitFor();
      await button("Cancel if no invitation was saved").click();
      await p.waitForFunction(
        () =>
          !document.body.textContent.includes(
            "Check your previous invitation request",
          ),
      );
      assert.equal(
        calls.filter(
          (c) =>
            c.name === "event_host_request_cancel" &&
            c.args.p_request === nonce,
        ).length,
        1,
      );
      deny = true;
      await button("Refresh my parea").click();
      await p
        .getByRole("alert")
        .filter({ hasText: /could not be confirmed/ })
        .waitFor();
      assert.equal(await button("Organise this table").count(), 0);
      assert.equal(
        await p.getByRole("textbox", { name: /Recipient name/ }).count(),
        0,
      );
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      assert.equal(errors.length, 0, errors.join("\n"));
      await fs.writeFile(
        out + "/privacy-" + width + ".json",
        JSON.stringify(
          {
            width,
            checks: [
              "empty allocation",
              "expired allocation",
              "held response across sign-out",
              "other account",
              "unsupported Share/manual link",
              "rotated version stale token rejection",
              "unknown nonce lookup/cancel",
              "denied private refresh",
            ],
            physicalDevice: false,
          },
          null,
          2,
        ),
      );
      console.log(
        "PASS native parea privacy, expiry, versioned link, unsupported share and exact cancellation",
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
