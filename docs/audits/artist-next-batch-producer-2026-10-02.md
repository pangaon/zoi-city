# Next official artist batch — producer evidence,2026-10-02

The batch supplies17 individually documented source matches and16 guarded mutation candidates. Stavento stays blocked for two different valid Spotify IDs. No production writes or commits were made.

The read-only inventory contains999 artist records,949 public eligible records,487 public records without a website,62 source-bearing records without machine enrichment, and16 generic inherited Spotify roots. These counts are the inventory snapshot, not completed coverage. The selected batch is16 unique Latin roster matches plus the exact Greek Giorgos Tsalikis match; no show-specific hardcoding.

Source evidence is retained per record:17 substantive primary bodies,16 original decoded and visually inspected portraits,11 pages with usable biography facts. The16 guarded candidates contain15 portraits and10 biographies; six empty-biography pages remain sparse. Akylas has only a favicon and therefore no portrait. Its pre-existing Wikipedia source_url remains unchanged; only official website assignment is proposed.

The source fetcher obeys robots, public DNS guards, same-host redirect restrictions and request/byte/time limits. Initial portrait capture exhausted its9MB budget at VLOSPA; only the two uncaptured rows were recovered in a separate bounded run, preserving the failure and both logs. No challenge shell has been accepted.

Shared gaps: missing official source assignment prevents the ordinary extractor from finding these records; automatic news/navigation images are unsuitable for artist photography; valid inherited provider IDs intentionally retain precedence and require identity reconciliation when conflicting. The already accepted generic-provider correction is not modified by this batch. No runtime changes are included.

The builder uses exact retained public rows and the actual existing writer contracts. Every candidate locks one record, rechecks all eight function definitions and entire row MD5, refuses ownership/source/content drift, uses the genuine existing lease then enrichment writer, verifies complete source metadata and protected fields, and defaults toROLLBACK. Isolated PostgreSQL16 executed82 checks across16 candidates; production listing triggers were not recreated, so a real fresh dry run remains mandatory.

Reproduction from the frozen snapshot:

```sh
node ops/build-next-artist-publisher-proposals.mjs
ZOI_ARTIST_PGPORT=15549 node ops/verify-next-artist-proposals-pg.mjs
```

The first command is a local evidence generator; rerunning it makes a new timestamped manifest that needs a new review. The PG command uses only retained local records/functions and stops/removes its private database. Do not execute candidate SQL in production from this local result alone.

|Artist|Source|Portrait|Biography|Mutation candidate|
|---|---|---|---|---|
|Akylas|matched|absent|bounded facts|independent review pending|
|Antigoni|matched|original reviewed|bounded facts|independent review pending|
|Bloody Hawk|matched|original reviewed|absent|independent review pending|
|Bossikan|matched|original reviewed|bounded facts|independent review pending|
|Claydee|matched|original reviewed|absent|independent review pending|
|Evangelia|matched|original reviewed|bounded facts|independent review pending|
|FLY LO|matched|original reviewed|bounded facts|independent review pending|
|HGEMONA$|matched|original reviewed|bounded facts|independent review pending|
|iLLEOo|matched|original reviewed|absent|independent review pending|
|Light|matched|original reviewed|bounded facts|independent review pending|
|Prestige The Band|matched|original reviewed|bounded facts|independent review pending|
|Slogan|matched|original reviewed|absent|independent review pending|
|Stavento|matched|original reviewed|bounded facts|blocked provider IDs|
|Thug Slime|matched|original reviewed|absent|independent review pending|
|Toquel|matched|original reviewed|bounded facts|independent review pending|
|VLOSPA|matched|original reviewed|bounded facts|independent review pending|
|Giorgos Tsalikis|matched|original reviewed|absent|independent review pending|

Each individual report is in`individual-reports/`. Packet/source/prior-row/image/SQL hashes are in`packets/manifest.json`; exact row text retains numeric scales for whole-row guards. Independent review must verify all source facts/photos and rerun actual writer/defaultROLLBACK cases on a separate port. Then the lead performs production dry run, explicit bounded apply and public projection readback. Guest checks must cover source credit, exact player artist ID, gallery loading/close, sparse cases, four designs and390/1440 widths; provider playback and native/device behavior remain separate gates.

No public profile, database row or runtime is declared complete or live by this artifact.
