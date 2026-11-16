# Guest camera controls and quality

## What changed

- The guest camera no longer has an in-camera back link, and browser or device back gestures keep guests on the active camera until the roll ends.
- Guests can switch between rear and front cameras. The front camera preview is mirrored for a natural selfie view.
- Landscape date imprints are smaller and positioned clear of the camera controls.
- If a guest returns to a deleted or unavailable roll, the screen offers to remove that camera from this device and open another invite.
- Guest captures request higher camera resolution and retain more JPEG detail before upload.

## Affected files

- `app/camera/[id]/page.tsx` changes camera navigation, facing controls, capture resolution, and the unavailable-roll screen.
- `app/globals.css` mirrors the front preview and reduces the landscape imprint size.
- `lib/guest-camera-session.ts` clears the deleted roll from saved guest camera references.
- `lib/supabase/rolls.ts` accepts guest capture uploads up to 10 MB.
- `supabase/migrations/20261115000002_guest_camera_quality.sql` raises the private photo bucket limit to 10 MB.
- `README.md` describes guest front and rear camera controls.

## Database and deployment steps

Apply `supabase/migrations/20261115000002_guest_camera_quality.sql` after the earlier migrations, then deploy the application. No new environment variables are required.
