"use client";

import { useRef, useState } from "react";
import { Archive, Download, FolderOpen, Share2, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createPhotoZip, downloadBlob, preparePhotoFiles, safeFilePart, supportsFileShare } from "@/lib/photo-export";
import type { Photo } from "@/lib/types";

type Props = { rollName: string; photos: Photo[] };
type ShareNavigator = Navigator & { canShare?: (data?: ShareData) => boolean; share?: (data?: ShareData) => Promise<void> };

export function RollExportControls({ rollName, photos }: Props) {
  const { user } = useAuth();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState("");
  const [grouped, setGrouped] = useState(true);
  const controller = useRef<AbortController | null>(null);
  const busy = progress !== null;

  async function runExport(selected: Photo[], kind: "share" | "zip") {
    if (!selected.length || busy) {
      if (!selected.length) setMessage("There are no photos in this selection yet.");
      return;
    }
    const aborter = new AbortController();
    controller.current = aborter;
    setMessage(""); setProgress({ done: 0, total: selected.length });
    try {
      const { files, failed } = await preparePhotoFiles(selected, rollName, aborter.signal, (done) => {
        setProgress({ done, total: selected.length });
      });
      if (failed.length) throw new Error(`${failed.length} photo${failed.length === 1 ? "" : "s"} could not be prepared. Nothing was shared or zipped; refresh the gallery and try again.`);
      if (kind === "share") {
        const shareNav = navigator as ShareNavigator;
        const fileList = files.map((item) => item.file);
        const data = { files: fileList, title: `${rollName} · Afterhours`, text: `${files.length} photos from ${rollName}` };
        if (supportsFileShare(shareNav, fileList)) {
          try {
            await shareNav.share(data);
            setMessage("The share sheet closed. Choose Photos or another destination if it is available on your device.");
          } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") setMessage("Sharing cancelled. Your photos are still here.");
            else {
              const zip = await createPhotoZip(files, grouped);
              downloadBlob(zip, `${safeFilePart(rollName)}-photos.zip`);
              setMessage("The share sheet could not open, so we downloaded a ZIP instead.");
            }
          }
        } else {
          const zip = await createPhotoZip(files, grouped);
          downloadBlob(zip, `${safeFilePart(rollName)}-photos.zip`);
          setMessage("This browser cannot share multiple photo files. Downloaded a ZIP instead; open it to save the images.");
        }
      } else {
        const zip = await createPhotoZip(files, grouped);
        downloadBlob(zip, `${safeFilePart(rollName)}-photos.zip`);
        setMessage(`Downloaded ${files.length} photos${grouped ? " in contributor folders" : ""}, with a CSV index.`);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") setMessage("Export cancelled. No files were shared.");
      else setMessage(error instanceof Error ? error.message : "The photos could not be exported. Try again.");
    } finally {
      if (controller.current === aborter) controller.current = null;
      setProgress(null);
    }
  }

  const myPhotos = user ? photos.filter((photo) => photo.uploadedBy === user.id) : [];
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
