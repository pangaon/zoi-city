# Toronto projected label origin correction — 2026-10-01

The retained category and furniture data were correct. The phone fullscreen number overlay was54px above the canvas after the two-row toolbar release: `.fc-markers` retained64px top offset while canvas padding became118px. Consequently58/57/56 appeared over pink lounge footprints even though their corresponding meshes remained yellow. This supersedes the perspective-only hypothesis in the earlier label-source audit.

## Bounded correction

`assets/events/signature/furnished-concert.mjs` now aligns the label layer origin and dimensions with the actual canvas relative to its containing block each projection update. Four added runtime lines; no source/category/furniture/geometry/artwork changes. Montréal code unchanged. No additional leader lines were necessary after correcting the coordinate space; selected58 visibly sits on its yellow physical table and the existing floor highlight remains.

Runtime SHA256 `216f6c83e38f40c2ac55cb563c5d9fd34db499f5bb8ffc312682b3a03f37fb28`.

## Before and after

`tests/browser/paired-room-association/verify.cjs` runs actual local renderers, with the exact retained Montréal plan because its live canonical page currently returns503. Before artifacts: `/tmp/paired-room-association-before/`; after: `/tmp/paired-room-association-after/`; unchanged Montréal: `/tmp/paired-room-association-montreal/`.

Toronto390 before: inline0px, fullscreen−54px, selected58−54px, resized inline0px. After: every measured state0px. Toronto1440 inline/fullscreen/selected/resized remain0px. Final fixture additionally checks fullscreen orientation/resize before exiting. Source table58 is selected through the real finder; seated/overview/fullscreen exit still work. Both selected58 phone and desktop before/after screenshots inspected. Phone yellow-number-to-yellow-footprint association is now clear; no pink lounge recolouring occurred.

Four initial Toronto/Montréal journeys pass. Root independently ran four paired journeys and visually accepted selected58 after correction.28 relevant unit tests pass. Final Toronto fullscreen-orientation extension run retained separately in `/tmp/paired-room-association-after.log`.

No broad guarantee for arbitrary orbit angles, simultaneous readability of every number, certified venue dimensions, available ticket inventory or live Montréal route acceptance. Deliberate overview decluttering remains; all source IDs are accessible through Find table.
