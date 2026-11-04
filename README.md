# Afterhours

Afterhours is a shared camera roll for nights out. Create a private roll, invite friends to add photos while the night is happening, then open the complete gallery together afterward.

## What it includes

- Create rolls with a title, end time, photo limit, and visual theme.
- Invite friends with a roll code.
- Add multiple photos with captions and camera-inspired edits.
- Keep shared photos private in Supabase Storage until the roll is revealed.
- Try the interface in local demo mode without configuring a backend. Demo rolls are stored in the current browser and are not shared.
- Install the site on iPhone or Android as a Progressive Web App (PWA).

## Tech stack

- Next.js 15 with the App Router and React 19
- Supabase Auth, Postgres, and private Storage for shared rolls
- fal.ai FLUX.2 Flash for photo edits
- Tailwind CSS 4

## Run locally

### Requirements

- Node.js 20 or later
- npm

### Install dependencies

```bash
npm install
```

Copy `.env.example` to `.env.local` and add the credentials for the services you want to use:

```dotenv
FAL_KEY=your_fal_api_key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key
```

The app can run in demo mode without these values. Supabase is needed for accounts, shared rolls, and cloud photo storage. `FAL_KEY` enables the FLUX.2 Flash photo edit; get one from the [fal.ai dashboard](https://fal.ai/dashboard/keys).

Keep `.env.local` private. Never commit real credentials or expose a Supabase service-role key in a `NEXT_PUBLIC_` variable.

### Set up Supabase for shared rolls

1. Create a Supabase project and copy its project URL and publishable (or legacy anon) key into `.env.local`.
2. In **Authentication → Providers**, enable Email. Enable Google too if you want Google sign-in.
3. In **Authentication → URL Configuration**, set the local Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` to the redirect URLs. Use the port shown by Next.js if it chooses another one.
4. Open the Supabase SQL Editor and run every SQL file in [`supabase/migrations`](supabase/migrations) in filename order. These migrations create the database policies and private `roll-photos` storage bucket.
5. Restart the development server after changing `.env.local`.

### Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). If port 3000 is busy, use the URL printed in your terminal.

To try the local server on a phone connected to the same Wi-Fi, start Next.js so it listens on your network interface:

```bash
npm run dev -- --hostname 0.0.0.0
```

Then open `http://<your-computer-ip>:3000` on the phone. The `/install` page has the steps for adding Afterhours to the Home Screen. PWA installation generally requires HTTPS; `localhost` is treated as secure by the browser on the computer running the server, but a local network IP may not be.

## Main routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page |
| `/dashboard` | My Rolls and past galleries |
| `/rolls/new` | Create a roll |
| `/join` | Join a shared roll with an invite code |
| `/rolls/[id]` | Roll details and contribution entry point |
| `/capture/[id]` | Add photos to a roll |
| `/rolls/[id]/reveal` | View a completed gallery |
| `/login` | Sign in or create an account |
| `/account` | Account settings |
| `/install` | PWA installation instructions |

## Commands

```bash
npm run dev       # Start the development server
npm run build     # Create a production build
npm run start     # Serve the production build
npm run typecheck # Check TypeScript types
npm run lint      # Run ESLint
```

## Deploying

Deploy the app to a Next.js-compatible host. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the host's environment variables; add `FAL_KEY` to enable photo editing. In Supabase Authentication URL Configuration, set the production Site URL and allow the production `/auth/callback` URL.

The PWA manifest and icons are served by the app. Private photos and account data are not cached for offline use.

## Secrets and Git

`.env.local` is ignored by Git. Commit `.env.example` with placeholder values only. Before committing, review `git status` and make sure no credentials or private photos are staged. If a credential is accidentally exposed, revoke or rotate it with its provider.
