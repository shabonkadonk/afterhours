# Afterhours

Afterhours is a shared digital camera roll for nights out. Add photos to a roll, invite friends, and keep the frames hidden until the roll is revealed.

## Features

- Create rolls with a name, a closing time, a frame limit, and a mood.
- Invite people to a shared roll with an invite code.
- Add photos with captions and camera-inspired looks.
- Use fal.ai FLUX.2 Flash for the Y2K photo edit and add an amber seven-segment date imprint.
- Keep photos in private Supabase Storage until the roll is revealed.
- Use local demo mode when Supabase is not configured.

## Tech stack

- Next.js and React
- Supabase Auth, Postgres, and Storage
- fal.ai for Y2K photo editing
- Tailwind CSS

## Run locally

### Requirements

- Node.js 20 or later
- npm

### Install

```bash
npm install
```

Copy `.env.example` to `.env.local`, then add your credentials:

```dotenv
FAL_KEY=your_fal_api_key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key
```

Get the fal.ai key from your [fal.ai dashboard](https://fal.ai/dashboard/keys). Get the Supabase URL and publishable (or legacy anon) key from your Supabase project’s API settings.

Keep `.env.local` private. Never commit API keys or put a Supabase service-role key in a `NEXT_PUBLIC_` variable.

### Set up Supabase

1. Create a Supabase project.
2. In **Authentication → Providers**, enable Email.
3. In **Authentication → URL Configuration**, set the Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` as a redirect URL. If Next.js starts on another port, use that port instead.
4. In the Supabase **SQL Editor**, run every file in `supabase/migrations` in filename order. This creates the tables, policies, and private `roll-photos` bucket.

### Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). If port 3000 is already in use, Next.js may start on port 3001; open the URL printed in the terminal and use that same port in Supabase’s Auth URL settings.

## Available commands

```bash
npm run dev       # Start the development server
npm run build     # Create a production build
npm run start     # Start the production server
npm run typecheck # Check TypeScript types
npm run lint      # Run ESLint
```

## Deployment

Add `FAL_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to your hosting provider’s environment variables. In Supabase Auth URL Configuration, add your deployed site URL and its `/auth/callback` redirect URL.

## Secrets

`.env.local` contains private credentials and should stay on your computer. Commit `.env.example` instead; it contains placeholders only. If a secret is accidentally pushed to GitHub, revoke or rotate it in the provider’s dashboard.
