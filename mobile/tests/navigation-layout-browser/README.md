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

Hot-font regression also suppresses both onContentSizeChange and tab onLayout
after mount in the fixture-only adapter. It exercises grow/shrink, width changes,
reordered and changed labels, and releases captured old measurement callbacks
after newer layouts settle. This verifies retained-ref measurement and callback
tokens through the actual component, not an Android device metric claim. The
installed46c1b645 hot-font defect remains open until a coherent future APK is
independently exercised.

Set ZOI_HOT_FONT_ONLY=1 on verify to run only the two390/320 hot-font
regressions. Complete child unions override stale native width; the whole nav
row decides overflow while the narrower scroll viewport controls page/reveal
math. Layout failures have at most two extra measurement passes; no polling
loop or ScrollView remount is used.
