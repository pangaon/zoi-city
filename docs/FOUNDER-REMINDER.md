# Founder Reminder: Zoi Go-Live

To: pangaon@gmail.com
Subject: Zoi and Buy Greek: what is live and what needs action

## Already live

- Zoi Business Suite sign-in and workspace selection
- Built-in Social starter templates for events, offers, namedays, community, reviews, video, and partnerships
- Composer previews, drafts, scheduling, per-network copy, alt text, and Orthodox calendar context
- Free Tickets reservations, QR tickets, attendee lists, exports, and Door mode
- Founder Command Center with directory metrics and system pulse
- Verified-site enrichment with robots and SSRF protection
- Automated enrichment scheduling
- Website source tracking, crawl dates, success counts, empty-site results, and crawl errors
- Secure OAuth authorization boundaries

## What needs founder action

1. Register provider apps for the social networks you want to use.
2. Add the provider credentials to Supabase Edge Function secrets.
3. Use this callback URL in every provider app:

   https://csebihpaychdkanjjsmz.supabase.co/functions/v1/social-oauth-callback

4. Open `/social` and connect the Zoi accounts.
5. Switch to the Buy Greek workspace and connect its accounts separately.
6. Create one test post, review every platform preview, and publish to one network first.
7. Add `RESEND_API_KEY` and `EMAIL_FROM` when email campaigns should send.
8. Add `ANTHROPIC_API_KEY` when AI drafting should be enabled.
9. Add Stripe secrets and complete webhook verification before enabling paid tickets.

## Current external status

Currently disabled in production:

- Facebook
- Instagram
- LinkedIn
- X
- TikTok
- YouTube
- Email sending
- AI generation
- Stripe payments

This is intentional. The system does not pretend a provider is connected when its app credentials are missing.

## Where to monitor the system

Open:

https://www.zoi.city/apps/command-center/

Sign in with `pangaon@gmail.com`. The System pulse shows website coverage,
verified websites, crawl queue, checks today, successes, failures, listing totals,
and pending review.

## Important safety rule

Never paste provider secrets into chat, email, source files, or Git. Add them only
through Supabase Edge Function secrets.
