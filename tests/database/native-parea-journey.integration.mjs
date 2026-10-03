import { installEventAuthorityCandidate } from "./event-table-current-session.integration.mjs";
import { nativePareaClient } from "../../mobile/src/nativePareaClient.ts";
import {
  pareaDetail,
  pareaGuestParams,
  pareaPaymentOptions,
  pareaChoiceParams,
} from "../../mobile/src/nativeParea.ts";

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawn } from "node:child_process";
import assert from "node:assert/strict";
const dir = mkdtempSync(join(tmpdir(), "table-holds-")),
  bin = "/usr/lib/postgresql/16/bin",
  env = {
    ...process.env,
    PGHOST: dir,
    PGPORT: process.env.PGPORT || "15566",
    PGDATABASE: "postgres",
  };
let started = false;
const q = (s) =>
    execFileSync(
      join(bin, "psql"),
      ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-c", s],
      { env, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    ).trim(),
  uid = "10000000-0000-4000-8000-000000000001",
  uid2 = "10000000-0000-4000-8000-000000000002",
  actor = "20000000-0000-4000-8000-000000000001",
  actor2 = "20000000-0000-4000-8000-000000000002",
  ws = "30000000-0000-4000-8000-000000000001",
  event = "40000000-0000-4000-8000-000000000001",
  venue = "50000000-0000-4000-8000-000000000001",
  table = "60000000-0000-4000-8000-000000000001",
  request = "70000000-0000-4000-8000-000000000001";
const as = (s, u = uid) => q(`set request.jwt.claim.sub='${u}';${s}`),
  json = (s, u = uid) => JSON.parse(as(s, u)),
  hold = (req = request, version = 1, party = 5) =>
    `select public.table_hold_create('${event}','${table}',${party},${version},'${req}')`;
const data = {
    starts_at: new Date(Date.now() + 86400000).toISOString(),
    enabled: true,
    tables: [
      {
        table_id: table,
        source_label: "Table1",
        capacity: 10,
        min_party_size: 2,
        price_per_guest_cents: 27500,
        currency: "CAD",
        fees_included: true,
      },
    ],
  },
  configure = (version = 0, req = request, d = data) =>
    `select public.table_inventory_configure('${ws}','${event}',${version},'${req}','${JSON.stringify(d)}')`;
const run = (s, u = uid) =>
  new Promise((resolve) => {
    let out = "",
      err = "";
    const p = spawn(
      join(bin, "psql"),
      [
        "-X",
        "-qAt",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `set request.jwt.claim.sub='${u}';${s}`,
      ],
      { env },
    );
    p.stdout.on("data", (x) => (out += x));
    p.stderr.on("data", (x) => (err += x));
    p.on("close", (code) => resolve({ code, out: out.trim(), err }));
  });
try {
  execFileSync(
    join(bin, "initdb"),
    ["-D", join(dir, "data"), "-A", "trust", "--no-locale"],
    { stdio: "ignore" },
  );
  execFileSync(
    join(bin, "pg_ctl"),
    [
      "-D",
      join(dir, "data"),
      "-l",
      join(dir, "log"),
      "-o",
      `-k ${dir} -p ${env.PGPORT} -c listen_addresses=''`,
      "-w",
      "start",
    ],
    { stdio: "ignore" },
  );
  started = true;
  q(
    `create extension pgcrypto;create schema zoi;create schema auth;create role anon;create role authenticated;create function auth.uid()returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table auth.users(id uuid primary key);create table zoi.user_profiles(id uuid primary key,auth_user_id uuid);create function zoi.ensure_profile()returns uuid language sql as $$select id from zoi.user_profiles where auth_user_id=auth.uid()$$;create table zoi.workspaces(id uuid primary key);create table zoi.workspace_members(workspace_id uuid,profile_id uuid,role text);create table zoi.listings(id uuid primary key,name text,primary_category_id bigint,owner_workspace_id uuid,entity_type text,publish_status text,moderation_status text,marketplace_status text);create table zoi.categories(id bigint primary key,slug text);insert into zoi.categories values(6,'events-entertainment');create function zoi.qa_category_gate()returns trigger language plpgsql as $$begin if new.publish_status='published' and new.primary_category_id is null then new.publish_status:='pending_review';end if;return new;end$$;create trigger qa_category_gate before insert or update on zoi.listings for each row execute function zoi.qa_category_gate();create table zoi.ticket_types(id bigint generated always as identity,event_id uuid);create table zoi.seating_sessions(id uuid default gen_random_uuid(),event_id uuid);insert into auth.users values('${uid}'),('${uid2}');insert into zoi.user_profiles values('${actor}','${uid}'),('${actor2}','${uid2}');insert into zoi.workspaces values('${ws}');insert into zoi.workspace_members values('${ws}','${actor}','owner');insert into zoi.listings(id,owner_workspace_id,entity_type,primary_category_id,publish_status,moderation_status,marketplace_status)values('${event}','${ws}','event',6,'published','clean','visible');`,
  );
  const ddl = readFileSync(
    new URL(
      "../../supabase/migrations/0027_table_orders_and_venues.sql",
      import.meta.url,
    ),
    "utf8",
  );
  q(ddl.slice(0, ddl.indexOf("-- Realtime publication")));
  q(
    `alter table public.event_venues add column workspace_id uuid;insert into public.event_venues(id,event_id,name,workspace_id)values('${venue}','${event}','QA venue','${ws}');insert into public.venue_tables_zones(id,venue_id,name,capacity)values('${table}','${venue}','QA table',10)`,
  );
  q(
    readFileSync(
      new URL(
        "../../supabase/migrations/20260930125216_versioned_event_table_holds.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );

  q("create schema extensions;alter extension pgcrypto set schema extensions");
  q(
    readFileSync(
      new URL(
        "../../supabase/migrations/20260930144328_event_host_table_allocations.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  json(configure());
  q(
    readFileSync(
      new URL(
        "../../supabase/migrations/20260930192244_event_payment_preferences.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );

  q(
    `alter table auth.users add column deleted_at timestamptz,add column is_anonymous boolean default false,add column banned_until timestamptz;create table auth.sessions(id uuid,user_id uuid,not_after timestamptz);insert into auth.sessions select id,id,null from auth.users;create function auth.jwt()returns jsonb language sql stable as $$select jsonb_build_object('session_id',auth.uid())$$;alter table zoi.workspaces add column owner_profile_id uuid;update zoi.workspaces set owner_profile_id='${actor}';`,
  );
  const shared = readFileSync(
    new URL(
      "../../supabase/migrations/20261001170000_workspace_current_authority.sql",
      import.meta.url,
    ),
    "utf8",
  );
  q(
    shared.slice(
      shared.indexOf("create function zoi.suite_current_session"),
      shared.indexOf("create or replace function zoi.assert_ws"),
    ),
  );
  q(
    readFileSync(
      new URL(
        "../../supabase/migrations/20261001032515_event_host_request_cancellation.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  for (const signature of [
    "zoi.event_payment_policy_view(uuid,uuid)",
    "public.event_payment_policy_get(uuid,uuid)",
    "public.event_payment_policy_save(uuid,uuid,integer,uuid,boolean,boolean)",
    "public.event_guest_payment_options(uuid)",
    "public.event_guest_payment_choose(uuid,text,integer,integer,uuid)",
    "public.event_payment_operator_report(uuid,uuid)",
  ])
    console.log(
      "GUARD",
      signature,
      q(`select md5(pg_get_functiondef('${signature}'::regprocedure))`),
    );
  q(
    readFileSync(
      new URL(
        "../../supabase/migrations/20261001171500_event_payment_response_deadline.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  if (process.env.PAREA_AUTHORITY_MIGRATION === "1")
    installEventAuthorityCandidate(q);
  const req = (n) => "91000000-0000-4000-8000-" + String(n).padStart(12, "0"),
    uid3 = "10000000-0000-4000-8000-000000000003",
    uid4 = "10000000-0000-4000-8000-000000000004";
  q(
    `insert into auth.users(id)values('${uid3}'),('${uid4}');insert into auth.sessions values('${uid3}','${uid3}',null),('${uid4}','${uid4}',null);insert into zoi.user_profiles values('20000000-0000-4000-8000-000000000003','${uid3}'),('20000000-0000-4000-8000-000000000004','${uid4}');`,
  );
  json(
    `select public.event_payment_policy_configure('${ws}','${event}',0,'${req(1)}',true,false,null)`,
  );
  const a = json(
    `select public.event_host_allocate('${ws}','${event}','${table}','${actor}',10,clock_timestamp()+interval '1 hour',1,'${req(2)}')`,
  ).allocation;
  const specs = {
    event_host_get: ["p_allocation"],
    event_host_guest_save: [
      "p_allocation",
      "p_guest",
      "p_expected_version",
      "p_request",
      "p_label",
      "p_quantity",
      "p_token",
    ],
    event_host_claim: ["p_token", "p_request"],
    event_host_receipt: ["p_request"],
    event_host_request_cancel: ["p_request", "p_kind"],
    event_guest_payment_options: ["p_event"],
    event_guest_payment_choose: [
      "p_guest",
      "p_method",
      "p_expected_policy_version",
      "p_expected_version",
      "p_request",
    ],
    event_payment_request: [
      "p_request",
      "p_kind",
      "p_scope",
      "p_cancel_if_missing",
    ],
  };
  const quote = (v) =>
    v === null
      ? "null"
      : typeof v === "number" || typeof v === "boolean"
        ? String(v)
        : "'" +
          (typeof v === "object" ? JSON.stringify(v) : String(v)).replaceAll(
            "'",
            "''",
          ) +
          "'";
  const invoke = (name, p, u) => {
    assert(specs[name], "Unexpected RPC");
    return json(
      `select public.${name}(${specs[name].map((k) => quote(p[k])).join(",")})`,
      u,
    );
  };
  const records = new Map(),
    storage = {
      getItem: async (k) => records.get(k) || null,
      setItem: async (k, v) => records.set(k, v),
      removeItem: async (k) => records.delete(k),
    };
  let number = 10,
    loseGuest = true,
    loseChoice = true;
  const create = async (u) =>
    nativePareaClient({
      actor: u,
      event,
      current: () => true,
      storage,
      randomUUID: () => req(number++),
      client: {
        session: { user: { id: u } },
        token: async () => "isolated-fixture-only",
        request: async (path, p) => {
          const name = path.split("/").pop(),
            r = invoke(name, p, u);
          if (name === "event_host_guest_save" && loseGuest) {
            loseGuest = false;
            throw Error("Lost response after commit");
          }
          if (name === "event_guest_payment_choose" && loseChoice) {
            loseChoice = false;
            throw Error("Lost preference response after commit");
          }
          return r;
        },
      },
    });
  const host = await create(uid),
    tokens = ["a", "b", "c"].map((x) => x.repeat(64)),
    ids = [1, 2, 3].map(
      (n) => "82000000-0000-4000-8000-" + String(n).padStart(12, "0"),
    );
  for (const [i, quantity] of [3, 1, 5].entries()) {
    const d = pareaDetail(
        invoke("event_host_get", { p_allocation: a.id }, uid),
        event,
        actor,
      ),
      p = pareaGuestParams(
        d,
        { id: ids[i], label: ["Maria", "Nikos", "Eleni"][i], quantity },
        tokens[i],
      );
    if (i === 0) {
      await assert.rejects(host.hostWrite("guest", "event_host_guest_save", p));
      assert.equal(host.host.state().pending.request, req(10));
      assert.equal(records.size, 1);
      await host.hostRetry();
    } else await host.hostWrite("guest", "event_host_guest_save", p);
  }
  assert.equal(records.size, 0);
  assert.equal(q("select count(*)from zoi.event_host_guests"), "3");
  const detail = pareaDetail(
    invoke("event_host_get", { p_allocation: a.id }, uid),
    event,
    actor,
  );
  assert.equal(detail.group.unassigned, 1);
  assert.deepEqual(
    detail.guests.map((g) => g.quantity).sort((x, y) => x - y),
    [1, 3, 5],
  );
  assert.equal(
    q(`select count(distinct token_hash)from zoi.event_host_guests`),
    "3",
  );
  assert.equal(
    q(
      `select count(*)from zoi.event_host_requests where actor='${actor}' and request='${req(10)}'`,
    ),
    "1",
  );
  console.log(
    "PASS actual native host 3/1/5, immutable lost-response retry, real quota and unique capability hashes",
  );
  if (!process.env.PAREA_ALLOW_KNOWN_LEGACY_GAP) {
    const removed = detail.guests[0];
    q(
      `update auth.sessions set not_after=clock_timestamp()where user_id='${uid}'`,
    );
    await assert.rejects(
      host.hostWrite(
        "guest",
        "event_host_guest_save",
        pareaGuestParams(
          detail,
          { id: removed.id, label: removed.label, quantity: removed.quantity },
          "d".repeat(64),
          true,
        ),
      ),
      /suite_session_unavailable/,
    );
    assert.equal(
      q(`select version from zoi.event_host_guests where id='${removed.id}'`),
      "1",
    );
    q(`update auth.sessions set not_after=null where user_id='${uid}'`);
    await host.hostRecover();
    await host.hostCancel();
    console.log(
      "PASS current expired host session rejects rotation and exact missing nonce cancellation settles",
    );
  } else
    console.log(
      "KNOWN BLOCKER: expired-session host writer gate not accepted; diagnostic mode continues other independent journey checks",
    );
  const guest = await create(uid2);
  await guest.hostWrite("claim", "event_host_claim", { p_token: tokens[0] });
  let opt = pareaPaymentOptions(
    invoke("event_guest_payment_options", { p_event: event }, uid2),
    event,
  ).guests[0];
  assert.equal(opt.quantity, 3);
  assert.equal(opt.price_per_guest_cents, 27500);
  const preference = pareaChoiceParams(opt);
  await assert.rejects(guest.paymentWrite(preference));
  assert.equal(records.size, 1);
  guest.destroy();
  const reopened = await create(uid2),
    recovered = await reopened.paymentRecover();
  assert.equal(recovered.choice.status, "unpaid");
  assert.equal(recovered.payment_collected, false);
  assert.equal(recovered.ticket_issued, false);
  assert.equal(records.size, 0);
  assert.equal(
    q("select count(*)from zoi.event_guest_payment_preferences"),
    "1",
  );
  console.log(
    "PASS real guest claim and remounted exact unpaid preference recovery without duplicate choice",
  );
  const second = await create(uid3);
  await second.hostWrite("claim", "event_host_claim", { p_token: tokens[1] });
  assert.equal(
    pareaPaymentOptions(
      invoke("event_guest_payment_options", { p_event: event }, uid3),
      event,
    ).guests[0].quantity,
    1,
  );
  assert.throws(
    () =>
      invoke(
        "event_host_claim",
        { p_token: tokens[0], p_request: req(40) },
        uid3,
      ),
    /claim_unavailable/,
  );
  console.log(
    "PASS unique invitation belongs to first authenticated holder, other-account claim denied",
  );
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const lock = run(
    `begin;select 1 from zoi.event_host_allocations where id='${a.id}' for update;select pg_sleep(0.8);commit;`,
  );
  await sleep(50);
  q(
    `update zoi.event_host_allocations set expires_at=clock_timestamp()+interval '0.3 seconds'where id='${a.id}'`,
  ); // expiry mutation waits for initial lock and then sets a future boundary
  const expiryLock = run(
    `begin;select 1 from zoi.event_host_guests where id='${ids[2]}' for update;select pg_sleep(0.8);commit;`,
  );
  await sleep(50);
  const racing = run(
    `select public.event_host_claim('${tokens[2]}','${req(41)}')`,
    uid4,
  );
  let observed = false;
  for (let i = 0; i < 40; i++) {
    if (
      Number(
        q(
          `select count(*)from pg_stat_activity where query like '%event_host_claim%' and wait_event_type='Lock'`,
        ),
      )
    ) {
      observed = true;
      break;
    }
    await sleep(10);
  }
  assert(observed, "Actual claim lock wait must be observed");
  const denied = await racing;
  await expiryLock;
  await lock;
  assert.notEqual(denied.code, 0);
  assert.match(denied.err, /claim_unavailable/);
  assert.equal(
    q(`select status from zoi.event_host_guests where id='${ids[2]}'`),
    "invited",
  );
  q(
    `update zoi.event_host_allocations set expires_at=clock_timestamp()+interval '1 hour'where id='${a.id}'`,
  );
  console.log(
    "PASS actual observed claim lock wait rechecks allocation expiry and does not claim stale invitation",
  );
  const unknown = req(50),
    key = "zoi.native-parea." + uid4 + "." + event + ".host";
  records.set(key, JSON.stringify({ kind: "claim", request: unknown }));
  const third = await create(uid4);
  assert.equal(await third.hostRecover(), null);
  const cancelled = await third.hostCancel();
  assert.equal(cancelled.error, "request_cancelled");
  const replay = invoke(
    "event_host_claim",
    { p_token: tokens[2], p_request: unknown },
    uid4,
  );
  assert.equal(replay.error, "request_cancelled");
  assert.equal(
    q(`select status from zoi.event_host_guests where id='${ids[2]}'`),
    "invited",
  );
  await third.hostWrite("claim", "event_host_claim", { p_token: tokens[2] });
  console.log(
    "PASS exact unknown nonce cancellation wins late replay and next explicit claim uses new reference",
  );
  json(
    `select public.event_payment_policy_configure('${ws}','${event}',1,'${req(60)}',false,false,null)`,
  );
  opt = pareaPaymentOptions(
    invoke("event_guest_payment_options", { p_event: event }, uid2),
    event,
  ).guests[0];
  assert.equal(opt.choice.status, "needs_review");
  assert.throws(() => pareaChoiceParams(opt));
  assert.throws(
    () =>
      invoke(
        "event_guest_payment_choose",
        { ...preference, p_request: req(61) },
        uid2,
      ),
    /payment_policy_changed|payment_method_unavailable/,
  );
  console.log(
    "PASS organiser policy change invalidates prior unpaid choice and rejects stale policy",
  );
  for (const n of [
    "public.event_host_guest_save(uuid,uuid,integer,uuid,text,integer,text)",
    "public.event_host_claim(text,uuid)",
    "public.event_guest_payment_choose(uuid,text,integer,integer,uuid)",
  ])
    assert.equal(
      q(`select has_function_privilege('anon','${n}','execute')`),
      "f",
    );
  assert.equal(q("select count(*)from public.tab_payments"), "0");
  assert.equal(
    q("select count(*)from zoi.event_host_guests where claimed_by is not null"),
    "3",
  );
  for (const x of [host, reopened, second, third]) x.destroy();
  console.log(
    "PASS authenticated writer ACL, zero money rows, actual whole-ticket quantities for three separate claimant accounts",
  );
} finally {
  if (started)
    execFileSync(
      join(bin, "pg_ctl"),
      ["-D", join(dir, "data"), "-m", "immediate", "-w", "stop"],
      { stdio: "ignore" },
    );
  rmSync(dir, { recursive: true, force: true });
}
