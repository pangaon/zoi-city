Run `node tests/browser/suite-documents-privacy/verify.cjs`. OUTPUT_DIR and CHROMIUM_EXECUTABLE_PATH are configurable.

Actual Social shell and Documents wrapper/operator/client run with synthetic authenticated workspace/project RPCs. All external requests intercepted. Controlled cases at390/1440: held auth refresh then account switch; sameaccount upload receipt, versionhistory and downloaded attachment;403denial clears private UI; unresolvedactor/token-only denies private reads. No real provider or file writes.

This verifies client privacy and ordinary document flow, not legal review, signing, malware scanning, government filing, or live database recovery.
