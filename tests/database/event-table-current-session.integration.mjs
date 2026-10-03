import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync, spawn } from "node:child_process";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

export function installEventAuthorityCandidate(q) {
  const rows = JSON.parse(
    readFileSync(
      new URL(
        "../../docs/audits/evidence/event-table-current-session-producer-2026-10-03/baseline-functions.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  q("create role postgres superuser;create role service_role");
  q(
    readFileSync(
      new URL(
        "../../supabase/migrations/20260930142554_event_table_identity_setup.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  for (const row of rows) {
    const signature = row.signature.startsWith("zoi.")
      ? row.signature
      : "public." + row.signature;
    q(row.definition + ";");
    q(
      `alter function ${signature} owner to postgres;set role postgres;revoke all on function ${signature} from public,anon,authenticated,service_role;reset role`,
    );
    for (const grant of row.acl.matchAll(/([a-z_]+)=X\/postgres/g))
      q(
        `set role postgres;grant execute on function ${signature} to ${grant[1]};reset role`,
      );
    assert.equal(
      q(`select md5(pg_get_functiondef('${signature}'::regprocedure))`),
      row.definition_hash,
      signature + " actual retained definition",
    );
    assert.equal(
      q(
        `select proacl::text from pg_proc where oid='${signature}'::regprocedure`,
      ),
      row.acl,
      signature + " retained ACL",
    );
  }
  const migration = readFileSync(
    new URL(
      "../../supabase/migrations/20261003023304_event_table_current_session.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const original = q(
    "select md5(pg_get_functiondef('zoi.table_inventory_actor()'::regprocedure))",
  );
  q(
    "alter function public.table_hold_status(uuid,uuid) set search_path to public",
  );
  assert.throws(() => q(migration), /event_authority_preflight_changed/);
  assert.equal(
    q(
      "select md5(pg_get_functiondef('zoi.table_inventory_actor()'::regprocedure))",
    ),
    original,
    "failed preflight changes nothing",
  );
  q("alter function public.table_hold_status(uuid,uuid) set search_path to ''");
  q(
    "set role postgres;grant execute on function public.table_hold_status(uuid,uuid)to anon;reset role",
  );
  assert.throws(() => q(migration), /event_authority_preflight_changed/);
  assert.equal(
    q(
      "select md5(pg_get_functiondef('zoi.table_inventory_actor()'::regprocedure))",
    ),
    original,
  );
  q(
    "set role postgres;revoke execute on function public.table_hold_status(uuid,uuid)from anon;reset role",
  );
  const sourceRow = rows.find(
    (x) => x.signature === "zoi.table_inventory_actor()",
  );
  q(
    sourceRow.definition.replace(
      "a:=zoi.ensure_profile();",
      "a:=zoi.ensure_profile();/* fixture drift */",
    ) + ";",
  );
  assert.throws(() => q(migration), /event_authority_preflight_changed/);
  q(sourceRow.definition + ";");

  q(migration.replace(/COMMIT;\s*$/, "ROLLBACK;"));
  assert.equal(
    q(
      "select md5(pg_get_functiondef('zoi.table_inventory_actor()'::regprocedure))",
    ),
    original,
    "default review rollback preserves baseline",
  );
  q(migration);
  for (const row of rows) {
    const signature = row.signature.startsWith("zoi.")
      ? row.signature
      : "public." + row.signature;
    assert.equal(
      q(
        `select proacl::text from pg_proc where oid='${signature}'::regprocedure`,
      ),
      row.acl,
    );
    assert.equal(
      q(
        `select (pg_get_userbyid(proowner)='postgres' and prosecdef and proconfig=ARRAY['search_path=""']::text[]) from pg_proc where oid='${signature}'::regprocedure`,
      ),
      "t",
    );
  }
  console.log(
    "PASS exact 29 installed definitions/ACLs, drift refusal, transactional ROLLBACK and candidate installation",
  );
}

async function main() {
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

    q(
      "create schema extensions;alter extension pgcrypto set schema extensions",
    );
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

    installEventAuthorityCandidate(q);
    const req = (n) => "92000000-0000-4000-8000-" + String(n).padStart(12, "0");
    const deny = (sql, u = uid) =>
      assert.throws(
        () => as(sql, u),
        /suite_session_unavailable|not_authorized|not_signed_in/,
      );
    const save = (guest, nonce, label = "Guest", version = 0) =>
      `select public.event_host_guest_save('${allocation.id}','${guest}',${version},'${nonce}','${label}',3,'${"a".repeat(64)}')`;
    const allocation = json(
      `select public.event_host_allocate('${ws}','${event}','${table}','${actor}',10,clock_timestamp()+interval '1 hour',1,'${req(1)}')`,
    ).allocation;
    const g = req(2);
    json(save(g, req(3)));
    q(
      `update auth.sessions set not_after=clock_timestamp()-interval '1 second' where user_id='${uid}'`,
    );
    for (const sql of [
      save(req(4), req(5)),
      `select public.event_host_get('${allocation.id}')`,
      `select public.event_host_list(null,'${event}')`,
      `select public.event_host_receipt('${req(3)}')`,
      `select public.event_host_request_cancel('${req(6)}','guest')`,
      `select public.table_hold_status('${event}',null)`,
      `select public.table_inventory_configure_receipt('${ws}','${event}','${request}')`,
      `select public.table_identity_get('${ws}','${event}')`,
    ])
      deny(sql);
    assert.equal(q("select count(*)from zoi.event_host_guests"), "1");
    q(`update auth.sessions set not_after=null where user_id='${uid}'`);
    const originalSession = q(
      `select row_to_json(s)from auth.sessions s where user_id='${uid}'`,
    );
    for (const clause of [
      "deleted_at=clock_timestamp()",
      "is_anonymous=true",
      "banned_until=clock_timestamp()+interval '1 hour'",
    ]) {
      q(`update auth.users set ${clause} where id='${uid}'`);
      deny(save(req(4), req(5)));
      q(
        `update auth.users set deleted_at=null,is_anonymous=false,banned_until=null where id='${uid}'`,
      );
    }
    q(`delete from auth.sessions where user_id='${uid}'`);
    deny(save(req(4), req(5)));
    q(
      `insert into auth.sessions select * from jsonb_populate_record(null::auth.sessions,'${originalSession}')`,
    );
    deny("set request.jwt.claim.sub='';select zoi.table_inventory_actor()");
    console.log(
      "PASS expired, deleted, anonymous, banned, absent-session and signedout actor rejected across host/read/receipt/cancel/hold/owner surfaces",
    );
    let race = 10;
    async function waited(lockSql, operation, revoke, verify) {
      const tag = "parea-session-race-" + race++;
      let unblock;
      const lock = spawn(
        join(bin, "psql"),
        ["-X", "-qAt", "-v", "ON_ERROR_STOP=1"],
        { env },
      );
      let ready = "";
      lock.stdout.on("data", (x) => (ready += x));
      lock.stdin.write(`begin;${lockSql};select 'locked';\n`);
      const deadline = Date.now() + 5000;
      while (!ready.includes("locked") && Date.now() < deadline)
        await new Promise((r) => setTimeout(r, 10));
      assert(ready.includes("locked"), "blocker actually acquired");
      const pending = run(`set application_name='${tag}';${operation}`);
      let observed = false;
      while (Date.now() < deadline) {
        if (
          q(
            `select count(*)from pg_stat_activity where application_name='${tag}' and wait_event_type='Lock'`,
          ) === "1"
        ) {
          observed = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 10));
      }
      assert(observed, "writer actually waiting on lock");
      if (revoke.startsWith("BLOCKER:"))
        lock.stdin.write(revoke.slice(8) + ";\n");
      else q(revoke);
      lock.stdin.end("commit;\n");
      await new Promise((r) => lock.on("close", r));
      const result = await pending;
      assert.notEqual(result.code, 0, result.out);
      assert.match(
        result.err,
        /suite_session_unavailable|not_authorized|not_signed_in/,
      );
      verify();
      q(
        `update auth.users set deleted_at=null,is_anonymous=false,banned_until=null where id='${uid}';insert into auth.sessions(id,user_id,not_after)select '${uid}','${uid}',null where not exists(select 1 from auth.sessions where id='${uid}');update auth.sessions set not_after=null where user_id='${uid}'`,
      );
    }
    await waited(
      `select 1 from zoi.event_host_guests where id='${g}' for update`,
      save(g, req(20), "Updated", 1),
      `delete from auth.sessions where user_id='${uid}'`,
      () => {
        assert.equal(
          q(
            `select label||':'||version from zoi.event_host_guests where id='${g}'`,
          ),
          "Guest:1",
        );
        assert.equal(
          q(
            `select count(*)from zoi.event_host_requests where request='${req(20)}'`,
          ),
          "0",
        );
      },
    );
    console.log(
      "PASS observed final guest row wait followed by session deletion leaves guest/version/nonce unchanged",
    );
    await waited(
      `select 1 from zoi.event_table_settings where event_id='${event}' for update`,
      hold(req(21)),
      `update auth.sessions set not_after=clock_timestamp()-interval '1 second' where user_id='${uid}'`,
      () =>
        assert.equal(
          q(
            `select count(*)from zoi.event_table_holds where request_id='${req(21)}'`,
          ),
          "0",
        ),
    );
    console.log("PASS observed hold settings wait then expiry leaves no hold");
    await waited(
      `select 1 from zoi.event_host_guests where id='${g}' for update`,
      `select public.event_host_claim('${"a".repeat(64)}','${req(22)}')`,
      `update auth.users set banned_until=clock_timestamp()+interval '1 hour' where id='${uid}'`,
      () =>
        assert.equal(
          q(
            `select claimed_by is null from zoi.event_host_guests where id='${g}'`,
          ),
          "t",
        ),
    );
    console.log("PASS observed claim row wait then ban leaves guest unclaimed");
    await waited(
      `select pg_advisory_xact_lock(hashtextextended('table-config-request:${actor}:${req(23)}',0))`,
      configure(1, req(23)),
      `delete from auth.sessions where user_id='${uid}'`,
      () =>
        assert.equal(
          q(
            `select version from zoi.event_table_settings where event_id='${event}'`,
          ),
          "1",
        ),
    );
    console.log(
      "PASS observed owner configuration nonce wait then deletion preserves price/version",
    );
    await waited(
      `select pg_advisory_xact_lock(hashtextextended('table-identity-request:${actor}:${req(24)}',0))`,
      `select public.table_identity_receipt('${ws}','${event}','${req(24)}')`,
      `delete from auth.sessions where user_id='${uid}'`,
      () =>
        assert.equal(
          q("select count(*)from zoi.event_table_identity_requests"),
          "0",
        ),
    );
    console.log(
      "PASS observed private identity receipt wait then deletion refuses readback",
    );

    await waited(
      `select 1 from zoi.event_host_guests where id='${g}' for update`,
      save(g, req(26), "Changed actor", 1),
      `update zoi.user_profiles set auth_user_id=null where id='${actor}'`,
      () =>
        assert.equal(
          q(
            `select label||':'||version from zoi.event_host_guests where id='${g}'`,
          ),
          "Guest:1",
        ),
    );
    q(`update zoi.user_profiles set auth_user_id='${uid}' where id='${actor}'`);
    console.log(
      "PASS observed guest wait then removed profile binding rejects changed actor",
    );
    await waited(
      `select 1 from zoi.workspace_members where workspace_id='${ws}' and profile_id='${actor}' for update`,
      `select public.table_inventory_configure_receipt('${ws}','${event}','${request}')`,
      `BLOCKER:update zoi.workspace_members set role='viewer' where workspace_id='${ws}' and profile_id='${actor}'`,
      () =>
        assert.equal(
          q(
            `select version from zoi.event_table_settings where event_id='${event}'`,
          ),
          "1",
        ),
    );
    q(
      `update zoi.workspace_members set role='owner' where workspace_id='${ws}' and profile_id='${actor}'`,
    );
    console.log(
      "PASS observed initial owner role lock then demotion denies historical configuration read",
    );
    assert.equal(json(save(g, req(25), "Changed", 1)).guest.version, 2);
    assert.equal(json(save(g, req(25), "Changed", 1)).guest.version, 2);
    assert.throws(
      () => json(save(g, req(25), "Different", 1)),
      /request_conflict/,
    );
    assert.equal(
      q(
        `select count(*)from zoi.event_host_requests where request='${req(25)}'`,
      ),
      "1",
    );

    assert.equal(
      JSON.parse(as(`set role authenticated;${save(g, req(25), "Changed", 1)}`))
        .guest.version,
      2,
    );
    assert.throws(
      () => q(`set role anon;select public.event_host_get('${allocation.id}')`),
      /permission denied/,
    );
    assert.throws(
      () => q("set role authenticated;select zoi.table_inventory_actor()"),
      /permission denied/,
    );
    json(`select public.event_host_release('${allocation.id}',1,'${req(27)}')`);
    const held = json(hold(req(28))).hold;
    assert.equal(held.total_cents, 137500);
    assert.equal(
      json(`select public.table_hold_release('${held.id}')`).hold.status,
      "released",
    );
    console.log(
      "PASS actual authenticated execution, anonymous/private ACL denial and unchanged valid release/hold price",
    );
    assert.equal(q("select count(*)from public.tab_payments"), "0");
    console.log(
      "PASS active-session exact nonce retry and payload conflict preserved; no money rows",
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
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main();
