# Private personal calendar

Status: candidate; production migration and actual authenticated acceptance required before activation. UI uses real API and shows unavailable/retry when backend is absent. No feature claims for reminders, bulk sends, contacts matching, or a full Orthodox calendar.

`personal_calendar_get()` authenticated → `{ok:true,profile_id,version,preferences,church}`. Actor is the server-selected `zoi.user_profiles.id` for auth.uid(), not the auth UUID. Default version0 is opt-out: enabledfalse, newcalendar, Europe/Athens, emptyfeasts, church_idnull. No signup question is mandatory.

`personal_calendar_save(p_request uuid,p_expected_version integer,p_preferences jsonb)` authenticated → same fields plus `request`. Same actor/request+exact version/payload returns the original receipt. Changed payload/request reuse, null version, unknown fields, bad timezone/feasts reject. Actor advisory lock serializes version and30/hour budget. Prior exact retries are allowed without consuming budget or reapplying old values.

Preferences: `{enabled:boolean,calendar:'new'|'old',timezone:IANA,feasts:string[],church_id:UUID|null}`. Supported keys match FEASTS in model.mjs. Selected feast keys deduplicate/sort. Mychurch is optional and can be a monastery (current listings use entity_typechurch). Selection is exact ID, published+clean/cleared+nonhidden; no name inference. Church response is public identity summary only. Hidden/unpublished existing selection remains private but its public details are not returned. Removing it is explicit.

Autocomplete uses existing explore_search(typechurch), never generates names; individual selection verifies seo_entity.id. Known monastery aliases from assets/faith/monastery-network.mjs collapse by reviewed ID mapping only. The canonical ID still must pass the backend public church guard. Unmatched same-saint-name churches stay distinct. A church's actual service times come only from org_calendar_public / its existing published calendar route.

Calendar: GOARCH new-calendar StGeorge April23 on/beforePascha transfers to BrightMonday. Julian fixed commemorations use their civil offset and explicitly do not claim all jurisdiction-specific transfer rules. Feasts are reference dates, not services. Calendar and timezone choices are explicit; personal preference does not claim parish affiliation.

Greeting composer produces editable text. Copy / device share are explicit; no recipients inferred, no remote messaging API, no confirmed delivery state. This is not targeted bulk sending. Existing email audience_tag scheduling is insufficient for exact contact selection, and provider availability remains separately gated.

All tables private with RLS and no client grants. RPCs bind current actor; browser checks auth account before/after asynchronous operations and clears private DOM on account change. Failed uncertain save keeps exact payload/request for in-page retry; reload reads current state without replay. No private calendar preferences are stored in browser persistent storage.
