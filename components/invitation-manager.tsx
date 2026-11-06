"use client";

import QRCode from "qrcode";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Copy, QrCode, RefreshCw, Share2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { rotateCloudInvitation, setCloudInvitationEnabled } from "@/lib/supabase/rolls";

export function InvitationManager({
  rollId,
}: { rollId: string }) {
  const { user } = useAuth();
  const [token, setToken] = useState("");
  const [code, setCode] = useState("");
  const [active, setActive] = useState(false);
  const [qr, setQr] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [origin, setOrigin] = useState("");
  const link = origin ? `${origin}/join/${token}` : "";

  useEffect(() => { setOrigin(window.location.origin); }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user || user.is_anonymous) { setLoadingInvite(false); return; }
    let mounted = true;
    void supabase.rpc("get_roll_invitation", { target_roll_id: rollId }).then(({ data, error }) => {
      if (!mounted) return;
      if (error) { setMessage("Could not load the host invitation."); setLoadingInvite(false); return; }
      const invitation = data?.[0] as { invite_token: string; join_code: string; invitation_enabled: boolean } | undefined;
      setToken(invitation?.invite_token ?? "");
      setCode(invitation?.join_code ?? "");
      setActive(invitation?.invitation_enabled ?? false);
      setLoadingInvite(false);
    });
    return () => { mounted = false; };
  }, [rollId, user]);

  useEffect(() => {
    if (!token || !active || !origin) { setQr(""); return; }
    void QRCode.toDataURL(`${origin}/join/${token}`, { width: 240, margin: 1, errorCorrectionLevel: "M" })
      .then(setQr)
      .catch(() => setQr(""));
  }, [token, active, origin]);

  if (!user || user.is_anonymous) return null;

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copied.`);
    } catch {
      setMessage("Could not copy automatically. Select and copy the text above.");
    }
  }

  async function rotate() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true); setMessage("");
    try {
      const next = await rotateCloudInvitation(supabase, rollId);
      setToken(next.invite_token); setCode(next.join_code); setActive(true);
      setMessage("A fresh invitation is ready. The previous link and code no longer work.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not refresh this invitation.");
    } finally { setBusy(false); }
  }

  async function toggle() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true); setMessage("");
    try {
      await setCloudInvitationEnabled(supabase, rollId, !active);
      setActive(!active);
      setMessage(active ? "Invitations are paused." : "Invitations are active again.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update this invitation.");
    } finally { setBusy(false); }
  }

  async function share() {
    if (!link) return;
    if (navigator.share) {
      try { await navigator.share({ title: "Join my Afterhours roll", url: link }); setMessage("Invitation shared."); return; }
      catch (error) { if (error instanceof Error && error.name === "AbortError") return; }
    }
    await copy(link, "Invitation link");
  }

  return <section className="mt-6 border border-white/10 bg-[#191714] p-4 sm:p-5" aria-labelledby={`invite-heading-${rollId}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="eyebrow flex items-center gap-2"><QrCode size={13} className="text-[#b54b40]"/> HOST INVITATION</p><h2 id={`invite-heading-${rollId}`} className="mt-2 font-display text-2xl">Bring the crew in.</h2></div>
      <span className={`border px-2 py-1 font-mono text-[8px] tracking-[.1em] ${active ? "border-[#74916b]/35 text-[#a8c294]" : "border-white/15 text-[#817a70]"}`}>{active ? "OPEN" : "PAUSED"}</span>
    </div>
    <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0 space-y-3">
        <div><p className="eyebrow">INVITATION LINK</p><p className="mt-1 break-all font-mono text-[11px] leading-5 text-[#d5cfc3]">{active ? link : "Paused by the host"}</p></div>
        <div><p className="eyebrow">SHORT JOIN CODE</p><p className="mt-1 font-mono text-xl tracking-[.2em] text-[#e7ddca]">{active ? code : "—"}</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!active || busy} onClick={() => void share()} className="button-primary min-h-10 px-3 text-[9px] disabled:opacity-40"><Share2 size={13}/> SHARE INVITE</button>
          <button type="button" disabled={!active || busy} onClick={() => void copy(link, "Invitation link")} className="button-secondary min-h-10 px-3 text-[9px] disabled:opacity-40"><Copy size={13}/> COPY LINK</button>
          <button type="button" disabled={!active || busy} onClick={() => void copy(code, "Join code")} className="button-secondary min-h-10 px-3 text-[9px] disabled:opacity-40"><Copy size={13}/> COPY CODE</button>
          <button type="button" disabled={busy} onClick={() => void rotate()} className="button-secondary min-h-10 px-3 text-[9px] disabled:opacity-40"><RefreshCw size={12}/> REFRESH INVITE</button>
          <button type="button" disabled={busy} onClick={() => void toggle()} className="button-secondary min-h-10 px-3 text-[9px] disabled:opacity-40">{active ? "PAUSE INVITES" : "REOPEN INVITES"}</button>
        </div>
      </div>
      {active && <div className="mx-auto w-fit border border-white/10 bg-white p-2">
        {qr ? <><Image src={qr} alt="QR code for the roll invitation" width={144} height={144} unoptimized className="h-36 w-36"/><a href={qr} download={`afterhours-${rollId}-invite.png`} className="mt-1 block text-center font-mono text-[8px] text-[#302d28] underline">DOWNLOAD QR</a></> : <div className="grid h-36 w-36 place-items-center text-[#48433b]">Creating QR…</div>}
      </div>}
    </div>
    <p className="mt-3 text-[10px] leading-4 text-[#8d867a]">Only share this link with people joining the roll. Guests can join without an account.</p>
    {loadingInvite && <p className="mt-3 text-xs text-[#8d867a]">Loading the invitation…</p>}
    {message && <p role="status" className="mt-3 text-xs text-[#cfc2a9]">{message}</p>}
  </section>;
}
