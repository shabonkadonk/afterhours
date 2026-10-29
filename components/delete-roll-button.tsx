"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { useAuth } from "@/components/auth-provider";

export function DeleteRollButton({ rollId, rollName, photoCount, ownerId, className = "" }: { rollId: string; rollName: string; photoCount: number; ownerId?: string; className?: string }) {
  const router = useRouter();
  const { deleteRoll } = useApp();
  const { configured, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  if (configured && user && ownerId && ownerId !== user.id) return null;

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  async function confirmDelete() {
    setError("");
    try {
      await deleteRoll(rollId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete this roll. Try again.");
      return;
    }
    setOpen(false);
    router.replace("/dashboard");
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label={`Delete ${rollName}`} aria-haspopup="dialog" className={`inline-flex min-h-10 items-center justify-center gap-2 border border-white/15 bg-[#1a1815]/90 px-3 text-[10px] tracking-[.08em] text-[#b5aa9d] transition hover:border-[#a33a32]/70 hover:text-[#e58679] ${className}`}>
      <Trash2 size={14}/><span>DELETE ROLL</span>
    </button>
    {open&&<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-5 backdrop-blur-sm" onMouseDown={(event)=>{if(event.target===event.currentTarget)setOpen(false);}}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="delete-roll-title" aria-describedby="delete-roll-description" className="w-full max-w-[430px] border border-white/15 bg-[#1b1916] p-5 shadow-2xl sm:p-7">
        <p className="eyebrow flex items-center gap-2 text-[#cf766b]"><Trash2 size={12}/> REMOVE THIS ROLL</p>
        {error && <p role="alert" className="mt-4 border-l border-[#a33a32]/60 pl-3 text-xs leading-5 text-[#e08478]">{error}</p>}
        <h2 id="delete-roll-title" className="mt-4 font-display text-3xl leading-tight">Delete “{rollName}”?</h2>
        <p id="delete-roll-description" className="mt-3 text-sm leading-6 text-[#a39a8d]">{configured && user ? `This deletes the roll and its ${photoCount} ${photoCount === 1 ? "photo" : "photos"} for everyone in this shared session. You cannot undo this.` : `This removes the roll and its ${photoCount} ${photoCount === 1 ? "photo" : "photos"} from this browser. You cannot undo this.`}</p>
        <p className="mt-4 border-l border-[#a33a32]/60 pl-3 font-mono text-[9px] leading-4 text-[#777168]">{configured && user ? "Private photos are permanently removed from storage with this roll." : "Local demo · No shared copies or cloud uploads are affected."}</p>
        <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" autoFocus onClick={()=>setOpen(false)} className="button-secondary">Keep this roll</button><button type="button" onClick={confirmDelete} className="button-primary border-[#81302a] bg-[#81302a] hover:border-[#a33a32] hover:bg-[#a33a32]"><Trash2 size={14}/> Delete roll</button></div>
      </section>
    </div>}
  </>;
}
