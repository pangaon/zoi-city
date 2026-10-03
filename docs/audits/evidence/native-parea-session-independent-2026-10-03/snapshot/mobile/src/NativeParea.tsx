import { useEffect, useRef, useState } from "react";
import {
  AppState,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./Auth";
import { ownPareaGroups, privateEventInvitation } from "./eventHostLink";
import { nativePareaClient } from "./nativePareaClient";
import {
  pareaAmount,
  pareaChoiceParams,
  pareaDetail,
  pareaGuestParams,
  pareaInvitation,
  pareaInvitationPreview,
  pareaLabel,
  pareaPaymentOptions,
  pareaPlan,
  samePareaPreview,
  type PareaRecipient,
} from "./nativeParea";
type Engine = Awaited<ReturnType<typeof nativePareaClient>>;
type Detail = ReturnType<typeof pareaDetail>;
const capability = () =>
  Array.from(Crypto.getRandomBytes(32), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
/** Private capabilities and recipient labels live only in this mounted account/event view. */
export function NativeParea({ eventId }: { eventId: string }) {
  const { client, session, workspaceId } = useAuth(),
    actor = session?.user.id || "";
  const scope = useRef({ actor, eventId, workspaceId });
  scope.current = { actor, eventId, workspaceId };
  const captured = useRef({ actor, eventId, workspaceId }).current,
    alive = useRef(true),
    working = useRef(false),
    engine = useRef<Engine | null>(null),
    profile = useRef(""),
    selected = useRef(""),
    rowsRef = useRef<PareaRecipient[]>([]),
    review = useRef<{
      rows: PareaRecipient[];
      version: number;
      allocation: string;
    } | null>(null);
  const [groups, setGroups] = useState<
      Awaited<ReturnType<typeof ownPareaGroups>>
    >([]),
    [detail, setDetail] = useState<Detail | null>(null),
    [rows, setRows] = useState<PareaRecipient[]>([]),
    [preview, setPreview] = useState<ReturnType<
      typeof pareaInvitationPreview
    > | null>(null),
    [link, setLink] = useState(""),
    [visibleLink, setVisibleLink] = useState<{
      id: string;
      url: string;
    } | null>(null),
    [options, setOptions] = useState<any[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [reviewing, setReviewing] = useState(false),
    [revision, setRevision] = useState(0),
    [now, setNow] = useState(Date.now());
  const current = () =>
    alive.current &&
    scope.current.actor === captured.actor &&
    scope.current.eventId === captured.eventId &&
    scope.current.workspaceId === captured.workspaceId &&
    client.session?.user.id === captured.actor;
  const check = () => {
    if (!current()) throw Error("The account or event view changed.");
  };
  const e = () => {
    check();
    if (!engine.current) throw Error("Current account recovery is not ready.");
    return engine.current;
  };
  const replaceRows = (next: PareaRecipient[]) => {
    rowsRef.current = next;
    setRows(next);
  };
  const resetReview = () => {
    review.current = null;
    setReviewing(false);
  };
  const pending = () =>
    !!engine.current &&
    (!!engine.current.host.state().pending ||
      !!engine.current.payment.state().pending ||
      engine.current.persistencePending());
  const freshDetail = async (id = selected.current) => {
    const r = pareaDetail(
      await e().read("event_host_get", { p_allocation: id }),
      eventId,
      profile.current,
    );
    check();
    if (r.group.id !== id) throw Error("The selected allocation changed.");
    return r;
  };
  const loadOptions = async () => {
    setOptions([]);
    const r = pareaPaymentOptions(
      await e().read("event_guest_payment_options", { p_event: eventId }),
      eventId,
    );
    check();
    setOptions(r.guests);
    return r.guests;
  };
  const refreshDetail = async () => {
    if (!selected.current) return;
    const next = await freshDetail();
    check();
    setDetail(next);
    setGroups((current) =>
      current.map((group) => (group.id === next.group.id ? next.group : group)),
    );
    replaceRows(
      rowsRef.current.map((row) => {
        const guest = next.guests.find((g: any) => g.id === row.id);
        if (!guest) return row;
        if (row.status === "saving")
          return {
            ...row,
            label: guest.label,
            status: guest.status === "accepted" ? "accepted" : "saved",
            version: guest.version,
            link: null,
          };
        if (
          row.status === "saved" &&
          (guest.status !== "invited" || guest.version !== row.version)
        )
          return {
            ...row,
            status: guest.status === "accepted" ? "accepted" : "saved",
            version: guest.version,
            link: null,
          };
        return row;
      }),
    );
    return next;
  };
  const loadGroups = async () => {
    setGroups([]);
    setDetail(null);
    const me = await e().read("zoi_me", {});
    check();
    profile.current = me?.profile?.id || "";
    const next = await ownPareaGroups(eventId, e().read);
    check();
    setGroups(next);
    if (selected.current && next.some((g) => g.id === selected.current))
      await refreshDetail();
    else {
      selected.current = "";
      replaceRows([]);
      resetReview();
    }
  };
  const act = async (fn: () => Promise<void>) => {
    if (working.current || !current()) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch {
      if (current()) {
        resetReview();
        setVisibleLink(null);
        setDetail(null);
        setOptions([]);
        setPreview(null);
        setError(
          "This action could not be confirmed. Refresh current details, or check the saved request below before trying another change.",
        );
      }
    } finally {
      working.current = false;
      if (current()) {
        setBusy(false);
        setRevision((n) => n + 1);
      }
    }
  };
  const initialize = async () => {
    if (engine.current) return;
    const opened = await nativePareaClient({
      client,
      actor,
      event: eventId,
      current,
      storage: AsyncStorage,
      randomUUID: Crypto.randomUUID,
    });
    if (!current()) {
      opened.destroy();
      check();
    }
    engine.current = opened;
    setReady(true);
  };
  const refresh = () =>
    act(async () => {
      setVisibleLink(null);
      setPreview(null);
      resetReview();
      await initialize();
      await e().flush();
      await loadGroups();
      try {
        await loadOptions();
      } catch {
        check();
        setOptions([]);
        setMessage(
          "Current payment options are unavailable. No payment choice is enabled until the organiser’s rules can be verified.",
        );
      }
    });
  useEffect(() => {
    alive.current = true;
    void act(async () => {
      await initialize();
      await loadGroups();
      try {
        await loadOptions();
      } catch {
        check();
        setMessage(
          "Payment options could not be verified. Refresh before choosing an arrangement.",
        );
      }
    });
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && current() && !working.current) {
        setLink("");
        setVisibleLink(null);
        setPreview(null);
        replaceRows([]);
        setDetail(null);
        setOptions([]);
        resetReview();
        refresh();
      }
    });
    const clock = setInterval(() => {
      if (current()) setNow(Date.now());
    }, 30000);
    return () => {
      alive.current = false;
      clearInterval(clock);
      subscription.remove();
      engine.current?.destroy();
      engine.current = null;
      rowsRef.current = [];
      review.current = null;
    };
  }, []);
  const button = (label: string, run: () => void, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: busy || disabled }}
      disabled={busy || disabled}
      onPress={run}
      style={[s.button, (busy || disabled) && s.disabled]}
    >
      <Text style={s.action}>{label}</Text>
    </Pressable>
  );
  const select = (id: string) =>
    act(async () => {
      selected.current = id;
      replaceRows([]);
      resetReview();
      setDetail(null);
      await refreshDetail();
    });
  const add = () => {
    resetReview();
    replaceRows([
      ...rowsRef.current,
      { id: Crypto.randomUUID(), label: "", quantity: 1, status: "draft" },
    ]);
  };
  const edit = (id: string, change: Partial<PareaRecipient>) => {
    resetReview();
    replaceRows(
      rowsRef.current.map((r) => (r.id === id ? { ...r, ...change } : r)),
    );
  };
  const reviewPlan = () =>
    act(async () => {
      if (pending()) throw Error("Check the earlier request first.");
      const fresh = await freshDetail();
      const plan = pareaPlan(rowsRef.current, fresh);
      if (!plan.rows.length) throw Error("Add a recipient first.");
      review.current = {
        rows: plan.rows.map((r) => ({ ...r })),
        version: fresh.allocation.version,
        allocation: fresh.group.id,
      };
      check();
      setDetail(fresh);
      setReviewing(true);
      setMessage(
        "Review each person’s whole ticket quantity. Invitations are saved one at a time; sharing is a separate action.",
      );
    });
  const savePlan = () =>
    act(async () => {
      if (pending() || !review.current)
        throw Error("Review the current group first.");
      const approved = review.current;
      let fresh = await freshDetail();
      if (
        fresh.group.id !== approved.allocation ||
        fresh.allocation.version !== approved.version
      )
        throw Error("Allocation changed. Review again.");
      pareaPlan(approved.rows, fresh);
      resetReview();
      for (const row of approved.rows) {
        fresh = await freshDetail();
        const token = capability(),
          params = pareaGuestParams(fresh, row, token);
        replaceRows(
          rowsRef.current.map((r) =>
            r.id === row.id ? { ...r, status: "saving" } : r,
          ),
        );
        const receipt = await e().hostWrite(
          "guest",
          "event_host_guest_save",
          params,
        );
        check();
        replaceRows(
          rowsRef.current.map((r) =>
            r.id === row.id
              ? {
                  ...r,
                  label: pareaLabel(r.label),
                  status: "saved",
                  version: receipt.guest.version,
                  link: pareaInvitation(token, eventId),
                }
              : r,
          ),
        );
        setMessage(
          "Personal invitation saved. Use Share invitation to send it through your chosen app.",
        );
        await refreshDetail();
      }
    });
  const rotate = (guest: any) =>
    act(async () => {
      if (pending()) throw Error("Check the earlier request first.");
      const fresh = await freshDetail(),
        token = capability(),
        params = pareaGuestParams(fresh, guest, token, true);
      const receipt = await e().hostWrite(
        "guest",
        "event_host_guest_save",
        params,
      );
      check();
      replaceRows([
        ...rowsRef.current.filter((r) => r.id !== guest.id),
        {
          id: guest.id,
          label: guest.label,
          quantity: guest.quantity,
          status: "saved",
          version: receipt.guest.version,
          link: pareaInvitation(token, eventId),
        },
      ]);
      setMessage(
        "A new personal link was saved. The previous unclaimed link no longer works. Share the new link with this person.",
      );
      await refreshDetail();
    });
  const currentLink = async (guest: any) => {
    const row = rowsRef.current.find((r) => r.id === guest.id && r.link);
    if (!row?.link) throw Error("Prepare a new unclaimed link first.");
    const fresh = await freshDetail(),
      actual = fresh.guests.find((g: any) => g.id === guest.id);
    if (
      !fresh.group.active ||
      actual?.status !== "invited" ||
      actual.quantity !== row.quantity ||
      actual.label !== row.label ||
      actual.version !== row.version
    )
      throw Error("Invitation changed.");
    check();
    return { row, fresh };
  };
  const revealLink = (guest: any) =>
    act(async () => {
      const { row } = await currentLink(guest);
      check();
      setVisibleLink({ id: guest.id, url: row.link! });
    });
  const share = (guest: any) =>
    act(async () => {
      const { row, fresh } = await currentLink(guest);
      try {
        await Share.share({
          message: `We’re going! ${row.quantity} ${row.quantity === 1 ? "ticket is" : "tickets are"} assigned to you at ${fresh.group.label}. Open your personal invitation to join our parea and review the organiser’s payment arrangements. Keep this link private.\n${row.link}`,
        });
        check();
        setMessage(
          "Sharing opened. Delivery is handled by the app you choose; no message delivery is recorded here.",
        );
      } catch {
        check();
        setMessage(
          "Sharing did not open. Use Show private link to select and copy the invitation, then send it through your chosen app.",
        );
      }
    });
  const inspect = () =>
    act(async () => {
      setPreview(null);
      const parsed = privateEventInvitation(link, eventId),
        fresh = pareaInvitationPreview(
          await e().read("event_host_claim_preview", { p_token: parsed.token }),
          eventId,
        );
      check();
      setPreview(fresh);
    });
  const claim = () =>
    act(async () => {
      if (pending()) throw Error("Check the earlier request first.");
      const parsed = privateEventInvitation(link, eventId),
        fresh = pareaInvitationPreview(
          await e().read("event_host_claim_preview", { p_token: parsed.token }),
          eventId,
        );
      if (!samePareaPreview(preview, fresh))
        throw Error("Invitation changed. Check it again.");
      if (fresh.status === "invited") {
        const result = await e().hostWrite("claim", "event_host_claim", {
          p_token: parsed.token,
        });
        if (result.event_id !== eventId || result.quantity !== fresh.quantity)
          throw Error("Claim did not match this invitation.");
      }
      check();
      setLink("");
      setPreview(null);
      setMessage(
        "You have joined your parea. No payment was collected and no admission ticket was issued.",
      );
      await loadOptions();
    });
  const choose = (guest: any) =>
    act(async () => {
      if (pending()) throw Error("Check the earlier request first.");
      const before = pareaChoiceParams(guest),
        fresh = (await loadOptions()).find(
          (g: any) => g.guest_id === guest.guest_id,
        );
      const next = pareaChoiceParams(fresh);
      if (JSON.stringify(next) !== JSON.stringify(before))
        throw Error("The organiser changed the payment options. Review again.");
      const receipt = await e().paymentWrite(next);
      if (receipt.event_id !== eventId)
        throw Error("Preference does not match this event.");
      setMessage(
        "Pay at the door selected · unpaid. Payment collection and admission are separate.",
      );
      await loadOptions();
    });
  const recover = (
    domain: "host" | "payment",
    mode: "recover" | "retry" | "cancel",
  ) =>
    act(async () => {
      const api = e();
      let receipt;
      if (domain === "host")
        receipt = await (mode === "retry"
          ? api.hostRetry()
          : mode === "cancel"
            ? api.hostCancel()
            : api.hostRecover());
      else
        receipt = await (mode === "retry"
          ? api.paymentRetry()
          : api.paymentRecover(mode === "cancel"));
      check();
      setMessage(
        receipt
          ? "Saved result resolved. Refresh current details before another action."
          : "No completed result found. Check again, retry the same request if available, or cancel the unsaved request.",
      );
      if (receipt) {
        replaceRows(rowsRef.current.filter((r) => r.status !== "saving"));
        await loadGroups();
        try {
          await loadOptions();
        } catch {
          check();
        }
      }
    });
  const blocked = !ready || pending(),
    hostState = engine.current?.host.state(),
    paymentState = engine.current?.payment.state();
  void revision;
  return (
    <View style={s.card}>
      <View style={s.intro}>
        <Text style={s.eyebrow}>YOUR PEOPLE · THEIR TICKETS</Text>
        <Text style={s.title}>Get your parea ready</Text>
        <Text style={s.text}>
          One friend takes three, another one, another five. Every whole ticket
          keeps its per-guest price. Each saved recipient gets a unique private
          invitation.
        </Text>
      </View>
      {message ? (
        <Text accessibilityLiveRegion="polite" style={s.notice}>
          {message}
        </Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      ) : null}
      {button(
        busy
          ? "Checking current details…"
          : ready
            ? "Refresh my parea"
            : "Retry account recovery",
        refresh,
      )}
      {engine.current?.persistencePending() ? (
        <View style={s.recovery}>
          <Text style={s.heading}>Finish saving the recovery reference</Text>
          <Text style={s.text}>
            Another change is blocked until the device confirms the reference.
            Your private invitation is never stored.
          </Text>
          {button("Retry recovery storage", () =>
            act(async () => {
              await e().flush();
              setMessage(
                "Recovery storage confirmed. Check any pending request below.",
              );
            }),
          )}
        </View>
      ) : null}
      {hostState?.pending ? (
        <View style={s.recovery}>
          <Text style={s.heading}>Check your previous invitation request</Text>
          <Text style={s.text}>
            Its result is uncertain. Checking and retrying use the same request
            reference.
          </Text>
          {button("Check saved invitation result", () =>
            recover("host", "recover"),
          )}
          {hostState.canRetry
            ? button("Retry the same invitation request", () =>
                recover("host", "retry"),
              )
            : null}
          {hostState.canCancel
            ? button("Cancel if no invitation was saved", () =>
                recover("host", "cancel"),
              )
            : null}
        </View>
      ) : null}
      {paymentState?.pending ? (
        <View style={s.recovery}>
          <Text style={s.heading}>Check your previous unpaid preference</Text>
          {button("Check saved preference result", () =>
            recover("payment", "recover"),
          )}
          {button("Retry the same preference", () =>
            recover("payment", "retry"),
          )}
          {button("Cancel if preference was not saved", () =>
            recover("payment", "cancel"),
          )}
        </View>
      ) : null}
      <Text style={s.heading}>Your table allocations</Text>
      {ready && groups.length === 0 ? (
        <Text style={s.text}>
          No active table is assigned to you as a host. To organise tickets, ask
          the organiser to assign your table. You can still check a personal
          invitation below.
        </Text>
      ) : null}
      {groups.map((g) => (
        <View key={g.id} style={s.group}>
          <Text style={s.heading}>{g.label}</Text>
          <Text style={s.text}>
            {g.quota} allocated · {g.accepted} accepted · {g.waiting} awaiting
            acceptance · {g.unassigned} unassigned
          </Text>
          <Text style={s.small}>
            {pareaAmount(1, g.unitPrice, g.currency)} per guest · expires{" "}
            {new Date(g.expires).toLocaleString()}
          </Text>
          {button(
            selected.current === g.id
              ? "Refresh selected table"
              : "Organise this table",
            () => select(g.id),
            blocked || !g.active || Date.parse(g.expires) <= now,
          )}
        </View>
      ))}
      {detail ? (
        <View style={s.group}>
          <Text style={s.heading}>{detail.group.label} · your parea</Text>
          <Text style={s.text}>
            {detail.group.unassigned} whole tickets remain to assign. Allocation{" "}
            {detail.group.active && Date.parse(detail.group.expires) > now
              ? "active"
              : "closed"}
            .
          </Text>
          {detail.guests
            .filter((g: any) => g.status !== "revoked")
            .map((guest: any) => (
              <View key={guest.id} style={s.recipient}>
                <Text style={s.heading}>{guest.label}</Text>
                <Text style={s.text}>
                  {guest.quantity} tickets ·{" "}
                  {pareaAmount(
                    guest.quantity,
                    detail.group.unitPrice,
                    detail.group.currency,
                  )}
                </Text>
                <Text style={s.small}>
                  {guest.status === "accepted"
                    ? "Joined · payment and admission are separate"
                    : "Awaiting acceptance"}
                </Text>
                {guest.status === "invited" &&
                  (rows.find((r) => r.id === guest.id)?.link ? (
                    <>
                      {button(
                        "Share invitation for " + guest.label,
                        () => share(guest),
                        blocked,
                      )}
                      {button(
                        visibleLink?.id === guest.id
                          ? "Hide private link"
                          : "Show private link for " + guest.label,
                        () => {
                          if (visibleLink?.id === guest.id)
                            setVisibleLink(null);
                          else revealLink(guest);
                        },
                        blocked,
                      )}
                      {visibleLink?.id === guest.id ? (
                        <>
                          <Text style={s.small}>
                            Select and copy this personal link. Anyone with it
                            can claim the invitation; share it privately.
                          </Text>
                          <Text selectable style={s.privateLink}>
                            {visibleLink?.url}
                          </Text>
                        </>
                      ) : null}
                    </>
                  ) : (
                    button(
                      "Prepare new private link for " + guest.label,
                      () => rotate(guest),
                      blocked,
                    )
                  ))}
              </View>
            ))}
          {rows
            .filter((r) => ["draft", "saving"].includes(r.status))
            .map((row) => (
              <View key={row.id} style={s.recipient}>
                <Text style={s.small}>Recipient · whole tickets</Text>
                <TextInput
                  accessibilityLabel={"Recipient name " + row.id}
                  style={s.input}
                  value={row.label}
                  maxLength={80}
                  onChangeText={(label) => edit(row.id, { label })}
                  placeholder="First name or nickname"
                  editable={!busy && !blocked && !reviewing}
                />
                <TextInput
                  accessibilityLabel={"Ticket quantity " + row.id}
                  style={s.input}
                  keyboardType="number-pad"
                  value={Number.isNaN(row.quantity) ? "" : String(row.quantity)}
                  onChangeText={(v) =>
                    edit(row.id, {
                      quantity: /^\d{1,3}$/.test(v) ? Number(v) : NaN,
                    })
                  }
                  editable={!busy && !blocked && !reviewing}
                />
                {Number.isInteger(row.quantity) &&
                row.quantity > 0 &&
                row.quantity <= 100 ? (
                  <Text style={s.heading}>
                    {pareaAmount(
                      row.quantity,
                      detail.group.unitPrice,
                      detail.group.currency,
                    )}
                  </Text>
                ) : (
                  <Text style={s.error}>Enter a whole ticket quantity.</Text>
                )}
                {row.status === "draft" ? (
                  button(
                    "Remove draft recipient",
                    () => {
                      resetReview();
                      replaceRows(
                        rowsRef.current.filter((r) => r.id !== row.id),
                      );
                    },
                    blocked,
                  )
                ) : (
                  <Text style={s.small}>Save result needs confirmation.</Text>
                )}
              </View>
            ))}
          {button(
            "+ Add someone",
            add,
            blocked ||
              reviewing ||
              !detail.group.active ||
              detail.group.unassigned < 1 ||
              rows.length >= 100,
          )}
          {reviewing ? (
            <View style={s.review}>
              <Text style={s.heading}>Review your invitations</Text>
              {review.current?.rows.map((r) => (
                <Text key={r.id} style={s.text}>
                  {pareaLabel(r.label)} · {r.quantity} tickets ·{" "}
                  {pareaAmount(
                    r.quantity,
                    detail.group.unitPrice,
                    detail.group.currency,
                  )}
                </Text>
              ))}
              {button(
                "Confirm and save personal invitations",
                savePlan,
                blocked,
              )}
              {button("Change this plan", resetReview, blocked)}
            </View>
          ) : (
            button(
              "Review whole ticket plan",
              reviewPlan,
              blocked || !rows.some((r) => r.status === "draft"),
            )
          )}
        </View>
      ) : null}
      <View style={s.group}>
        <Text style={s.heading}>Received a personal invitation?</Text>
        <TextInput
          accessibilityLabel="Private Zoi invitation link"
          style={s.input}
          value={link}
          onChangeText={(v) => {
            setLink(v);
            setPreview(null);
          }}
          editable={!busy && !blocked}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="none"
          secureTextEntry
          placeholder="Paste your private invitation"
        />
        {button("Check this invitation", inspect, blocked || !link.trim())}
        {preview ? (
          <View style={s.review}>
            <Text style={s.heading}>
              {preview.event} · {preview.table}
            </Text>
            <Text style={s.text}>
              {preview.quantity} tickets ·{" "}
              {pareaAmount(
                preview.quantity,
                preview.unitPrice,
                preview.currency,
              )}
            </Text>
            <Text style={s.small}>
              Expires {new Date(preview.expires).toLocaleString()}. A private
              link can be claimed by its authenticated holder; keep it private.
            </Text>
            {button(
              preview.status === "accepted"
                ? "Refresh my payment options"
                : "Join my parea",
              claim,
              blocked || Date.parse(preview.expires) <= now,
            )}
          </View>
        ) : null}
      </View>
      <Text style={s.heading}>Your payment arrangements</Text>
      {options.map((g) => (
        <View key={g.guest_id} style={s.group}>
          <Text style={s.heading}>
            {g.table_label || "Your table"} · {g.quantity} tickets
          </Text>
          <Text style={s.text}>
            {pareaAmount(g.quantity, g.price_per_guest_cents, g.currency)}
          </Text>
          {g.choice ? (
            <Text style={s.notice}>
              {g.choice.status === "unpaid"
                ? "Pay at the door selected · unpaid"
                : "The organiser changed the policy. Review your arrangement again."}
            </Text>
          ) : null}
          <Text style={s.small}>
            {g.policy.response_deadline
              ? "Respond by " +
                new Date(g.policy.response_deadline).toLocaleString()
              : "No response deadline set."}{" "}
            {g.policy.response_open
              ? "Responses are open."
              : "Responses are closed."}
          </Text>
          {g.policy.allow_pay_at_door ? (
            button(
              "Choose pay at the door",
              () => choose(g),
              blocked ||
                !g.policy.response_open ||
                g.choice?.status === "unpaid" ||
                Date.parse(g.expires_at) <= now,
            )
          ) : (
            <Text style={s.text}>
              The organiser has not enabled a payment option for this
              invitation.
            </Text>
          )}
        </View>
      ))}
      {ready && !options.length ? (
        <Text style={s.text}>
          No verified payment arrangements are loaded for this account and
          event. Join your parea or refresh current options.
        </Text>
      ) : null}
      <Text style={s.small}>
        No payment is collected and no admission ticket is issued here. Online
        payment is not connected. Keep invitations private. Reopen this event to
        recover a saved result. If a link is lost, create a replacement for a
        guest who has not joined. Guests who have joined cannot be edited here.
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#C6DCEA",
    backgroundColor: "#F1F8FD",
    gap: 16,
  },
  intro: { gap: 10 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: "#2779A6",
  },
  title: { fontSize: 27, fontWeight: "700", color: "#102D45" },
  heading: { fontSize: 17, fontWeight: "700", color: "#173A54" },
  text: { fontSize: 14, lineHeight: 22, color: "#425D70" },
  small: { fontSize: 12, lineHeight: 19, color: "#567080" },
  group: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    gap: 12,
    borderWidth: 1,
    borderColor: "#DCE9F1",
  },
  recipient: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#F6FAFD",
    gap: 10,
  },
  review: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#E7F5FD",
    gap: 12,
  },
  recovery: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#FFF6E2",
    gap: 12,
  },
  button: {
    minHeight: 46,
    padding: 13,
    borderRadius: 13,
    backgroundColor: "#DDEFFC",
    justifyContent: "center",
  },
  action: { fontSize: 14, fontWeight: "700", color: "#1266A7" },
  disabled: { opacity: 0.48 },
  input: {
    minHeight: 48,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#AAC5D8",
    backgroundColor: "#fff",
    color: "#173A54",
  },
  privateLink: { fontSize: 12, lineHeight: 19, color: "#1266A7" },
  notice: { fontSize: 14, lineHeight: 22, color: "#145868" },
  error: { fontSize: 14, lineHeight: 22, color: "#A03E30" },
});
