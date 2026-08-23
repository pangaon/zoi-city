# Finishing the enrichment chain

Corrected runbook. Three things in the original differ from what the tooling and
the code actually do — each is called out below.

## Already applied (do not re-run)

* `idx_listings_pub_created` — fixed the `explore_fresh` timeout.
* `0003_profile_writable.sql` — `public.bizpage_save_profile`, `zoi.enrich_apply`,
  `zoi.profile_strip`.
* `0005_enrich_queue_and_noop_guard.sql` — `zoi.enrich_queue`,
  `idx_listings_enrich_due`, the `listings_skip_noop` trigger.

Both files use `CREATE OR REPLACE` and `DROP ... IF EXISTS`, so re-running is
harmless if the tooling insists.

## Correction 1 — the command is `db query`, not `db execute`

`supabase db execute` does not exist in CLI v2.115. Use:

    supabase db query --project-ref csebihpaychdkanjjsmz -f <file>

`--linked` / `--project-ref` run the statement through the **Management API**,
which means this needs only a personal access token — **no database password and
no Docker**. That also removes the need for `supabase link`.

## Correction 2 — do NOT deploy with `--no-verify-jwt`

The original pairs `--no-verify-jwt` with a cron call that sends no
`Authorization` header. That combination leaves the endpoint publicly
invokable, and this particular endpoint is a crawler: anyone who found the URL
could make Zoi fetch other people's websites on demand, repeatedly, from our
address and under our User-Agent. That spends our reputation and our egress.

The worker now authenticates its caller itself (`authorised()` in `index.ts`,
constant-time compare against the service role key), so it is not open even if
someone deploys it with the flag. Deploy it *without* the flag anyway — defence
in depth:

    supabase functions deploy zoi-enrich --use-api --project-ref csebihpaychdkanjjsmz
    supabase secrets set --project-ref csebihpaychdkanjjsmz \
      ENRICH_ENABLED=on REQUIRE_DNS_GUARD=true ENRICH_BATCH=40

`--use-api` bundles server-side, so Docker is not required.

## Correction 3 — the cron must carry the Authorization header

With authentication on (either the platform's or the worker's own), a header-less
`net.http_post` returns 401 every hour, forever, silently. Store the key in Vault
rather than in plaintext inside `cron.job`:

```sql
-- once
select vault.create_secret(
  '<service role key>', 'service_role_key',
  'used by pg_cron to invoke edge functions');

-- schedule at :45, clear of the other workers at :00/:07/:15
select cron.schedule(
  'zoi-enrich-hourly', '45 * * * *',
  $$
  select net.http_post(
    url     := 'https://csebihpaychdkanjjsmz.supabase.co/functions/v1/zoi-enrich',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' ||
                   (select decrypted_secret from vault.decrypted_secrets
                     where name = 'service_role_key')),
    body    := '{"limit":40}'::jsonb,
    timeout_milliseconds := 120000   -- the worker's own budget is 110s
  );
  $$);
```

Confirm it is actually succeeding rather than 401-ing into the void:

```sql
select j.jobname, r.status, r.return_message, r.start_time
  from cron.job_run_details r join cron.job j on j.jobid = r.jobid
 where j.jobname = 'zoi-enrich-hourly'
 order by r.start_time desc limit 5;
```

## The two data backfills

```
supabase db query --project-ref csebihpaychdkanjjsmz -f supabase/migrations/0002_geocode_backfill.sql
supabase db query --project-ref csebihpaychdkanjjsmz -f supabase/migrations/0004_enrich_backfill.sql
```

Both are wrapped in `BEGIN` with `COMMIT` left commented out, and both print what
they will change before changing it. Read the counts, then commit. Both are safe
to re-run: 0002 only fills coordinates that are currently NULL, and 0004 writes
only into `profile._enrich`.

## Reclaiming the existing bloat

The trigger stops new bloat; it cannot reclaim what is already there.

    VACUUM (FULL, ANALYZE) zoi.listings;

This takes an ACCESS EXCLUSIVE lock for its duration, which blocks reads as well
as writes — the live directory will error while it runs. On ~136 MB expect
seconds rather than minutes, but pick the moment deliberately and keep it clear
of the ingestion runs at :00/:07/:15 and enrichment at :45. `pg_repack` does the
same online if you would rather not take the lock at all.

Check the trigger is earning its keep first — run the hourly maintenance once,
then:

```sql
select n_tup_upd, n_dead_tup,
       pg_size_pretty(pg_total_relation_size('zoi.listings')) as size
  from pg_stat_user_tables where relname = 'listings';
```

`n_tup_upd` should barely move on a no-change pass.

## End-to-end check

```sql
-- did anything actually land?
select count(*) filter (where profile ? '_enrich')                  as enriched,
       count(*) filter (where profile -> '_enrich' ? 'social')       as with_social,
       count(*) filter (where profile -> '_enrich' ? 'photo_url')    as with_photo,
       count(*) filter (where profile -> '_enrich' ->> 'blocked' = 'true') as blocked
  from zoi.listings;
```

Then open any enriched listing. It should show a cover image, social links, and
one line naming the site and the date it was read — "not confirmed by them".
If that line is missing while `_enrich` has data, the renderer is not picking it
up and `safeProfile()` in `api/_verticals.js` is where to look.


---

# What actually happened on deploy (2026-08-23)

Applied and verified in production. Three things the runbook could not have
known, found by deploying rather than by reading:

**1. PostgREST cannot see the `zoi` schema.** 0003 and 0005 created
`zoi.enrich_apply` and `zoi.enrich_queue` and revoked them from PUBLIC, which was
correct — but the worker calls them over PostgREST, which only resolves functions
in an exposed schema. The worker got `PGRST202: Searched for the function
public.enrich_queue ... no matches`. Fixed by 0006: thin SECURITY DEFINER
wrappers in `public`, `GRANT EXECUTE ... TO service_role` only. `anon` and
`authenticated` still cannot reach either — a visitor must never be able to make
the site crawl, and machine claims must never be writable by a logged-in user.

**2. Two headers are needed, not one.** With platform JWT verification on, the
`Authorization` header must be a valid JWT, so it cannot also carry a custom
shared secret. And `SUPABASE_SERVICE_ROLE_KEY` as injected into the function did
not match the `service_role` key the Management API returns — this project has
the newer API-key system alongside the legacy JWT, so comparing against the
service key alone produced a 401 on a completely legitimate call from pg_cron.
The worker now accepts a dedicated `ENRICH_TOKEN` via `x-enrich-token`, and the
cron sends both headers. Both secrets live in Vault; neither is in `cron.job` in
plaintext.

**3. pg_net's default timeout is 5 seconds**, and that is why
`zoi-worker-hourly` has been failing on every run — see below. `zoi-enrich-hourly`
sets `timeout_milliseconds := 150000`.

## Live state after deploy

    published listings with coordinates   3,599 -> 7,805 of 8,081  (44.5% -> 96.6%)
    listings with any coordinate          3,693 -> 9,549 of 11,829
    of those, street-level precision      2,027
    enriched listings                     0 -> 113
    with a photo                          0 -> 56
    with social links (from _enrich)      0 -> 83
    hosts that refused a bot, recorded    2

`zoi-enrich-hourly` runs at :45, 100 listings per run, ~1s per listing. The queue
holds roughly 5,900 listings with a website, so full coverage takes about
two and a half days and then settles into a 30-day refresh.

## A separate live fault, found while checking cron conventions

`zoi-worker-hourly` reports `succeeded` in `cron.job_run_details` on every run
and has not actually worked. `net.http_post` only enqueues the request, so cron
records success the moment the SQL returns; the real outcome is in
`net._http_response`, where every hourly attempt shows `status_code = null` and
`Timeout of 5000 ms reached`. The RSS ingestion behind it has not been running.

The fix is to reschedule that job with an explicit timeout:

```sql
select cron.unschedule('zoi-worker-hourly');
select cron.schedule('zoi-worker-hourly', '15 * * * *', $job$
  select net.http_post(
    url     := 'https://csebihpaychdkanjjsmz.supabase.co/functions/v1/zoi-worker',
    headers := jsonb_build_object('Content-Type','application/json',
                 'Authorization','Bearer ' || (select decrypted_secret
                    from vault.decrypted_secrets where name='service_role_key')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 150000);
$job$);
```

Worth auditing every HTTP cron job the same way — `job_run_details` saying
`succeeded` means only that the SQL ran.

## And one exposure worth a decision

`social_publish_worker` and `zoi-worker-hourly` both call their functions with no
`Authorization` header at all, and `social-publish` returns HTTP 200 to them.
That means it is deployed with JWT verification off and is publicly invokable by
anyone who knows the URL. Its blast radius is limited — it publishes posts that
are already due — but it is an open endpoint on a project where everything else
is gated, and the same worker also sends scheduled email. Deploying it with
verification on, and giving its cron the header above, closes it.
