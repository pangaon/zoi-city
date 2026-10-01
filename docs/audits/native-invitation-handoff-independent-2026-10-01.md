# Native invitation web handoff — independent review

1 October 2026. Narrow Account action review; no live invitations, auth emails or memberships changed.

`mobile/src/Account.tsx` SHA256 `02ceae02ff2ca7b576f6f212c9388abc95b97a42ec9da66fc92c810913835229` adds owner/administrator-only invitation copy and an “Invite a colleague on web” action. It reuses the unchanged `openWorkspace` guard: current client/session actor, selected workspace present in the current actor's roster, and the exact generated Settings URL. No session token is placed in the URL. Web Settings remains responsible for fresh authorization and actual invitation creation.

Independently ran actual Expo-web at localhost8197 with controlled Auth/RPC responses: owner and viewer cases at390/1440, plus an independent extension for administrator and editor at both widths. All eight cases passed. Owners/administrators open exactly `https://www.zoi.city/social/settings?workspace=<selected ID>`; viewers/editors have no invitation action. No horizontal overflow. Phone action rendering visually inspected. TypeScript no-emit check passed.

Evidence: `/tmp/native-invitation-handoff-independent.log`, `/tmp/native-invitation-handoff-independent-extra.log` and `/tmp/native-invitation-handoff-390.png`. The extension is `/tmp/native-invitation-handoff-independent-extra.cjs`.

Accepted for this narrow handoff. This is actual Expo-web evidence with a captured browser-open call; it is not physical-device/store-build verification, automatic authentication transfer or native invitation creation. The user is told they may need to sign in on the web and must share the private link themselves.
