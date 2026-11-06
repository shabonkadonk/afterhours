"use client";

import { ArrowLeft, ArrowRight, Check, Crown, LoaderCircle, Sparkles, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Award, AwardsResult } from "@/lib/ai/awards-types";
import { PhotoImage } from "@/components/photo-image";
import type { Photo } from "@/lib/types";
import { formatDate } from "@/components/roll-ui";

type AwardsStatus = "loading" | "none" | "generating" | "completed" | "failed";
type ProviderMode = "mock" | "cloudflare" | "unavailable";
type ServerState = {
  generationStatus: Exclude<AwardsStatus, "loading">;
  awards: AwardsResult | null;
  provider: string | null;
  providerMode: ProviderMode;
  maxPhotos: number;
  canGenerate: boolean;
  canDelete: boolean;
};

const sampleTitles = [
  "Most Cinematic Moment", "Best Accidental Photo", "Best Photo Aesthetic", "Most Mysterious Photo",
  "Funniest Photo", "Most Likely to Become a Meme", "Best Background Appearance",
] as const;

function makeLocalPreview(photoIds: string[]): AwardsResult {
  const regular = photoIds.slice(0, Math.min(6, Math.max(0, photoIds.length - 1))).map((photoId, index) => ({
    id: `sample_${index + 1}`,
    title: sampleTitles[index % sampleTitles.length],
    photoId,
    explanation: "Sample preview only: the committee has seen nothing and is already forming strong opinions.",
    runnerUpPhotoId: null,
  }));
  const finalePhotoId = photoIds[0];
  return {
    awards: [...regular, {
      id: "sample_finale",
      title: "Photo of the Night",
      photoId: finalePhotoId,
      explanation: "Sample grand finale: no analysis, just an extremely confident envelope and zero evidence.",
      runnerUpPhotoId: photoIds[1] ?? null,
    }],
    summary: "A sample ceremony preview. No photos were uploaded or analyzed.",
  };
}

export function AwardsSection({
  rollId,
  rollName,
  rollDate,
  photos,
  isCloudRoll,
}: {
  rollId: string;
  rollName: string;
  rollDate: string;
  photos: Photo[];
  isCloudRoll: boolean;
}) {
  const [status, setStatus] = useState<AwardsStatus>(isCloudRoll ? "loading" : "none");
  const [serverState, setServerState] = useState<ServerState | null>(null);
  const [awardsResult, setAwardsResult] = useState<AwardsResult | null>(null);
  const [resultProvider, setResultProvider] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [ceremonyStep, setCeremonyStep] = useState(-3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shareMessage, setShareMessage] = useState("");

  const maxPhotos = serverState?.maxPhotos ?? 10;
  const providerMode: ProviderMode = isCloudRoll ? serverState?.providerMode ?? "unavailable" : "mock";
  const awards = awardsResult?.awards ?? [];
  const awardPhotos = useMemo(() => new Map(photos.map((photo) => [photo.id, photo])), [photos]);
  const currentAward = ceremonyStep >= 0 ? awards[ceremonyStep] : undefined;

  const refreshStatus = useCallback(async () => {
    if (!isCloudRoll) return null;
    try {
      const response = await fetch(`/api/rolls/${rollId}/awards`, { cache: "no-store" });
      const payload = await response.json() as Partial<ServerState> & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Awards couldn’t be loaded.");
      const next = payload as ServerState;
      setServerState(next);
      setStatus(next.generationStatus);
      setAwardsResult(next.awards);
      setResultProvider(next.provider);
      return next.generationStatus;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Awards couldn’t be loaded.");
      setStatus("failed");
      return "failed" as const;
    }
  }, [isCloudRoll, rollId]);

  useEffect(() => { void refreshStatus(); }, [refreshStatus]);

  useEffect(() => {
    if (!isCloudRoll || status !== "generating") return;
    const timer = window.setInterval(() => { void refreshStatus(); }, 2500);
    return () => window.clearInterval(timer);
  }, [isCloudRoll, refreshStatus, status]);

  useEffect(() => {
    const dialogOpen = selectionOpen || ceremonyStep >= -1;
    if (!dialogOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (selectionOpen) setSelectionOpen(false);
      else setCeremonyStep(-3);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [ceremonyStep, selectionOpen]);

  function openSelection() {
    setError("");
    setConsent(false);
    setSelectedIds(photos.slice(0, maxPhotos).map((photo) => photo.id));
    setSelectionOpen(true);
  }

  function togglePhoto(photoId: string) {
    setSelectedIds((current) => current.includes(photoId)
      ? current.filter((id) => id !== photoId)
      : current.length >= maxPhotos ? current : [...current, photoId]);
  }

  async function startGeneration() {
    if (!selectedIds.length || !consent) return;
    setBusy(true);
    setError("");
    setSelectionOpen(false);
    setStatus("generating");
    setCeremonyStep(-1);
    try {
      if (!isCloudRoll) {
        setAwardsResult(makeLocalPreview(selectedIds));
        setResultProvider("mock-preview");
        setStatus("completed");
        return;
      }
      const response = await fetch(`/api/rolls/${rollId}/awards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds: selectedIds, consent: true }),
      });
      const payload = await response.json() as { awards?: AwardsResult; provider?: string; error?: string; generationStatus?: string };
      if (!response.ok) {
        if (response.status === 409 && payload.generationStatus === "generating") {
          await refreshStatus();
          return;
        }
        throw new Error(payload.error ?? "Awards couldn’t be generated.");
      }
      if (!payload.awards) throw new Error("Awards were saved, but the ceremony couldn’t be loaded. Refresh to try again.");
      setAwardsResult(payload.awards);
      setResultProvider(payload.provider ?? null);
      setStatus("completed");
      await refreshStatus();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Awards couldn’t be generated.");
      const refreshedStatus = isCloudRoll ? await refreshStatus() : "failed";
      if (refreshedStatus !== "generating" && refreshedStatus !== "completed") setStatus("failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAwards() {
    if (!isCloudRoll || !window.confirm("Clear the saved Awards ceremony for this roll?")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/rolls/${rollId}/awards`, { method: "DELETE" });
      if (!response.ok) throw new Error("Saved Awards couldn’t be cleared. Try again.");
      setAwardsResult(null);
      setResultProvider(null);
      setCeremonyStep(-1);
      await refreshStatus();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Saved Awards couldn’t be cleared.");
    } finally {
      setBusy(false);
    }
  }

  async function shareResults() {
    if (!awardsResult) return;
    const url = window.location.href;
    const text = `AFTERHOURS AWARDS · ${rollName}\n${awardsResult.awards.map((award) => award.title).join("\n")}\n\n${awardsResult.summary}`;
    if (!navigator.share) {
      setShareMessage(window.isSecureContext ? "THIS BROWSER DOESN’T SUPPORT SHARING" : "OPEN THE HTTPS APP TO SHARE");
      window.setTimeout(() => setShareMessage(""), 2200);
      return;
    }
    try {
      await navigator.share({ title: `Afterhours Awards · ${rollName}`, text, url });
      setShareMessage("RESULTS SHARED");
    } catch (caught) {
      if (caught instanceof Error && caught.name === "AbortError") return;
      setShareMessage("COULDN’T SHARE RIGHT NOW");
    }
    window.setTimeout(() => setShareMessage(""), 2200);
  }

  const samplePhoto = photos[0];
  const finalScreen = ceremonyStep === awards.length - 1 && currentAward?.title === "Photo of the Night";
  const loadingMessages = providerMode === "mock"
    ? ["Preparing the sample ceremony…", "Checking the tiny imaginary envelopes…", "The sample committee is almost ready…"]
    : ["Reviewing the selected frames…", "Comparing visual moments…", "Preparing the ceremony…"];

  return <section aria-labelledby={`awards-title-${rollId}`} className="awards-panel relative mt-7 overflow-hidden border border-[#d6c7ad]/20 bg-[radial-gradient(ellipse_at_50%_0%,rgba(192,170,134,.12),transparent_55%),linear-gradient(145deg,#26221d,#171613_74%)] p-5 sm:p-8">
    <div className="awards-shine pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full border border-[#eee2ca]/10" />
    <div className="relative">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow flex items-center gap-2 text-[#d5bd91]"><Sparkles size={13}/> AFTER THE FLASHES</p>
          <h2 id={`awards-title-${rollId}`} className="awards-chrome mt-2 font-mono text-sm font-semibold tracking-[.2em] sm:text-base">AFTERHOURS AWARDS</h2>
          <p className="mt-2 font-display text-2xl text-[#e9e1d2]">Every night deserves its own awards ceremony.</p>
          <p className="mt-2 max-w-xl text-xs leading-5 text-[#a39b8e]">Bring the roll back out for one more look. Pick the frames that belong on the big screen.</p>
        </div>
        <div className="awards-badge inline-flex w-fit shrink-0 items-center gap-2 border border-[#e1d0ad]/25 bg-[#ded1b1]/[.07] px-3 py-2 font-mono text-[8px] tracking-[.15em] text-[#e0cca1]">
          {providerMode === "mock" ? <Sparkles size={12}/> : <Crown size={12}/>} {providerMode === "mock" ? "SAMPLE MODE" : "THE AWARDS ROOM"}
        </div>
      </div>

      {status === "loading" ? <div className="mt-6 flex min-h-16 items-center gap-3 border-t border-white/10 pt-5 text-xs text-[#9b9386]"><LoaderCircle size={15} className="animate-spin"/> Checking the guest list…</div> : null}

      {status === "generating" || busy ? <div className="awards-loading mt-6 border-y border-[#d6c7ad]/15 py-7" aria-live="polite">
        <div className="flex items-center gap-3 text-[#edddb9]"><span className="awards-star"><Sparkles size={18}/></span><p className="font-display text-2xl">The ceremony is getting ready.</p></div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[9px] tracking-[.09em] text-[#999081]">{loadingMessages.map((message, index) => <span key={message} className={`awards-loading-message awards-loading-message--${index + 1}`}>{message}</span>)}</div>
        {providerMode === "mock" && <p className="mt-3 text-[10px] leading-4 text-[#8c8377]">Sample mode does not analyze or send your photos.</p>}
      </div> : null}

      {!busy && status === "completed" && awardsResult ? <div className="mt-6 border-t border-[#d6c7ad]/15 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="eyebrow text-[#bda77e]">THE ENVELOPE HAS OPENED</p><p className="mt-1 font-display text-xl">{awardsResult.awards.length} awards. One very shiny ending.</p></div>
          {resultProvider === "mock" || resultProvider === "mock-preview" ? <span className="font-mono text-[8px] tracking-[.12em] text-[#a99d83]">SAMPLE RESULTS · PHOTOS NOT ANALYZED</span> : <span className="font-mono text-[8px] tracking-[.12em] text-[#a99d83]">SAVED WITH THIS ROLL</span>}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => setCeremonyStep(-1)} className="button-primary min-h-11 border-[#c5a978] bg-[#9c8052] px-4 text-xs text-[#fff5df] hover:border-[#d6bd94] hover:bg-[#ae9160]">WATCH THE CEREMONY <ArrowRight size={14}/></button>
          {serverState?.canDelete && <button onClick={deleteAwards} disabled={busy} className="button-secondary min-h-11 px-4 text-[10px] text-[#b0a79a]"><Trash2 size={13}/> CLEAR SAVED AWARDS</button>}
        </div>
      </div> : null}

      {!busy && status !== "loading" && status !== "completed" ? <div className="mt-6 grid gap-4 border-t border-[#d6c7ad]/15 pt-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="flex items-center gap-3">
          {samplePhoto ? <div className="photo-frame h-16 w-16 shrink-0 border border-[#e5d3ad]/30"><PhotoImage src={samplePhoto.src} thumbnailSrc={samplePhoto.thumbnailSrc} alt="A photo from this roll" className="h-full w-full object-cover"/></div> : <div className="grid h-16 w-16 shrink-0 place-items-center border border-[#e5d3ad]/25 bg-white/[.03] text-[#c5a978]"><Sparkles size={19}/></div>}
          <div><p className="font-mono text-[8px] tracking-[.16em] text-[#bda77e]">{isCloudRoll ? "THE CEREMONY IS YOURS" : "A SNEAK PEEK"}</p><p className="mt-1 font-display text-xl text-[#eee6d7]">Most Cinematic Moment</p><p className="mt-1 max-w-lg text-[10px] leading-4 text-[#928a7d]">The night, through the frames your crew caught.</p></div>
        </div>
        {isCloudRoll && !serverState ? <div className="max-w-xs text-[10px] leading-4 text-[#b0a79a]">Awards couldn’t verify access just now. Refresh the gallery and try again.</div>
          : isCloudRoll && providerMode === "unavailable" ? <div className="max-w-xs text-[10px] leading-4 text-[#b0a79a]">Awards are in sample mode by default. Live photo analysis remains disabled until provider access and requirements are confirmed.</div>
            : <button onClick={openSelection} disabled={!photos.length || busy || (isCloudRoll && !serverState?.canGenerate)} className="button-primary min-h-12 border-[#c5a978] bg-[#9c8052] px-5 text-xs text-[#fff5df] hover:border-[#d6bd94] hover:bg-[#ae9160] disabled:cursor-not-allowed disabled:opacity-50">{isCloudRoll ? status === "failed" ? "TRY AGAIN" : "GENERATE AWARDS" : "PREVIEW SAMPLE CEREMONY"} <ArrowRight size={14}/></button>}
      </div> : null}

      {error && !selectionOpen ? <p role="alert" className="mt-4 border-l-2 border-[#c55448] pl-3 text-xs leading-5 text-[#e2aa9f]">{error}</p> : null}
      {isCloudRoll && resultProvider === "cloudflare" && status === "none" && <p className="mt-4 border-t border-white/10 pt-3 text-[9px] leading-4 text-[#837b6f]">Up to {maxPhotos} selected reduced-size photos are sent to Cloudflare Workers AI only after you confirm. Completed results are saved to this roll.</p>}
      {!isCloudRoll && <p className="mt-4 border-t border-white/10 pt-3 text-[9px] leading-4 text-[#837b6f]">Sample preview only. It stays in this browser and does not analyze or upload your photos.</p>}
    </div>

    {ceremonyStep >= -1 && status === "completed" && awardsResult && !busy ? <div className="awards-ceremony" role="dialog" aria-modal="true" aria-label="Afterhours Awards ceremony">
      <div className="awards-ceremony__backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCeremonyStep(-3); }}>
        <div className="awards-ceremony__card grain relative max-h-[92svh] w-full max-w-3xl overflow-y-auto border border-[#ddc99f]/30 bg-[radial-gradient(ellipse_at_50%_0%,rgba(192,170,134,.2),transparent_52%),linear-gradient(145deg,#27231d,#171613_75%)] p-5 shadow-2xl sm:p-9">
          <button onClick={() => setCeremonyStep(-3)} className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center border border-white/15 bg-black/30 text-[#d9d0bf]" aria-label="Close ceremony"><X size={17}/></button>
          {ceremonyStep === -1 ? <div className="relative py-8 text-center sm:py-14">
            <Sparkles size={22} className="mx-auto text-[#d4b77c]"/><p className="mt-5 font-mono text-[10px] tracking-[.27em] text-[#d2b880]">A VERY OFFICIAL PRODUCTION</p><h2 className="awards-chrome mt-4 font-mono text-2xl tracking-[.16em] sm:text-4xl">AFTERHOURS AWARDS</h2><p className="mt-3 font-display text-2xl text-[#e8ddc9]">Your night. Your awards.</p><p className="mt-5 font-mono text-[9px] tracking-[.11em] text-[#938a7b]">{rollName.toUpperCase()} <span className="mx-2 text-[#bf9e62]">/</span> {formatDate(rollDate).toUpperCase()}</p><p className="mx-auto mt-4 max-w-md text-xs leading-5 text-[#a49a88]">{awardsResult.summary}</p>
            <button onClick={() => setCeremonyStep(0)} className="button-primary mt-7 border-[#d1b278] bg-[#a27f47] px-7 text-xs text-[#fff4dc] hover:border-[#e1c995] hover:bg-[#b2925c]">START THE CEREMONY <ArrowRight size={14}/></button>
          </div> : currentAward ? <div className="awards-ceremony__award relative">
            <div className="flex items-center justify-between gap-3 pr-10"><p className="font-mono text-[8px] tracking-[.18em] text-[#c7ad7c]">{finalScreen ? "THE GRAND FINALE" : `AWARD ${String(ceremonyStep + 1).padStart(2, "0")} / ${String(awards.length).padStart(2, "0")}`}</p><span className="font-mono text-[8px] text-[#8e8577]">{rollName.toUpperCase()}</span></div>
            <p className="mt-5 font-mono text-[9px] tracking-[.18em] text-[#a99673]">{finalScreen ? "PHOTO OF THE NIGHT" : "AND THE AWARD GOES TO…"}</p>
            <h2 className="awards-chrome mt-2 font-display text-4xl leading-[.95] tracking-[-.04em] sm:text-6xl">{currentAward.title}</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_.7fr] sm:items-start">
              {awardPhotos.get(currentAward.photoId) ? <div className="awards-winner-frame photo-frame relative mx-auto aspect-[4/5] w-full max-w-md border border-[#e3cf9e]/35 p-1.5"><PhotoImage src={awardPhotos.get(currentAward.photoId)!.src} thumbnailSrc={awardPhotos.get(currentAward.photoId)!.thumbnailSrc} alt={awardPhotos.get(currentAward.photoId)!.caption || `${currentAward.title} winner`} loading="eager" className="h-full w-full object-cover"/><span className="absolute bottom-3 left-3 border border-[#e3cf9e]/40 bg-black/60 px-2 py-1 font-mono text-[8px] tracking-[.1em] text-[#f2e4c4]">WINNING FRAME</span><span className="awards-frame-star absolute right-4 top-3 text-[#f6dfad]">✦</span></div> : <div className="grid aspect-[4/5] w-full place-items-center border border-[#e3cf9e]/20 bg-black/20 text-sm text-[#9d927e]">This winning photo is no longer available.</div>}
              <div className="flex h-full flex-col justify-between gap-5">
                <div><p className="font-mono text-[8px] tracking-[.17em] text-[#a99673]">THE COMMITTEE’S CITATION</p><p className="mt-3 font-display text-2xl leading-snug text-[#e5dac7]">“{currentAward.explanation}”</p></div>
                {currentAward.runnerUpPhotoId && awardPhotos.get(currentAward.runnerUpPhotoId) && <div className="flex items-center gap-3 border-t border-white/10 pt-4"><div className="photo-frame h-14 w-14 shrink-0 border border-white/15"><PhotoImage src={awardPhotos.get(currentAward.runnerUpPhotoId)!.src} thumbnailSrc={awardPhotos.get(currentAward.runnerUpPhotoId)!.thumbnailSrc} alt="Runner-up photo" className="h-full w-full object-cover"/></div><div><p className="font-mono text-[8px] tracking-[.12em] text-[#9d927e]">ALSO IN THE RUNNING</p><p className="mt-1 font-display text-base">A worthy runner-up.</p></div></div>}
                {finalScreen ? <div className="border-t border-[#ddc99f]/20 pt-4"><p className="font-mono text-[8px] tracking-[.17em] text-[#a99673]">THE NIGHT IN ONE SENTENCE</p><p className="mt-2 font-display text-lg text-[#e0d5c2]">{awardsResult.summary}</p><div className="mt-5 flex flex-wrap gap-2"><button onClick={shareResults} className="button-primary min-h-11 border-[#c5a978] bg-[#9c8052] px-4 text-[10px] text-[#fff5df] hover:bg-[#ae9160]">{shareMessage || "SHARE RESULTS"} <ArrowRight size={13}/></button><button onClick={() => setCeremonyStep(-3)} className="button-secondary min-h-11 px-4 text-[10px]">RETURN TO THE ROLL</button></div></div>
                  : <div className="flex items-center justify-between border-t border-white/10 pt-4"><button onClick={() => setCeremonyStep((step) => Math.max(0, step - 1))} disabled={ceremonyStep === 0} className="button-secondary min-h-10 px-3 text-[9px] disabled:opacity-30"><ArrowLeft size={13}/> PREVIOUS</button><button onClick={() => setCeremonyStep((step) => Math.min(awards.length - 1, step + 1))} className="button-primary min-h-10 border-[#c5a978] bg-[#9c8052] px-4 text-[9px] text-[#fff5df] hover:bg-[#ae9160]">NEXT AWARD <ArrowRight size={13}/></button></div>}
              </div>
            </div>
            {finalScreen && <p className="mt-5 text-center font-mono text-[8px] tracking-[.15em] text-[#a99673]">THE FLASHES FADE. THE GROUP CHAT DOESN’T.</p>}
          </div> : null}
        </div>
      </div>
    </div> : null}

    {selectionOpen ? <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby={`awards-select-title-${rollId}`}>
      <div className="max-h-[94svh] w-full max-w-2xl overflow-y-auto border border-[#d6c7ad]/30 bg-[#1d1a16] p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-5"><div><p className="eyebrow text-[#c3aa79]">THE SHORTLIST</p><h3 id={`awards-select-title-${rollId}`} className="mt-2 font-display text-3xl">Choose the frames.</h3><p className="mt-2 text-xs leading-5 text-[#9b9387]">Pick up to {maxPhotos} photos for this ceremony. Only your selected photos are considered.</p></div><button onClick={() => setSelectionOpen(false)} className="flex h-10 w-10 shrink-0 items-center justify-center border border-white/15 text-[#ccc2b0]" aria-label="Close photo selection"><X size={16}/></button></div>
        <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4">{photos.map((photo, index) => {
          const checked = selectedIds.includes(photo.id);
          const atLimit = !checked && selectedIds.length >= maxPhotos;
          return <button type="button" key={photo.id} onClick={() => togglePhoto(photo.id)} disabled={atLimit} aria-pressed={checked} className={`choice-card relative aspect-square overflow-hidden border text-left disabled:opacity-40 ${checked ? "border-[#dbbf86] ring-1 ring-[#dbbf86]/50" : "border-white/10"}`}>
            <PhotoImage src={photo.src} thumbnailSrc={photo.thumbnailSrc} alt={photo.caption || `Photo ${index + 1}`} className="h-full w-full object-cover"/>
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/85 to-transparent px-2 pb-2 pt-6 font-mono text-[8px] tracking-[.08em] text-white"><span>FRAME {String(index + 1).padStart(2, "0")}</span><span className={`grid h-5 w-5 place-items-center border ${checked ? "border-[#dbbf86] bg-[#b89455]" : "border-white/60 bg-black/25"}`}>{checked && <Check size={12}/>}</span></span>
          </button>;
        })}</div>
        <p className="mt-3 font-mono text-[8px] tracking-[.13em] text-[#81796e]">{selectedIds.length} / {maxPhotos} SELECTED</p>
        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="text-xs leading-5 text-[#c2b9a8]">{providerMode === "cloudflare" ? "A vision model looks for visible objects, setting, composition, and clear moments. It must not identify people or infer personal traits. The selected reduced-size previews are sent to Cloudflare Workers AI. Afterhours saves award text and photo references with this roll, not another copy of the photos." : isCloudRoll ? "Mock mode is on. These are sample awards; the selected photos will not be sent to or analyzed by an AI provider." : "This sample preview does not upload or analyze photos. It is not saved to your roll."}</p>
          <label className="mt-4 flex cursor-pointer items-start gap-3 text-[11px] leading-5 text-[#ddd4c5]"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-4 w-4 accent-[#b89455]"/><span>{providerMode === "cloudflare" ? "I agree to send the selected photo previews to Cloudflare Workers AI for this Awards ceremony." : "I understand this is a sample preview and my photos will not be analyzed."}</span></label>
        </div>
        {error && <p role="alert" className="mt-3 text-xs text-[#e2aa9f]">{error}</p>}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button onClick={() => setSelectionOpen(false)} className="button-secondary min-h-11 px-5 text-[10px]">NOT NOW</button><button onClick={startGeneration} disabled={!selectedIds.length || !consent || busy} className="button-primary min-h-11 border-[#c5a978] bg-[#9c8052] px-5 text-[10px] text-[#fff5df] hover:bg-[#ae9160] disabled:cursor-not-allowed disabled:opacity-50">{providerMode === "cloudflare" ? "GENERATE AWARDS" : "START SAMPLE CEREMONY"} <ArrowRight size={13}/></button></div>
      </div>
    </div> : null}
  </section>;
}
