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
- Install the site on iPhone or Android as a Progressive Web App.

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

The Supabase secret key (`sb_secret_...`) is the current server-only key format. Keep it in `SUPABASE_SERVICE_ROLE_KEY`; the variable name is retained for this project's server configuration.

### Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To test from a phone on the same Wi-Fi, start Next.js on the network interface:

```bash
npm run dev -- --hostname 0.0.0.0
```

Then open `http://<your-computer-ip>:3000` on the phone. The `/install` page explains how to add Afterhours to the Home Screen. PWA installation generally requires HTTPS; local network IPs may not meet that requirement.

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

## Privacy and credentials

`.env.local` is ignored by Git. Commit `.env.example` with placeholder values only. Before committing, check that no credentials or private photos are staged. If a credential is exposed, rotate it with its provider. Private photos and account data are not cached for offline use.
