# Zoi Mobile

This is the native Expo shell for Zoi. It uses the canonical production web
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

Scan the QR code with Expo Go. iOS TestFlight requires an Apple Developer account
and an EAS or Xcode signing setup; this repository currently does not contain those
credentials or an App Store Connect connection.