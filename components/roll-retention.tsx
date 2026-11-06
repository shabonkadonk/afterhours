"use client";

import { useEffect, useState } from "react";
import { Clock3, RotateCw } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const GRACE_MS = 7 * 24 * 60 * 60 * 1000;

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

export function RollRetention({ rollId, expiresAt, isHost }: { rollId: string; expiresAt?: string | null; isHost: boolean }) {
  const [expiry, setExpiry] = useState(expiresAt ?? "");
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => setExpiry(expiresAt ?? ""), [expiresAt]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!expiry) return <div className="mt-5 border border-white/10 bg-white/[.025] p-4 text-xs leading-5 text-[#a49b8d]">This roll is temporary. Photos will be kept for 30 days after reveal, then held for a 7-day renewal window before deletion.</div>;
  const expiryMs = Date.parse(expiry);
  const graceEnd = expiryMs + GRACE_MS;
  const inGrace = now >= expiryMs && now < graceEnd;
  const nearExpiry = expiryMs > now && expiryMs - now <= GRACE_MS;
  const pastGrace = now >= graceEnd;
  const canRenew = isHost && now < graceEnd;
  const daysLeft = Math.max(0, Math.ceil((expiryMs - now) / (24 * 60 * 60 * 1000)));

  async function renew() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || busy) return;
    setBusy(true); setMessage("");
    const { data, error } = await supabase.rpc("renew_roll", { target_roll_id: rollId });
    setBusy(false);
    if (error || typeof data !== "string") {
      setMessage(error?.message ?? "Could not renew this roll. Refresh and try again.");
      return;
    }
    setExpiry(data); setNow(Date.now());
    setMessage("Renewed for another 30 days. Your photos are staying in the roll.");
  }

  return <section aria-label="Photo retention" className={`mt-5 border p-4 ${inGrace || nearExpiry ? "border-[#d4aa68]/35 bg-[#b89455]/[.06]" : "border-white/10 bg-white/[.025]"}`}>
    <p className="eyebrow flex items-center gap-2 text-[#c8b489]"><Clock3 size={13}/> PHOTO RETENTION</p>
    <p className="mt-2 text-sm text-[#ded8cd]">{inGrace ? `This roll expired ${dateLabel(expiry)}.` : pastGrace ? `This roll passed its expiration date ${dateLabel(expiry)}.` : `Photos expire ${dateLabel(expiry)} · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left.`}</p>
    <p className="mt-1 text-xs leading-5 text-[#a49b8d]">{inGrace
      ? `The host can renew by ${dateLabel(new Date(graceEnd).toISOString())}. After that, the photos and roll are permanently deleted.`
      : pastGrace
        ? "The 7-day renewal window has ended. Deletion is being retried by the scheduled cleanup job."
        : `The roll is kept for 30 days after reveal, followed by a 7-day grace period. Download your copies before ${dateLabel(expiry)}.`}</p>
    {(nearExpiry || inGrace) && isHost && canRenew && <button type="button" onClick={() => void renew()} disabled={busy} className="button-primary mt-3 min-h-10 px-3 text-[9px] disabled:opacity-50"><RotateCw size={13}/>{busy ? "RENEWING…" : "RENEW FOR 30 DAYS"}</button>}
    {message && <p role="status" className="mt-3 text-xs text-[#cfc2a9]">{message}</p>}
  </section>;
}
