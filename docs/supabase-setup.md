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
6. In **Authentication → Providers**, enable Email. Email confirmation can stay enabled; the sign-up page handles the confirmation link.
7. Open `/login`, create an account, then create a roll. Share its invite code; friends sign in and use **Join with code**.

The migration creates the private `roll-photos` bucket and its row-level security policies. Photos can be uploaded by roll members while a roll is active and downloaded only after it is revealed. Owners can end or delete their rolls. The browser uses only the publishable/anon key; never put a Supabase service-role key in a `NEXT_PUBLIC_` variable.

Without Supabase credentials, the app remains in local demo mode and keeps saving to this browser.
