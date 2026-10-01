# Native header identity correction — 1 October 2026

The app header rendered a text-only “zoi.” identity despite the user's approved blue Greek-Z/olive mark being present in the repository. The existing `mobile/assets/zoi-emblem.svg` is an obsolete gold Z and was not used for this fix.

`mobile/App.tsx` now renders the visually inspected existing `assets/brand/zoi-logo.png`, copied byte-for-byte to `mobile/assets/zoi-logo.png`, beside the Zoi wordmark. No artwork was regenerated, resized on disk, recoloured or reinterpreted. React Native contains the image within34×48 layout points, retaining its proportions; the accessible “Zoi home” parent remains the navigation control. The account link and tagline remain.

Source/copied SHA256: `08db50bee5caf18a878cb8468ced301d74c92bffd7b308678fb95e4f75514ff1`.
App.tsx SHA256: `6a77ea65e97e5ccccf4f3f13c9eddab9c262a792fa24b53d6baacc869484168c`.

Evidence: mobile TypeScript passed. `node tests/browser/native-brand/verify.cjs` passed390/1440 against the actual Expo-web app: approved image decoded, header fits without horizontal overflow, and brand home navigation works after entering Grow. `/tmp/native-brand-390.png` visually inspected for logo proportions, contrast and header spacing; desktop screenshot retained. Independent review requested separately. Public Supabase calls were controlled empty responses; no writes.

This is native source implementation plus Expo-web rendered verification. It is not a physical-device check, native store release or proof that previously installed app binaries have changed. Team-management candidate files remain separate and unchanged.
