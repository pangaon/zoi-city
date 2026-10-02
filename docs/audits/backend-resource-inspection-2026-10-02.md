# Backend resource inspection — 2026-10-02

The expiring read-only inspection requested by main b4e039e ran in Production Database Recovery37037546251 and failed. Health with repeated services returned400 in686ms, metrics500 in10.243s, database diagnostics timed out at25.002s. No restart, mutation or retry occurred. Metadata ACTIVE_HEALTHY is not current service/query acceptance. Previous September30 restart was accepted; it is not repeated.

Next accepted local diagnostic uses the documented alternative comma-separated db/auth/rest encoding plus bounded GET resource metrics, disk utilization and disk configuration. Exactly four GET requests, no SQL, resizing, restart or configuration mutation. No retries; expiring main request cannot replay beyond attempt1. Only allowlisted finite numeric samples are emitted; resource label values are removed, and disk response extras are discarded. Fifteen unit cases and distinct independent review pass. The request is not evidence of a recovered database.

Contracts verified from the current official Supabase OpenAPI: https://raw.githubusercontent.com/supabase/supabase/master/apps/docs/spec/api_v1_openapi.json and https://supabase.com/docs/reference/api/v1-get-services-health.

Actual result and any remaining provider gate must be recorded separately after the committed request runs. No production schema application is authorized by this diagnostic result alone.
