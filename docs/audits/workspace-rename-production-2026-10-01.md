# Workspace rename authority — production schema verification

Applied once through the production migration API after independent and lead isolated PostgreSQL checks (nine each). The live prior setter authorized every workspace member through assert_ws. The deployed setter retains the boolean contract and legacy creator/profile-owner authority, and restricts membership-based rename to owner/admin.

Readback confirms SECURITY DEFINER with empty search_path, anonymous execution denied, authenticated execution granted with explicit actor/ownership checks. Security advisor snapshots captured before/after; this is not a whole-project security acceptance. No customer workspace names were changed during verification.

Legacy creator/profile-owner authority remains independent of membership; ownership transfer must clear those fields appropriately. Current zoi_me only exposes memberships, so membership-less legacy owners still need navigation repair. Web/native candidate release and real authenticated production UI mutation are separate evidence.
