# Rating icons excluded from machine photography

## Verified defect and source

Independent production QA found Tasty Greek Corner gallery photographs 2/3 were `/imgs/star.png` and `/imgs/star_half.png`. A fresh public HTML read confirmed both URLs remained projected. Both exact assets were fetched from `https://www.tastygreekcorner.co.uk/`; they are 27×24 PNGs. Visual inspection confirms a full green rating star and half green rating star, not food or venue photographs. The current homepage HTML did not contain those filenames, so no claim is made that the present homepage itself supplied them. Stored source history is preserved.

## Shared correction

Changed only `supabase/functions/zoi-enrich/_image-context.js` and `tests/unit/image-context.test.mjs`, plus this audit. Exact reviewed source-host/path rules reject these two machine assets, including cache query strings. Other hosts require an exact star-icon basename plus explicit rating-widget path or rating-icon hint; an ordinary `star.png`, Star Hotel room photograph, or star-shaped pastry photograph remains eligible.

Existing source extraction and `profileMedia` both consume this shared classifier. Fresh crawls exclude these icons and public galleries exclude already stored machine results without deleting evidence. No renderer-specific or listing-ID bypass was added. Explicit owner-selected images still win, and owner clears still suppress imagery.

## Verification and release boundary

43 focused image-context, extractor, profile-media, restaurant-renderer and packaging tests passed. Coverage includes exact source assets, generic rating-widget context, Star Hotel/food negatives, source extraction, retained machine evidence, explicit owner gallery and clears, actual restaurant HTML/photo list, and a sparse icon-only gallery. Local rendering produces the genuine gyro photograph alone; icon-only sparse input produces no invented photo.

No database write, worker deployment or production release performed by this specialist. Public rendering needs the shared API classifier release; fresh extraction needs the corresponding worker bundle release. Production gallery interaction remains to be checked after that release. Independent production discovery evidence is in `social-commerce-production-3a6f520-2026-09-30.md`.
