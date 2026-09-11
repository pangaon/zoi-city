# Zoi Mobile

This is the native Expo shell for Zoi. It uses the existing Zoi production web
journeys while native feature parity is built: Directory, Map, Business, Tickets,
Intelligence, Founder Command Center, and BuyGreek.

## Local validation

```bash
npm install
npx tsc --noEmit
npx expo export --platform web
npm start
```

## Device testing

```bash
npx expo start
```

Scan the QR code with Expo Go. The iOS bundle is configured to match the existing
App Store Connect/TestFlight record: `com.usgreekscan.zoi`. TestFlight still
requires Apple Developer signing access and an EAS or Xcode build.

## TestFlight build

From this directory, after authenticating with Expo/EAS:

```bash
npx eas login
npx eas build --platform ios --profile testflight
npx eas submit --platform ios --profile testflight
```

The App Store Connect app ID is configured as `1464901778`. The build will reuse
that Zoi app record and will not create a second listing.