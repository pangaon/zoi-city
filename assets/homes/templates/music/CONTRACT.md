# Reusable music homes — four source-backed layouts

`renderMusic(data, template, design={})` is a pure HTML renderer. `template` is `atelier`, `concierge`, `table` or `parea`. Body uses matching `data-template` and class. All templates share the same authoritative actions and differ in typography, composition, section priority and listening/live emphasis.

`design.section_order`, `hidden_sections`, and `copy.{headline,intro,offerings_title,calendar_title,media_title,contact_title}` follow the shared home-design contract. Copy is escaped; duplicate/unrecognized section IDs are ignored. Hidden sections are omitted and navigation/hero action follows remaining sections. No design choice changes inventory, prices, artist identity or operational permissions.

Data: `{id,slug,name,greek_name?,website,checked_at,source_method,portrait,portrait_credit,spotify,youtube,video_playlist,facebook,instagram,contact,programme,releases:[],shows:[]}`. A release is `{id,title,url,image,kind,year,source}` with an exact Spotify artist/album/track URL; embedded playback is click-to-load. A sourced show is `{id,date:'YYYY-MM-DD',city,venue,source,time_precision:'date_only',status:'official_website_listing'}`. These are source references, NEVER platform event IDs or confirmed bookings. Keep source evidence separate from profile fields and update/expire it explicitly. No current time, timezone, ticket price or sale status is inferred from a date-only source.

The demonstration source for George Dalaras is `showcase/music/giorgos-dalaras-athens-a558f2/source.json`. The official website currently challenges direct crawling; dated programme text was reviewed via the public search index on 2026-09-30. Spotify oEmbed successfully returned the official-linked artist portrait and three actual release covers. Assets remain provider-hosted with attribution. Not an owner claim or endorsement.

Working customer tools:
- Filter actual sourced dates by city; automatically omit dates before today. Download RFC5545 all-day transparent **personal reminder**, explicitly no performance time/ticket reservation. Exact source included; text escaped against calendar-property injection.
- Click-to-load official Spotify recording/artist player and official-linked YouTube playlist. External-provider fallback link remains visible; no stream counts/embeddability guarantee.
- Share actual release or artist link with Web Share/clipboard.
- Query deployed `artist_shows(p_artist)` only on request. Its records remain separately labelled as mutually confirmed by artist/event workspaces.
- After authentication, select an actual own `trips_mine` trip and call `trip_item_save` with exact confirmed `event_id/appearance_id`. Stable UUID + unchanged payload are stored before send under authenticated profile scope; explicit retries reuse them. Receipt verifies record/trip/appearance/listing and not-removed state. This saves a **private planned stop**, never a ticket. Existing `/trips/` supplies create/edit/remove. No mutation from opening or refreshing a page.
- `inquiry_availability` exposes `/inquiries/?listing=UUID` only when the actual owner enabled the inbox. Dalaras production check returned false, so official contact is the only enquiry option.

Working owner entry:
- Sign in; select own workspace from `zoi_me`.
- `appearance_operator` must authorize that actor and contain this artist in its current `owned` rows before mounting the existing appearance operator.
- Existing operator handles proposal/version/confirmation/withdrawal and audit. Owner/admin only; ordinary workspace editor or a workspace not owning the artist cannot manage it.
- Root's shared owner-design editor is the publication authority for template, order and wording. This module does not claim the unfinished editor is live.

Production read evidence 2026-09-30: Dalaras artist listing `a558f28d-6c8f-4079-9730-838f483867fc`; `artist_shows` empty; `inquiry_availability.available=false`. Therefore no production booking, ticket or enquiry submission was attempted. Real provider music images loaded 4/4 at 390/1440 across all four routes. Local isolated browser fixture tested trip lost-response retry, wrong-owner denial and authorized operator mounting with zero automatic mutations. Existing trip/appearance PostgreSQL authorization tests remain backend authority; no new schema introduced here.

Native may reuse `calendarReminder`, `visibleShows`, `confirmedShow`, `spotifyEmbed` and `youtubePlaylistEmbed` from `model.mjs`; native trip/appearance contracts are unchanged. Native four-layout visual parity is not yet claimed.
