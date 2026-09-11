# Social Provider Setup

The Social Suite is ready to connect real Zoi and Buy Greek accounts. Provider apps must be registered before the Connect buttons can enable.

Callback URL for every provider:

`https://csebihpaychdkanjjsmz.supabase.co/functions/v1/social-oauth-callback`

Configure these Supabase Edge Function secrets. Never commit their values or paste them into chat.

| Platform | Secrets | Notes |
|---|---|---|
| Facebook / Instagram | `META_APP_ID`, `META_APP_SECRET` | Instagram must be Business/Creator and linked to a Facebook Page. |
| LinkedIn | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | Request the posting product/scopes. |
| X | `X_CLIENT_ID`, `X_CLIENT_SECRET` | Requires X OAuth 2 access and write scope. |
| TikTok | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | App review and video publishing approval are required. |
| YouTube | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth consent and YouTube upload verification are required. |

After adding secrets:

1. Open `/social` and sign in with the founder email.
2. Select the Zoi workspace and open **Accounts**.
3. Confirm the provider button changes from unavailable to **Connect**.
4. Connect the Zoi account and return from the provider.
5. Switch to the Buy Greek workspace and repeat.
6. Create a test draft, select one connected network, and publish only after reviewing its preview.

A provider can still fail after credentials are present if its app review, redirect URL, scopes, business-account link, or API plan is incomplete. The Accounts panel reports availability; the publish result reports the provider's actual response.
