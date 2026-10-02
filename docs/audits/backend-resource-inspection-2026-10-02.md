# Backend resource inspection — 2026-10-02

The expiring read-only inspection requested by main b4e039e ran in Production Database Recovery37037546251 and failed. Health with repeated services returned400 in686ms, metrics500 in10.243s, database diagnostics timed out at25.002s. No restart, mutation or retry occurred. Metadata ACTIVE_HEALTHY is not current service/query acceptance. Previous September30 restart was accepted; it is not repeated.

Next accepted local diagnostic uses the documented alternative comma-separated db/auth/rest encoding plus bounded GET resource metrics, disk utilization and disk configuration. Exactly four GET requests, no SQL, resizing, restart or configuration mutation. No retries; expiring main request cannot replay beyond attempt1. Only allowlisted finite numeric samples are emitted; resource label values are removed, and disk response extras are discarded. Fifteen unit cases and distinct independent review pass. The request is not evidence of a recovered database.

Contracts verified from the current official Supabase OpenAPI: https://raw.githubusercontent.com/supabase/supabase/master/apps/docs/spec/api_v1_openapi.json and https://supabase.com/docs/reference/api/v1-get-services-health.

Actual result and any remaining provider gate must be recorded separately after the committed request runs. No production schema application is authorized by this diagnostic result alone.

## Actual terminal result

Production Database Recovery37039381048 on2317bb6 failed at17:15UTC. FourGETs only: comma-encoded health400/2072ms, resource metrics500/11519ms, diskutil500/1040ms, diskconfiguration200/1561ms with gp3,3000IOPS,8GiB and125MiB/s. Current disk utilization remains unknown; this is not proof of disk exhaustion or sufficient headroom. No SQL, restart or mutation occurred.

Out-of-band aggregate PostgreSQL logs for17:10–17:17UTC returned70PostgREST14.5 and3postgres_exporter ERROR57014 events; no FATAL/PANIC groups returned. This bounded classification does not reveal blocking statements, customer rows or a root cause. No repeated diagnostic execution is queued.

The official Supabase status page reports an unresolved Eastern-US latency incident and API Gateway degraded performance, with improvement reportedOctober1. Deployment region iad1 may encounter that path; this is a possible contributor, not an established explanation for the observed database statement cancellations. https://status.supabase.com/

## Narrow activity follow-through

A lightweight current activity row read later completed through Management SQL. It returned3active sessions, ages14/1/2seconds, no reported waits or blocking PIDs; a following bounded operation-class projection returned0active rows. These transient samples do not establish capacity, sustained service health or a root cause. The actual Montréal guest event and Signature business routes still returned503 in3.509/3.554seconds. No recovery mutation or held schema application followed.
