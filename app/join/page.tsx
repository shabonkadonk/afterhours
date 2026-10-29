"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, KeyRound } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { joinCloudRoll } from "@/lib/supabase/rolls";

export default function JoinRollPage() {
  const router = useRouter();
  const { user, configured } = useAuth();
  const [code, setCode] = useState("");
  const [name, setName] = useState(String(user?.user_metadata.display_name ?? ""));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const invite = new URLSearchParams(window.location.search).get("code");
    if (invite) setCode(invite.toUpperCase().replace(/[^A-Z0-9]/g, ""));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const supabase = getSupabaseBrowserClient();
    if (!configured || !supabase) { setError("Connect the app to Supabase before joining shared rolls."); return; }
    if (!user) { router.push(`/login?next=${encodeURIComponent(`/join?code=${code}`)}`); return; }
    setBusy(true);
    try {
      const rollId = await joinCloudRoll(supabase, code, name);
      window.location.assign(`/rolls/${rollId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not join that roll. Check the code and try again.");
      setBusy(false);
    }
  }

  return <main className="mx-auto min-h-[calc(100svh-90px)] max-w-[1440px] px-5 pb-20 pt-8 sm:px-10 sm:pt-12 lg:px-16"><div className="mx-auto max-w-[560px]">
    <Link href="/dashboard" className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[.12em] text-[#8a8378] hover:text-[#eee9de]"><ArrowLeft size={13}/> YOUR ROLLS</Link>
    <section className="mt-8 border border-white/10 bg-[#191714] p-5 sm:p-8"><span className="flex h-10 w-10 items-center justify-center border border-[#a33a32]/40 text-[#c55448]"><KeyRound size={18}/></span><p className="eyebrow mt-6">THE NIGHT IS BETTER TOGETHER</p><h1 className="mt-2 font-display text-4xl tracking-[-.04em]">Join a roll.</h1><p className="mt-3 text-sm leading-6 text-[#918a7e]">Enter the invite code your friend shared with you.</p>
      {!user && configured && <p className="mt-5 border-l border-[#a33a32]/60 pl-3 text-xs leading-5 text-[#c5b3a8]">You’ll need an Afterhours account to join across devices. <Link href="/login" className="text-[#e0b4a5] underline underline-offset-4">Sign in</Link> first.</p>}
      {!configured && <p className="mt-5 border-l border-[#d7963a]/60 pl-3 text-xs leading-5 text-[#cdb88e]">Shared rolls need a connected Supabase project. Local demo rolls can only be opened in this browser.</p>}
      <form onSubmit={submit} className="mt-6 space-y-4"><label className="block"><span className="eyebrow">INVITE CODE</span><input required minLength={6} maxLength={10} autoCapitalize="characters" value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} className="field mt-2 font-mono text-lg tracking-[.2em]" placeholder="A1B2C3D4E5"/></label>
        {user && <label className="block"><span className="eyebrow">YOUR NAME IN THE ROLL</span><input required maxLength={48} value={name} onChange={(event) => setName(event.target.value)} className="field mt-2" placeholder="Your name"/></label>}
        {error && <p role="alert" className="border-l border-[#a33a32]/60 pl-3 text-xs leading-5 text-[#e08478]">{error}</p>}
        <button type="submit" disabled={busy} className="button-primary min-h-12 w-full disabled:opacity-60">{busy ? "OPENING THE ENVELOPE…" : "JOIN THE ROLL"}<ArrowUpRight size={14}/></button>
      </form>
    </section>
  </div></main>;
}
