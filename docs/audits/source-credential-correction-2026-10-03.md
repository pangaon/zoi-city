# Source-capture credential correction

GitHub reported a Google API key signature in b7c48a5 evidence. A tracked-file scan found two distinct Google API key strings, twelve occurrences in three captured Google Maps evidence files. They are third-party browser page content, not Zoi application configuration. No credential values are printed in this report, scanner output or replacement metadata.

The three current files replace only those exact strings with a redaction marker. Original and derivative hashes are separately recorded in `evidence/source-credential-redaction-2026-10-03.json`; earlier source hashes describe originals, not the sanitized derivatives. A fourth unpublished capture was also sanitized and remains outside this corrective commit.

The new tracked-file checker includes internal source evidence and catches common Google, GitHub, AWS, Stripe and private-key signatures. It does not establish detection of every credential format. Tests exercise the actual Git index separately from the worktree. CI runs the checker on every checked-out tracked file. The initial independent scan of the uncorrected index failed; after exact staging the lead scan passed all 3,037 tracked files with zero findings. Four focused tests and the isolated exact-staged release verification passed: inline syntax, HTML lint, 299 Node test files and two standalone suites.

Website access to the internal `/docs/audits` subtree is routed to an uncached 404. This protects public website delivery of source captures; real deployed requests still require verification after promotion. Ordinary client and event routes retain their existing rewrites.

GitHub denied this connection access to secret-scanning alerts with HTTP 403. No alert was dismissed. Original credentials remain in Git history; replacing HEAD does not revoke third-party keys, erase prior deployment URLs or establish their validity. No repository-history rewrite or provider revocation was performed. This incident remains open for alert disposition through an authorized GitHub account.
