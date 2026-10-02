# Bounded backend inspection —2026-10-02

Existing main Production Database Recovery workflow serializes under supabase-production-deploy and uses existing masked CI Supabase credential. Manual workflow dispatch was denied403 Resource not accessible by integration. Its existing push trigger accepts an expiring ops/database-recovery-request.json; this request uses inspect only, never restart/recover or production migration paths.

Reviewed existing script sends bounded read-only service health, resource metrics and database/activity/cron/statistics aggregate. Unsuccessful API body is withheld, secret masked; resource series allowlist excludes query/credential labels. Database diagnostic exposes only classified operation names and operational counters, not raw SQL/customer rows. No generic write query or automatic retry in inspect. Read request window45minutes, committed attempts cannot be replayed automatically.

Previous run36790191281on2026-09-30accepted exactly one restart200; its health400/metrics500 made overall run fail. A restart is not being repeated. Current official OpenAPI still documents db/auth/rest and repeated or comma-separated service parameters; service200 alone remains insufficient. Goal is authoritative current telemetry, not a recovery claim.

Source: https://raw.githubusercontent.com/supabase/supabase/master/apps/docs/spec/api_v1_openapi.json and https://supabase.com/docs/reference/api/v1-get-services-health. The2026-10-02changelog scan has no relevant management service-health breaking change; PostgreSQL version change is separate from this read-only inspection.
