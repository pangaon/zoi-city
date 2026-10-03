import { HOST_UUID } from "../../assets/tickets/host-allocation-client.mjs";
type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};
const sameKeys = (o: any, keys: string[]) =>
  o &&
  typeof o === "object" &&
  !Array.isArray(o) &&
  Object.keys(o).length === keys.length &&
  keys.every((k) => Object.hasOwn(o, k));
function safeMarker(key: string, value: string) {
  if (value.length > 2000) throw Error("Recovery reference is too large.");
  const p = JSON.parse(value);
  if (key.startsWith("zoi:host-request:")) {
    if (
      !sameKeys(p, ["kind", "request"]) ||
      !["guest", "claim"].includes(p.kind) ||
      !HOST_UUID.test(p.request)
    )
      throw Error("Invalid private group recovery reference.");
  } else if (key.startsWith("zoi:event-payment-request:")) {
    const a = p?.params;
    if (
      !sameKeys(p, ["kind", "params"]) ||
      p.kind !== "choice" ||
      !sameKeys(a, [
        "p_guest",
        "p_method",
        "p_expected_policy_version",
        "p_expected_version",
        "p_request",
      ]) ||
      !HOST_UUID.test(a.p_guest) ||
      !HOST_UUID.test(a.p_request) ||
      a.p_method !== "pay_at_door" ||
      !Number.isSafeInteger(a.p_expected_policy_version) ||
      a.p_expected_policy_version < 1 ||
      !Number.isSafeInteger(a.p_expected_version) ||
      a.p_expected_version < 0
    )
      throw Error("Invalid unpaid preference recovery reference.");
  } else throw Error("Unknown recovery reference.");
  return value;
}
/** Existing sync clients may queue only nonsecret references. Every dispatch awaits flush. */
export async function nativePareaRecovery(
  storage: Storage,
  actor: string,
  event: string,
  current: () => boolean,
) {
  if (!HOST_UUID.test(actor) || !HOST_UUID.test(event))
    throw Error("Choose the current account and event.");
  const prefix = "zoi.native-parea." + actor + "." + event + ".",
    keys = ["zoi:host-request:" + actor, "zoi:event-payment-request:" + actor],
    cache = new Map<string, string>(),
    queue: { key: string; value: string | null }[] = [];
  let running: Promise<void> | null = null;
  const check = () => {
    if (!current()) throw Error("The account or event view changed.");
  };
  for (const key of keys) {
    check();
    const v = await storage.getItem(
      prefix + (key.startsWith("zoi:host") ? "host" : "choice"),
    );
    check();
    if (v !== null) cache.set(key, safeMarker(key, v));
  }
  const physical = (key: string) => {
    if (!keys.includes(key)) throw Error("Unknown recovery key.");
    return prefix + (key.startsWith("zoi:host") ? "host" : "choice");
  };
  const flush = async () => {
    check();
    if (running) {
      await running;
      check();
      return;
    }
    running = (async () => {
      while (queue.length) {
        check();
        const op = queue[0],
          key = physical(op.key);
        if (op.value === null) await storage.removeItem(key);
        else await storage.setItem(key, op.value);
        check();
        if ((await storage.getItem(key)) !== op.value)
          throw Error("Recovery storage did not confirm this reference.");
        check();
        queue.shift();
      }
    })();
    try {
      await running;
    } finally {
      running = null;
    }
    check();
  };
  return {
    flush,
    pending: () => queue.length > 0,
    storage: {
      getItem: (key: string) => {
        check();
        physical(key);
        return cache.get(key) || null;
      },
      setItem: (key: string, v: string) => {
        check();
        physical(key);
        safeMarker(key, v);
        cache.set(key, v);
        queue.push({ key, value: v });
      },
      removeItem: (key: string) => {
        check();
        physical(key);
        cache.delete(key);
        queue.push({ key, value: null });
      },
    },
    destroy() {
      cache.clear();
    },
  };
}
