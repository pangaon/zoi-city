# Toronto sponsor design demonstration

This is a test preview, not an approved sponsor list. No event affiliation, discount, service offer or payment relationship is asserted. Two actual public Toronto listings were selected by bounded read-only query; images were fetched from their matching official websites and visually inspected.

- Kolonaki Fine Foods & Beverages: listing `c12e76e0-e020-4ede-bcf3-b9068f611ddd`, public vendor slug `kolonaki-fine-foods-beverages-toronto`. Source https://kolonakifinefoods.ca/ describes Greek/Mediterranean foods and beverages. Exact883×240PNG logo in `sponsor-preview-model.mjs`; inspected business wordmark, not product/venue imagery.
- Theo Eye Care: listing `2d6eb99c-aace-4bb7-af46-50aa566b7f25`, public business slug `theo-eye-care-toronto`. Source https://theoeyecare.com/ lists658DanforthAve Suite204 and its eye-care identity. Exact255×125PNG logo inspected. No medical/license or event-sponsor endorsement is added.

`mountSponsorPreview({root,previewMode:true,eventKey,tableId,allowedTableIds,businessId?})` returns open({trigger}),close,setTable,destroy. Requires actual caller-supplied table allowlist and explicit preview flag. Remains labelled even when closed. Changes to table preserve selected business. Manual close/Escape restore exact triggering control. Uses in-context card, public Zoi profile link and secondary image-source link. No approval shape; automated tests prove it cannot qualify for real `activeLoungePlacements` rendering. No production writes.

Acceptance: actual images loaded883/255px in isolated browser;390nooverflow,Escapeclosed/exactfocus;1440alternate business works. Screens `.recovery/logs/sponsor-preview-390.png` and `sponsor-preview-1440.png`. Unit `tests/unit/sponsor-preview.test.mjs`.

Excluded finding: `d5d1c169-031f-4737-85da-2e72c76e8c39` VIP Billiards & Lounge has original billiardsacademy.ca website but current machine assets from zoomacademia.com. Needs a separate guarded source-identity investigation; not used here, no repair claimed. Acropolis Organics product images with ChatGPT filenames were also not used. This bounded8-row review is not a Toronto-wide quality signoff.
