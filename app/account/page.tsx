"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowLeft, ArrowUpRight, LogOut } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { NotificationSettings } from "@/components/notification-settings";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AccountPage() {
  const router = useRouter();
  const { user, configured, signOut } = useAuth();
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const guest = Boolean(user?.is_anonymous);

  async function handleSignOut() {
    try { await signOut(); router.replace("/dashboard"); router.refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not sign out."); }
  }

  async function setAccountPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPasswordMessage("");
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setError("Accounts are not configured."); return; }
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setPassword("");
      setPasswordMessage("Password saved. You can use it to sign in on another device.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save your password.");
    }
  }

  return <main className="mx-auto min-h-[calc(100svh-90px)] max-w-[1440px] px-5 pb-20 pt-8 sm:px-10 sm:pt-12 lg:px-16"><div className="mx-auto max-w-[560px]">
    <Link href="/dashboard" className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[.12em] text-[#8a8378] hover:text-[#eee9de]"><ArrowLeft size={13}/> YOUR ROLLS</Link>
    <section className="flow-panel mt-8 border border-white/10 bg-[#191714] p-6 sm:p-8"><p className="eyebrow">YOUR AFTERHOURS ACCOUNT</p><h1 className="mt-2 break-all font-display text-3xl">{guest ? "Guest session" : user?.email ?? "Not signed in"}</h1><p className="mt-3 text-sm leading-6 text-[#918a7e]">{guest ? "Add an email to this guest account to keep its roll memberships and use the same account on other devices." : configured ? "Your shared rolls are saved to your Afterhours account." : "Connect Supabase to enable account sign-in."}</p>
      {error && <p role="alert" className="mt-5 text-xs text-[#e08478]">{error}</p>}
      {guest ? <div className="mt-6 space-y-4"><Link href="/login?mode=signup&next=%2Faccount" className="button-primary min-h-11">Create an account <ArrowUpRight size={14}/></Link><p className="text-xs leading-5 text-[#817a70]">Already have an account? <Link href="/login?next=%2Fdashboard" className="text-[#d6b1a1] underline underline-offset-4">Sign in</Link>. Creating an account here keeps this guest session attached to your rolls.</p></div> : user ? <button onClick={handleSignOut} className="button-secondary mt-6 min-h-11"><LogOut size={14}/> Sign out</button> : <Link href="/login" className="button-primary mt-6 min-h-11">Sign in <LogOut size={14}/></Link>}
    </section>
    {user && !guest && <section className="flow-panel mt-4 border border-white/10 bg-[#191714] p-6 sm:p-8"><p className="eyebrow">PASSWORD</p><h2 className="mt-2 font-display text-2xl">Set or change your password.</h2><form onSubmit={(event) => void setAccountPassword(event)} className="mt-4 space-y-3"><label className="block"><span className="eyebrow">NEW PASSWORD</span><input required type="password" minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="field mt-2" placeholder="At least 8 characters"/></label>{passwordMessage && <p role="status" className="text-xs text-[#b9c79c]">{passwordMessage}</p>}<button type="submit" className="button-secondary min-h-11">Save password</button></form></section>}
    {user && !user.is_anonymous && <NotificationSettings/>}
  </div></main>;
}
