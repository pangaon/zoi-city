import { HOST_UUID } from "../../assets/tickets/host-allocation-client.mjs";
import {
  currentPareaGroup,
  currentInvitationPreview,
  privateEventInvitation,
} from "./eventHostLink.ts";
import { validatedGuestPaymentOptions } from "../../assets/tickets/event-payment-policy-client.mjs";
export type PareaRecipient = {
  id: string;
  label: string;
  quantity: number;
  status: "draft" | "saving" | "saved" | "accepted" | "unavailable";
  version?: number;
  link?: string | null;
};
export const pareaLabel = (v: unknown) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .trim()
        .slice(0, 80)
    : "";
export function pareaDetail(
  value: any,
  event: string,
  profile: string,
  now = Date.now(),
) {
  const group = currentPareaGroup(value, event, profile, now);
  if (
    !Number.isSafeInteger(value.allocation.version) ||
    value.allocation.version < 1 ||
    value.guests.some(
      (g: any) =>
        !Number.isSafeInteger(g.version) ||
        g.version < 1 ||
        typeof g.label !== "string" ||
        g.label.length > 80,
    )
  )
    throw Error("Current guest revisions could not be verified.");
  return { group, allocation: value.allocation, guests: value.guests };
}
export function pareaAmount(quantity: number, cents: number, currency: string) {
  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 100 ||
    !Number.isSafeInteger(cents) ||
    cents < 0 ||
    !Number.isSafeInteger(quantity * cents) ||
    !["CAD", "USD", "EUR", "GBP", "AUD", "NZD", "CHF"].includes(currency)
  )
    throw Error("Ticket amount could not be verified.");
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    currencyDisplay: "code",
  }).format((quantity * cents) / 100);
}
export function pareaPlan(
  rows: PareaRecipient[],
  detail: ReturnType<typeof pareaDetail>,
) {
  const ids = new Set();
  let total = 0;
  for (const r of rows) {
    if (
      !HOST_UUID.test(r.id) ||
      ids.has(r.id) ||
      !pareaLabel(r.label) ||
      !Number.isInteger(r.quantity) ||
      r.quantity < 1 ||
      r.quantity > 100
    )
      throw Error("Review each recipient and whole ticket quantity.");
    ids.add(r.id);
    if (["draft", "saving"].includes(r.status)) total += r.quantity;
  }
  if (!detail.group.active || total > detail.group.unassigned)
    throw Error("The current allocation cannot cover this whole-ticket plan.");
  return {
    total,
    remaining: detail.group.unassigned - total,
    rows: rows.filter((r) => r.status === "draft"),
  };
}
export function pareaGuestParams(
  detail: ReturnType<typeof pareaDetail>,
  recipient: { id: string; label: string; quantity: number },
  token: string,
  editing = false,
) {
  if (!/^[a-f0-9]{64}$/.test(token) || !HOST_UUID.test(recipient.id))
    throw Error("The private invitation could not be prepared.");
  const guest = editing
    ? detail.guests.find(
        (g: any) => g.id === recipient.id && g.status === "invited",
      )
    : null;
  if (
    !detail.group.active ||
    (editing && !guest) ||
    !Number.isInteger(recipient.quantity) ||
    recipient.quantity < 1 ||
    recipient.quantity > detail.group.unassigned + (guest?.quantity || 0) ||
    !pareaLabel(recipient.label)
  )
    throw Error("Review the current unclaimed guest and ticket quantity.");
  return {
    p_allocation: detail.group.id,
    p_guest: recipient.id,
    p_expected_version: guest?.version || 0,
    p_label: pareaLabel(recipient.label),
    p_quantity: recipient.quantity,
    p_token: token,
  };
}
export function pareaInvitation(token: string, event: string) {
  const url =
    "https://www.zoi.city/tickets/hosts/?event=" + event + "#claim=" + token;
  return privateEventInvitation(url, event).url;
}
export function pareaInvitationPreview(value: any, event: string) {
  return currentInvitationPreview(value, event);
}
export function samePareaPreview(a: any, b: any) {
  return !!a && !!b && JSON.stringify(a) === JSON.stringify(b);
}
export function pareaPaymentOptions(value: any, event: string) {
  const r = validatedGuestPaymentOptions(value);
  if (r.guests.some((g: any) => g.event_id !== event))
    throw Error("Payment options do not match the selected event.");
  return r;
}
export function pareaChoiceParams(guest: any, now = Date.now()) {
  if (
    !guest ||
    !HOST_UUID.test(guest.guest_id) ||
    !guest.policy?.allow_pay_at_door ||
    guest.policy.allow_pay_online !== false ||
    guest.policy.online_connected !== false ||
    guest.policy.response_open !== true ||
    !Number.isSafeInteger(guest.policy.version) ||
    guest.policy.version < 1 ||
    Date.parse(guest.expires_at) <= now ||
    guest.choice?.status === "unpaid"
  )
    throw Error(
      "The organiser’s current payment arrangement is not open for this invitation.",
    );
  return {
    p_guest: guest.guest_id,
    p_method: "pay_at_door",
    p_expected_policy_version: guest.policy.version,
    p_expected_version: guest.choice?.version || 0,
  };
}
