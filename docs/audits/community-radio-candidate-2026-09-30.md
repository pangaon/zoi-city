# Official radio candidate

Separate, unmounted component pending Community integration after the current release freeze. No edits to the frozen `music.mjs` or floating-player module were made for this radio patch.

Sources checked30 September2026:
- https://www.ertecho.gr/radio/deftero/player/ explicitly supplies `https://radiostreaming.ert.gr/ert-deftero` in `data-player-source`.
- https://www.ertecho.gr/radio/kosmos/player/ explicitly supplies `https://radiostreaming.ert.gr/ert-kosmos`.
- https://www.ertecho.gr/radio/i-foni-tis-elladas/player/ explicitly supplies `https://radiostreaming.ert.gr/ert-voiceofgreece`.

Official station logos come from the same source pages. No guessed now-playing song, invented programme schedule or local rebroadcast is provided. Browsers request the broadcaster stream directly. These are technical source/playback observations, not a claim of a broadcasting partnership.

`mountRadio(container,{onChoose})` renders the three source-backed station cards and visible native audio controls; it returns `{stop,destroy,element}`. `onChoose` lets the host stop another player before radio begins. Station selection accepts only the exact reviewed IDs. Source URLs cannot be supplied by a caller. Audio has preload=none and no autoplay attribute; a user chooses Play. Actual playing/waiting/pause/error events drive status; Stop removes the source and releases the connection.

Acceptance: declared-bot official pages HTTP200; bounded512-byte stream probes; actual local browser Deftero playback reached readyState4, paused=false and currentTime10.78seconds, then was immediately stopped (srcnull, pausedtrue). No audible-output verification is claimed. At390/1440 there was no horizontal overflow. A clearly local injected play rejection showed the Retry/official-player fallback. Two unit tests cover strict station selection and truthful status mapping. Screenshot `/home/codespace/.agent-browser/tmp/screenshots/screenshot-1790748514882.png`.

Integration still required: mount within Community Music, mutual exclusion with Spotify, stop or keep controls visible when leaving the section, and optional reuse of the floating shell without hiding native audio controls. Do not claim this unmounted component is already available in production.

## Integrated candidate after music release65b743e

Radio is now mounted in `music.mjs`. Choosing a station closes the Spotify floating player before connecting. Selecting/opening a Spotify release stops radio and removes its source. Artist filters and queue/playlist edits retain the same radio component and audio element, preserving playback. Explicitly leaving Music stops radio so its playback controls do not become hidden. Shared player render code no longer contains the obsolete stopped-while-minimized text.

Actual integrated browser390 acceptance: opened Spotify, compacted it, then chose Deftero; Spotify iframe count became0. Deftero reached readyState4 with paused=false. Changing the featured artist retained the exact audio element, readyState4 and advancing currentTime. Adding a release to the queue likewise retained the same playing audio element. Selecting a Spotify release then removed the radio source, paused radio and opened exactly one Spotify iframe. Compact remained152px. At1440 integrated width=scrollWidth=1440; mobile width=scrollWidth=390. Screenshot integrated desktop `/home/codespace/.agent-browser/tmp/screenshots/screenshot-1790748781183.png`. Eight model tests pass (music, player positioning and radio); syntax checks pass. Root controls production release; no deployment performed by this task.
