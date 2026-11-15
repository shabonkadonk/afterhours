# Deployment readiness fixes

## What changed

- Fixed the ceremony push call so it passes the Supabase admin client to the shared push sender.
- Updated test mocks for server-only dependencies and the new host ceremony RPCs.
- Escaped the capture page's apostrophe so the project lint check passes.
- Added an API regression check that guests cannot start the ceremony and the host can.

## Affected files

- `lib/web-push.ts` fixes the ceremony notification call.
- `app/capture/[id]/page.tsx` fixes the lint issue.
- `tests/awards.test.cjs` mocks server dependencies and verifies host-only ceremony start.
- `tests/guest-rolls.test.cjs` mocks push delivery for route tests.

## Database and deployment steps

- Apply `supabase/migrations/20261115000001_host_awards_ceremony.sql` after the existing migrations.
- Configure Supabase and VAPID environment variables in the deployment environment. No deployment was performed as part of this update.
