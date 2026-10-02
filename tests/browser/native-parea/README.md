# Native Parea handoff

Run Expo web from current source, then:
`EXPO_ORIGIN=http://localhost:8198 node tests/browser/native-parea/verify.cjs`

Optional QA_OUTPUT_DIR and CHROMIUM_EXECUTABLE_PATH. All backend calls are controlled; window.open is captured, so no customer link/provider opens. Uses actual Expo Tickets screen/Auth/Session client and the new Parea component. Both390/1440 cover own group quantities, exact current private invitation, keyboard browser handoff, empty/expired groups, invalid local URL (zero RPC), wrong server event, changed table between preview and open, and held response across workspace navigation. No token persisted in session storage. These are browser-rendered native components, not physical-device evidence.
