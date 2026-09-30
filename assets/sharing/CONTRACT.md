# Poster share composer

`mountPosterComposer({root,event:{title,url,poster},onClose})` from `poster-composer.mjs` returns `{destroy}`. It loads its scoped CSS. Mount inside a user-opened share dialog/panel, not automatically on page load: mounting loads the actual poster and attempts a CORS-safe raster download to prepare a native file share. The caller owns dialog focus restoration and dismissal.

`url` must be an actual public Zoi event/business/artist/organization/venue canonical link. All query and fragment data are removed before any sharing action. Never pass guest names/table allocation/private plan text as title or caption defaults. Poster may be a same-origin path or authorized public HTTPS image; no fabricated poster. Browser validates MIME and image signature, max12MiB. Remote fetch refusal leaves link sharing usable.

Editable500-character caption,3presets, native share when supported, native file share only when canShare(files) accepts the preloaded file. Otherwise shares publiclink; no auto posts. Native abort says cancelled; resolved promise only says share sheet closed, not message delivered. Email/SMS/WhatsApp links open drafts without automatic image attachments. Copy/download have explicit actions and recoverable errors. No analytics or server writes.

Tests `tests/unit/poster-sharing.test.mjs`; isolated browser fixture `.qa-image/poster-share.html` mocks navigator.share/clipboard only. Actual poster fetched same-origin. OS sharing support requires device acceptance, not proven by mocked browser.
