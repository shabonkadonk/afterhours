"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Archive, Download, FolderOpen, Share2, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createPhotoZip, downloadBlob, preparePhotoFiles, safeFilePart, supportsFileShare, type PreparedPhoto } from "@/lib/photo-export";
import type { Photo } from "@/lib/types";

type Props = { rollName: string; photos: Photo[]; compact?: boolean };
type ShareNavigator = Navigator & { canShare?: (data?: ShareData) => boolean; share?: (data?: ShareData) => Promise<void> };

export function RollExportControls({ rollName, photos, compact = false }: Props) {
  const { user } = useAuth();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState("");
  const [grouped, setGrouped] = useState(true);
  const [preparedExport, setPreparedExport] = useState<PreparedPhoto[] | null>(null);
  const controller = useRef<AbortController | null>(null);
  const busy = progress !== null;

  async function runExport(selected: Photo[], kind: "share" | "zip") {
    if (!selected.length || busy) {
      if (!selected.length) setMessage("There are no photos in this selection yet.");
      return;
    }
    const aborter = new AbortController();
    controller.current = aborter;
    setMessage("");
    setProgress({ done: 0, total: selected.length });
    try {
      const { files, failed } = await preparePhotoFiles(selected, rollName, aborter.signal, (done) => {
        setProgress({ done, total: selected.length });
      });
      if (failed.length) {
        throw new Error(failed.length + " photo" + (failed.length === 1 ? "" : "s") + " could not be prepared. Nothing was exported; refresh the gallery and try again.");
      }
      if (kind === "share") {
        setPreparedExport(files);
        setMessage("");
      } else {
        const zip = await createPhotoZip(files, grouped);
        downloadBlob(zip, safeFilePart(rollName) + "-photos.zip");
        setMessage("Downloaded " + files.length + " photos" + (grouped ? " in contributor folders" : "") + ", with a CSV index.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") setMessage("Export cancelled. No files were shared.");
      else setMessage(error instanceof Error ? error.message : "The photos could not be exported. Try again.");
    } finally {
      if (controller.current === aborter) controller.current = null;
      setProgress(null);
    }
  }

  async function sharePreparedExport() {
    if (!preparedExport) return;
    const shareNav = navigator as ShareNavigator;
    const files = preparedExport.map((item) => item.file);
    if (!supportsFileShare(shareNav, files)) {
      setMessage("This browser cannot share this group of photos at once. Save them one by one below.");
      return;
    }
    try {
      await shareNav.share?.({ files, title: rollName + " - Afterhours", text: files.length + " photos from " + rollName });
      setMessage("Share sheet closed. Choose Photos or another destination to save the images on your device.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") setMessage("Sharing cancelled. Your prepared photos are still here.");
      else setMessage("The share sheet could not open. Save the photos one by one below.");
    }
  }
  const myPhotos = user ? photos.filter((photo) => photo.uploadedBy === user.id) : [];
  const canSharePrepared = preparedExport !== null
    && typeof navigator !== "undefined"
    && supportsFileShare(navigator as ShareNavigator, preparedExport.map((item) => item.file));

  if (preparedExport) return createPortal(<div className="fixed inset-0 z-[999] flex items-center justify-center overflow-y-auto bg-[#100f0d]/95 p-4 sm:p-8" role="dialog" aria-modal="true" aria-labelledby="roll-share-title">
    <section className="w-full max-w-xl border border-[#d6c7ad]/25 bg-[#1b1916] p-4 shadow-2xl sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div><p className="eyebrow flex items-center gap-2 text-[#bda77e]"><Share2 size={13}/> EXPORT READY</p><h2 id="roll-share-title" className="mt-2 font-display text-3xl">Save {rollName}.</h2><p className="mt-2 text-xs leading-5 text-[#918a7e]">{preparedExport.length} full-quality photos are ready. {canSharePrepared ? "Open the share sheet to save the roll to Photos, Files, or another destination." : "Save the images individually to your device."}</p></div>
        <button type="button" onClick={() => { setPreparedExport(null); setMessage(""); }} className="flex h-10 w-10 shrink-0 items-center justify-center border border-white/15 text-[#c9c1b4] hover:text-white" aria-label="Back to roll export options"><X size={16}/></button>
      </div>
      {canSharePrepared && <button type="button" onClick={() => void sharePreparedExport()} className="button-primary mt-5 min-h-12 w-full"><Share2 size={15}/> SHARE / SAVE TO DEVICE</button>}
      <div className="mt-5 max-h-[42vh] space-y-2 overflow-y-auto border-y border-white/10 py-3">
        {preparedExport.map((item, index) => <div key={item.filename + index} className="flex items-center justify-between gap-3">
          <div className="min-w-0"><p className="font-mono text-[9px] tracking-[.06em] text-[#d9d2c6]">{String(index + 1).padStart(2, "0")} · {item.photo.by}</p><p className="truncate text-[10px] text-[#837c71]">{item.filename}</p></div>
          <button type="button" onClick={() => { downloadBlob(item.file, item.filename); setMessage(item.filename + " is ready in your device downloads."); }} className="button-secondary min-h-9 shrink-0 px-3 text-[9px]"><Download size={12}/> SAVE</button>
        </div>)}
      </div>
      {!canSharePrepared && <p className="mt-3 text-[10px] leading-4 text-[#918a7e]">Save images one at a time from this list.</p>}
      {message && <p role="status" className="mt-3 text-xs leading-5 text-[#cfc2a9]">{message}</p>}
      <button type="button" onClick={() => { setPreparedExport(null); setMessage(""); }} className="button-secondary mt-4 min-h-10 w-full text-[9px]">BACK TO ROLL</button>
    </section>
  </div>, document.body);
  if (compact) return <section aria-label="Save photos from this roll" className="reveal-mobile-export">
    <div className="flex items-center gap-2">
      <button type="button" disabled={busy || !photos.length} onClick={() => void runExport(photos, "share")} className="button-primary min-h-12 flex-1 px-3 text-[10px] disabled:opacity-50"><Share2 size={14}/> SAVE ENTIRE ROLL · {photos.length}</button>
      <button type="button" disabled={busy || !photos.length} onClick={() => void runExport(photos, "zip")} aria-label="Download the roll as a ZIP" title="Download ZIP" className="button-secondary min-h-12 w-12 shrink-0 px-0 disabled:opacity-50"><FolderOpen size={15}/></button>
    </div>
    <label className="mt-2 inline-flex min-h-7 items-center gap-2 text-[9px] text-[#aca394]"><input type="checkbox" checked={grouped} onChange={(event) => setGrouped(event.target.checked)} disabled={busy} className="accent-[#b89455]"/> GROUP ZIP BY CONTRIBUTOR</label>
    {progress && <div className="mt-2" aria-live="polite"><div className="flex items-center justify-between gap-3"><p className="text-[10px] text-[#d5cfc3]">Preparing photos · {progress.done} / {progress.total}</p><button type="button" onClick={() => controller.current?.abort()} className="text-[9px] text-[#b9b2a6]">CANCEL</button></div><progress className="mt-1 h-1 w-full accent-[#b89455]" max={progress.total} value={progress.done}/></div>}
    {message && <p role="status" className="mt-1 text-[10px] leading-4 text-[#cfc2a9]">{message}</p>}
  </section>;

  return <section aria-labelledby="roll-export-title" className="mt-7 border border-[#d6c7ad]/20 bg-[linear-gradient(145deg,#211e19,#171613)] p-4 sm:p-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div><p className="eyebrow flex items-center gap-2 text-[#bda77e]"><Archive size={13}/> TAKE THE WHOLE ROLL WITH YOU</p><h2 id="roll-export-title" className="mt-2 font-display text-2xl">Save these photos.</h2><p className="mt-1 max-w-xl text-xs leading-5 text-[#918a7e]">Photos are shared at their stored quality. iPhone Safari may offer Photos in its share sheet, but available destinations vary by iOS version.</p></div>
      <label className="flex items-center gap-2 text-[10px] text-[#aca394]"><input type="checkbox" checked={grouped} onChange={(event) => setGrouped(event.target.checked)} disabled={busy} className="accent-[#b89455]"/> GROUP ZIP BY CONTRIBUTOR</label>
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" disabled={busy || !photos.length} onClick={() => void runExport(photos, "share")} className="button-primary min-h-11 px-4 text-[10px] disabled:opacity-50"><Share2 size={14}/> SAVE ENTIRE ROLL · {photos.length}</button>
      {myPhotos.length > 0 && <button type="button" disabled={busy} onClick={() => void runExport(myPhotos, "share")} className="button-secondary min-h-11 px-4 text-[10px] disabled:opacity-50"><Download size={13}/> SAVE MY PHOTOS · {myPhotos.length}</button>}
      <button type="button" disabled={busy || !photos.length} onClick={() => void runExport(photos, "zip")} className="button-secondary min-h-11 px-4 text-[10px] disabled:opacity-50"><FolderOpen size={13}/> DOWNLOAD ZIP</button>
    </div>
    {progress && <div className="mt-4 border-t border-white/10 pt-4" aria-live="polite"><div className="flex items-center justify-between gap-3"><p className="text-xs text-[#d5cfc3]">Preparing photos · {progress.done} / {progress.total}</p><button type="button" onClick={() => controller.current?.abort()} className="button-secondary min-h-9 px-3 text-[9px]"><X size={12}/> CANCEL</button></div><progress className="mt-2 h-1.5 w-full accent-[#b89455]" max={progress.total} value={progress.done}/></div>}
    {message && <p role="status" className="mt-4 border-t border-white/10 pt-3 text-xs leading-5 text-[#cfc2a9]">{message}</p>}
  </section>;
}
