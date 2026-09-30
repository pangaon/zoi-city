# Concert room selection and theater integration

The old SVG scene made its numbered badge interactive, while furniture polygons
were ordinary drawing elements. Clicking furniture outside its number therefore
entered the background orbit handler instead of selecting that table. The new
furnished scene (implemented and reviewed separately) raycasts furniture groups
and their labels and reports their original source table IDs.

`venue-experience.mjs` now mounts that scene by default using its existing scene
interface. Published-plan and clear-diagram tabs remain available. Repeated
selection of an already selected ID leaves the inspector nodes intact and does
not call the scene selection or camera methods again. Selection and adding a
preference remain distinct; no hold or availability is synthesized.

Full-screen room mode uses a fixed viewport CSS mode rather than requiring the
browser Fullscreen API. It records/restores body overflow and prior inert states
of background ancestor siblings. Escape, Tab wrapping, explicit exit and destroy
are handled; exit restores the original focus target when still connected.
Root owns the corresponding responsive CSS; the furnished scene owns camera
and raycasting behavior.

Actual local browser checks: Table30 selected through the picker synchronizes
scene and inspector, repeating the same choice preserves the exact inspector
node, and preferences remain empty until explicitly added. Theater entry sets
body overflow hidden and the background hero inert; Escape restores both. The
15 focused existing startup/bridge/venue tests passed. Independent QA covers
mobile, pointer/raycast and camera behavior separately. No production mutation.

Fullscreen CSS acceptance: actual local390×844 root fills exactly0,0,390,844;
canvas387.8px high ends549.8 and separately scrollable inspector begins558.8,
so they do not overlap. At1440×900 the canvas is1102px wide and inspector300px;
no horizontal page overflow. Screenshots `signature-theater-390.png` and
`signature-theater-1440.png` under `.recovery/logs`. Furnished scene stylesheet
is included in the document head before startup. Root was not yet deployed.
