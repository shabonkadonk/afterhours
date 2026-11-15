# Disposable guest cameras

## What changed

- Invitees claim a roll-specific disposable camera after opening an invite. Each guest's frame allowance is calculated from the roll limit and current participant count; hosts retain the full app and are not subject to the guest frame cap.
- Guests return to that camera when they reopen the installed app, and the route moves to the shared gallery after reveal.
- Guests can enable push from their anonymous session. Subscribed members receive randomized copy for a reminder about five minutes before the roll opens and for the reveal alert.
- A minute-level lifecycle endpoint reveals due rolls and sends both scheduled alerts. Invite joins, push subscription storage, and shared gallery access continue to use Supabase.

## Affected files

- `app/camera/[id]/page.tsx`, `app/join/page.tsx`, and `app/install/install-page-client.tsx` — guest camera and invite claim flow.
- `components/installed-app-shell.tsx`, `components/site-header.tsx`, `components/notification-settings.tsx`, and `app/globals.css` — guest routing, navigation, and notification opt-in.
- `app/api/invitations/[token]/route.ts`, `app/api/push/subscriptions/route.ts`, and `app/api/cron/roll-lifecycle/route.ts` — returning members, anonymous subscriptions, and scheduled lifecycle processing.
- `lib/guest-camera-session.ts`, `lib/supabase/rolls.ts`, and `lib/web-push.ts` — persistent invite routing, guest frame enforcement, and notification copy.
- `supabase/migrations/20261115000000_roll_reveal_notifications.sql` — guest frame counters and atomic lifecycle claims.
- `README.md`, `docs/supabase-setup.md`, `docs/vercel-deployment.md`, and `.env.example` — setup and operational guidance.

## Database and deployment steps

1. Apply `20261115000000_roll_reveal_notifications.sql` after the earlier migrations.
2. Configure Web Push VAPID values and `CRON_SECRET` in the production environment.
3. Configure a minute-level scheduler for `/api/cron/roll-lifecycle` using Supabase Cron, or Vercel Pro/Enterprise. The route is intentionally not added to `vercel.json` because a per-minute Vercel cron would make Hobby deployments fail.
4. On iPhone, install Afterhours to the Home Screen before enabling guest push notifications.
