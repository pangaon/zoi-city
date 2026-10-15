This fixture runs the actual AppHeader and PrimaryNavigation components through
installed React, React DOM and React Native Web. No product data, API, Auth,
map, provider or device commands are used.

```sh
node mobile/tests/navigation-layout-browser/build.cjs
ZOI_PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core/index.mjs \
CHROMIUM_EXECUTABLE_PATH=/absolute/path/to/chrome \
OUTPUT_DIR=/tmp/independent-navigation-evidence \
node mobile/tests/navigation-layout-browser/verify.mjs
node --test mobile/tests/navigationLayout.test.mjs
mobile/node_modules/.bin/tsc --noEmit -p mobile
```

BUNDLE_PATH optionally changes the temporary bundle file in both commands.
Dependencies come from the existing mobile installation; no install or paid
build is needed. The small local bundler transpiles the actual TSX/TS, resolves
installed CJS distributions and embeds the exact approved logo bytes. It is
only a test tool, not the application build or another navigation library.

RN Web does not apply native system text scaling. A fixture-only Text adapter
therefore multiplies font and line-height points once at1×/2×, while its
useWindowDimensions wrapper exposes that scale to the unchanged component.
Production imports remain react-native, which owns real system scaling. This
controlled approximation is not an installed Android/iOS text-layout result.

Cases cover320px/390px portrait,844px landscape and780px shell at1×/2×,
English and long Greek labels. They exercise all five existing destination IDs,
full selected-tab reveal,44px targets, overflow arrows without route changes,
keyboard focus/Enter/Space, account/home callbacks, external route/font/rotation
changes, explicit newlines, whole-label visibility and compact header bounds.
Manual scrolling may move the currently selected tab out of view; focusing it
or changing route/font/orientation reveals it again. Scroll controls do not
change the selected route.

Original installed7b13 screenshot/XML are retained separately as defect evidence.
The lead owns the next coherent binary build and real installed acceptance;
these tests do not certify that APK, screen-reader behavior or real device
font metrics. Use a separate output folder for independent review.
