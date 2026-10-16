# Account deletion: Community companion

This is a source-reviewed rollout procedure, not evidence of production activation
or universal account deletion. The core V2 request/session implementation remains
a prerequisite. The companion uses the same private request ledger; it introduces
no second account, queue or editable-content store.

## Supported erasure map

| Data | Treatment |
| --- | --- |
| Personal Community profile/preferences | Delete complete rows, including `initial_data`. |
| Drafts, versions, request/publication/comment receipts | Delete owned rows and all payloads; the existing immutable triggers allow DELETE only in the exact request/worker/transaction scope. UPDATE remains forbidden. |
| Own posts and comments | Delete text/media/context. Before deleting a parent post, detach other authors' replies so the existing FK cannot cascade their text away. Their author/body remain unchanged. |
| Saved items, reactions, follows, blocks, mutes, notifications | Remove links involving the erased identity. Associated obsolete post links follow the reviewed canonical FKs. |
| Reports | Delete own cases. Scrub system snapshots/quoted details of own posts in other reporters' cases, including identifiable snapshots whose post has already disappeared. Clear own reviewer identity/notes. Redact the reviewed legacy report reason associated with an erased post; retain the other reporter's neutral case reference. |
| Community upload bytes | Exact private namespace and object UUID/version manifest; actual Storage API DELETE, authenticated HEAD absence, then canonical metadata-absence acknowledgement. No SQL-only object erasure. |
| Media proof/grants/assets | Remove owned immutable proof rows and metadata only after the byte checkpoint is acknowledged. |
| Auth/profile | The unchanged core worker hard-deletes Auth only after residual checks; empty profile reference id/created_at remain. Old JWT/profile recreation remain refused. |
| Business, transactions, unrelated/shared media, unmapped history | Preserve and report incomplete. No invented legal-retention justification, ownership transfer or business cascade. Further reviewed erasure maps/operator completion are required. |

Queries and mutations are bounded: up to 100 changed SQL rows in a stage, eight
Storage objects per checkpoint, at most four HEAD requests at once and five
requests per worker dispatch. Empty stages may advance in the same SQL call.
Private object paths never come from a client request. New service uploads cannot
recreate a namespace once deletion is accepted. Ordinary discard-only cleanup can
still finish without acquiring a reverse receipt lock; restoration/PII writes
refuse, and other trigger receipt locks use NOWAIT.

## Retry and failure behavior

Each worker owns a two-minute request lease. SQL progress and the original object
manifest survive a process crash or lost Storage response. A retry uses the same
request and original object references, repeats idempotent Storage deletion and
verifies absence. Another object's version/identity cannot be substituted.
Failure uses exponential backoff capped at one hour. Failed cleanup never returns
`completed`. Status remains read-only; closing the app does not cancel a request.

Stage-specific FK and trigger checks fail closed before erasure. The retained
actual four-parent cascade graph and immutable helper/trigger metadata are pinned
in the fixture. A wider metadata read timed out; its failure is retained outside
Git. Root must verify every affected live stage and actual schema before rollout,
not treat local fixtures as an exhaustive hosted inventory.

## Root-only activation gates

1. Verify exact core V2 and companion source/ACL/configuration guards, current FK
   and trigger topology, and unaffected business records. Install using the
   reviewed root release procedure. The new cron job installs **paused**.
2. Deploy the exact Edge bundle including `community-erasure.ts`. Complete an
   actual dedicated synthetic user journey through reauthentication, Community
   drafts/posts/reports, uploaded image/video bytes, asynchronous cleanup and Auth
   removal. Verify old-token refusal and other users/business records unchanged.
3. Measure worker duration, backlog and failure/retry behavior. Choose a finite
   operating budget that can actually be met and is earlier than capability
   expiry. The private `account_delete_completion_budget()` intentionally returns
   NULL initially; confirmation refuses and rolls session revocation back while
   it is unconfigured. The dispatcher also performs zero HTTP in that state.
4. In one guarded root transaction, set the reviewed measured private budget and
   enable only the exact paused `zoi-account-delete-worker` cron job. Preserve its
   fixed minute schedule, command, owner and unrelated jobs. No client/service
   API can configure this budget. Pausing admission must likewise reset the
   budget to NULL and pause the job atomically.
5. Verify actual executions and stored `accepted_at`/`due_at`/completion readback.
   The deadline is assigned once after all confirmation waits. A later policy
   change must not silently extend previously accepted deadlines. Monitor overdue
   and held cases; keep a real completion path for every admitted account type.

No fixed production timeframe is supplied by this packet. The one-hour interval
in the isolated test is explicitly synthetic. App-visible timing comes only from
stored server receipts. An overdue or held case remains incomplete. Users are not
required to email support to keep an accepted request processing.

The packet is **not full App Review deletion readiness** for business/transaction
or other unmapped accounts. Those cases still need reviewed timely completion,
not an indefinite `requires_review` state. Do not activate unrestricted real-user
admission or claim universal deletion until those operational cases are resolved.

References: [Apple account deletion](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/),
[Storage deletion](https://supabase.com/docs/guides/storage/management/delete-objects),
[Auth user data](https://supabase.com/docs/guides/auth/managing-user-data).
