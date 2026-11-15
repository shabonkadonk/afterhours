# Shared reveal ceremony and camera polish

## What changed

- Guest Y2K and disposable captures now show a horizontal amber date imprint. The guest camera and permission screens have smoother entrances, filter changes, shutter feedback, and a short photo-develop effect.
- The revealed roll starts with a larger, photo-led hero and a direct reveal action. Awards open in a much larger ceremony view, and each winner arrives with a short transition.
- Only the roll host can generate shared Awards. The host can start the ceremony once, which reveals the saved results to members and sends a push notification to opted-in guests. Guests already viewing the roll open into the ceremony automatically.
- Cloud uploads keep more resolution and JPEG detail. The large mobile cover and photo stage load the original image instead of the small gallery thumbnail.
- The red-to-blue palette is darker and more muted.

## Affected files

- `app/camera/[id]/page.tsx` adds guest date imprints, higher quality processing, and shutter feedback.
- `app/capture/[id]/page.tsx` enables disposable date imprints and raises cloud upload quality.
- `lib/photo-processing.ts` draws the amber stamp and preserves JPEG quality longer before resizing.
- `app/rolls/[id]/reveal/page.tsx` adds the cinematic reveal hero, full resolution photo views, mobile launch action, and shared ceremony visibility.
- `components/awards/awards-section.tsx` adds the host ceremony launch and guest waiting state.
- `app/api/rolls/[id]/awards/route.ts` enforces host generation and releases the ceremony to members.
- `lib/web-push.ts` sends a randomized ceremony notification to subscribed guests.
- `app/globals.css`, `app/page.tsx`, `app/dashboard/page.tsx`, and `app/rolls/[id]/page.tsx` deepen the gradient and add camera/reveal motion.
- `supabase/migrations/20261115000001_host_awards_ceremony.sql` stores the ceremony start and protects saved awards until release.

## Database and deployment steps

Apply the new Supabase migration before using shared Awards. Push notifications require the existing Web Push VAPID environment variables; without them, the in-app ceremony still activates and guests who have the gallery open will see it on refresh.
