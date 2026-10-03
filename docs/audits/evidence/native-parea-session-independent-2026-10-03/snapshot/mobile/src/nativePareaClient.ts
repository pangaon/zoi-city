import {
  HOST_UUID,
  createHostClient,
} from "../../assets/tickets/host-allocation-client.mjs";
import { createPaymentPolicyClient } from "../../assets/tickets/event-payment-policy-client.mjs";
import { pareaLabel } from "./nativeParea.ts";
import { nativePareaRecovery } from "./nativePareaRecovery.ts";
const reads = [
  "zoi_me",
  "event_host_list",
  "event_host_get",
  "event_host_claim_preview",
  "event_host_receipt",
  "event_guest_payment_options",
];
const writes = [
  "event_host_guest_save",
  "event_host_claim",
  "event_host_request_cancel",
  "event_guest_payment_choose",
  "event_payment_request",
];
export async function nativePareaRpc(
  client: {
    session: { user: { id: string } } | null;
    token: () => Promise<string>;
    request: (path: string, args: unknown, token: string) => Promise<any>;
  },
  actor: string,
  current: () => boolean,
  name: string,
  args: Record<string, unknown>,
  before: () => Promise<void> = async () => {},
) {
  const check = () => {
    if (
      !HOST_UUID.test(actor) ||
      client.session?.user.id !== actor ||
      !current()
    )
      throw Error("The account or event view changed.");
  };
  if (!reads.includes(name) && !writes.includes(name))
    throw Error("Unsupported native group operation.");
  check();
  await before();
  check();
  const token = await client.token();
  check();
  if (!token) throw Error("Sign in again before continuing.");
  const value = await client.request("/rest/v1/rpc/" + name, args, token);
  check();
  return value;
}
export function clonePareaJson(value: unknown): any {
  function validate(v: any): void {
    if (v === null || typeof v === "string" || typeof v === "boolean") return;
    if (typeof v === "number" && Number.isFinite(v)) return;
    if (
      v &&
      typeof v === "object" &&
      Object.getPrototypeOf(v) === Object.prototype
    ) {
      for (const x of Object.values(v)) validate(x);
      return;
    }
    throw Error("Only validated JSON request data can be copied.");
  }
  validate(value);
  return JSON.parse(JSON.stringify(value));
}
export function nativePareaHostParameters(
  kind: string,
  name: string,
  p: Record<string, unknown>,
) {
  const fields =
    kind === "guest"
      ? [
          "p_allocation",
          "p_guest",
          "p_expected_version",
          "p_label",
          "p_quantity",
          "p_token",
        ]
      : kind === "claim"
        ? ["p_token"]
        : [];
  if (
    !fields.length ||
    Object.keys(p).length !== fields.length ||
    fields.some((k) => !Object.hasOwn(p, k)) ||
    !String(p.p_token).match(/^[a-f0-9]{64}$/)
  )
    throw Error("Review the private invitation request.");
  if (
    kind === "guest" &&
    (name !== "event_host_guest_save" ||
      !HOST_UUID.test(String(p.p_allocation)) ||
      !HOST_UUID.test(String(p.p_guest)) ||
      !Number.isSafeInteger(p.p_expected_version) ||
      Number(p.p_expected_version) < 0 ||
      !Number.isInteger(p.p_quantity) ||
      Number(p.p_quantity) < 1 ||
      Number(p.p_quantity) > 100 ||
      !pareaLabel(p.p_label) ||
      pareaLabel(p.p_label) !== p.p_label)
  )
    throw Error("Review each whole ticket recipient.");
  if (kind === "claim" && name !== "event_host_claim")
    throw Error("Unsupported invitation claim.");
  return clonePareaJson(p);
}
export async function nativePareaClient({
  client,
  actor,
  event,
  current,
  storage,
  randomUUID,
}: {
  client: any;
  actor: string;
  event: string;
  current: () => boolean;
  storage: Parameters<typeof nativePareaRecovery>[0];
  randomUUID: () => string;
}) {
  const recovery = await nativePareaRecovery(storage, actor, event, current),
    getActor = () => (current() ? client.session?.user.id : null);
  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await nativePareaRpc(
      client,
      actor,
      current,
      name,
      args,
      recovery.flush,
    );
    const receipt =
      name === "event_host_receipt" || name === "event_payment_request"
        ? result?.receipt
        : result;
    if (receipt?.event_id && receipt.event_id !== event)
      throw Error("The receipt does not match this event.");
    if (
      name === "event_host_guest_save" &&
      result?.ok === true &&
      result.guest?.label !== args.p_label
    )
      throw Error("The recipient receipt did not match.");
    return result;
  };
  const host = createHostClient({
      call,
      getActor,
      storage: recovery.storage,
      randomUUID,
      clone: clonePareaJson,
    } as any),
    payment = createPaymentPolicyClient({
      call,
      getActor,
      storage: recovery.storage,
      randomUUID,
    } as any);
  const writable = () => {
    if (host.state().pending || payment.state().pending || recovery.pending())
      throw Error("Resolve your previous request before another change.");
  };
  const finish = async (fn: () => Promise<any>) => {
    try {
      return await fn();
    } finally {
      if (current()) await recovery.flush();
    }
  };
  return {
    host,
    payment,
    read: call,
    hostWrite: (kind: string, name: string, args: Record<string, unknown>) => {
      writable();
      if (
        (kind === "guest" && name !== "event_host_guest_save") ||
        (kind === "claim" && name !== "event_host_claim") ||
        !["guest", "claim"].includes(kind)
      )
        throw Error("Unsupported group change.");
      const params = nativePareaHostParameters(kind, name, args);
      return finish(() => host.write(kind, name, params));
    },
    hostRetry: () => finish(() => host.retry()),
    hostRecover: () => finish(() => host.recover()),
    hostCancel: () => finish(() => host.cancel()),
    paymentWrite: (args: Record<string, unknown>) => {
      writable();
      return finish(() => payment.write("choice", args));
    },
    paymentRetry: () => finish(() => payment.retry()),
    paymentRecover: (cancel = false) =>
      finish(() => (cancel ? payment.cancel() : payment.recover())),
    flush: recovery.flush,
    persistencePending: recovery.pending,
    destroy() {
      host.destroy();
      payment.destroy();
      recovery.destroy();
    },
  };
}
