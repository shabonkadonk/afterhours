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

  return <main className="mx-auto min-h-[calc(100svh-90px)] max-w-[1440px] px-5 pb-20 pt-8 sm:px-10 sm:pt-12 lg:px-16">
    <div className="mx-auto max-w-[480px]">
      <Link href="/dashboard" className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[.12em] text-[#8a8378] hover:text-[#eee9de]"><ArrowLeft size={13}/> BACK TO YOUR ROLLS</Link>
      <section className="mt-8 border border-white/10 bg-[#191714] p-5 sm:p-8">
        <span className="flex h-10 w-10 items-center justify-center border border-[#a33a32]/50 text-[#c55448]"><Disc3 size={20}/></span>
        <p className="eyebrow mt-6">AFTERHOURS ACCOUNT</p>
        <h1 className="mt-2 font-display text-4xl tracking-[-.04em]">{mode === "signin" ? "Welcome back." : "Come on in."}</h1>
        <p className="mt-3 text-sm leading-6 text-[#918a7e]">Sign in to keep your rolls in sync and pass invite codes to your crew.</p>
        {!configured && <p className="mt-5 border-l border-[#d7963a]/60 pl-3 text-xs leading-5 text-[#cdb88e]">Set up a Supabase project and add its URL and publishable key to enable accounts.</p>}
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signup" && <label className="block"><span className="eyebrow">YOUR NAME</span><input required maxLength={48} autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="field mt-2" placeholder="What should friends call you?"/></label>}
          <label className="block"><span className="eyebrow">EMAIL</span><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="field mt-2" placeholder="you@example.com"/></label>
          <label className="block"><span className="eyebrow">PASSWORD</span><input required type="password" minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="field mt-2" placeholder="At least 8 characters"/></label>
          {message && <p role="status" className="border-l border-[#a33a32]/60 pl-3 text-xs leading-5 text-[#c9b7a8]">{message}</p>}
          <button type="submit" disabled={busy} className="button-primary min-h-12 w-full disabled:opacity-60">{busy ? "ONE MOMENT…" : mode === "signin" ? "SIGN IN" : "CREATE ACCOUNT"}<ArrowUpRight size={14}/></button>
        </form>
        <p className="mt-5 text-center text-xs text-[#817a70]">{mode === "signin" ? "New to Afterhours?" : "Already have an account?"}{" "}<button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }} className="text-[#d6b1a1] underline underline-offset-4">{mode === "signin" ? "Create one" : "Sign in"}</button></p>
      </section>
    </div>
  </main>;
}
