# Shared listing galleries — producer candidate

Baseline637d70a, isolated listing-public-experience-20261006. Producer owns only new photo-gallery module/CSS plus eight approved gallery entry modules. Root owns independent review, cache integration and release.

## Changes and scope

A shared rounded dialog now provides clear photo counts, bounded previous/next buttons, keyboard arrows, touch swipes, image loading/failure/retry, source link, captions/credits, Escape and focus return. Source arrays remain owned by existing models; no image facts or owner media selection were changed. Generic venue integration uses only data-generic-photo; Signature Highlights, room scenes, concert furniture and other customer actions remain untouched. Health, Professional and Society have no equivalent photo collection and are not assigned invented galleries.

Restaurant/Bakery preserve their supplied captions/profile attribution. Hospitality uses the current published photos. Creator uses images/alt text from its existing rendered source gallery. Artist preserves caption,credit,source from artistGallery. Church preserves photo alt/caption. Generic listing preserves image alt and exact image URL. Existing non-photo dialogs and writers remain unchanged.

The helper intercepts only explicitly selected photo controls. Caller-supplied URLs must be nonempty HTTP(S) without embedded credentials. Strings are assigned through textContent. Remount retires previous shared gallery for that root; Church/Event disposal invokes cleanup. Persisted pagehide closes image content but preserves gallery handlers for BFCache restoration (independent reviewer finding corrected before freeze). Ordinary unload destroys. Retry restores keyboard focus inside the dialog before its button disappears.

## Evidence

- Source: existing family arrays and attribution unchanged; no new source/provider verification.
- Render: phone/desktop gallery screenshots retained, with explicitly labeled controlled image fixtures. These do not prove current remote-photo availability.
- Exercised:42 actual canonical renderer/client cases,390/1440, populated/single/sparse inputs. Creator's two populated variants both use its actual curated two-photo gallery; no single-photo Creator model coverage claim. All other applicable families exercise one-photo behavior. Failed initial requests→retry→loaded, arrow navigation, source target, Escape/focus, no overflow/page errors.
- Shared actual generic client:2 widths exercise preserved captions, swipe events, source URL, persisted-pagehide reopening, invalid URL refusal, literal unsafe-looking captions and destroy cleanup.
- Regression:41 existing family unit cases pass; existing actual food owner/provider editor→canonical journey passes four width/family combinations, preserving non-gallery provider/owner-clear behavior.

Commands in tests/browser/listing-photo-gallery/README.md. Exact12-file manifest plus report/logs/screens in evidence/shared-listing-gallery-2026-10-06. The native physical touch/browser BFCache lifecycle was simulated with browser events; no physical-device or production acceptance claim. Independent reviewer should verify native Back restoration as appropriate. No deployment or schema changes.
