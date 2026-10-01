# Native header brand — independent review

1 October 2026. Accepted source/Expo-web correction of the header logo. The copied mobile asset matches the approved web asset byte-for-byte, SHA256 `08db50bee5caf18a878cb8468ced301d74c92bffd7b308678fb95e4f75514ff1`. No generated replacement or enlargement was introduced.

Independently ran `tests/browser/native-brand/verify.cjs` against the actual Expo app at390/1440. Approved image loads with nonzero natural dimensions, Zoi wordmark is present, header does not overflow, and navigating to Grow then using Zoi home returns home. Directly inspected both screenshots `/tmp/native-brand-390.png` and `/tmp/native-brand-1440.png`: the Greek-Z/olive mark is clear on the light header with legible wordmark and account link. Log `/tmp/native-brand-independent.log`.

App.tsx SHA256 `6a77ea65e97e5ccccf4f3f13c9eddab9c262a792fa24b53d6baacc869484168c`. This corrects the prior header parity observation in the native team review. It is not physical-device/store-distribution evidence and does not certify every app icon/splash surface.

Separately reviewed the organization-invitation integration proposal as a missing-capability design, not delivery. Recipient-bound verified-email acceptance, current issuer/owner authority, explicit acceptance, existing-member non-escalation, hashed tokens and honest link-versus-delivery states are appropriate required gates. No invitation code or live transport is accepted by that proposal.
