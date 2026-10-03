# Public listing media candidate

These controlled browser suites run the actual candidate HTML and modules. RPCs
use the retained public source/API whitelist for eight real families; original
remote photographs and logos load naturally. They are not production schema
acceptance or live authenticated owner publishing tests.

Run from the repository with Playwright installed and Chromium at the recorded
path:

```
NODE_PATH=$PWD/node_modules node tests/browser/discovery-public-media/verify.cjs
NODE_PATH=$PWD/node_modules node tests/browser/discovery-public-media/canonical-transition.cjs
```

The first suite checks 390/1440px card → Quick look, canonical destination,
source identity, sparse records, image loading, geometry, no per-card entity
requests, Escape and a blocked original-logo fallback. Optional
QA_DISCOVERY_MEDIA_LABEL narrows the real-family selection; blocked-image cases
still run. QA_DISCOVERY_MEDIA_DIR selects a separate output directory.

The canonical suite serves the actual candidate event renderer for Signature
and Parkview, clicks Open full page at both widths with normal and reduced
motion, checks OG/payload branding, and retains source/incoming transition
timestamps and pageerrors. It exits unsuccessfully if any case fails. Its API
records remain controlled fixtures; its destination is the candidate renderer.

Earlier native AbortError runs remain in the candidate audit bundle. The final
incoming event head opts into the same cross-document transition as Explore and
loads the existing shared observer early. No global pageerror filter is used.
