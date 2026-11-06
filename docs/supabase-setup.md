# Supabase setup

Afterhours uses Supabase Auth, Postgres, and a private Storage bucket for shared rolls.

## Connect a project

1. Create a Supabase project.
2. Copy its project URL and publishable key (or legacy anon key) into `.env.local`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
   ```

3. Restart the Next.js dev server.
4. Open **SQL Editor** in Supabase and run the SQL files in `supabase/migrations` in filename order.
5. In **Authentication → URL Configuration**, set the local Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` as a redirect URL. Add the production domain and its `/auth/callback` URL when deploying.
6. In **Authentication → Sign In / Providers**, enable Email for hosts and enable **Anonymous Sign-Ins** for guests. Keep email confirmation enabled if desired; the sign-up page handles the confirmation link.
7. In **Authentication → Bot and Abuse Protection**, configure CAPTCHA if you enable it for anonymous sign-ins. Supabase also applies Auth rate limits; the invite-code join route has its own per-IP limit.
8. Open `/login`, create a host account, then create a roll. Share its invitation link, QR code, or short code. Guests open the link or choose **Join with code**, enter a display name, and join without an account.

## Guest sessions and privacy

Anonymous Auth creates a Supabase user for the guest and stores that session in the browser. The guest can return from the same browser while its site data remains. Clearing site data, signing out, or switching devices loses that anonymous identity. Hosts use registered accounts and are the only people who can change invitation settings, renew a roll, or delete it.

Invite links use a high-entropy token; short codes are rate-limited server-side. The service-role key is required by the server routes for joining and cleanup. Put it only in a server environment variable named `SUPABASE_SERVICE_ROLE_KEY`; never use a `NEXT_PUBLIC_` prefix or add it to client code. Generate a separate random `CRON_SECRET` for the scheduled retention job. See [Vercel deployment](vercel-deployment.md) for configuration.

The migrations create the private `roll-photos` bucket and its row-level security policies. Each upload first reserves a frame through the database's atomic capacity counter; Storage accepts only matching JPEG objects for current roll members. Photos can be downloaded after reveal. The host can end or delete their rolls. The browser uses only the publishable/anon key; never put a Supabase service-role key in a `NEXT_PUBLIC_` variable.

Revealed rolls are kept for 30 days, then have a 7-day renewal window. The host can renew from the gallery. Expired photos are removed by the Vercel Cron Job; guests and hosts can also download a copy before expiration. The current app shows an in-app reminder and does not send email.

Without Supabase credentials, the app remains in local demo mode and keeps saving to this browser.
