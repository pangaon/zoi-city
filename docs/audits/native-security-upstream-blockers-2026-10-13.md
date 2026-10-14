# Native dependency follow-up

The reviewed patch removes the critical shell-quote finding and source-map-js high finding without changing the Expo/React Native release family. Pinned overrides: shell-quote 1.12.0, source-map-js 1.2.2, @expo/metro-file-map 57.0.4 and uuid 11.1.1. Exact locked install, 458 tests, TypeScript and web/iOS/Android exports passed locally. Node 24.14.0 meets React Native/Metro's declared `^24.3.0` engine range. These exports are bundles, not signed native binaries or device acceptance.

Fresh `npm audit --omit=dev` reports zero critical, 16 high and zero moderate package findings. Counts include propagated parent packages; they are not 16 independent application exploits. Direct exposure and reachable exploit paths are not established by the audit.

The remaining high roots require upstream fixes:

- `braces@3.0.3`, through `expo → @expo/metro@56.0.2 → metro-file-map@0.84.5 → micromatch@4.0.8`. Its [reviewed advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) affects every published version through 3.0.3 and lists no patched version. The [maintainer tracking issue](https://github.com/micromatch/braces/issues/84) requests a release with bounded recursion. Required final check: compatible patched braces/Metro dependency, exact lock install, audit, Metro resolution tests and all-platform exports. The updated @expo/metro-file-map removes one micromatch edge but the React Native/Metro edge remains.
- `node-forge@1.4.0`, through `expo → @expo/cli@57.0.27` and `@expo/code-signing-certificates@0.0.6`. The [reviewed advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv) affects versions through 1.4.0 and lists no patched version. Required final check: patched forge or supported Expo certificate implementation, audit, exact install, export and certificate/signing workflow verification.

The former moderate root was `uuid@7.0.3` through `expo-sharing → @expo/config-plugins → xcode@3.0.1`. The [maintainer advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq) is fixed by uuid11.1.1. This version retains dual CommonJS/ESM exports. The installed xcode consumer only calls `uuid.v4()`; its actual generateUuid produced the expected uppercase24-character identifier after the override. Locked install, source tests, TypeScript and all-platform exports pass with this version. No switch to UUID12+ or Expo downgrade was made.

These are engineering/upstream dependencies; George does not need to send credentials or approve spending. Native release ownership remains with the lead. No advisory was suppressed, no insecure package was disguised with a fork, and no automatic Expo44/React Native0.72 downgrade suggested by npm audit was applied.
