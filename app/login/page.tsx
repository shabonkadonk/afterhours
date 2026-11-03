"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Disc3 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("error")) setMessage("The sign-in link expired. Try again.");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setMessage("Add your Supabase project URL and publishable key to .env.local first."); return; }
    const requestedNext = new URLSearchParams(window.location.search).get("next");
    const next = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/dashboard";
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(next);
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName.trim() },
            emailRedirectTo: (() => {
              const callback = new URL("/auth/callback", window.location.origin);
              callback.searchParams.set("next", next);
              return callback.toString();
            })(),
          },
        });
        if (error) throw error;
        setMessage(data.session ? "Your account is ready. Taking you to your rolls…" : "Check your email for the confirmation link, then sign in.");
        if (data.session) { router.replace(next); router.refresh(); }
      }
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Could not sign in. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setMessage("");
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setMessage("Add your Supabase project URL and publishable key to .env.local first."); return; }
    const requestedNext = new URLSearchParams(window.location.search).get("next");
    const next = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/dashboard";
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", next);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callback.toString() },
      });
      if (error) throw error;
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Could not start Google sign-in. Try again.");
      setBusy(false);
    }
  }

  return <main className="mx-auto min-h-[calc(100svh-90px)] max-w-[1440px] px-5 pb-20 pt-8 sm:px-10 sm:pt-12 lg:px-16">
    <div className="mx-auto max-w-[480px]">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-xs text-[#8a8378] hover:text-[#eee9de]"><ArrowLeft size={13}/> Back to your rolls</Link>
      <section className="flow-panel mt-8 border border-white/10 bg-[#191714] p-5 sm:p-8">
        <span className="flex h-10 w-10 items-center justify-center border border-[#a33a32]/50 text-[#c55448]"><Disc3 size={20}/></span>
        <p className="eyebrow mt-6">AFTERHOURS ACCOUNT</p>
        <h1 className="mt-2 font-display text-4xl tracking-[-.04em]">{mode === "signin" ? "Welcome back." : "Come on in."}</h1>
        <p className="mt-3 text-sm leading-6 text-[#918a7e]">Sign in to sync your rolls and share them with friends.</p>
        {!configured && <p className="mt-5 border-l border-[#d7963a]/60 pl-3 text-xs leading-5 text-[#cdb88e]">Set up a Supabase project and add its URL and publishable key to enable accounts.</p>}
        <button type="button" onClick={signInWithGoogle} disabled={busy || !configured} className="mt-6 flex min-h-12 w-full items-center justify-center gap-3 border border-white/15 bg-transparent px-4 text-sm text-[#eee9de] transition-colors hover:border-white/30 hover:bg-white/[.04] disabled:cursor-not-allowed disabled:opacity-60">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.75 3.27-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.15v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.15A11 11 0 0 0 1 12c0 1.78.43 3.45 1.15 4.95l3.69-2.84Z"/><path fill="#EA4335" d="M12 5.36c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.85 6.05l3.69 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"/></svg>
          {busy ? "Connecting to Google…" : "Continue with Google"}
        </button>
        <div className="my-5 flex items-center gap-3 text-[10px] text-[#817a70]"><span className="h-px flex-1 bg-white/10"/><span>Or use email</span><span className="h-px flex-1 bg-white/10"/></div>
        <form onSubmit={submit} className="form-enter space-y-4">
          {mode === "signup" && <label className="block"><span className="eyebrow">YOUR NAME</span><input required maxLength={48} autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="field mt-2" placeholder="What should friends call you?"/></label>}
          <label className="block"><span className="eyebrow">Email</span><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="field mt-2" placeholder="you@example.com"/></label>
          <label className="block"><span className="eyebrow">Password</span><input required type="password" minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="field mt-2" placeholder="At least 8 characters"/></label>
          {message && <p role="status" className="border-l border-[#a33a32]/60 pl-3 text-xs leading-5 text-[#c9b7a8]">{message}</p>}
          <button type="submit" disabled={busy} className="button-primary min-h-12 w-full disabled:opacity-60">{busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}<ArrowUpRight size={14}/></button>
        </form>
        <p className="mt-5 text-center text-xs text-[#817a70]">{mode === "signin" ? "New to Afterhours?" : "Already have an account?"}{" "}<button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }} className="text-[#d6b1a1] underline underline-offset-4">{mode === "signin" ? "Create one" : "Sign in"}</button></p>
      </section>
    </div>
  </main>;
}
