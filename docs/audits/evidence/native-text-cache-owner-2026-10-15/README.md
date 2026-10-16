Frozen Android font cache source repair

{
  "focused": "cd mobile && node --test tests/native-text-font-cache.test.mjs tests/scale-text.test.mjs",
  "mobile": "cd mobile && node --test tests/*.test.mjs",
  "types": "cd mobile && ./node_modules/.bin/tsc --noEmit",
  "web_export": "cd mobile && CI=1 ./node_modules/.bin/expo export --platform web --output-dir <unique-private-output>",
  "browser_bundle": "BUNDLE_PATH=<unique-private-bundle> node mobile/tests/scale-text-browser/build.cjs",
  "browser": "BUNDLE_PATH=<same> OUTPUT_DIR=<unique-private-output> node mobile/tests/scale-text-browser/verify.mjs",
  "cpp": "Focused unit compiles complete original TextMeasureCache/hash/float/LRU headers with g++20; compile-command.json retained for the separate explicit replay. Structural attributed-string/geometry declarations are test-only substitutes, listed in fixture support-types.h; no Android renderer or JNI C++ build is claimed."
}

Install patch tests create private temporary packages and use offline npm ci with a local tarball. The shared real dependency tree is read only and remains original. RN fixtures use .js.txt solely to avoid TypeScript parsing upstream Flow syntax. Original five upstream source bytes are unchanged; MIT license retained.

The Android app_process probe loaded TextAttributeProps, WritableMapBuffer, DisplayMetricsHolder and PixelUtil from the actually installed eighth APK, in a separate shell process. The reflection probe used Android createConfigurationContext for .85/1/1.3/2 and compared native field1 vs current scale for five SP sizes, allowtrue/false, max absent/1.5 (80 pairs). It proves the field does not change the current APK painting conversion; it does NOT run the newly patched JS or prove the app Settings round trip fixed. No JNI cache was directly injected or invalidated. Probe dex was removed; restored device proof retained. No device rerun by independent reviewer while root owns ADB.

Installed ninth artifact is not requested/created. Root must independently review before a coherent artifact; normal Settings2→map Close/re-expand + Home/More/form, input/state/camera retention and font1 restoration remain required.
