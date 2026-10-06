# Independent public entry review — 2026-10-06

Reviewed root candidate `.recovery/public-entry-release-20261006`, excluding Home (separate reviewer) and Tickets (my producer packet). Exact final reviewed source hashes are in [manifest](evidence/public-entry-independent-2026-10-06/manifest.json). No runtime edits or production requests.

Two concrete findings were reported and corrected by the lead during review:

1. Google preparation originally checked account identity before an awaited PKCE digest but not afterward. Independently holding the digest and changing accounts produced an unwanted provider redirect and pending marker. The corrected implementation checks current identity plus supplied mount liveness after the digest and before storage/navigation. Independent repeated actor-change and detached-sign-in-surface cases both reject, with zero redirect and zero marker. Social supplies the actual Google button connection guard.
2. The business-specific Event host action linked to public `/tickets`. It now points to `/tickets/?manage=1`, preserving public Events navigation separately.

Four Google PKCE units pass, including the newly retained independent held-digest actor/surface regression. This establishes local exchange/protocol behavior, not connected Google provider readiness. The Google action remains hidden unless explicit verified-provider flag and settings proof both permit it. No provider was contacted.

The root actual public-entry browser fixture was independently rerun at390/1440 in both themes. Signed-out Social renders the public choices without an email gate, private suite scripts, Auth endpoint or database request; deliberate sign-in and Keep exploring work, including explicit `signin=1`. No overflow or page exceptions recorded. Exact changed source was served locally on8768, external traffic blocked.

An additional actual-page check at390/1440 held a synthetic intercepted OTP response, returned to public browsing, then released the response. The obsolete sign-in code screen did not reappear. No email was delivered. Business layouts also stayed within viewport bounds at both widths. Shared CTA listeners were inspected: they change navigation labels based on stored session state without granting private access. Authenticated suite response/mount gates remain generation, route, token and workspace bound; this review does not replace full authenticated suite regressions.

Final reviewed scope accepted for local public entry behavior after those two fixes. Evidence logs retained beside the manifest. Deployment, real OAuth provider operation and Home acceptance remain separate lead/reviewer responsibilities.
