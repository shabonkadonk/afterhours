# Guest full-screen camera

## What changed

- First-time guests are asked for camera access, then offered push notifications, before the live camera opens. Guests can skip notifications and open them later from the camera screen.
- The camera fills the screen. Its shutter sits at the bottom in portrait and at the right edge in landscape; filter looks apply to the saved image and preview.
- The camera view does not lock portrait or restart the camera stream when the device rotates, which avoids app-driven zoom jumps during orientation changes.
- The flash control requests the active camera's browser torch when available. Web camera APIs do not expose a physical flash on every browser and device, so the control reports when that camera does not provide one.

## Affected files

- `app/camera/[id]/page.tsx` implements camera and notification setup, the full-screen viewfinder, shutter, filter selection, torch attempt, and save flow.
- `components/notification-settings.tsx` adds the optional notification setup step.
- `components/installed-app-shell.tsx` allows the guest camera route to rotate instead of locking the app portrait.
- `app/globals.css` styles the full-screen controls, orientation layouts, and camera-safe viewport.
- `lib/guest-camera-session.ts` remembers that the first-use camera setup was completed.

## Database and deployment steps

No database migration is needed. Configure the existing Web Push VAPID keys and push subscription route for notification opt-in. Physical flash behavior depends on browser and camera support; test it on the target phones before promising it as a universal feature.
