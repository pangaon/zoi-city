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
