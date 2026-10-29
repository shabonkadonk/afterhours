"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Camera, Check, Clock3, Copy, LockKeyhole, PartyPopper, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { useAuth } from "@/components/auth-provider";
import { DeleteRollButton } from "@/components/delete-roll-button";
import { PhotoImage } from "@/components/photo-image";
import { AvatarStack, LocalDemoNote, ParticipantCount, PhotoCount, ThemeBadge, formatDate, formatTime } from "@/components/roll-ui";
import type { Roll } from "@/lib/types";

function useCountdown(endsAt: string) {
  const [remaining, setRemaining] = useState(0);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, new Date(endsAt).getTime() - Date.now()));
    update(); setStarted(true); const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [endsAt]);
  const seconds = Math.floor(remaining / 1000);
  return { remaining, started, days: Math.floor(seconds / 86400), hours: Math.floor((seconds % 86400) / 3600), minutes: Math.floor((seconds % 3600) / 60), secs: seconds % 60 };
}

function RollContents({ roll }: { roll: Roll }) {
  const router = useRouter();
  const { revealRoll } = useApp();
  const { configured, user } = useAuth();
  const countdown = useCountdown(roll.endsAt);
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (countdown.started && roll.status === "active" && countdown.remaining === 0) void revealRoll(roll.id).catch(() => {}); }, [countdown.remaining, countdown.started, roll.id, roll.status, revealRoll]);

  async function copyCode() {
    try { await navigator.clipboard.writeText(roll.inviteCode); setCopied(true); window.setTimeout(()=>setCopied(false),1800); }
    catch { setCopied(false); }
  }

  async function finishRoll() { await revealRoll(roll.id); router.push(`/rolls/${roll.id}/reveal`); }

  return <main className="mx-auto min-h-screen max-w-[1440px] px-5 pb-20 pt-8 sm:px-10 sm:pt-12 lg:px-16">
    <div className="mx-auto max-w-[1120px]"><LocalDemoNote/>
      <Link href="/dashboard" className="mt-8 inline-flex items-center gap-2 font-mono text-[10px] tracking-[.12em] text-[#8a8378] transition hover:text-[#eee9de]"><ArrowLeft size={13}/> ALL ROLLS</Link>
      <div className="mt-6 grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
        <section className="relative min-h-[360px] overflow-hidden border border-white/10 bg-[#211e19] sm:min-h-[470px]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_20%,rgba(147,56,46,.20),transparent_44%),linear-gradient(130deg,#201c18,#171613_72%)]"/><div className="grain absolute inset-0 opacity-35"/><div className="absolute -right-5 top-12 hidden font-display text-[360px] leading-none text-white/[.025] sm:block">{roll.photos.length.toString().padStart(2,"0")}</div><div className="absolute inset-0 bg-gradient-to-t from-[#171613]/80 via-transparent to-[#171613]/10"/>
          <div className="relative flex min-h-[360px] flex-col justify-between p-5 sm:min-h-[470px] sm:p-8"><div className="flex items-center justify-between"><span className={`eyebrow flex items-center gap-2 ${roll.status==="active"?"text-[#e0b5ac]":"text-[#c4bcaf]"}`}><i className={`h-1.5 w-1.5 rounded-full ${roll.status==="active"?"animate-pulse bg-[#c7564a]":"bg-[#8c8170]"}`}/>{roll.status === "active" ? "CAMERA IS OPEN" : "ROLL DEVELOPED"}</span><ThemeBadge theme={roll.theme}/></div>
            <div><p className="mb-3 font-mono text-[10px] tracking-[.14em] text-[#b0a99c]">STARTED {formatDate(roll.createdAt).toUpperCase()} · INVITE {roll.inviteCode}</p><h1 className="font-display text-4xl leading-[.93] tracking-[-.05em] sm:text-6xl">{roll.name}</h1><div className="mt-6 flex flex-wrap items-center gap-5"><div><p className="eyebrow mb-2">YOUR CREW</p><AvatarStack people={roll.participants} size="lg"/></div><span className="h-10 w-px bg-white/15"/><div><p className="eyebrow mb-2">FRAMES SO FAR</p><PhotoCount roll={roll}/></div><span className="h-10 w-px bg-white/15"/><div><p className="eyebrow mb-2">PEOPLE</p><ParticipantCount people={roll.participants}/></div></div></div></div>
        </section>
        <aside className="flex flex-col border border-white/10 bg-[#1b1916] p-5 sm:p-7">
          {roll.status === "active" ? <><div className="flex items-center justify-between"><p className="eyebrow flex items-center gap-2"><Clock3 size={13} className="text-[#bb584c]"/> UNTIL THE ROLL CLOSES</p><span className="font-mono text-[9px] text-[#777168]">{formatDate(roll.endsAt,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).toUpperCase()}</span></div><div className="my-8 grid grid-cols-4 divide-x divide-white/10 border-y border-white/10 py-5 text-center">{[{n:countdown.days,l:"DAYS"},{n:countdown.hours,l:"HRS"},{n:countdown.minutes,l:"MIN"},{n:countdown.secs,l:"SEC"}].map((item)=><div key={item.l}><span className="font-mono text-2xl tabular-nums sm:text-3xl">{String(item.n).padStart(2,"0")}</span><span className="mt-1 block font-mono text-[8px] tracking-[.14em] text-[#716b61]">{item.l}</span></div>)}</div><p className="font-display text-[22px]">Keep the phone down.</p><p className="mt-2 text-sm leading-6 text-[#898378]">Add a few frames, then let the rest of the night happen. The roll stays right here until it’s ready.</p>
            <div className="mt-7 grid gap-2"><Link href={`/capture/${roll.id}`} className="button-primary w-full"><Camera size={15}/> Add photos <ArrowUpRight size={14}/></Link>{(!configured || !user || roll.ownerId === user.id) && <button onClick={finishRoll} className="button-secondary w-full"><PartyPopper size={14}/> End session & reveal</button>}</div>
          </> : <><p className="eyebrow flex items-center gap-2"><PartyPopper size={13} className="text-[#bb584c]"/> THE ROLL IS DEVELOPED</p><div className="mt-7 border-y border-white/10 py-7"><p className="font-display text-3xl">The night came back.</p><p className="mt-2 text-sm leading-6 text-[#898378]">Open the photos in order and see what everyone caught.</p></div><Link href={`/rolls/${roll.id}/reveal`} className="button-primary mt-auto w-full">Open the gallery <ArrowUpRight size={14}/></Link></>}
          <div className="mt-7 border-t border-white/10 pt-5"><div className="flex items-start justify-between gap-3"><div><p className="eyebrow">PASS THE INVITE CODE</p><p className="mt-2 font-mono text-2xl tracking-[.2em]">{roll.inviteCode}</p></div><button onClick={copyCode} className="button-secondary min-h-9 px-3 text-[10px]" aria-label="Copy invite code">{copied?<Check size={13}/>:<Copy size={13}/>} {copied?"COPIED":"COPY"}</button></div><p className="mt-3 flex items-start gap-2 text-[10px] leading-4 text-[#716b61]"><LockKeyhole size={12} className="mt-0.5 shrink-0"/>{configured && user ? "Friends can join from another device with this code and an account." : "Local demo code. Connect Supabase to invite friends from other devices."}</p><Link href="/join" className="mt-3 inline-flex min-h-10 items-center gap-2 text-[10px] tracking-[.1em] text-[#d6b1a1] underline underline-offset-4">JOIN ANOTHER ROLL <ArrowUpRight size={12}/></Link></div>
        </aside>
      </div>
      <section className="mt-8 border border-white/10 bg-[#191714] p-5 sm:p-7"><div className="flex items-end justify-between gap-3 border-b border-white/10 pb-4"><div><p className="eyebrow">IN THE ENVELOPE</p><h2 className="mt-2 font-display text-2xl">{roll.photos.length} {roll.photos.length===1?"frame":"frames"} collected</h2></div><span className="hidden font-mono text-[9px] tracking-[.1em] text-[#746d62] sm:block">THE ROLL OPENS {roll.status==="active"?"WHEN THE TIMER ENDS":"NOW"}</span></div>
        {roll.status === "active" ? <div className="flex flex-col items-center py-10 text-center"><span className="flex h-11 w-11 items-center justify-center border border-white/15 text-[#8c8170]"><LockKeyhole size={18}/></span><p className="mt-4 font-display text-xl">{roll.photos.length ? `${roll.photos.length} frames, still a secret.` : "Nothing in the envelope yet."}</p><p className="mt-1 max-w-sm text-xs leading-5 text-[#80796d]">{roll.photos.length ? "The photos stay tucked away until the roll closes." : "The first frame is always the hardest."}</p></div> : roll.photos.length ? <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{roll.photos.slice(-8).map((photo)=><div key={photo.id} className="photo-frame aspect-square"><PhotoImage src={photo.src} fallbackSrc={photo.cloudinaryOriginalSrc} alt={photo.caption||"A photo in this roll"} className="h-full w-full object-cover"/><span className="absolute bottom-2 left-2 z-[1] bg-black/50 px-2 py-1 font-mono text-[8px] text-white">{formatTime(photo.at)}</span></div>)}</div> : <div className="py-10 text-center"><Camera size={20} className="mx-auto text-[#756e62]"/><p className="mt-3 font-display text-xl">Nothing in the envelope yet.</p><p className="mt-1 text-xs text-[#80796d]">The first frame is always the hardest.</p></div>}
      </section>
      <div className="mt-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><p className="flex items-center gap-2 font-mono text-[9px] tracking-[.04em] text-[#6f695f]"><Share2 size={12}/> {configured && user ? "This roll is shared with accounts that join using its invite code." : "This session is a local prototype. There are no real participants or shared uploads."}</p><DeleteRollButton rollId={roll.id} rollName={roll.name} photoCount={roll.photos.length} ownerId={roll.ownerId}/></div>
    </div>
  </main>;
}

export default function RollDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { rolls, ready } = useApp();
  const roll = rolls.find((item)=>item.id===id);
  if (!ready) return <main className="min-h-screen px-5 py-28 text-center font-mono text-xs tracking-widest text-[#898378]">LOADING THE ROLL...</main>;
  if (!roll) return <main className="min-h-screen px-5 py-28 text-center"><p className="eyebrow">NO ROLL FOUND</p><p className="mt-3 font-display text-3xl">That roll isn’t in this browser.</p><Link href="/dashboard" className="button-secondary mt-6">Back to your rolls</Link></main>;
  return <RollContents key={roll.id} roll={roll}/>;
}
