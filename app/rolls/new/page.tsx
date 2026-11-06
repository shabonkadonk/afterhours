"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Disc3, Film, Moon, Sparkles, Sun } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { useAuth } from "@/components/auth-provider";
import { LocalDemoNote } from "@/components/roll-ui";
import { useInstalledApp } from "@/components/use-installed-app";

const themes = [
  { name: "After dark", icon: Moon, note: "flash, noise, last call" },
  { name: "Soft focus", icon: Sun, note: "slow hours, warm light" },
  { name: "Flash on", icon: Sparkles, note: "bright faces, big nights" },
  { name: "No theme", icon: Film, note: "let the night decide" },
];

function localDateTime(value: Date) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function CreateRollPage() {
  const router = useRouter();
  const { createRoll } = useApp();
  const { configured, user, loading: authLoading } = useAuth();
  const installed = useInstalledApp();
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("6");
  const [revealAt, setRevealAt] = useState("");
  const [photoLimit, setPhotoLimit] = useState("24");
  const [theme, setTheme] = useState("After dark");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [smallScreen, setSmallScreen] = useState(false);
  const needsHostSignIn = configured && !authLoading && (!user || user.is_anonymous);
  const showWizard = installed === true || smallScreen;

  useEffect(() => { setRevealAt(localDateTime(new Date(Date.now() + 6 * 60 * 60 * 1000))); }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px), (pointer: coarse)");
    const update = () => setSmallScreen(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (needsHostSignIn) router.replace(`/login?next=${encodeURIComponent("/rolls/new")}`);
  }, [needsHostSignIn, router]);

  function continueWizard() {
    setError("");
    if (step === 0) {
      if (name.trim().length < 2) { setError("Give this roll a name with at least two characters."); return; }
      if (name.trim().length > 48) { setError("Keep the roll name under 48 characters."); return; }
    }
    if (step === 1) {
      const revealDate = new Date(revealAt);
      if (!Number.isFinite(revealDate.getTime()) || revealDate.getTime() <= Date.now() || revealDate.getTime() > Date.now() + 30 * 24 * 60 * 60 * 1000) {
        setError("Choose a reveal time between now and 30 days from now."); return;
      }
    }
    setStep((current) => Math.min(2, current + 1));
  }

  async function createRollNow() {
    if (busy) return;
    if (showWizard && step !== 2) return;
    setError("");
    const cleanName = name.trim();
    if (cleanName.length < 2) { setError("Give this roll a name with at least two characters."); return; }
    if (cleanName.length > 48) { setError("Keep the roll name under 48 characters."); return; }
    const revealDate = new Date(revealAt);
    if (!Number.isFinite(revealDate.getTime()) || revealDate.getTime() <= Date.now() || revealDate.getTime() > Date.now() + 30 * 24 * 60 * 60 * 1000) {
      setError("Choose a reveal time between now and 30 days from now."); return;
    }
    if (needsHostSignIn || authLoading) return;
    setBusy(true);
    try {
      const roll = await createRoll({ name: cleanName, endsAt: revealDate.toISOString(), photoLimit: Number(photoLimit), theme });
      router.push(`/rolls/${roll.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create this roll. Try again.");
      setBusy(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (showWizard && step !== 2) return;
    void createRollNow();
  }

  if (configured && (authLoading || needsHostSignIn)) return <main className="create-auth-gate"><p className="eyebrow">AFTERHOURS</p><p>{authLoading ? "Checking your session…" : "Taking you to host sign-in…"}</p></main>;

  if (showWizard) return <main className={`installed-create${installed === true ? "" : " mobile-create"}`}>
    <div className="installed-create__inner">
      <div className="installed-create__top">
        {step > 0 ? <button type="button" onClick={() => { setError(""); setStep((current) => current - 1); }} className="installed-create__back"><ArrowLeft size={16}/> Back</button> : <Link href="/" className="installed-create__back"><ArrowLeft size={16}/> Home</Link>}
        <span className="installed-create__count">{String(step + 1).padStart(2, "0")} <i>/</i> 03</span>
      </div>
      <div className="installed-create__progress" aria-label={`Step ${step + 1} of 3`}><span style={{ width: `${((step + 1) / 3) * 100}%` }}/></div>
      <form onSubmit={handleSubmit} className="installed-create__form">
        {step === 0 && <section className="installed-create__step" key="name">
          <p className="eyebrow">BEFORE THE NIGHT BEGINS</p><h1 className="font-display">Name this night.</h1><p className="installed-create__hint">Give the shared camera roll a name.</p>
          <label className="sr-only" htmlFor="roll-name">Roll name</label><input id="roll-name" autoFocus maxLength={48} required value={name} onChange={(event) => { setName(event.target.value); setError(""); }} placeholder="e.g. No plans after 10" className="field installed-create__name"/><div className="installed-create__field-note"><span>MAKE IT SOUND LIKE THE NIGHT.</span><span>{name.length}/48</span></div>
        </section>}
        {step === 1 && <section className="installed-create__step" key="reveal">
          <p className="eyebrow">WHEN SHOULD IT OPEN?</p><h1 className="font-display">Set the reveal.</h1><p className="installed-create__hint">Everyone adds photos until then.</p>
          <div className="installed-create__durations">{[{ v: "2", l: "2 hours" }, { v: "6", l: "6 hours" }, { v: "12", l: "12 hours" }, { v: "24", l: "24 hours" }].map((item) => <button type="button" key={item.v} aria-pressed={duration === item.v} onClick={() => { setDuration(item.v); setRevealAt(localDateTime(new Date(Date.now() + Number(item.v) * 60 * 60 * 1000))); }} className={`choice-card ${duration === item.v ? "is-selected" : ""}`}>{item.l}</button>)}</div>
          <label className="installed-create__date"><span className="eyebrow">OR PICK A DATE + TIME</span><input aria-label="Reveal date and time" type="datetime-local" required min={localDateTime(new Date())} max={localDateTime(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))} value={revealAt} onChange={(event) => { setDuration("custom"); setRevealAt(event.target.value); setError(""); }} className="field"/></label>
        </section>}
        {step === 2 && <section className="installed-create__step" key="look">
          <p className="eyebrow">ONE LAST THING</p><h1 className="font-display">Set the roll.</h1><p className="installed-create__hint">Choose the photo limit and the mood.</p>
          <div className="installed-create__capacity" aria-label="Photo capacity">{[12, 24, 36].map((count) => <button type="button" key={count} aria-pressed={photoLimit === String(count)} onClick={() => setPhotoLimit(String(count))} className={`choice-card ${photoLimit === String(count) ? "is-selected" : ""}`}><strong>{count}</strong><span>photos</span>{photoLimit === String(count) && <Check size={14}/>}</button>)}</div>
          <fieldset className="installed-create__themes"><legend className="eyebrow">PICK A FEELING</legend><div>{themes.map((item) => { const Icon = item.icon; return <button type="button" key={item.name} aria-pressed={theme === item.name} onClick={() => setTheme(item.name)} className={`choice-card ${theme === item.name ? "is-selected" : ""}`}><Icon size={16}/><span>{item.name}</span></button>; })}</div></fieldset>
        </section>}
        <div className="installed-create__footer">
          <p className="installed-create__error" role={error ? "alert" : undefined}>{error}</p>
          {step < 2 ? <button key={`continue-${step}`} type="button" onClick={continueWizard} className="button-primary">Continue <ArrowRight size={16}/></button> : <button key="create-roll-final" type="button" onClick={() => void createRollNow()} disabled={busy} className="button-primary">{busy ? "Creating your roll…" : "Create the roll"} {!busy && <ArrowUpRight size={15}/>}</button>}
        </div>
      </form>
    </div>
  </main>;

  return <main className="mx-auto min-h-screen max-w-[1440px] px-5 pb-20 pt-8 sm:px-10 sm:pt-12 lg:px-16">
    <div className="mx-auto max-w-[1040px]"><LocalDemoNote/>
      <Link href="/dashboard" className="mt-8 inline-flex items-center gap-2 font-mono text-[10px] tracking-[.12em] text-[#8a8378] transition hover:text-[#eee9de]"><ArrowLeft size={13}/> YOUR ROLLS</Link>
      <div className="mt-8 grid gap-10 lg:grid-cols-[.72fr_1.28fr] lg:gap-16">
        <div><p className="eyebrow mb-4">BEFORE THE NIGHT BEGINS</p><h1 className="font-display text-5xl leading-[.91] tracking-[-.055em] sm:text-6xl">Start a<br/><i className="text-[#b54b40]">new roll.</i></h1><p className="mt-6 max-w-[310px] text-sm leading-6 text-[#999287]">Give this night a name. Choose how long the camera stays closed, then pass it around.</p><div className="mt-10 hidden border-t border-white/10 pt-5 lg:block"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center border border-white/15 text-[#b04b41]"><Disc3 size={17}/></span><div><p className="font-mono text-[9px] tracking-[.12em] text-[#aaa396]">ONE NIGHT. ONE SHARED ROLL.</p><p className="mt-1 text-[11px] text-[#69635b]">No feed. No likes. Just the photos.</p></div></div></div></div>
        <form onSubmit={handleSubmit} className="flow-panel border border-white/10 bg-[#191714] p-5 sm:p-8">
          <div><label htmlFor="roll-name" className="eyebrow">01 <span className="mx-1 text-[#a33a32]">/</span> WHAT ARE WE CALLING IT?</label><input id="roll-name" autoFocus maxLength={48} required value={name} onChange={(event) => {setName(event.target.value); setError("");}} placeholder="e.g. No plans after 10" className="field mt-3 text-[16px]"/><div className="mt-2 flex justify-between font-mono text-[9px] text-[#726c62]"><span>MAKE IT SOUND LIKE THE NIGHT.</span><span>{name.length}/48</span></div></div>
          <div className="mt-8"><label className="eyebrow">02 <span className="mx-1 text-[#a33a32]">/</span> WHEN DOES THE ROLL CLOSE?</label><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{[{v:"2", l:"2 HOURS"},{v:"6",l:"6 HOURS"},{v:"12",l:"12 HOURS"},{v:"24",l:"24 HOURS"}].map((item)=><button type="button" key={item.v} aria-pressed={duration===item.v} disabled={busy} onClick={()=>{setDuration(item.v);setRevealAt(localDateTime(new Date(Date.now()+Number(item.v)*60*60*1000)));}} className={`choice-card min-h-[56px] border px-2 py-2 font-mono text-[10px] tracking-[.08em] transition disabled:opacity-60 ${duration===item.v?"border-[#a44b42] bg-[#a33a32]/10 text-[#e2c4b8]":"border-white/10 text-[#8f887d] hover:border-white/25"}`}><span className="block text-base">{item.v}</span><span className="mt-1 block text-[8px]">{item.l}</span></button>)}</div><label className="mt-3 block"><span className="eyebrow">OR SET A DATE + TIME</span><input type="datetime-local" required min={localDateTime(new Date())} max={localDateTime(new Date(Date.now()+30*24*60*60*1000))} disabled={busy} value={revealAt} onChange={(event)=>{setDuration("custom");setRevealAt(event.target.value);}} className="field mt-2 text-[16px]"/><span className="mt-1 block text-[10px] leading-4 text-[#777168]">Friends can add photos until this time. The host can reveal earlier.</span></label></div>
          <div className="mt-8"><label className="eyebrow">03 <span className="mx-1 text-[#a33a32]">/</span> HOW MANY FRAMES?</label><p className="mt-1 text-xs text-[#777168]">Choose the total number of photos everyone can add.</p><div className="mt-3 flex flex-wrap gap-2">{[12,24,36].map((count)=><button type="button" key={count} aria-pressed={photoLimit===String(count)} disabled={busy} onClick={()=>setPhotoLimit(String(count))} className={`choice-card inline-flex min-h-12 min-w-[88px] items-center justify-between gap-4 border px-3 py-2.5 font-mono text-[11px] transition disabled:opacity-60 ${photoLimit===String(count)?"border-[#a44b42] text-[#e2c4b8]":"border-white/10 text-[#8f887d] hover:border-white/25"}`}>{count} <span className="text-[8px] text-[#716b61]">EXP</span>{photoLimit===String(count)&&<Check size={12} className="text-[#b54b40]"/>}</button>)}</div></div>
          <fieldset className="mt-8"><legend className="eyebrow">04 <span className="mx-1 text-[#a33a32]">/</span> PICK A FEELING</legend><div className="mt-3 grid grid-cols-2 gap-2">{themes.map((item)=>{const Icon=item.icon; return <button type="button" key={item.name} aria-pressed={theme===item.name} disabled={busy} onClick={()=>setTheme(item.name)} className={`choice-card flex min-h-[84px] items-start gap-3 border p-3 text-left transition disabled:opacity-60 ${theme===item.name?"border-[#a44b42] bg-[#a33a32]/[.07]":"border-white/10 hover:border-white/25"}`}><Icon size={15} className={theme===item.name?"mt-0.5 text-[#bd5a4f]":"mt-0.5 text-[#777168]"}/><span><span className="block text-xs text-[#ded8cd]">{item.name}</span><span className="mt-1 block text-[10px] leading-4 text-[#777168]">{item.note}</span></span></button>})}</div></fieldset>
          {error && <p role="alert" className="mt-5 border-l-2 border-[#b54b40] pl-3 text-xs text-[#e08478]">{error}</p>}
          <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="font-mono text-[9px] leading-4 text-[#777168]">{configured && user ? "SHARED ROLL · SAVED TO YOUR ACCOUNT." : "LOCAL ROLL · SAVED IN THIS BROWSER."}</p><button type="submit" disabled={busy} className="button-primary min-h-12 w-full disabled:cursor-wait disabled:opacity-60 sm:w-auto">{busy ? "Creating your roll…" : "Create the roll"} {!busy && <ArrowUpRight size={14}/>}</button></div>
        </form>
      </div>
    </div>
  </main>;
}
