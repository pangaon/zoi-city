// Identity-matched provider media reviewed against official artist/label sources.
// These are defaults only: explicit profile/owner edits and clears win.
const MEDIA={
  "98a3cc20-0369-469a-b885-9e1d6f070f92": {
    "names": [
      "giannis ploutarhos",
      "giannis ploutarchos",
      "γιάννης πλούταρχος"
    ],
    "portrait": "https://image-cdn-ak.spotifycdn.com/image/ab67616100005174ed63c4552ca0d7a8fd795f16",
    "spotify": "https://open.spotify.com/artist/152y903Cqyk9GVl6amOtuD",
    "video": "https://www.youtube.com/watch?v=Toth_4OkO5U",
    "checked_at": "2026-09-30"
  },
  "6c125478-7978-4168-b405-625cfa29c22c": {
    "names": [
      "andromache",
      "ανδρομάχη"
    ],
    "portrait": "https://image-cdn-fa.spotifycdn.com/image/ab676161000051745fe227ead9bc0bcc338a02d4",
    "spotify": "https://open.spotify.com/artist/0dn2Cwr75Rl4bh7yTwTorv",
    "video": "https://www.youtube.com/watch?v=pXkjKtg7tTs",
    "checked_at": "2026-09-30"
  }
};
export function reviewedArtistMedia(entity){const row=MEDIA[entity?.id];return row&&row.names.includes(String(entity.name||" ").trim().toLowerCase())?row:null;}
