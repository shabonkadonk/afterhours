# Afterhours

Afterhours is a shared camera roll for nights out. A host creates a roll and invites friends to contribute photos. The photos stay private until the reveal, when everyone can browse and save the collection together.

## Features

- Create rolls with a title, end time, photo limit, and visual theme.
- Invite contributors with a link, QR code, or join code. Guests can join with an anonymous browser session.
- Upload photos with captions and camera inspired edits.
- Keep photos private in Supabase Storage until the roll is revealed.
- Browse revealed galleries by contributor or timeline, filter contributors, download individual photos, or export the full roll.
- Retain cloud rolls for 30 days after reveal, with a 7 day renewal window for the host before scheduled deletion.
- Try demo mode without a backend. Demo rolls are stored only in the current browser and are not shared.
- Preview Afterhours Awards on revealed rolls. Sample mode is enabled by default; live processing remains disabled until provider, privacy, license, and age requirements have been confirmed.
- Install the site on iPhone or Android as a Progressive Web App, with app-style navigation and a simple offline screen.
- Keep the app portrait-oriented where the installed browser supports orientation locking. Some iPhone versions may still allow rotation; the app shows a portrait prompt in landscape.

## Technology

- Next.js 15 App Router and React 19
- Supabase Auth, Postgres, and private Storage
- Tailwind CSS 4
- fal.ai and other configured image providers for photo editing

## Run locally

### Requirements

- Node.js 20 or later
- npm

Install dependencies:

```bash
npm install
```

Copy `.env.example` to `.env.local`, then fill in the values for the services you want to use. The app can run in demo mode without Supabase credentials.

```dotenv
FAL_KEY=your_fal_api_key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_publishable_or_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_server_only_secret_key
CRON_SECRET=your_generated_random_secret
```

`FAL_KEY` enables photo editing; create one in the [fal.ai dashboard](https://fal.ai/dashboard/keys). Supabase is needed for accounts, guest sessions, shared rolls, and cloud photo storage. The Supabase secret key is used only by server routes for invitation lookups and expiry cleanup. `CRON_SECRET` authorizes the scheduled cleanup endpoint.

Keep `.env.local` private. Never put a Supabase secret key in a `NEXT_PUBLIC_` variable or commit real credentials. Generate a cron secret locally with PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use the same generated value for `CRON_SECRET` in local configuration and Vercel.

### Supabase setup

1. Create a Supabase project. In **Project Settings → API Keys**, copy the project URL and publishable key. Put these in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. In **Authentication → Sign In / Providers**, enable Email for hosts and **Anonymous Sign-Ins** for guests. Enable Google if you want Google host sign-in.
3. In **Authentication → URL Configuration**, set the local Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` to the redirect URLs. If Next.js chooses another port, use that port instead.
4. Apply every SQL migration in [`supabase/migrations`](supabase/migrations) in filename order, using the Supabase SQL Editor or the Supabase CLI. Migrations are incremental; do not skip earlier files on a new project.
5. Restart the development server after changing `.env.local`.

The current Supabase dashboard may label the privileged key **Secret key** (`sb_secret_...`); older projects may show the legacy `service_role` key. Put that server-only key in `SUPABASE_SERVICE_ROLE_KEY`; the variable name is retained for this project's server configuration. Do not use the publishable key in its place.

### Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To test from a phone on the same Wi-Fi, start Next.js on the network interface:

```bash
npm run dev -- --hostname 0.0.0.0
```

Then open `http://<your-computer-ip>:3000` on the phone. The `/install` page explains how to add Afterhours to the Home Screen. iPhone installation is done from Safari's Share menu with **Add to Home Screen**. PWA installation and service worker features generally require HTTPS; localhost is treated as secure for development, but a local network IP may not be. The service worker is registered only in production and only inside the installed app.

The offline screen is a fallback when a navigation request cannot reach the server. It does not cache roll data or photos; private content needs an internet connection. Orientation locking is best-effort because support varies by browser and device.

## Main routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page |
| `/dashboard` | Rolls and past galleries |
| `/rolls/new` | Create a roll |
| `/join` | Join with a code |
| `/join/[token]` | Preview and join from an invitation |
| `/rolls/[id]` | Roll details and contribution entry |
| `/capture/[id]` | Add photos |
| `/rolls/[id]/reveal` | Revealed gallery |
| `/login` | Sign in or create an account |
| `/account` | Account settings |
| `/install` | PWA installation instructions |

Installed-app navigation provides quick links to Home, Create, Join, and Profile when those destinations apply to the signed-in user. In the app shell, the main content area is separated from the fixed top and bottom navigation. Some creation and capture steps use a compact viewport layout; other content can scroll when it needs more room.

Awards behavior and provider configuration are documented in [`docs/afterhours-awards.md`](docs/afterhours-awards.md).

## Commands

```bash
npm run dev        # Start the development server
npm run build      # Create a production build
npm run start      # Serve the production build
npm run typecheck  # Check TypeScript types
npm run lint       # Run ESLint
npm test           # Run the test suite
```

## Deploy to Vercel

Import the repository into Vercel and configure the needed environment variables under **Project → Settings → Environment Variables**:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `CRON_SECRET`
- `FAL_KEY` if photo editing is needed
- Any optional Awards variables listed in `.env.example`

The included [`vercel.json`](vercel.json) schedules `/api/cron/expire-rolls` daily. Set `CRON_SECRET` in Vercel so the scheduled route can authenticate, then redeploy after changing environment variables. Follow [`docs/vercel-deployment.md`](docs/vercel-deployment.md) and [`docs/supabase-setup.md`](docs/supabase-setup.md) for deployment details.

Expiry reminders are shown to the host in the app; email reminders are not configured. Live database behavior and scheduled cleanup require a correctly configured Supabase project and Vercel deployment.

## Revealed rolls and downloads

After a roll is revealed, contributors can browse the gallery, view photos by contributor or in chronological order, and download individual images. The gallery also offers a **Save Entire Roll** export. On browsers that support the Web Share API and file sharing, the app can open the native share sheet; otherwise use the available download option. Bulk saving behavior varies across browsers, and iPhone Safari may require saving or sharing files through its own interface. Keep a connection while viewing or exporting a cloud roll.

Afterhours Awards can show a sample ceremony without sending photos to an AI provider. Live processing is off by default. Review [`docs/afterhours-awards.md`](docs/afterhours-awards.md) and the live-processing gates before enabling a provider.

## Privacy and credentials

`.env.local` is ignored by Git. Commit `.env.example` with placeholder values only. Before committing, check that no credentials or private photos are staged. If a credential is exposed, rotate it with its provider. Private photos and account data are not cached for offline use.
