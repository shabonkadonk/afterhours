"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, KeyRound } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ensureGuestSession } from "@/lib/supabase/guest";
import { joinCloudRoll, joinCloudRollByToken } from "@/lib/supabase/rolls";

type InvitePreview = { name: string; theme: string; photoCount: number; photoLimit: number };

export default function JoinRollPage() {
  const router = useRouter();
  const params = useParams<{ token?: string }>();
  const inviteToken = typeof params.token === "string" ? params.token : "";
  const { user, configured, loading } = useAuth();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState<InvitePreview | null>(null);

  useEffect(() => {
    if (inviteToken) {
      void fetch(`/api/invitations/${encodeURIComponent(inviteToken)}`, { cache: "no-store" })
        .then(async (response) => {
          const payload = await response.json() as { roll?: InvitePreview; error?: string };
          if (!response.ok || !payload.roll) throw new Error(payload.error ?? "This invitation is unavailable.");
          setInvite(payload.roll);
          setError("");
        })
        .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "This invitation is unavailable."));
      return;
    }
    const inviteCode = new URLSearchParams(window.location.search).get("code");
    if (inviteCode) setCode(inviteCode.toUpperCase().replace(/[^A-Z0-9-]/g, ""));
  }, [inviteToken]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const supabase = getSupabaseBrowserClient();
    if (!configured || !supabase) { setError("Guest access needs a connected Supabase project."); return; }
    setBusy(true);
    try {
      await ensureGuestSession(supabase, user);
      const rollId = inviteToken
        ? await joinCloudRollByToken(inviteToken, name)
        : await joinCloudRoll(code, name);
      window.location.assign(`/rolls/${rollId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not join that roll. Check the invitation and try again.");
      setBusy(false);
    }
  }

  return <main className="mx-auto min-h-[calc(100svh-90px)] max-w-[1440px] px-5 pb-20 pt-8 sm:px-10 sm:pt-12 lg:px-16"><div className="mx-auto max-w-[560px]">
    <Link href="/dashboard" className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[.12em] text-[#8a8378] hover:text-[#eee9de]"><ArrowLeft size={13}/> YOUR ROLLS</Link>
    <section className="flow-panel mt-8 border border-white/10 bg-[#191714] p-5 sm:p-8"><span className="flex h-10 w-10 items-center justify-center border border-[#a33a32]/40 text-[#c55448]"><KeyRound size={18}/></span><p className="eyebrow mt-6">THE NIGHT IS BETTER TOGETHER</p><h1 className="mt-2 font-display text-4xl tracking-[-.04em]">Join a roll.</h1>
      {invite ? <><p className="mt-3 font-display text-2xl text-[#ded8cd]">{invite.name}</p><p className="mt-1 text-xs text-[#918a7e]">{invite.photoCount} / {invite.photoLimit} photos · {invite.theme}</p></> : <p className="mt-3 text-sm leading-6 text-[#918a7e]">{inviteToken ? "Checking your invitation…" : "Enter the short code your friend shared."}</p>}
      {!configured && <p className="mt-5 border-l border-[#d7963a]/60 pl-3 text-xs leading-5 text-[#cdb88e]">Guest access needs a connected Supabase project.</p>}
      {configured && <p className="mt-5 border-l border-white/15 pl-3 text-xs leading-5 text-[#a49b8d]">No account or email needed. Your guest access stays in this browser; clearing browser data or switching devices means you may lose access.</p>}
      <form onSubmit={submit} className="form-enter mt-6 space-y-4">
        {!inviteToken && <label className="block"><span className="eyebrow">INVITE CODE</span><input required minLength={8} maxLength={13} disabled={busy} autoCapitalize="characters" value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))} className="field mt-2 font-mono text-lg tracking-[.2em] disabled:opacity-60" placeholder="AFTR-82A9F0C1"/></label>}
        <label className="block"><span className="eyebrow">YOUR NAME IN THE ROLL</span><input required maxLength={48} disabled={busy} autoComplete="nickname" value={name} onChange={(event) => setName(event.target.value)} className="field mt-2 disabled:opacity-60" placeholder="Your name"/></label>
        {error && <p role="alert" className="border-l border-[#a33a32]/60 pl-3 text-xs leading-5 text-[#e08478]">{error}</p>}
        <button type="submit" disabled={busy || loading || Boolean(inviteToken && !invite)} className="button-primary min-h-12 w-full disabled:opacity-60">{busy ? "OPENING THE ENVELOPE…" : "JOIN THE ROLL"}<ArrowUpRight size={14}/></button>
      </form>
    </section>
  </div></main>;
}
