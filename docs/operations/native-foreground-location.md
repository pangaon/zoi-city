# Discovery foreground location

This source candidate adds an optional **Use my location** action to Android's embedded MapLibre map, the iOS native map and the native-web Discovery map. Manual city browsing remains independent. It does not change a home city, profile, search preferences or listing coordinates.

The user must press the action before permissions or location services are consulted. The app requests foreground permission only, then removes its foreground subscription after the first fresh valid reading. A twenty-second deadline, cancellation, backgrounding, Android blur, scope change and unmount also stop it. A subscription that resolves after cancellation is removed immediately. OS permission dialogs may temporarily make the app inactive; no location watch starts unless the app is active and focused.

A device marker represents a measured snapshot, not a live GPS or navigation promise. Its label reports the device's accuracy or says accuracy is unavailable. A reported accuracy radius is rendered separately. Only latitude, longitude, accuracy and timestamp enter map rendering. Invalid, stale or future readings are refused; measured zero latitude/longitude are valid. The snapshot expires after two minutes and can be hidden immediately.

A pan, zoom or selection after the request invalidates automatic centering. A valid result may still appear as an honest marker. A new explicit request can center again. Denial, permanently denied permission, disabled services, unavailable results, timeout and retry have visible states. **Open app settings** is a user-controlled operating-system handoff; it does not silently enable device services. Web settings behavior depends on the browser.

## Required future artifact

The installed APK identified as `4a` does **not** include this source change. A coherent new native binary is required for the `expo-location` module and foreground permission configuration. No new binary, provider key, paid build or deployment was created for this candidate. Android/iOS permission prompts, real device fixes and installed-artifact behavior remain release acceptance work.

`expo-location` is pinned to **57.0.21** in package and lock files. Its official SDK57 documentation describes foreground subscriptions and config-plugin changes requiring a new binary: [Expo Location SDK57](https://docs.expo.dev/versions/v57.0.0/sdk/location/). The shipped plugin/types were checked; both iOS Always descriptions and motion usage are disabled, as are iOS/Android background location, Android foreground service and activity recognition. Expo config introspection produces only iOS `NSLocationWhenInUseUsageDescription` and Android coarse/fine location permissions. No background or motion permission is enabled.

Coordinates remain ephemeral React/controller state and map display data. There is no profile write, location history, geocoding or provider purchase. The existing basemap service may request map tiles for the area the user chooses to display. Android WebView geolocation remains disabled: the app's explicit foreground action supplies its bounded snapshot through the existing bridge.

## Verification bounds

Controlled tests exercise lifecycle and the actual hook, controls, Android bridge and iOS component with device APIs substituted. A real browser exercises actual React Native Web controls and MapLibre with a controlled location adapter and an empty basemap. These checks prove source behavior and camera handling; they do not prove real operating-system permission UI, sensor availability or a shipped native binary.
