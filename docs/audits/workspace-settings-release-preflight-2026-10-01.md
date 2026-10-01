# Workspace settings release preflight

Lead read-only production checks, 1 October 2026. No candidate migration applied.

- Production still exposes the legacy boolean `workspace_rename` and void `ai_profile_save`; new versioned settings RPCs are absent.
- Expected workspace/profile columns match the candidate types. No existing noninternal triggers were found on either table.
- Production PostgreSQL is 17.6 and provides `pg_catalog.sha256(bytea)`. There are two workspaces and no orphan AI profile rows. No customer field values were read for this inventory.
- Current legacy function definitions were saved in the private recovery directory before any cutoff. Security advisor output was captured before changes; this is a baseline, not a declaration that all existing advisories are resolved.

Release order: independently accept the frozen SQL and styled client journeys; apply the foundation once; inspect installed definitions, grants and RLS; publish the exact verified client; verify deployed assets and browser flows; then apply the separate legacy mutation cutoff and verify it. Leaving unversioned writers enabled is not universal concurrency protection. Keep native web handoff and authenticated production acceptance boundaries explicit.

Open at this checkpoint: final cancellation race tests and actual suite styling review. The lead rejected an unstyled fixture screenshot as visual acceptance. Broader organization and platform scope remains open.
