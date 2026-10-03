# Shared public listing media and source projection candidate

This packet corrects missing and inconsistent card imagery without copying
profiles into a cache or adding an entity request to each card. It is a local
candidate, not applied or deployed by this specialist. The lead retains schema,
integration and production release ownership.

## Source, API and rendered gap

The unchanged pre-implementation bundle at
`evidence/discovery-media-before-2026-10-02/manifest.json` contains actual public
API records and 11 live rendered journeys across eight families. Signature's
search card and Quick look displayed initials with no image, while its canonical
page rendered the reviewed 3000×1996 concert photograph and 1307×887 identity.
Yamas had source imagery, but its actual official padded logo was not presented
consistently. Parkview's search-selected imported photo differed from its reviewed
canonical photograph. Sparse church, school and professional examples had no
trustworthy photograph; that absence remains honest.

The fresh read-only inventory covers 32,239 eligible records in 12 families:
5,676 have imported media, zero are unbound, 5,504 match the current host/path
estimate, 171 conflict, and one is quarantined. Exact query and individual
conflict records are retained. All 171 were also classified with the actual
shared JavaScript selector: none pass source binding, and none have a base photo,
raw explicit photo/hero or suite owner base-image write. These are imported-only
conflicts. No source reconciliation or listing data rewrite was performed.

## Shared correction

`assets/discovery/public-listing-media.mjs` centralizes media and description
selection for Explore, Quick look and the existing canonical profile-media
adapter. Explicit owner/raw image, logo, gallery and description clears suppress
fallback, including reviewed defaults. Source-derived media requires matching
current website host/port/path and no identity quarantine. Existing no-source
canonical fixture compatibility remains in the adapter; current valid source
data and reviewed catalog defaults are retained. Reviewed Signature, Parkview
and artist imagery binds actual ID, category and current source identity. No
other client's photograph is transplanted.

Source-bound current artist biography/excerpt is projected for cards; other
families keep reviewed base descriptions first. Base listing fields are not
overwritten. HTTPS and credential checks apply to images; official HTTP source
sites remain usable for biography identity. Imported interface/translation/map
artwork and exact gallery-only roles do not become heroes. Owner choices retain
precedence. Logos are separate badges, not photographic heroes. The exact Yamas
792×612 asset has native whitespace cropped in the badge; its file is unchanged.
Blocked original logos produce a readable identity fallback with no broken
image. Opened Quick look reuses the same selection contract.

The CLI-created guarded migration
`20261002234013_explore_public_card_source_projection.sql` changes only selected
page projection in existing scalar/types readers. Ranking, dedupe, filters,
aliases, geography, canonical IDs, pagination, defaults and public authority
remain unchanged. Five private security-invoker helpers receive a bounded
whitelist after the materialized page; no whole profile/private owner payload
is exposed. Existing owner helper body/owner/ACL and both public reader
body/owner/ACL are guarded. Legacy top-level photo and poster-kind fields are
also corrected so other scalar/types consumers do not restore an imported
image after an explicit owner clear. The broad JSON oracles exclude only the
four intentional projection differences: description, media_input, photo_url
and image_kind; their new behavior has separate assertions.

## Verification and limits

The retained isolated PG16 suite passes 24 groups on 6,014 populated/sparse/edge
rows. It compares 52 scalar and five types full-output oracles, reader authority,
five private helper ACLs, clear/edit cases, all quarantine flags, source conflicts,
event-poster kind, gallery-only/base-photo roles, explicit owner override, bounded
payloads, empty results and replay refusal. It does not alter production.
The actual neutral-parameter SQL plan retains the unforced covering index-only
dedupe scan and bounded page before helpers. One local measurement increased
from 6.773ms to 17.190ms for the additional 24-row projection; this is not a
production latency or cold-cache guarantee. The already accepted global ranking
index and its independent production timeout evidence are unchanged.

120 relevant family/media unit tests pass, including restaurant, bakery,
hospitality, parish, artist, creator, professional, health, society and event
consumers. The controlled 18-case card/Quick look matrix passes at 390/1440px;
the final source-specific Yamas crop and blocked-logo fixture were repeated in
four additional cases. Original remote media loaded with recorded dimensions,
no per-card home_entity requests, and one home_entity only on Quick look. The
unchanged submitted/initial search intent fixtures pass: slow old responses,
draft typing, account retirement, keyboard destination, Retry and no stuck
skeleton states remain covered.

Eight candidate Signature/Parkview full-page clicks pass at both widths with
normal/reduced motion. Original native AbortError failures remain separately
retained. Their outgoing Explore transition existed but the incoming event
document lacked an opt-in and exposed no viewTransition. The owned event head
now opts in, respects reduced motion and loads the existing shared observer
early; global observer/error handling was not changed. This follows the
[Chrome cross-document transition requirement](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document)
that both documents opt in. The repeated normal cases now retain incoming
transition objects and zero pageerrors; reduced-motion cases retain none and
zero pageerrors. These are candidate-renderer journeys, not a live deployment.

Earlier logo badge anchoring/intrinsic-size failures were caught during visual
inspection and corrected before this freeze. Those early temporary screenshots
were overwritten, so they are described as diagnostics, not represented as
retained visual proof. The later canonical navigation failures are retained in
full, separately from passing runs.

Open scope: 171 imported-only source conflicts and the quarantined record need
individual source reconciliation. Source-bound HTML can still contain inaccurate
facts; this selector does not replace source review. Native/map/legacy JSON
readers do not receive this new logo/description contract unless they use the
changed scalar/types reader; their complete media journeys remain separate work.
The private SQL legacy-photo URL classifier is intentionally bounded and does
not claim to implement the entire browser URL parser or every encoded auxiliary
image path. Live authenticated owner edit → preview → publish and post-deployment
family journeys still require the lead's release gates. Signature's existing
cleared-hero renderer can retain its figure caption without an image; that minor
caption limitation is not called fixed here. No payment/provider or whole-site
completion claim is made.

The immutable manifest lists owned runtime/tests, exact imported baseline
dependencies, and retained source/render/journey evidence separately. Reproduce
from its snapshots before authorizing the lead's migration and deployment.
