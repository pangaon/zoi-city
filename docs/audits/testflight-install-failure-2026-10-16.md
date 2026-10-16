# Zoi TestFlight installation failure

Apple processed Zoi **2.0.0 (2)** and assigned it to the existing internal tester
group. The founder sees the build and received Apple's email, but installation
fails with **“The requested app is not available or doesn't exist.”** Closing and
reopening TestFlight, selecting the exact build and retrying produced the same
error. Successful installation is therefore **not verified**.

## Verified release identity

- App Store Connect app: `1464901778`; bundle: `com.usgreekscan.zoi`.
- Source: `6c2f013d3ffa3a1d39dda6922c433de39d3550d4`.
- EAS build: `d81a0a15-e973-4f81-a8c0-1d6f10c4728c`.
- EAS submission: `90aafd48-b06f-4d0f-bcb5-b904031338ed`, finished.
- Apple build: `cc743714-121b-4261-a2bb-9d167f19f9fb`, `VALID`, not expired,
  internal state `IN_BETA_TESTING`, assigned to the existing internal group.
- IPA: 13,438,346 bytes; SHA256
  `27a3f4ef03dd820baf641bbd071091de2bff9973f99dca706c8e44cd4a071115`.
- iPhone/iPad, ARM64, minimum iOS 16.4. No device registration restriction in the
  App Store provisioning profile. Artifact checks have not established a signing
  or architecture defect; no physical iPhone installation has been inspected.

The independently reviewed captured receipt is
[testflight-delivery.json](evidence/native-testflight-root-2026-10-16/testflight-delivery.json).
Its availability assertion describes Apple's control-plane state before the
founder's failed installation, and does not override that later customer result.

## Confirmed Apple restriction and restoration

The founder supplied the exact App Review thread for this app. Apple's December
15, 2022 App Store Improvement Notice explicitly states that TestFlight versions
will become unavailable for **external and internal testing** if the app is removed.
The March 16, 2023 follow-up confirms removal. This establishes the app-record
restriction behind the failed installation. An accepted binary and tester-group
assignment do not remove that restriction.

The supported next step is an updated app reviewed for restoration. The existing
app now has a **2.0.0** draft, ID `774d678e-096f-4177-b18c-2651401e500f`, with accepted
build2 attached and release type **MANUAL**. No review submission or public release
has occurred. Apple retains the restoration decision; approval of a manual draft
is not a guarantee of immediate TestFlight access before release.

The draft inherited 16 screenshots from2019, an old description, absent What's
New, an old4+ questionnaire and outdated content-rights declarations. Current
privacy disclosures, working support/privacy links, reviewer access and real iOS
captures must be completed before submission. New structured-service source work
is not part of the attached build2.

[App Review thread](https://appstoreconnect.apple.com/apps/1464901778/distribution/reviewsubmissions/threads/d026f227-f576-4ad1-8b99-fe09773ac63f).

## Account and credential evidence

Apple renewal mail confirms membership through April25,2027. Its October16,2026
00:23:43UTC message confirms the Developer Program agreement was signed for this
team. No missing agreement or expired membership was established.

During preparation, an unsafe SDK-model serialization exposed the previous ASC
credential in one private diagnostic file and tool output. It was absent from
source, commits, public applications and provider payloads. The file was sanitized;
outputs now use explicit primitive allowlists. The founder created replacement
key `FJKAQL22WZ` and revoked old key `2M5J4ZSHSU`, verified by their Team Keys screen.
Root verified the new key against this exact Apple app and replaced all three
shared Expo submission bindings. Signing certificates were unchanged. Expo refuses
deletion of the historical old key record; its Apple authority is revoked and no
current submission binding refers to it. No further delete retries are planned.
Private key contents remain outside Git in an ignored0700 directory/0600 file.

## Remaining external step

Complete the reviewable update and request Apple's review/restoration. Do not
upload speculative duplicate builds, recreate the app or remove testers to work
around this known restriction. No support message or external outreach was sent.
