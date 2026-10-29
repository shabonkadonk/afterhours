"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Camera, ChevronLeft, ChevronRight, LockKeyhole, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { PhotoImage } from "@/components/photo-image";
import { AvatarStack, LocalDemoNote, ThemeBadge, formatDate, formatTime } from "@/components/roll-ui";
import type { Photo } from "@/lib/types";

function legacyFilter(photo: Photo) {
  if (!photo.filter || (photo.filterVersion ?? 1) >= 3) return undefined;
  const styles: Record<string, string> = {
    "Y2K": "saturate(1.65) contrast(1.18) brightness(1.22) sepia(.1) hue-rotate(-16deg)",
    "Flash": "brightness(1.22) contrast(1.32) saturate(1.3)",
    "Disposable": "sepia(.55) contrast(1.15) saturate(1.3) brightness(1.08)",
    "Soft focus": "blur(1px) saturate(.75) brightness(1.12)",
    "B&W": "grayscale(1) contrast(1.3)",
  };
  return styles[photo.filter];
}

function PhotoViewer({ photos, index, close, move }: { photos: Photo[]; index: number; close:()=>void; move:(step:number)=>void }) {
  const photo=photos[index];
  useEffect(()=>{const onKey=(event:globalThis.KeyboardEvent)=>{if(event.key==="Escape")close();if(event.key==="ArrowRight")move(1);if(event.key==="ArrowLeft")move(-1);};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);},[close,move]);
  return <div role="dialog" aria-modal="true" aria-label="Enlarged photo" className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-3 sm:p-8" onMouseDown={(event)=>{if(event.target===event.currentTarget)close();}}>
    <button onClick={close} className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center border border-white/20 bg-black/30" aria-label="Close photo"><X size={18}/></button>
    <button onClick={()=>move(-1)} className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center border border-white/20 bg-black/30 sm:left-6" aria-label="Previous photo"><ChevronLeft size={20}/></button>
    <div className="flex max-h-full max-w-full flex-col items-center">
      <PhotoImage src={photo.src} fallbackSrc={photo.cloudinaryOriginalSrc} alt={photo.caption||"Photo from the roll"} style={{filter:legacyFilter(photo)}} className="max-h-[78svh] max-w-[calc(100vw-40px)] object-contain sm:max-w-[82vw]"/>
      <div className="mt-4 flex w-full max-w-3xl items-end justify-between gap-4"><div><p className="font-display text-xl">{photo.caption||"No caption. Just the moment."}</p><p className="mt-1 font-mono text-[9px] tracking-[.1em] text-[#8d867c]">{photo.by.toUpperCase()} · {formatDate(photo.at,{month:"short",day:"numeric"}).toUpperCase()} · {formatTime(photo.at)}{photo.filter&&` · ${photo.filter.toUpperCase()}`}</p></div><span className="shrink-0 font-mono text-[10px] text-[#8d867c]">{String(index+1).padStart(2,"0")} / {String(photos.length).padStart(2,"0")}</span></div>
    </div>
    <button onClick={()=>move(1)} className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center border border-white/20 bg-black/30 sm:right-6" aria-label="Next photo"><ChevronRight size={20}/></button>
  </div>;
}

function PhotoCard({ photo, index, rollName, introDone, onOpen }: { photo: Photo; index: number; rollName: string; introDone: boolean; onOpen: ()=>void }) {
  return <button onClick={onOpen} className={`group mb-4 block w-full break-inside-avoid border border-white/10 bg-[#1a1815] p-2 text-left transition hover:border-white/25 ${introDone?"reveal-in":"opacity-0"}`} style={{animationDelay:`${Math.min(index*90,700)}ms`}}>
    <div className="photo-frame relative"><PhotoImage src={photo.src} fallbackSrc={photo.cloudinaryOriginalSrc} alt={photo.caption||`Photo ${index+1} from ${rollName}`} style={{filter:legacyFilter(photo)}} className="max-h-[620px] w-full object-cover transition duration-500 group-hover:scale-[1.015]"/><span className="absolute left-2 top-2 z-[1] bg-black/50 px-2 py-1 font-mono text-[8px] tracking-[.1em] text-white">FRAME {String(index+1).padStart(2,"0")}</span>{photo.filter&&<span className="absolute right-2 top-2 z-[1] bg-black/50 px-2 py-1 font-mono text-[8px] tracking-[.08em] text-white">{photo.filter.toUpperCase()}</span>}<span className="absolute bottom-2 right-2 z-[1] bg-black/50 px-2 py-1 font-mono text-[8px] text-white">{formatTime(photo.at)}</span></div>
    <div className="px-2 pb-2 pt-3"><p className="font-display text-lg leading-tight">{photo.caption||"No caption. Just the moment."}</p><div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2"><span className="font-mono text-[8px] tracking-[.12em] text-[#938b80]">{photo.by.toUpperCase()} · {formatDate(photo.at,{month:"short",day:"numeric"}).toUpperCase()}</span><span className="font-mono text-[8px] text-[#716b61]">VIEW <ArrowUpRight size={10} className="inline"/></span></div></div>
  </button>;
}

export default function RevealPage() {
  const { id } = useParams<{id:string}>();
  const { rolls, ready } = useApp();
  const roll=rolls.find((item)=>item.id===id);
  const [selected,setSelected]=useState<number|null>(null);
  const [introDone,setIntroDone]=useState(false);
  useEffect(()=>{const timer=window.setTimeout(()=>setIntroDone(true),1450);return()=>window.clearTimeout(timer);},[]);
  const closeViewer=useCallback(()=>setSelected(null),[]);
  const moveViewer=useCallback((step:number)=>setSelected((current)=>current===null?0:(current+step+((roll?.photos.length)||1))%((roll?.photos.length)||1)),[roll?.photos.length]);
  if(!ready)return <main className="min-h-screen px-5 py-28 text-center font-mono text-xs tracking-widest text-[#898378]">DEVELOPING YOUR ROLL...</main>;
  if(!roll)return <main className="min-h-screen px-5 py-28 text-center"><p className="font-display text-3xl">That roll isn’t in this browser.</p><Link href="/dashboard" className="button-secondary mt-6">Back to your rolls</Link></main>;
  if(roll.status==="active")return <main className="mx-auto min-h-screen max-w-[1440px] px-5 pb-20 pt-8 sm:px-10 sm:pt-12 lg:px-16"><div className="mx-auto max-w-[760px]"><LocalDemoNote/><Link href={`/rolls/${roll.id}`} className="mt-8 inline-flex items-center gap-2 font-mono text-[10px] tracking-[.12em] text-[#8a8378] hover:text-[#eee9de]"><ArrowLeft size={13}/> BACK TO SESSION</Link><section className="mt-8 border border-white/10 bg-[#191714] p-7 text-center sm:p-12"><span className="mx-auto flex h-12 w-12 items-center justify-center border border-[#a33a32]/35 text-[#ba574b]"><LockKeyhole size={19}/></span><p className="eyebrow mt-6">STILL IN THE ENVELOPE</p><h1 className="mt-3 font-display text-4xl tracking-[-.04em] sm:text-5xl">This roll hasn’t closed.</h1><p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[#918a7e]">{roll.photos.length} {roll.photos.length===1?"frame is":"frames are"} tucked away. Let the timer run out, or end the session when your crew is ready.</p><Link href={`/rolls/${roll.id}`} className="button-primary mt-7">Back to the session <ArrowUpRight size={14}/></Link></section></div></main>;
  const photos=[...roll.photos].sort((a,b)=>new Date(a.at).getTime()-new Date(b.at).getTime());
  return <main className="mx-auto min-h-screen max-w-[1440px] px-5 pb-20 pt-8 sm:px-10 sm:pt-12 lg:px-16"><div className="mx-auto max-w-[1120px]"><LocalDemoNote/>
    <Link href={`/rolls/${roll.id}`} className="mt-8 inline-flex items-center gap-2 font-mono text-[10px] tracking-[.12em] text-[#8a8378] hover:text-[#eee9de]"><ArrowLeft size={13}/> BACK TO SESSION</Link>
    {!introDone&&<div className="pointer-events-none fixed inset-0 z-40 bg-[#f0e8d5] film-flash" aria-hidden="true"/>}
    <div className={`mt-7 border border-white/10 bg-[#191714] p-5 sm:p-9 ${introDone?"reveal-in":"opacity-0"}`}>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="eyebrow mb-3">THE WAIT IS OVER <span className="mx-2 text-[#a33a32]">/</span> {formatDate(roll.createdAt).toUpperCase()}</p><h1 className="font-display text-5xl leading-[.92] tracking-[-.06em] sm:text-7xl">The night,<br/><i className="text-[#b54b40]">as it happened.</i></h1></div><div className="flex items-center gap-4"><AvatarStack people={roll.participants}/><div><p className="font-mono text-[10px] text-[#d4cdbf]">{photos.length.toString().padStart(2,"0")} FRAMES</p><p className="mt-1 font-mono text-[8px] tracking-[.12em] text-[#746e64]">{roll.participants.length} PEOPLE WERE THERE</p></div></div></div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-white/10 py-3"><ThemeBadge theme={roll.theme}/><p className="font-mono text-[9px] tracking-[.1em] text-[#827b70]">SHOT BY YOUR CREW · IN CHRONOLOGICAL ORDER</p></div>
    </div>
    {photos.length ? <div className="mt-7 columns-1 gap-4 sm:columns-2 lg:columns-3">{photos.map((photo,index)=><PhotoCard key={photo.id} photo={photo} index={index} rollName={roll.name} introDone={introDone} onOpen={()=>setSelected(index)}/>)}</div> : <div className="mt-7 border border-dashed border-white/15 py-20 text-center"><Camera size={22} className="mx-auto text-[#777168]"/><h2 className="mt-4 font-display text-2xl">The envelope is empty.</h2><p className="mt-2 text-sm text-[#898378]">This roll ended before anyone added a frame.</p><Link href="/dashboard" className="button-secondary mt-6">Back to your rolls</Link></div>}
    <div className="mt-8 flex flex-col justify-between gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center"><p className="font-mono text-[9px] tracking-[.09em] text-[#726c62]">A MEMORY MADE OF LITTLE ACCIDENTS.</p><Link href="/dashboard" className="button-secondary w-fit">All your rolls <ArrowUpRight size={14}/></Link></div>
  </div>{selected!==null&&photos.length>0&&<PhotoViewer photos={photos} index={selected} close={closeViewer} move={moveViewer}/>}</main>;
}
