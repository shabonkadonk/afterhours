"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Check, Disc3, Film, Moon, Sparkles, Sun } from "lucide-react";
import { FormEvent, useState } from "react";
import { useApp } from "@/components/app-provider";
import { LocalDemoNote } from "@/components/roll-ui";

const themes = [
  { name: "After dark", icon: Moon, note: "flash, noise, last call" },
  { name: "Soft focus", icon: Sun, note: "slow hours, warm light" },
  { name: "Flash on", icon: Sparkles, note: "bright faces, big nights" },
  { name: "No theme", icon: Film, note: "let the night decide" },
];

export default function CreateRollPage() {
  const router = useRouter();
  const { createRoll } = useApp();
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("6");
  const [photoLimit, setPhotoLimit] = useState("24");
  const [theme, setTheme] = useState("After dark");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (cleanName.length < 2) { setError("Give this roll a name with at least two characters."); return; }
    if (cleanName.length > 48) { setError("Keep the roll name under 48 characters."); return; }
    try {
      const roll = await createRoll({ name: cleanName, durationHours: Number(duration), photoLimit: Number(photoLimit), theme });
      router.push(`/rolls/${roll.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create this roll. Try again.");
    }
  }

  return <main className="mx-auto min-h-screen max-w-[1440px] px-5 pb-20 pt-8 sm:px-10 sm:pt-12 lg:px-16">
    <div className="mx-auto max-w-[1040px]"><LocalDemoNote/>
      <Link href="/dashboard" className="mt-8 inline-flex items-center gap-2 font-mono text-[10px] tracking-[.12em] text-[#8a8378] transition hover:text-[#eee9de]"><ArrowLeft size={13}/> YOUR ROLLS</Link>
      <div className="mt-8 grid gap-10 lg:grid-cols-[.72fr_1.28fr] lg:gap-16">
        <div><p className="eyebrow mb-4">BEFORE THE NIGHT BEGINS</p><h1 className="font-display text-5xl leading-[.91] tracking-[-.055em] sm:text-6xl">Start a<br/><i className="text-[#b54b40]">new roll.</i></h1><p className="mt-6 max-w-[310px] text-sm leading-6 text-[#999287]">Give this night a name. Choose how long the camera stays closed, then pass it around.</p><div className="mt-10 hidden border-t border-white/10 pt-5 lg:block"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center border border-white/15 text-[#b04b41]"><Disc3 size={17}/></span><div><p className="font-mono text-[9px] tracking-[.12em] text-[#aaa396]">ONE NIGHT. ONE SHARED ROLL.</p><p className="mt-1 text-[11px] text-[#69635b]">No feed. No likes. Just the photos.</p></div></div></div></div>
        <form onSubmit={handleSubmit} className="border border-white/10 bg-[#191714] p-5 sm:p-8">
          <div><label htmlFor="roll-name" className="eyebrow">01 <span className="mx-1 text-[#a33a32]">/</span> WHAT ARE WE CALLING IT?</label><input id="roll-name" autoFocus maxLength={48} required value={name} onChange={(event) => {setName(event.target.value); setError("");}} placeholder="e.g. No plans after 10" className="field mt-3 text-[16px]"/><div className="mt-2 flex justify-between font-mono text-[9px] text-[#726c62]"><span>MAKE IT SOUND LIKE THE NIGHT.</span><span>{name.length}/48</span></div></div>
          <div className="mt-8"><label className="eyebrow">02 <span className="mx-1 text-[#a33a32]">/</span> WHEN DOES THE ROLL CLOSE?</label><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{[{v:"2", l:"2 HOURS"},{v:"6",l:"6 HOURS"},{v:"12",l:"12 HOURS"},{v:"24",l:"24 HOURS"}].map((item)=><button type="button" key={item.v} onClick={()=>setDuration(item.v)} className={`border px-2 py-3 font-mono text-[10px] tracking-[.08em] transition ${duration===item.v?"border-[#a44b42] bg-[#a33a32]/10 text-[#e2c4b8]":"border-white/10 text-[#8f887d] hover:border-white/25"}`}><span className="block text-base">{item.v}</span><span className="mt-1 block text-[8px]">{item.l}</span></button>)}</div></div>
          <div className="mt-8"><label className="eyebrow">03 <span className="mx-1 text-[#a33a32]">/</span> HOW MANY FRAMES?</label><div className="mt-3 flex flex-wrap gap-2">{[12,24,36].map((count)=><button type="button" key={count} onClick={()=>setPhotoLimit(String(count))} className={`inline-flex min-w-[82px] items-center justify-between gap-4 border px-3 py-2.5 font-mono text-[11px] transition ${photoLimit===String(count)?"border-[#a44b42] text-[#e2c4b8]":"border-white/10 text-[#8f887d] hover:border-white/25"}`}>{count} <span className="text-[8px] text-[#716b61]">EXP</span>{photoLimit===String(count)&&<Check size={12} className="text-[#b54b40]"/>}</button>)}</div></div>
          <fieldset className="mt-8"><legend className="eyebrow">04 <span className="mx-1 text-[#a33a32]">/</span> PICK A FEELING</legend><div className="mt-3 grid grid-cols-2 gap-2">{themes.map((item)=>{const Icon=item.icon; return <button type="button" key={item.name} onClick={()=>setTheme(item.name)} className={`flex min-h-[76px] items-start gap-3 border p-3 text-left transition ${theme===item.name?"border-[#a44b42] bg-[#a33a32]/[.07]":"border-white/10 hover:border-white/25"}`}><Icon size={15} className={theme===item.name?"mt-0.5 text-[#bd5a4f]":"mt-0.5 text-[#777168]"}/><span><span className="block text-xs text-[#ded8cd]">{item.name}</span><span className="mt-1 block text-[10px] leading-4 text-[#777168]">{item.note}</span></span></button>})}</div></fieldset>
          {error && <p role="alert" className="mt-5 border-l-2 border-[#b54b40] pl-3 text-xs text-[#e08478]">{error}</p>}
          <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="font-mono text-[9px] leading-4 text-[#777168]">THIS LOCAL ROLL LIVES IN THIS BROWSER.</p><button type="submit" className="button-primary w-full sm:w-auto">Create the roll <ArrowUpRight size={14}/></button></div>
        </form>
      </div>
    </div>
  </main>;
}
