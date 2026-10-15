This fixture exercises the actual ScaleText and AppChrome with React 19 and
RN-web. The narrow RN adapter controls platform/font scale and records text-host
mounts. The retained map div verifies reconciliation identity, not map rendering.
It does not emulate the Android paragraph cache or claim installed acceptance.

Run from the repository root using unique persistent output paths:

```sh
BUNDLE_PATH=/home/codespace/.cache/zoi/<unique>/scale.js node mobile/tests/scale-text-browser/build.cjs
BUNDLE_PATH=/home/codespace/.cache/zoi/<unique>/scale.js OUTPUT_DIR=/home/codespace/.cache/zoi/<unique>/browser node mobile/tests/scale-text-browser/verify.mjs
```

`ZOI_PLAYWRIGHT_MODULE` and `CHROMIUM_EXECUTABLE_PATH` can select existing local
browser dependencies. No downloads, EAS build, ADB, Auth or provider calls occur.

Installed acceptance remains: Android Settings font1→2→resume, selected map
Close/re-expand/scroll, Home, More and a representative form, then font1 restore.
Parent/screen state, map camera, selection and permission policy must survive.
