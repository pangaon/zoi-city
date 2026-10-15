# Professional header flow

From the repository root:

```
OUTPUT_DIR=/your/distinct/path node tests/browser/professional-header-flow/verify.mjs
ZOI_ACTUAL_PUBLIC=1 OUTPUT_DIR=/your/distinct/path node tests/browser/professional-header-flow/verify.mjs
node --test tests/unit/professional-home.test.mjs tests/unit/professional-source.test.mjs
```

The default run mounts the actual family renderer and app with the curated populated professional model, the retained public EKKY model, and a clearly synthetic long Greek name. All four designs run at390 and1440. External images are deliberately blocked in these controlled cases; no Auth/provider or database writes occur. The original CSS is read from Git commit be60cb576b7a24ec3061448f80872835274f3097 and proves that the mobile CTA extends outside its header and is covered by the hero.

`ZOI_ACTUAL_PUBLIC=1` additionally opens the current canonical EKKY production page at both widths, intercepting ONLY its professional stylesheet with the candidate CSS. Public HTML/API responses stay actual; this is candidate overlay evidence, not a claim the fix is deployed. Read-only RPCs are allowlisted, other POSTs refused. Neither phase submits a checklist or contacts a practice. Pointer click, Enter activation, Escape and button-close focus restoration are exercised. Geometry requires full title containment, no horizontal overflow,44px CTA/close targets, and the hero starting after the header.

Defaults reuse the existing Playwright module and Chromium1243 installation; override `ZOI_PLAYWRIGHT_MODULE` or `CHROMIUM_EXECUTABLE_PATH` if necessary. Set a distinct output directory to preserve frozen evidence.
