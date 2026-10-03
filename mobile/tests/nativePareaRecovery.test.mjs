import test from "node:test";
import assert from "node:assert/strict";
import { nativePareaRecovery } from "../src/nativePareaRecovery.ts";
const id = (n) => "11111111-1111-4111-8111-" + String(n).padStart(12, "0"),
  actor = id(1),
  event = id(2),
  key = "zoi:host-request:" + actor,
  raw = JSON.stringify({ kind: "guest", request: id(3) });
function store() {
  const values = new Map();
  return {
    values,
    getItem: async (k) => values.get(k) || null,
    setItem: async (k, v) => values.set(k, v),
    removeItem: async (k) => values.delete(k),
  };
}
test("nonce-only durable reference restores in exact account/event and contains no bearer or labels", async () => {
  const s = store(),
    a = await nativePareaRecovery(s, actor, event, () => true);
  a.storage.setItem(key, raw);
  assert.equal(s.values.size, 0);
  await a.flush();
  assert.equal(s.values.size, 1);
  assert.equal([...s.values.values()][0], raw);
  a.destroy();
  const b = await nativePareaRecovery(s, actor, event, () => true);
  assert.equal(b.storage.getItem(key), raw);
  assert.equal(
    (await nativePareaRecovery(s, actor, id(9), () => true)).storage.getItem(
      key,
    ),
    null,
  );
  assert.equal(
    (await nativePareaRecovery(s, id(8), event, () => true)).storage.getItem(
      "zoi:host-request:" + id(8),
    ),
    null,
  );
  b.storage.removeItem(key);
  await b.flush();
  assert.equal(s.values.size, 0);
});
test("private capabilities and unexpected stored fields fail closed before writes", async () => {
  const s = store(),
    a = await nativePareaRecovery(s, actor, event, () => true);
  for (const p of [
    { kind: "guest", request: id(3), token: "a".repeat(64) },
    { kind: "guest", request: id(3), label: "Maria" },
    { kind: "allocate", request: id(3) },
  ])
    assert.throws(() => a.storage.setItem(key, JSON.stringify(p)));
  assert.equal(s.values.size, 0);
  s.values.set("zoi.native-parea." + actor + "." + event + ".host", "bad-json");
  await assert.rejects(nativePareaRecovery(s, actor, event, () => true));
});
test("failed persistence retains same queued reference until confirmed, then durable clear", async () => {
  const s = store();
  let fail = true;
  const write = s.setItem;
  s.setItem = async (k, v) => {
    if (fail) throw Error("offline storage");
    return write(k, v);
  };
  const a = await nativePareaRecovery(s, actor, event, () => true);
  a.storage.setItem(key, raw);
  await assert.rejects(a.flush());
  assert.equal(a.pending(), true);
  assert.equal(a.storage.getItem(key), raw);
  fail = false;
  await a.flush();
  assert.equal(a.pending(), false);
  a.storage.removeItem(key);
  await a.flush();
  assert.equal(s.values.size, 0);
});
test("account/view invalidation after storage await keeps recovery reference but rejects stale continuation", async () => {
  const s = store();
  let current = true,
    release;
  const write = s.setItem;
  s.setItem = async (k, v) => {
    await new Promise((r) => (release = r));
    return write(k, v);
  };
  const a = await nativePareaRecovery(s, actor, event, () => current);
  a.storage.setItem(key, raw);
  const p = a.flush();
  while (!release) await new Promise((r) => setImmediate(r));
  current = false;
  release();
  await assert.rejects(p, /changed/);
  assert.equal([...s.values.values()][0], raw);
  await assert.rejects(a.flush(), /changed/);
});
test("payment recovery includes exact guest/version/method/request only", async () => {
  const s = store(),
    a = await nativePareaRecovery(s, actor, event, () => true),
    k = "zoi:event-payment-request:" + actor,
    p = {
      kind: "choice",
      params: {
        p_guest: id(4),
        p_method: "pay_at_door",
        p_expected_policy_version: 2,
        p_expected_version: 0,
        p_request: id(5),
      },
    };
  a.storage.setItem(k, JSON.stringify(p));
  await a.flush();
  assert.deepEqual(JSON.parse([...s.values.values()][0]), p);
  assert.throws(() =>
    a.storage.setItem(
      k,
      JSON.stringify({ ...p, params: { ...p.params, p_token: "private" } }),
    ),
  );
});
