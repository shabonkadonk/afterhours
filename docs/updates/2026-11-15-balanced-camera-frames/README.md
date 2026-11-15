# Camera frames scale with the group

## What changed

- A guest camera's frame allowance now follows the roll photo limit and current participant count. A 24-frame roll with six people gives each guest camera four frames.
- When someone joins later, the allowance recalculates for everyone. Already saved photos remain; a guest who has used more than the updated share cannot add another frame.
- The shared roll limit remains the final cap, including when the per-person allowance rounds up.

## Affected files

- `app/camera/[id]/page.tsx` displays the current share and uses it to show remaining frames.
- `lib/guest-camera-session.ts` contains the shared allowance calculation.
- `lib/supabase/rolls.ts` checks the current participant count before guest uploads.
- `supabase/migrations/20261115000000_roll_reveal_notifications.sql` enforces the same changing allowance in the database.
- `README.md`, `docs/supabase-setup.md`, and the disposable-camera update note describe the allocation behavior.

## Database and deployment steps

Apply `20261115000000_roll_reveal_notifications.sql` in filename order with the other Supabase migrations. If it has already been applied to a project, update the `track_roll_photo_count()` function with the version in that migration so its frame cap uses the current member count. No new environment variables or scheduled jobs are required for this adjustment.
