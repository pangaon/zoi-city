import test from "node:test";
import assert from "node:assert/strict";
import {
  pareaDetail,
  pareaPlan,
  pareaGuestParams,
  pareaAmount,
  pareaInvitation,
  pareaPaymentOptions,
  pareaChoiceParams,
} from "../src/nativeParea.ts";
const id = (n) => "11111111-1111-4111-8111-" + String(n).padStart(12, "0"),
  event = id(1),
  profile = id(2),
  token = "a".repeat(64);
const raw = () => ({
  ok: true,
  payment_collected: false,
  allocation: {
    id: id(3),
    event_id: event,
    table_id: id(4),
    host_profile_id: profile,
    label: "Table 10",
    quota: 10,
    version: 1,
    status: "active",
    price_per_guest_cents: 27500,
    currency: "CAD",
    expires_at: new Date(Date.now() + 3600000).toISOString(),
  },
  guests: [],
});
test("whole-ticket 3/1/5 plan leaves one unassigned and keeps exact individual prices", () => {
  const d = pareaDetail(raw(), event, profile),
    rows = [3, 1, 5].map((quantity, i) => ({
      id: id(i + 10),
      label: "Friend " + i,
      quantity,
      status: "draft",
    }));
  assert.equal(pareaPlan(rows, d).remaining, 1);
  assert.match(pareaAmount(3, 27500, "CAD"), /825.00/);
  assert.match(pareaAmount(1, 27500, "CAD"), /275.00/);
  assert.match(pareaAmount(5, 27500, "CAD"), /1,375.00/);
  const p = pareaGuestParams(d, rows[0], token);
  assert.equal(p.p_quantity, 3);
  assert.equal(p.p_expected_version, 0);
  assert.equal(p.p_token, token);
  assert.equal(new URL(pareaInvitation(token, event)).hash, "#claim=" + token);
});
test("fractional, duplicate, excess and expired plans do not become invitations", () => {
  for (const qty of [0, 1.5, 11, NaN])
    assert.throws(() =>
      pareaPlan(
        [{ id: id(10), label: "Maria", quantity: qty, status: "draft" }],
        pareaDetail(raw(), event, profile),
      ),
    );
  const r = { id: id(10), label: "Maria", quantity: 3, status: "draft" };
  assert.throws(() => pareaPlan([r, r], pareaDetail(raw(), event, profile)));
  const expired = raw();
  expired.allocation.expires_at = new Date(1).toISOString();
  assert.throws(() =>
    pareaGuestParams(pareaDetail(expired, event, profile), r, token),
  );
});
test("only current unclaimed guest version can rotate link without extra quota", () => {
  const r = raw();
  r.guests = [
    { id: id(10), label: "Maria", quantity: 3, version: 2, status: "invited" },
  ];
  const d = pareaDetail(r, event, profile);
  assert.equal(
    pareaGuestParams(d, r.guests[0], token, true).p_expected_version,
    2,
  );
  r.guests[0].status = "accepted";
  assert.throws(() =>
    pareaGuestParams(pareaDetail(r, event, profile), r.guests[0], token, true),
  );
  r.allocation.host_profile_id = id(99);
  assert.throws(() => pareaDetail(r, event, profile));
});
const option = () => ({
  guest_id: id(10),
  event_id: event,
  quantity: 3,
  price_per_guest_cents: 27500,
  currency: "CAD",
  expires_at: new Date(Date.now() + 3600000).toISOString(),
  policy: {
    event_id: event,
    version: 2,
    allow_pay_at_door: true,
    allow_pay_online: false,
    online_connected: false,
    response_open: true,
    response_deadline: null,
  },
  choice: null,
});
test("guest choices require current event, explicit deadline proof and unpaid policy version", () => {
  const g = option();
  const r = {
    ok: true,
    guests: [g],
    total: 1,
    payment_collected: false,
    ticket_issued: false,
  };
  assert.equal(pareaPaymentOptions(r, event).guests[0].guest_id, g.guest_id);
  assert.deepEqual(pareaChoiceParams(g), {
    p_guest: g.guest_id,
    p_method: "pay_at_door",
    p_expected_policy_version: 2,
    p_expected_version: 0,
  });
  for (const property of ["response_open", "response_deadline"]) {
    const x = structuredClone(r);
    delete x.guests[0].policy[property];
    assert.throws(() => pareaPaymentOptions(x, event));
  }
  assert.throws(() => pareaPaymentOptions(r, id(99)));
  for (const update of [
    { response_open: false },
    { allow_pay_at_door: false },
    { allow_pay_online: true },
    { online_connected: true },
  ])
    assert.throws(() =>
      pareaChoiceParams({ ...g, policy: { ...g.policy, ...update } }),
    );
  assert.throws(() =>
    pareaChoiceParams({ ...g, choice: { status: "unpaid" } }),
  );
  assert.throws(() => pareaChoiceParams(g, Date.now() + 7200000));
});
