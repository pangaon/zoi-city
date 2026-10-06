# Accounts owner journey correction — 6 October 2026

Candidate only, based on b23f066 in isolated connect-owner-20261006. Owned runtime file: assets/suite/connect.js. No backend, provider configuration, OAuth dispatch, channel-add mutation or authorization changes.

The unavailable state now gives an honest planning alternative that scrolls to and focuses the real account-name field. Developer credential/callback instructions are removed from the owner UI. Contextual help is a native expandable details control. Responsive flex/grid containment removes the reproduced 390px overflow. Connected accounts remain visible; removal instructions point to the network’s connected-app settings without promising an unimplemented disconnect control.

Found and fixed a functional retry gap: Refresh previously refreshed channels only, despite provider-failure copy instructing Refresh. It now also checks provider availability using the existing capability loader; concurrent checks are fenced and stale actor responses cannot repaint. Initial supplied provider configuration remains respected; explicit retry fetches fresh availability. Actual provider/mutation interfaces unchanged.

Actual mounted controlled browser tests pass at 390/1440: no overflow/errors, planning action focus, unavailable Connect disabled, failed provider read then successful Refresh, connected account retained, no fabricated disconnect action, and logout clearing. Phone overview and focused planning form visually inspected. Evidence and frozen hash in adjacent evidence directory. These are controlled reads, not live OAuth acceptance; no real messages, account connections or writes occurred.
