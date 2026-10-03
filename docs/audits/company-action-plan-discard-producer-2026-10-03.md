# Company Action Plans: partial saved-work discard guard

This is a bounded additive derivative of immutable producer manifest 6060b4c0f888b901e4e1d8ee437a4866fb6331d56cdefaec88643c7832a81d37. The original snapshot remains unchanged.

The actual parent social workspace checks hasUnsavedChanges before navigation, but the action-plan Open saved work callback cleared state.dirty before calling navigate. Consequently, the parent could not see the remaining private plan draft. The callback now invokes the same existing confirmDiscard guard used by Back to company before clearing state.dirty. This is the only runtime byte change. Fully saved plans already clear their dirty state and do not prompt.

Two actual browser cases at 390 and 1440 exercise a middle committed response loss, receipt check and a confirmed project with two of four actions saved. Dismissing the discard dialog leaves the two remaining draft actions and saved records intact. Confirming opens the single saved project with its two existing tasks and makes zero additional writes; there is one prompt per click. A second fully saved project/action then opens without a discard prompt. The ordinary fixture navigator has no discard guard of its own, so the proof specifically exercises the Operations callback. The actual parent check was read from social/index.html and is bypassed only after the operator confirms this callback's guard.

Both cases and all 55 Company/Operations units pass. Screenshots retain the partial state after dismissal and the ordinary saved project after confirmation; the phone retained state was visually inspected. No writer, receipt, schema, contact payload, role policy, Company model, CSS, native source or source packet changed. No production writes or deployment occurred.

Reproduce from a reviewer-owned copy of the derivative snapshot:

```sh
COMPANY_PLAN_DISCARD_EVIDENCE=/absolute/reviewer/output node tests/browser/company-action-plan/partial-discard.cjs
node --test tests/unit/operations*.test.mjs tests/unit/company*.test.mjs
```

The manifest records original and derivative Operations SHA hashes and a checked exact reverse replacement. All original dependency bytes are inherited unchanged from the immutable base snapshot. Independent review and root cache/release integration remain pending.
