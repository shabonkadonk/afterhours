"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Camera, ChevronRight, Clock3, KeyRound, Plus, Sparkles } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { DeleteRollButton } from "@/components/delete-roll-button";
import { PhotoImage } from "@/components/photo-image";
import { AvatarStack, LocalDemoNote, PhotoCount, ThemeBadge, formatDate } from "@/components/roll-ui";
import type { Roll } from "@/lib/types";

function ActiveRollCard({ roll }: { roll: Roll }) {
  return <div className="roll-card roll-card--active scroll-reveal scroll-reveal--1 relative"><Link href={`/rolls/${roll.id}`} className="group relative block min-h-[380px] overflow-hidden border border-white/10 bg-[#221f1a] sm:min-h-[420px]">
    <div className="dashboard-glow absolute inset-0 bg-[radial-gradient(ellipse_at_82%_28%,rgba(147,56,46,.21),transparent_45%),linear-gradient(115deg,#171613_12%,#211d19_100%)]"/><div className="grain absolute inset-0 opacity-35"/><div className="absolute -right-10 top-10 hidden font-display text-[340px] leading-none text-white/[.025] sm:block">{roll.photos.length.toString().padStart(2,"0")}</div><div className="absolute inset-0 bg-gradient-to-t from-[#171613]/80 via-transparent to-black/5"/>
    <div className="relative flex min-h-[380px] flex-col justify-between p-5 sm:min-h-[420px] sm:p-8">
      <div className="flex items-start justify-between"><span className="eyebrow flex items-center gap-2 text-[#d1c9bd]"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#b84b41]"/>ROLL IN PROGRESS</span><ThemeBadge theme={roll.theme}/></div>
      <div><p className="mb-3 font-mono text-[10px] tracking-[.17em] text-[#b4ac9f]">STARTED {formatDate(roll.createdAt).toUpperCase()}</p><h3 className="font-display max-w-xl text-4xl leading-[.95] tracking-[-.04em] sm:text-6xl">{roll.name}</h3>
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3"><AvatarStack people={roll.participants}/><span className="h-4 w-px bg-white/15"/><PhotoCount roll={roll}/><span className="font-mono text-[10px] text-[#aaa396]">ENDS {formatDate(roll.endsAt, { hour: "numeric", minute: "2-digit" }).toUpperCase()}</span></div>
        <div className="mt-7 flex items-center gap-2 text-[10px] tracking-[.15em] text-[#eee9de] transition group-hover:text-[#cf665a]">OPEN SESSION <ArrowRight size={14}/></div>
      </div>
    </div>
  </Link><DeleteRollButton rollId={roll.id} rollName={roll.name} photoCount={roll.photos.length} ownerId={roll.ownerId} className="absolute bottom-4 right-4 z-10 min-h-9 bg-[#171613]/90 px-2 sm:bottom-5 sm:right-5"/></div>;
}

function RevealedCard({ roll, index }: { roll: Roll; index: number }) {
  const cover = roll.photos[0]?.src;
  return <div className={`roll-card scroll-reveal scroll-reveal--${(index % 3) + 1} relative`}><Link href={`/rolls/${roll.id}/reveal`} className="group block border border-white/10 bg-[#1b1916] transition hover:border-white/25">
    <div className="photo-frame relative aspect-[1.35]">
      {cover ? <PhotoImage src={cover} thumbnailSrc={roll.photos[0]?.thumbnailSrc} alt="" loading="lazy" className="dashboard-cover h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"/> : <div className="flex h-full items-center justify-center text-[#756e62]"><Camera size={28}/></div>}
      <span className="absolute left-3 top-3 z-[1] font-mono text-[9px] tracking-[.12em] text-white drop-shadow">ROLL 0{index + 1}</span>
      <span className="absolute bottom-3 right-3 z-[1] font-mono text-[9px] text-white drop-shadow">{roll.photos.length.toString().padStart(2,"0")} FRAMES</span>
    </div>
    <div className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="eyebrow mb-2">{formatDate(roll.createdAt).toUpperCase()} · OPENED</p><h3 className="font-display text-[22px] leading-tight">{roll.name}</h3></div><ChevronRight size={15} className="mt-1 shrink-0 text-[#8d867a] transition group-hover:translate-x-1 group-hover:text-white"/></div><div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3"><AvatarStack people={roll.participants} size="sm"/><ThemeBadge theme={roll.theme}/></div></div>
  </Link><DeleteRollButton rollId={roll.id} rollName={roll.name} photoCount={roll.photos.length} ownerId={roll.ownerId} className="absolute right-2 top-2 z-[2] min-h-9 bg-[#141311]/90 px-2"/></div>;
}

function AdditionalActiveRoll({ roll, index }: { roll: Roll; index: number }) {
  return <Link href={`/rolls/${roll.id}`} className={`roll-card scroll-reveal scroll-reveal--${(index % 3) + 1} group flex flex-col justify-between gap-4 border border-white/10 bg-[#1a1815] p-4 transition hover:border-white/25 sm:flex-row sm:items-center sm:px-5`}><div className="flex items-center gap-4"><span className="dashboard-frame-count flex h-9 w-9 shrink-0 items-center justify-center border border-[#a33a32]/30 font-mono text-[10px] text-[#bd5c51]">{roll.photos.length.toString().padStart(2,"0")}</span><div><p className="eyebrow">OPEN ROLL · {roll.theme.toUpperCase()}</p><h3 className="mt-1 font-display text-xl">{roll.name}</h3></div></div><div className="flex items-center justify-between gap-5 sm:justify-end"><AvatarStack people={roll.participants} size="sm"/><PhotoCount roll={roll}/><ArrowRight size={14} className="text-[#817a70] transition group-hover:translate-x-1 group-hover:text-white"/></div></Link>;
}

export default function DashboardPage() {
  const { rolls, ready } = useApp();
  const active = rolls.filter((roll) => roll.status === "active");
  const revealed = rolls.filter((roll) => roll.status === "revealed");
  return <main className="dashboard-page mx-auto min-h-screen max-w-[1440px] px-5 pb-20 pt-8 sm:px-10 sm:pt-12 lg:px-16">
    <LocalDemoNote />
    <div className="dashboard-intro scroll-reveal mt-10 flex flex-col justify-between gap-5 border-b border-white/10 pb-7 sm:flex-row sm:items-end">
      <div><p className="eyebrow mb-3">AFTERHOURS <span className="mx-2 text-[#a33a32]">/</span> SHARED PHOTO ROLLS</p><h1 className="dashboard-title font-display text-5xl tracking-[-.055em] sm:text-6xl">The good nights.</h1></div>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"><Link href="/rolls/new" className="dashboard-action dashboard-action--primary button-primary min-h-12 w-full sm:w-fit"><Plus size={15}/> Make a roll <ArrowUpRight size={14}/></Link><Link href="/join" className="dashboard-action dashboard-action--secondary button-secondary min-h-12 w-full sm:w-fit"><KeyRound size={14}/> Join with code</Link></div>
    </div>
    {!ready ? <div className="dashboard-loading py-24 text-center font-mono text-xs tracking-widest text-[#898378]">LOADING YOUR FILM...</div> : <>
      <section className="mt-8"><div className="dashboard-section-heading scroll-reveal mb-4 flex items-center justify-between"><h2 className="eyebrow flex items-center gap-2"><Clock3 size={13} className="text-[#a84940]"/> IN PROGRESS <span className="text-[#676158]">({active.length.toString().padStart(2,"0")})</span></h2><span className="text-xs text-[#676158]">Photos appear when the roll ends</span></div>
        {active.length ? <><div className="grid gap-4 lg:grid-cols-[1.45fr_.55fr]">{active.slice(0, 1).map((roll) => <ActiveRollCard key={roll.id} roll={roll}/>)}<div className="scroll-reveal scroll-reveal--2 flex flex-col justify-between border border-white/10 bg-[#1a1815] p-5 sm:p-7"><div><div className="flex h-9 w-9 items-center justify-center border border-[#a33a32]/40 text-[#bd5c51]"><Sparkles size={16}/></div><p className="eyebrow mt-6">A SHARED ALBUM FOR THE NIGHT</p><h3 className="mt-3 max-w-[250px] font-display text-3xl leading-[1.02]">Be there now.<br/><i>Remember it later.</i></h3><p className="mt-4 max-w-[290px] text-sm leading-6 text-[#8f887c]">Photos stay private while the roll is open. When it ends, everyone can see the full gallery.</p></div><div className="mt-8 border-t border-white/10 pt-4 text-xs text-[#6e685e]">Invite friends to add their photos.</div></div></div>{active.length>1&&<div className="mt-3 grid gap-2">{active.slice(1).map((roll, index)=><AdditionalActiveRoll key={roll.id} roll={roll} index={index}/>)}</div>}</> : <div className="dashboard-empty flex flex-col items-start justify-between gap-6 border border-dashed border-white/15 bg-white/[.015] p-7 sm:flex-row sm:items-center sm:p-10"><div><p className="eyebrow mb-3">READY WHEN YOU ARE</p><h3 className="font-display text-3xl">Start a roll for your next night out.</h3><p className="mt-2 text-sm text-[#898378]">Invite friends to share the photos they take.</p></div><Link href="/rolls/new" className="button-secondary shrink-0">Create a roll <ArrowUpRight size={14}/></Link></div>}
      </section>
      <section className="mt-12"><div className="dashboard-section-heading scroll-reveal mb-5 flex items-end justify-between border-b border-white/10 pb-4"><div><p className="eyebrow mb-2">YOUR GALLERIES</p><h2 className="font-display text-3xl tracking-[-.035em]">Past rolls <span className="font-sans text-sm text-[#777168]">/ {revealed.length}</span></h2></div><span className="hidden text-xs text-[#716b61] sm:block">Revisit the photos from nights out.</span></div>
        {revealed.length ? <div className="dashboard-gallery grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{revealed.map((roll, index) => <RevealedCard key={roll.id} roll={roll} index={index}/>)}</div> : <div className="dashboard-empty border border-dashed border-white/15 py-10 text-center"><Camera size={18} className="mx-auto text-[#777168]"/><p className="mt-3 font-display text-xl">Your first roll is waiting.</p><p className="mt-1 text-sm text-[#898378]">When a session ends, its photos will land here.</p></div>}
      </section>
      <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-5 text-[10px] text-[#676158] sm:flex-row sm:items-center sm:justify-between"><p><span className="font-mono tracking-[.1em]">DEMO MODE</span><span className="mx-2 text-[#a33a32]">·</span>Sample rolls are only visible in this browser. No photos are sent to a server.</p><Link href="/install" className="text-[#aaa396] underline decoration-white/20 underline-offset-4 hover:text-white">Install guide</Link></div>
    </>}
  </main>;
}
