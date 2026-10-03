// Actual existing preference writer in isolated PostgreSQL; no live requests.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import assert from "node:assert/strict";
const run = promisify(execFile),
  dir = mkdtempSync(join(tmpdir(), "zoi-discovery-pg-")),
  bin = process.env.PG_BIN || "/usr/lib/postgresql/16/bin",
  port = Number(process.env.PGPORT || 15563);
assert(Number.isInteger(port) && port > 1024 && port < 65536);
const env = {
    ...process.env,
    PGHOST: dir,
    PGPORT: String(port),
    PGDATABASE: "postgres",
  },
  actor = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
let started = false,
  checks = 0;
async function query(q, user) {
  const { stdout } = await run(
    join(bin, "psql"),
    [
      "-X",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      (user
        ? `set role authenticated;select set_config('request.jwt.claim.sub','${user}',false);`
        : "") + q,
    ],
    { env },
  );
  return stdout.trim().split("\n").filter(Boolean).at(-1);
}
const literal = (v) =>
    "'" + JSON.stringify(v).replaceAll("'", "''") + "'::jsonb",
  call = (name, args = "", user = actor) =>
    query(`select public.${name}(${args});`, user).then(JSON.parse),
  pass = (x) => {
    checks++;
    console.log("PASS " + x);
  };
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
      join(dir, "server.log"),
      "-o",
      `-k ${dir} -p ${port} -c listen_addresses=''`,
      "-w",
      "start",
    ],
    { stdio: "ignore" },
  );
  started = true;
  await query(
    readFileSync(new URL("./community-fixture.sql", import.meta.url), "utf8"),
  );
  await query(
    readFileSync(
      new URL(
        "../../supabase/migrations/20260930042430_community_profiles_graph_and_personal_feeds.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  let me = await call("community_me");
  assert.notEqual(me.profile.id, actor);
  assert.equal(me.preferences.version, 0);
  assert.equal(me.preferences.locality_enabled, false);
  assert.equal(me.preferences.city, null);
  pass(
    "sparse account defaults do not infer a home and public profile ID differs from auth ID",
  );
  const data = {
    topics: ["music"],
    city: "Toronto",
    country: "Canada",
    locality_enabled: true,
  };
  let saved = await call("community_preferences_save", "0," + literal(data));
  assert.equal(saved.preferences.version, 1);
  me = await call("community_me");
  assert.equal(me.preferences.city, "Toronto");
  assert.equal(me.profile.city, null);
  pass(
    "actual writer persists explicit private home without copying to public identity",
  );
  assert.equal((await call("community_me", "", other)).preferences.city, null);
  pass("another account does not inherit the saved home");
  const updates = await Promise.allSettled(
    ["London", "Athens"].map((city) =>
      call("community_preferences_save", "1," + literal({ ...data, city })),
    ),
  );
  assert.equal(updates.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(updates.filter((r) => r.status === "rejected").length, 1);
  assert.equal((await call("community_me")).preferences.version, 2);
  pass("concurrent preference changes cannot overwrite a newer home version");
  await assert.rejects(
    call("community_preferences_save", "1," + literal(data)),
  );
  assert.equal((await call("community_me")).preferences.version, 2);
  pass(
    "lost response replay of stale expected version cannot create another mutation",
  );
  saved = await call(
    "community_preferences_save",
    "2," +
      literal({ topics: [], city: null, country: "", locality_enabled: false }),
  );
  assert.equal(saved.preferences.city, null);
  assert.equal(saved.preferences.country, null);
  assert.equal(saved.preferences.locality_enabled, false);
  assert.deepEqual(saved.preferences.topics, []);
  assert.equal((await call("community_me")).profile.city, null);
  pass("explicit null/empty clears persist and do not alter public identity");
  await assert.rejects(
    call(
      "community_preferences_save",
      "3," +
        literal({
          topics: [],
          city: null,
          country: null,
          locality_enabled: true,
        }),
    ),
  );
  pass("locality cannot be enabled without an explicit area");
  await assert.rejects(
    call(
      "community_preferences_save",
      "3," + literal({ ...data, topics: ["unknown"] }),
    ),
  );
  pass("unknown interests rejected by existing writer");
  await assert.rejects(query("set role anon;select public.community_me();"));
  await assert.rejects(
    query(
      "set role anon;select public.community_preferences_save(0,'{}'::jsonb);",
    ),
  );
  pass("anonymous private home reads and writes denied");
  await assert.rejects(
    query("select * from zoi.community_preferences;", other),
  );
  pass("private preference table cannot be directly read by another account");
  console.log(checks + " actual preference database checks passed");
} finally {
  if (started)
    execFileSync(
      join(bin, "pg_ctl"),
      ["-D", join(dir, "data"), "-m", "immediate", "-w", "stop"],
      { stdio: "ignore" },
    );
  rmSync(dir, { recursive: true, force: true });
}
