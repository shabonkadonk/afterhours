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
| `SUPABASE_SERVICE_ROLE_KEY` | Secret service-role key from Supabase **Project Settings → API** | Secure invitation joins and photo expiration cleanup |
| `CRON_SECRET` | Long random secret that you generate | Authorizes the scheduled expiration route |
| `FAL_KEY` | Secret key from [fal.ai dashboard → Keys](https://fal.ai/dashboard/keys) | FLUX photo editing; optional for the rest of the site |

Afterhours Awards starts in sample mode and does not send photos to an AI provider. If you later complete the Cloudflare account, model license, privacy, and age checks described in [Afterhours Awards setup](afterhours-awards.md), add its server-only variables to Vercel. Keep `AWARDS_MOCK_MODE=true`, `AWARDS_LIVE_PROCESSING_ENABLED=false`, and `AWARDS_PROVIDER_REQUIREMENTS_CONFIRMED=false` until those checks are complete.

Only the Supabase URL and publishable/anon key use the `NEXT_PUBLIC_` prefix. Keep `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, and `FAL_KEY` server-side; never add a `NEXT_PUBLIC_` prefix to them. The service-role key bypasses RLS and is used only by server routes.

5. Click **Deploy**. Vercel builds and assigns a URL such as `https://afterhours-example.vercel.app`.

## Configure Afterhours Awards

Awards runs in sample mode by default. It sends no photos to Cloudflare in that mode. After confirming the account can run the documented vision model, accepting Meta's model terms, and reviewing privacy and applicable age requirements, set these in Vercel **Settings → Environment Variables**:

| Name | Value | Required for |
| --- | --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID | Workers AI requests |
| `CLOUDFLARE_API_TOKEN` | Secret bearer token | Workers AI requests; server-side only |
| `CLOUDFLARE_MODEL_ID` | `@cf/meta/llama-3.2-11b-vision-instruct` | Vision inference model |
| `AWARDS_MAX_PHOTOS` | `10` | Selected photo ceiling, 1–10 |
| `AWARDS_MOCK_MODE` | `true` | Sample mode without photo processing |
| `AWARDS_LIVE_PROCESSING_ENABLED` | `false` | Explicit live-processing gate |
| `AWARDS_PROVIDER_REQUIREMENTS_CONFIRMED` | `false` | Operator confirmation of account, license, privacy, and age checks |

Keep both live gates false and mock mode true until those checks are complete. The Cloudflare token must stay server-side with no `NEXT_PUBLIC_` prefix. See [Afterhours Awards setup](afterhours-awards.md) for the provider and live-processing gate procedure.

## Connect Supabase to the deployed site

The app needs a configured Supabase project for real user accounts, shared rolls, and persistent photos. Without it, the site uses local demo mode, which only saves data in each visitor's browser.

1. In the Supabase project, open **SQL Editor** and run every file under `supabase/migrations` in filename order if you have not already done so. This includes `20261105000000_afterhours_awards.sql` for saved ceremonies and `20261106000000_host_guest_expiration.sql` for guest invitations, retention, and the related RLS/Storage policies. The new migration adds columns and policies without dropping existing roll or photo rows.
2. Open **Authentication → URL Configuration**.
3. Set **Site URL** to the deployed production origin, for example `https://afterhours-example.vercel.app` (no path or trailing slash).
4. Add `https://afterhours-example.vercel.app/auth/callback` to **Redirect URLs** and save. Add your custom-domain callback there too after attaching a domain.
5. Open **Authentication → Sign In / Providers** and enable **Anonymous Sign-Ins** for guests. Keep Email enabled for hosts. Configure CAPTCHA under **Bot and Abuse Protection** if you enable it for anonymous sign-ins.

The checked-in `vercel.json` runs `/api/cron/expire-rolls` daily at 08:15 UTC on production deployments. Generate a random `CRON_SECRET` with at least 16 characters and configure it in the Production environment; Vercel sends it to the route as a bearer token. The route removes expired roll files from Storage before deleting roll records. Hosts can renew from the gallery during the 7-day grace period. After changing environment variables, redeploy so the server functions receive them.

Guests receive an in-app expiry notice. This project has no email provider or email reminder job configured.

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
