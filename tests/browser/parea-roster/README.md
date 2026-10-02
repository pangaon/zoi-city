# Parea roster journey

Run `node tests/browser/parea-roster/verify.cjs` from the repository. Optional `CHROMIUM_EXECUTABLE_PATH` and `QA_OUTPUT_DIR` override browser/output. The harness serves repository assets locally and blocks every external request. It mounts the real host, workspace contact picker, invitation sharing and guest payment modules with controlled responses shaped to the existing host/payment/Operations contracts. No production requests or sends occur.

At 390 and 1440: configured inventory changes quota min/max/default; an authorized Operations contact populates the new planner; quantities 3/2/1 are reviewed before writes; the second write deliberately commits and loses its response; the remaining queue stops; receipt recovery does not duplicate the recipient; the final recipient is saved after a new explicit review. Each recipient has their own private link. The selected recipient accepts exactly two tickets in a remounted guest session and chooses the organizer-enabled pay-at-door option, remaining unpaid.

Additional cases at both widths cover held authentication refresh then account change, ancestor removal, or same-account route scope change (zero writes), current quota reduction (zero writes), and reload after an ambiguous first save. Reload recovers only the existing request: unsaved names and secrets are not restored, and replacement-link controls remain available for the confirmed guest. Existing host draft acceptance is run separately.

Screenshots capture the actual saved roster at both widths. These prove UI/contract behavior, not production organizer setup, deployed payment policy, payment collection, real message delivery or native implementation.
