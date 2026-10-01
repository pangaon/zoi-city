`node tests/browser/suite-organizations-privacy/verify.cjs`

Actual Social shell + Programs & volunteers wrapper/core with controlled RPCs,390/1440. Tests authoritative403 private roster removal, positive program save/versionreceipt/refreshedlist, heldroster/accountswitch, unresolvedactor failures. Public signup backend is not called or rewritten. OUTPUT_DIR and CHROMIUM_EXECUTABLE_PATH configurable.

Also holds explicit session refresh before a save and changes mounted workspace context or detaches the surface; no private mutation may be sent afterward. The workspace case instruments the wrapper to expose the actual mounted context, not the workspace picker. Fourteen cases total.
False refresh additionally must clear the private editor and send no save RPC. Sixteen cases total.
