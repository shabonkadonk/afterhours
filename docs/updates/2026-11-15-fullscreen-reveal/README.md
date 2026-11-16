# Full-screen roll reveal

## User-visible changes

- Revealed rolls open directly to the photos on mobile, with the first image filling the screen.
- Added floating photo controls, a glass-style section switcher, casual labels, and soft entrance and photo transitions.
- Expanded the desktop opener into a full-viewport photo hero with an informal headline and a direct link to the gallery.
- Kept the roll information, downloads, retention details, crew, and host-led awards available in the reveal sections.
- Respects reduced-motion settings.

## Affected files

- `app/rolls/[id]/reveal/page.tsx`
- `app/globals.css`

## Database and deployment

- No database migration or new environment variable is required.
- Deploy the application code and CSS together.
