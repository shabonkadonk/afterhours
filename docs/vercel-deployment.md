# Deploy Afterhours to Vercel

Afterhours is a Next.js app. Vercel detects the framework and supplies the build settings automatically.

## Before deploying

1. Push the project to a GitHub, GitLab, or Bitbucket repository.
2. Create a Vercel account at [vercel.com](https://vercel.com/) and choose **Add New → Project**.
3. Import the repository. Keep the project root as the **Root Directory** unless the app is inside a subfolder. Leave the detected Next.js framework and build settings at their defaults.
4. In the project's **Settings → Environment Variables**, add the variables below. Select **Production**, **Preview**, and **Development** for each environment you plan to use.

| Name | Value | Required for |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL from Supabase **Project Settings → API** | Accounts and shared rolls |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key (or legacy anon key) from Supabase **Project Settings → API** | Accounts and shared rolls |
| `FAL_KEY` | Secret key from [fal.ai dashboard → Keys](https://fal.ai/dashboard/keys) | FLUX photo editing; optional for the rest of the site |

The Supabase values have the `NEXT_PUBLIC_` prefix because the browser needs them. They are publishable keys, not service-role secrets. Never add a Supabase service-role key to the app. Keep `FAL_KEY` server-side; do not prefix it with `NEXT_PUBLIC_`.

5. Click **Deploy**. Vercel builds and assigns a URL such as `https://afterhours-example.vercel.app`.

## Connect Supabase to the deployed site

The app needs a configured Supabase project for real user accounts, shared rolls, and persistent photos. Without it, the site uses local demo mode, which only saves data in each visitor's browser.

1. In the Supabase project, open **SQL Editor** and run every file under `supabase/migrations` in filename order if you have not already done so.
2. Open **Authentication → URL Configuration**.
3. Set **Site URL** to the deployed production origin, for example `https://afterhours-example.vercel.app` (no path or trailing slash).
4. Add `https://afterhours-example.vercel.app/auth/callback` to **Redirect URLs** and save. Add your custom-domain callback there too after attaching a domain.

## Enable Google sign-in

Google OAuth credentials are stored in Supabase, not Vercel.

1. In Supabase, open **Authentication → Sign In / Providers → Google** and copy the displayed Supabase **Callback URL**.
2. In [Google Cloud Console](https://console.cloud.google.com/), open **Google Auth Platform → Clients** and create or edit a **Web application** OAuth client.
3. Add the production origin (for example `https://afterhours-example.vercel.app`) under **Authorized JavaScript origins**.
4. Paste the Supabase **Callback URL** under **Authorized redirect URIs**. This is the Supabase URL ending in `/auth/v1/callback`, not your website's `/auth/callback` URL.
5. Save the Google client, then paste its client ID and client secret into Supabase's Google provider settings and enable the provider.

## Custom domain and future updates

Attach a custom domain in Vercel under **Settings → Domains**. Then update the Supabase **Site URL** and **Redirect URLs**, and add the custom origin to the Google OAuth client's **Authorized JavaScript origins**. The Google redirect URI remains the Supabase callback URL.

After changing Vercel environment variables, redeploy so the new values are included. `NEXT_PUBLIC_` values are embedded during the build. When deploying from Git, pushes to the configured production branch create production deployments; other branches create preview deployments.

## Photo-editing limits

The `/api/flux/edit` function runs on Vercel with a 60-second maximum duration. Its returned image is capped at 3 MiB so the base64 JSON response stays below Vercel's 4.5 MB function payload limit. Very large fal.ai results are rejected with an error instead of failing as an oversized Vercel function response.
