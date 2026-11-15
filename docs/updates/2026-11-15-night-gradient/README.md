# Night gradient palette

## What changed

- Added a subtle red-to-blue ambient wash to the app background for a nighttime feel.
- Applied the gradient to primary actions, the homepage headline accent, and key brand marks.
- Added blue ambient light to the dashboard and active roll header; shifted the installed app’s active accents toward blue.
- Shifted the installed navigation active icon toward the blue end of the palette.

## Affected files

- `app/globals.css` defines the palette, ambient background, gradient text and brand mark styles, and primary button treatment.
- `app/page.tsx` applies the two-tone lighting to the homepage and highlights its camera mark.
- `app/dashboard/page.tsx` and `app/rolls/[id]/page.tsx` add restrained blue light to the roll hero panels.
- `components/site-header.tsx` uses the gradient brand mark in the browser header.

## Database and deployment steps

No database changes or deployment configuration are required.
