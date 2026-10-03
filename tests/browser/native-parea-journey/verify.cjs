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
      await button("Organise this table").click();
      await button("+ Add someone").waitFor();
      for (const [i, qty] of [3, 1, 5].entries()) {
        await button("+ Add someone").click();
        await p
          .getByRole("textbox", { name: /Recipient name/ })
          .nth(i)
          .fill(["Maria", "Nikos", "Eleni"][i]);
        await p
          .getByRole("textbox", { name: /Ticket quantity/ })
          .nth(i)
          .fill(String(qty));
      }
      await button("Review whole ticket plan").click();
      await button("Confirm and save personal invitations").waitFor();
      assert.match(await p.locator("body").innerText(), /825.00/);
      assert.match(await p.locator("body").innerText(), /1,375.00/);
      loseGuest = true;
      await button("Confirm and save personal invitations").click();
      await button("Check saved invitation result").waitFor();
      assert.equal(guests.length, 1);
      const first = calls.find((c) => c.name === "event_host_guest_save");
      await button("Check saved invitation result").click();
      await button("Review whole ticket plan").waitFor();
      await button("Review whole ticket plan").click();
      await button("Confirm and save personal invitations").click();
      await button("Share invitation for Eleni").waitFor();
      assert.deepEqual(
        guests.map((g) => g.quantity),
        [3, 1, 5],
      );
      assert.equal(new Set(guests.map((g) => g.token)).size, 3);
      assert.equal(
        calls.filter(
          (c) =>
            c.name === "event_host_guest_save" &&
            c.args.p_request === first.args.p_request,
        ).length,
        1,
      );
      assert.match(
        await p.locator("body").innerText(),
        /10 allocated · 0 accepted · 9 awaiting acceptance · 1 unassigned/,
      );
      await button("Share invitation for Eleni").click();
      await p.waitForFunction(() => !!window.lastShare);
      const share = await p.evaluate(() => window.lastShare);
      assert.match(share.text, /5 tickets/);
      assert(share.text.includes(guests[2].token));
      shares.push(share);
      await button("Show private link for Eleni").click();
      await button("Hide private link").waitFor();
      assert((await p.locator("body").innerText()).includes(guests[2].token));
      await button("Hide private link").click();
      const stored = await p.evaluate(() =>
        JSON.stringify({
          local: { ...localStorage },
          session: { ...sessionStorage },
        }),
      );
      for (const g of guests) {
        assert(!stored.includes(g.token));
        assert(!stored.includes(g.label));
      }
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await p
        .getByText("Get your parea ready", { exact: true })
        .scrollIntoViewIfNeeded();
      await p.screenshot({
        path: out + "/host-overview-" + width + ".png",
        fullPage: true,
      });
      await p.reload();
      await enter();
      await button("Organise this table").click();
      await button("Prepare new private link for Maria").waitFor();
      const previous = guests[0].token;
      await button("Prepare new private link for Maria").click();
      await button("Share invitation for Maria").waitFor();
      assert.notEqual(guests.find((g) => g.label === "Maria").token, previous);
      const maria = guests.find((g) => g.label === "Maria");
      // Fresh session replaces host with guest on reload; persisted host references stay in separate scope.
      actor = B;
      profile = Q;
      await p.reload();
      await enter();
      const privateLink =
        "https://www.zoi.city/tickets/hosts/?event=" +
        event +
        "#claim=" +
        maria.token;
      await p
        .getByRole("textbox", {
          name: "Private Zoi invitation link",
          exact: true,
        })
        .fill(privateLink);
      await button("Check this invitation").click();
      await button("Join my parea").waitFor();
      loseClaim = true;
      await button("Join my parea").click();
      await button("Check saved invitation result").waitFor();
      const claimCount = calls.filter(
        (c) => c.name === "event_host_claim",
      ).length;
      await p.reload();
      await enter();
      await button("Check saved invitation result").click();
      await button("Choose pay at the door").waitFor();
      assert.equal(
        calls.filter((c) => c.name === "event_host_claim").length,
        claimCount,
      );
      loseChoice = true;
      await button("Choose pay at the door").click();
      await button("Check saved preference result").waitFor();
      await p.reload();
      await enter();
      await button("Check saved preference result").click();
      await p
        .getByText("Pay at the door selected · unpaid", { exact: true })
        .waitFor();
      assert.equal(
        calls.filter((c) => c.name === "event_guest_payment_choose").length,
        1,
      );
      assert.equal(await button("Choose pay at the door").isDisabled(), true);
      policy = {
        ...policy,
        version: 2,
        response_open: false,
        response_deadline: "2000-01-01T00:00:00Z",
      };
      choice = { ...choice, status: "needs_review" };
      await button("Refresh my parea").click();
      await p.getByText(/Responses are closed/).waitFor();
      assert.equal(await button("Choose pay at the door").isDisabled(), true);
      await p
        .getByText("Your payment arrangements", { exact: true })
        .scrollIntoViewIfNeeded();
      await p.screenshot({
        path: out + "/guest-" + width + ".png",
        fullPage: true,
      });
      // Signed out event does not expose private controls or dispatch private reads.
      await p.getByRole("tab", { name: /Grow/ }).click();
      await button("Sign out").click();
      const before = calls.length;
      await p.getByRole("tab", { name: /Events/ }).click();
      await p.getByText("Parea journey event", { exact: true }).waitFor();
      assert.equal(
        await p.getByText("Get your parea ready", { exact: true }).count(),
        0,
      );
      assert.equal(
        calls
          .slice(before)
          .filter((c) => /^event_host_|event_guest_payment/.test(c.name))
          .length,
        0,
      );
      assert.equal(errors.length, 0, errors.join("\n"));
      await fs.writeFile(
        out + "/journey-" + width + ".json",
        JSON.stringify(
          {
            width,
            wholeQuantities: guests.map((g) => g.quantity),
            uniqueTokens: 3,
            hostWrites: calls.filter((c) => c.name === "event_host_guest_save")
              .length,
            claimWrites: claimCount,
            choiceWrites: 1,
            source: "controlled transport of actual compiled Expo app",
            physicalDevice: false,
          },
          null,
          2,
        ),
      );
      console.log(
        "PASS native whole-ticket host, recovery, private share, guest claim and unpaid arrangement",
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
