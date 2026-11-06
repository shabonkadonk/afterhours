import type { SupabaseClient, User } from "@supabase/supabase-js";

export async function ensureGuestSession(supabase: SupabaseClient, currentUser: User | null) {
  if (currentUser) return currentUser;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) throw new Error("Guest access is not enabled yet. Ask the host to try again later.");
  return data.user;
}
