# Furnished lounge placements

`mountLoungeScene({root, initial:'front', placements:[], placementScope:{eventId,configurationVersion}})`.

Optional placements are trusted reviewed configuration, not evidence of server approval. Do not feed user-submitted JSON directly into this argument. The production page currently passes none; no sponsors are invented.

Each item: `{id,event_id,configuration:'front'|'side',configuration_version,approval:'approved',starts_at,ends_at,title,description,image_url,destination_url}`. Exact scope/version, unique identity, active dates (exclusive end), bounded plain text and HTTPS URLs without credentials are required. Maximum three displayed placements. No price, availability, quantity, checkout or ordering is accepted.

A neutral tabletop display marker and keyboard-accessible button open a disclosed sponsored-product card. Images load only when opened; failed images disappear. Destination is an explicitly external product link, not an order. Closing restores marker focus. Expiry removes placement controls; destruction cancels timers and graphics resources.

This is a presentation capability. Sponsor upload, approval, ownership, scheduling persistence and real order integration remain separate backend work. No placement is assigned to any numbered booth. Configuration dimensions are illustrative, not a measured venue survey.
