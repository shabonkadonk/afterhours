# Host led Awards release

## What changed

- Awards generation is reserved for the roll host.
- The host can inspect completed results privately, then start the shared ceremony to release them to roll members.
- Roll members cannot read saved award results until the ceremony has started. The start action is host-only and idempotent.
- Awards state now includes the ceremony start time so the app can coordinate the release.

## Affected files

- `README.md` summarizes the host-led Awards flow.
- `docs/afterhours-awards.md` documents generation permissions, release behavior, and migration order.
- `supabase/migrations/20261115000001_host_awards_ceremony.sql` adds the ceremony timestamp and updates access policies and RPC permissions.

## Database and deployment steps

Apply `supabase/migrations/20261115000001_host_awards_ceremony.sql` after the Awards migration. No new environment variables are required. Deploy the application after the migration so its Awards API can use the new database functions.
