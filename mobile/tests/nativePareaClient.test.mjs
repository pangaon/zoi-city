import test from "node:test";
import assert from "node:assert/strict";
import { nativePareaRpc, nativePareaClient } from "../src/nativePareaClient.ts";
import { SessionClient } from "../src/session.ts";
const id = (n) => "11111111-1111-4111-8111-" + String(n).padStart(12, "0"),
  actor = id(1),
  other = id(2),
  event = id(3);
for (const name of [
  "event_host_guest_save",
  "event_host_claim",
  "event_guest_payment_choose",
])
  for (const wait of ["refresh", "response"])
    for (const mode of ["account", "unmount", "unchanged"])
      test(name + " " + wait + " " + mode, async () => {
        let release,
          current = true,
          calls = 0;
        const c = new SessionClient(
          {
            read: async () => null,
            write: async () => {},
            clear: async () => {},
          },
          async (url) => {
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
        c.session = {
          access_token: "old",
          refresh_token: "r",
          expires_at:
            wait === "refresh" ? 1 : Math.floor(Date.now() / 1000) + 3600,
          user: { id: actor },
        };
        const p = nativePareaRpc(c, actor, () => current, name, {});
        while (!release) await new Promise((r) => setImmediate(r));
        if (mode === "account" && wait === "response")
          c.session = { ...c.session, user: { id: other } };
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
function storage() {
  const values = new Map();
  return {
    values,
    getItem: async (k) => values.get(k) || null,
    setItem: async (k, v) => values.set(k, v),
    removeItem: async (k) => values.delete(k),
  };
}
test("actual shared host client persists nonce before dispatch, loss retries same request and token", async () => {
  const s = storage(),
    sent = [];
  let lost = true;
  const c = {
      session: { user: { id: actor } },
      token: async () => "token",
      request: async (path, p) => {
        assert.equal(s.values.size, 1);
        sent.push(structuredClone(p));
        if (lost) {
          lost = false;
          throw Error("lost");
        }
        return {
          ok: true,
          guest: {
            id: p.p_guest,
            quantity: p.p_quantity,
            label: p.p_label,
            version: 1,
            status: "invited",
          },
          payment_collected: false,
        };
      },
    },
    a = await nativePareaClient({
      client: c,
      actor,
      event,
      current: () => true,
      storage: s,
      randomUUID: () => id(5),
    }),
    params = {
      p_allocation: id(8),
      p_guest: id(9),
      p_expected_version: 0,
      p_label: "Maria",
      p_quantity: 3,
      p_token: "a".repeat(64),
    };
  await assert.rejects(a.hostWrite("guest", "event_host_guest_save", params));
  assert.equal(a.host.state().pending.request, id(5));
  assert.equal(JSON.stringify([...s.values.values()]).includes("aaaa"), false);
  assert.equal(JSON.stringify([...s.values.values()]).includes("Maria"), false);
  await assert.rejects(async () => a.paymentWrite({}), /previous/);
  await a.hostRetry();
  assert.deepEqual(sent[0], sent[1]);
  assert.equal(s.values.size, 0);
  a.destroy();
});
test("remount cannot retry bearer args, exact missing-result cancellation settles before new request", async () => {
  const s = storage();
  s.values.set(
    "zoi.native-parea." + actor + "." + event + ".host",
    JSON.stringify({ kind: "claim", request: id(5) }),
  );
  const calls = [];
  const c = {
      session: { user: { id: actor } },
      token: async () => "token",
      request: async (path, p) => {
        calls.push([path, p]);
        return path.endsWith("event_host_receipt")
          ? { ok: true, found: false }
          : {
              ok: true,
              found: true,
              receipt: {
                ok: false,
                error: "request_cancelled",
                request_id: id(5),
                kind: "claim",
                payment_collected: false,
                ticket_issued: false,
              },
            };
      },
    },
    a = await nativePareaClient({
      client: c,
      actor,
      event,
      current: () => true,
      storage: s,
      randomUUID: () => id(6),
    });
  assert.equal(a.host.state().canRetry, false);
  await assert.rejects(a.hostCancel());
  assert.equal(calls.length, 0);
  assert.equal(await a.hostRecover(), null);
  await a.hostCancel();
  assert.equal(s.values.size, 0);
  assert.deepEqual(
    calls.map((x) => x[1].p_request),
    [id(5), id(5)],
  );
  a.destroy();
});
test("no token or RPC dispatch if durable storage has failed", async () => {
  const s = storage();
  s.setItem = async () => {
    throw Error("device storage failed");
  };
  let dispatched = 0;
  const c = {
      session: { user: { id: actor } },
      token: async () => {
        dispatched++;
        return "token";
      },
      request: async () => {
        dispatched++;
        return {};
      },
    },
    a = await nativePareaClient({
      client: c,
      actor,
      event,
      current: () => true,
      storage: s,
      randomUUID: () => id(5),
    });
  await assert.rejects(
    a.hostWrite("claim", "event_host_claim", { p_token: "a".repeat(64) }),
  );
  assert.equal(dispatched, 0);
  assert.equal(a.host.state().pending.request, id(5));
  assert.equal(a.persistencePending(), true);
});
test("native host never depends on browser structuredClone and rejects non-JSON mutation data", async () => {
  const clone = globalThis.structuredClone;
  try {
    globalThis.structuredClone = undefined;
    const s = storage(),
      c = {
        session: { user: { id: actor } },
        token: async () => "token",
        request: async (path, p) => ({
          ok: true,
          guest: {
            id: p.p_guest,
            label: p.p_label,
            quantity: p.p_quantity,
            version: 1,
            status: "invited",
          },
          payment_collected: false,
        }),
      },
      a = await nativePareaClient({
        client: c,
        actor,
        event,
        current: () => true,
        storage: s,
        randomUUID: () => id(5),
      });
    await assert.rejects(async () =>
      a.hostWrite("guest", "event_host_guest_save", {
        p_allocation: id(7),
        p_guest: id(8),
        p_expected_version: 0,
        p_label: "Maria",
        p_quantity: 1.5,
        p_token: "a".repeat(64),
      }),
    );
    assert.equal(s.values.size, 0);
    await a.hostWrite("guest", "event_host_guest_save", {
      p_allocation: id(7),
      p_guest: id(8),
      p_expected_version: 0,
      p_label: "Maria",
      p_quantity: 3,
      p_token: "a".repeat(64),
    });
    assert.equal(s.values.size, 0);
    a.destroy();
  } finally {
    globalThis.structuredClone = clone;
  }
});
test("durable clear failure blocks new writes until exact storage operation is confirmed", async () => {
  const s = storage();
  let fail = true,
    calls = 0;
  s.removeItem = async (k) => {
    if (fail) throw Error("durable clear failed");
    s.values.delete(k);
  };
  const c = {
      session: { user: { id: actor } },
      token: async () => "token",
      request: async (path, p) => {
        calls++;
        return {
          ok: true,
          guest: {
            id: p.p_guest,
            label: p.p_label,
            quantity: p.p_quantity,
            version: 1,
            status: "invited",
          },
          payment_collected: false,
        };
      },
    },
    a = await nativePareaClient({
      client: c,
      actor,
      event,
      current: () => true,
      storage: s,
      randomUUID: () => id(5),
    });
  const p = {
    p_allocation: id(7),
    p_guest: id(8),
    p_expected_version: 0,
    p_label: "Maria",
    p_quantity: 3,
    p_token: "a".repeat(64),
  };
  await assert.rejects(a.hostWrite("guest", "event_host_guest_save", p));
  assert.equal(a.host.state().pending, null);
  assert(a.persistencePending());
  assert.equal(calls, 1);
  assert.throws(
    () => a.hostWrite("guest", "event_host_guest_save", p),
    /previous/,
  );
  fail = false;
  await a.flush();
  assert.equal(s.values.size, 0);
  assert.equal(a.persistencePending(), false);
  a.destroy();
});
