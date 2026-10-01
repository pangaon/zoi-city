# Source run 36801072123 — independent artifact review

**Three error-state updates were applied; zero extracted profiles were applied.** All three immutable source report hashes match their filenames and pending references. Each receipt reports `applied:true`, but its corresponding pending payload contains only `crawl_status:error` and `last_error:rendered_source_identity_review` with empty provenance. A green workflow and those receipts do not establish completed enrichment.

| Slug | Captured source | Findings requiring review |
| --- | --- | --- |
| `the-gyro-spot-manchester-nh-manchester` | `https://www.thegyrospot.com/`, HTTP200, rendered title The Gyro Spot | Candidate includes description/contact/menu/order links and three image URLs, including a logo among photographs. Robots restrictions blocked some resources. No imagery visually accepted or ordering journey exercised in this audit. |
| `poppi-s-greek-taverna-eugene` | `https://www.poppisgreektaverna.com/`, HTTP200 | Extracted email is `info@poppisanatolia.com` while captured visible text repeatedly says `info@poppisgreektaverna.com`. Description/tagline are truncated to Poppi. Candidate photo list includes a logo. Visible source announces its 5th Street Public Market location and presents differing lunch-hour wording; reconcile source details before approval. |
| `hellenic-school-of-ireland-dublin` | `https://www.hellenic.ie/about_school/`, HTTP200 | Useful school-specific prose/contact exists, but proposed hero/photo URLs are the WPGlobus US/Greek language-selector flags. Social/donation branding belongs to the broader Hellenic Community; school relationship and channel scope require review. No new source description was extracted. |

All three captures have `review_required:true`, rendered hashes and `html_available` source state. Some third-party resources were blocked; successful source document fetching is not complete rendering or customer-journey acceptance.

Artifacts inspected locally under `/tmp/zoi-source-run-36801072123`. No new requests, database writes, approvals or profile applications were performed. Root was notified immediately that receipt count must not be described as three enriched profiles.
