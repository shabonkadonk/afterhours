"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, Check, ImagePlus, Upload, X } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useApp } from "@/components/app-provider";
import { LocalDemoNote, PhotoCount } from "@/components/roll-ui";
import { editPhotoWithFal, isFalConfigured } from "@/lib/fal-client";
import { createPhotoId } from "@/lib/supabase/rolls";

type FilterPreset = { id: string; label: string; description: string; swatch: string };

const FILTERS: FilterPreset[] = [
  { id: "original", label: "Original", description: "as it was", swatch: "linear-gradient(135deg,#81796b,#39352e 58%,#b4a48b)" },
  { id: "y2k", label: "Y2K", description: "dark ambient + direct flash", swatch: "linear-gradient(135deg,#a33a79,#395b9c 55%,#65bed1)" },
  { id: "flash", label: "Flash", description: "bright & bold", swatch: "linear-gradient(135deg,#f5c47e,#ad4236 52%,#241c22)" },
  { id: "disposable", label: "Disposable", description: "warm & faded", swatch: "linear-gradient(135deg,#d1ab71,#76543d 55%,#36302a)" },
  { id: "soft", label: "Soft focus", description: "hazy hours", swatch: "linear-gradient(135deg,#dfc7a0,#927f75 52%,#554958)" },
  { id: "mono", label: "B&W", description: "after the last song", swatch: "linear-gradient(135deg,#dad5ca,#77746f 55%,#272625)" },
];

function applyFilter(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, filterId: string) {
  if (filterId === "original") return;
  if (filterId === "y2k") { applyDigicamTone(context, canvas); return; }
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = image.data;
  let seed = 814731;
  const noise = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 4294967296 - .5) * (filterId==="y2k"?30:18);
  };
  const clamp = (value: number) => Math.max(0, Math.min(255, value));

  for (let index=0; index<pixels.length; index+=4) {
    const r=pixels[index], g=pixels[index+1], b=pixels[index+2];
    const luminance=.299*r+.587*g+.114*b;
    const grain=filterId==="disposable"?noise():0;

    if (filterId==="flash") {
      const contrast=(value:number)=>(value-128)*1.22+128;
      const luma=contrast(luminance);
      pixels[index]=clamp((luma+(contrast(r)-luma)*1.17)*1.10+18);
      pixels[index+1]=clamp((luma+(contrast(g)-luma)*1.17)*1.10+15);
      pixels[index+2]=clamp((luma+(contrast(b)-luma)*1.17)*1.10+12);
    } else if (filterId==="disposable") {
      const sepiaR=.393*r+.769*g+.189*b;
      const sepiaG=.349*r+.686*g+.168*b;
      const sepiaB=.272*r+.534*g+.131*b;
      pixels[index]=clamp((r*.22+sepiaR*.78)*.91+17+grain);
      pixels[index+1]=clamp((g*.22+sepiaG*.78)*.91+12+grain);
      pixels[index+2]=clamp((b*.22+sepiaB*.78)*.91+5+grain);
    } else if (filterId==="soft") {
      const softLuma=.299*r+.587*g+.114*b;
      pixels[index]=clamp((softLuma+(r-softLuma)*.68)*.9+20);
      pixels[index+1]=clamp((softLuma+(g-softLuma)*.68)*.9+17);
      pixels[index+2]=clamp((softLuma+(b-softLuma)*.68)*.9+15);
    } else if (filterId==="mono") {
      const gray=clamp((luminance-128)*1.2+128);
      pixels[index]=clamp(gray+2);
      pixels[index+1]=gray;
      pixels[index+2]=clamp(gray-2);
    }
  }
  context.putImageData(image,0,0);
}

function applyDigicamTone(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  const {width,height}=canvas;
  const frame=context.getImageData(0,0,width,height);
  const pixels=frame.data;
  let seed=604213;
  const clamp=(value:number)=>Math.max(0,Math.min(255,value));
  for (let index=0;index<pixels.length;index+=4) {
    const r=pixels[index],g=pixels[index+1],b=pixels[index+2];
    const luminance=.299*r+.587*g+.114*b;
    const cb=128-.168736*r-.331264*g+.5*b;
    const cr=128+.5*r-.418688*g-.081312*b;
    const skin=clamp((cb-62)/18)*clamp((142-cb)/18)*clamp((cr-124)/14)*clamp((190-cr)/14);
    const contrast=(luminance-128)*1.04+128;
    const highlightLift=0;
    const skinLift=skin*clamp((150-luminance)/130)*2;
    const shadowWarmth=clamp((85-luminance)/110);
    const target=contrast+highlightLift+skinLift;
    seed=(seed*1664525+1013904223)>>>0;
    const grain=(seed/4294967296-.5)*(1.5+shadowWarmth*1.5);
    pixels[index]=clamp(target+(r-luminance)*1.06+shadowWarmth*2+grain+2);
    pixels[index+1]=clamp(target+(g-luminance)*1.04+grain*.35+1);
    pixels[index+2]=clamp(target+(b-luminance)*1.05+shadowWarmth+grain+4);
  }
  context.putImageData(frame,0,0);
}

function applyDigicamTexture(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  const {width,height}=canvas;
  const frame=context.getImageData(0,0,width,height);
  const source=frame.data.slice();
  const pixels=frame.data;
  let seed=921731;
  const clamp=(value:number)=>Math.max(0,Math.min(255,value));

  for (let y=0;y<height;y+=1) {
    for (let x=0;x<width;x+=1) {
      const index=(y*width+x)*4;
      seed=(seed*1664525+1013904223)>>>0;
      const grain=(seed/4294967296-.5)*3;
      pixels[index]=clamp(source[index]+grain);
      pixels[index+1]=clamp(source[index+1]+grain*.35);
      pixels[index+2]=clamp(source[index+2]+grain);
    }
  }
  context.putImageData(frame,0,0);
}

function addHighlightBloom(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  const {width,height}=canvas;
  const source=context.getImageData(0,0,width,height);
  const mask=document.createElement("canvas");
  const glow=document.createElement("canvas");
  mask.width=glow.width=width;
  mask.height=glow.height=height;
  const maskContext=mask.getContext("2d");
  const glowContext=glow.getContext("2d");
  if (!maskContext||!glowContext) return;

  const highlights=maskContext.createImageData(width,height);
  for (let index=0;index<source.data.length;index+=4) {
    const luminance=.299*source.data[index]+.587*source.data[index+1]+.114*source.data[index+2];
    const alpha=Math.max(0,Math.min(1,(luminance-220)/35))*.32;
    highlights.data[index]=source.data[index];
    highlights.data[index+1]=source.data[index+1];
    highlights.data[index+2]=source.data[index+2];
    highlights.data[index+3]=alpha*255;
  }
  maskContext.putImageData(highlights,0,0);
  glowContext.filter=`blur(${Math.max(4,Math.round(width*.012))}px)`;
  glowContext.drawImage(mask,0,0);
  context.save();
  context.globalCompositeOperation="screen";
  context.globalAlpha=.22;
  context.drawImage(glow,0,0);
  context.restore();
}

function getDateStampParts(file: File, yearMode: "current" | "2006") {
  const sourceDate = new Date(file.lastModified || Date.now());
  const year = yearMode === "2006" ? "2006" : String(new Date().getFullYear());
  const month = String(sourceDate.getMonth()+1).padStart(2,"0");
  const day = String(sourceDate.getDate()).padStart(2,"0");
  const formattedTime = new Intl.DateTimeFormat("en-US",{hour:"2-digit",minute:"2-digit",hour12:true}).format(sourceDate).toUpperCase();
  const [clock,period] = formattedTime.split(" ");
  const [hour,minute] = clock.split(":");
  const yearShort=year.slice(-2);
  return { groups:[yearShort,month,day,hour,minute], period };
}

function drawDateStamp(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, file: File, yearMode: "current" | "2006") {
  const {groups,period}=getDateStampParts(file,yearMode);
  const size = Math.max(12,Math.min(32,canvas.width*.022));
  const marginX = Math.max(12,canvas.width*.045);
  const marginY = Math.max(10,canvas.height*.04);
  const digitWidth = size*.62;
  const bar = size*.105;
  const digitGap = size*.12;
  const groupGap = size*.42;
  const dateTimeGap = size*.56;
  const colonWidth = size*.28;
  const periodGap = size*.12;
  const apostropheWidth = size*.3;
  context.save();
  context.font=`bold ${size*.4}px "Courier New", monospace`;
  const periodWidth=context.measureText(period).width;
  context.restore();
  const stampWidth = apostropheWidth + size*.08 + groups.reduce((total,group)=>total+group.length*(digitWidth+digitGap)-digitGap,0) + groupGap*2 + dateTimeGap + colonWidth + periodGap + periodWidth;
  const fit = Math.min(1,(canvas.width-marginX*2)/stampWidth);
  const left = canvas.width-marginX-stampWidth*fit;
  const top = canvas.height-marginY-size*fit;
  const digitSegments: Record<string,string[]> = {
    "0":["a","b","c","d","e","f"], "1":["b","c"], "2":["a","b","g","e","d"],
    "3":["a","b","g","c","d"], "4":["f","g","b","c"], "5":["a","f","g","c","d"],
    "6":["a","f","g","e","c","d"], "7":["a","b","c"], "8":["a","b","c","d","e","f","g"],
    "9":["a","b","c","d","f","g"],
  };
  const drawDigits = () => {
    context.lineWidth=bar;
    context.lineCap="butt";
    context.lineJoin="miter";
    context.strokeStyle="#e99a5e";
    let x=0;
    const drawDigit = (digit:string) => {
      const middle=size/2;
      const segments:Record<string,[number,number,number,number]>={
        a:[bar/2,bar/2,digitWidth-bar/2,bar/2], b:[digitWidth-bar/2,bar/2,digitWidth-bar/2,middle-bar/2],
        c:[digitWidth-bar/2,middle+bar/2,digitWidth-bar/2,size-bar/2], d:[bar/2,size-bar/2,digitWidth-bar/2,size-bar/2],
        e:[bar/2,middle+bar/2,bar/2,size-bar/2], f:[bar/2,bar/2,bar/2,middle-bar/2],
        g:[bar/2,middle,digitWidth-bar/2,middle],
      };
      for (const key of digitSegments[digit]??[]) {
        const [x1,y1,x2,y2]=segments[key];
        context.beginPath(); context.moveTo(x+x1,y1); context.lineTo(x+x2,y2); context.stroke();
      }
      x+=digitWidth+digitGap;
    };
    context.beginPath(); context.moveTo(size*.1,size*.12); context.lineTo(apostropheWidth*.72,size*.3); context.stroke();
    x=apostropheWidth+size*.08;
    for (let index=0;index<groups.length;index+=1) {
      for (const digit of groups[index]) drawDigit(digit);
      if (index===0||index===1) x+=groupGap-digitGap;
      else if (index===2) x+=dateTimeGap-digitGap;
      else if (index===3) {
        const colonX=x;
        context.fillStyle="#e99a5e";
        context.beginPath(); context.arc(colonX+colonWidth*.5,size*.35,bar*.42,0,Math.PI*2); context.fill();
        context.beginPath(); context.arc(colonX+colonWidth*.5,size*.72,bar*.42,0,Math.PI*2); context.fill();
        x+=colonWidth-digitGap;
      }
    }
    x+=periodGap-digitGap;
    context.font=`bold ${size*.4}px "Courier New", monospace`;
    context.textBaseline="bottom";
    context.fillText(period,x,size*.92);
  };
  context.save();
  context.translate(left,top);
  context.scale(fit,fit);
  context.globalAlpha=.88;
  context.shadowColor="rgba(230,116,62,.55)";
  context.shadowBlur=size*.09;
  drawDigits();
  context.restore();
}

function compressPhoto(file: File, filter: FilterPreset, stampYear: "current" | "2006" | null, skipLocalFilter: boolean): Promise<{ data: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const sourceUrl = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      const context = canvas.getContext("2d");
      if (!context) { URL.revokeObjectURL(sourceUrl); reject(new Error("This browser couldn’t prepare the image.")); return; }
      if (filter.id==="soft") context.filter="blur(1.4px)";
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      context.filter = "none";
      // Keep flash character in the color curve; bloom was lifting already-bright
      // rooms and creating a pale halo around the center of the frame.
      if (!skipLocalFilter) applyFilter(context,canvas,filter.id);
      if (!skipLocalFilter && filter.id==="y2k") applyDigicamTexture(context,canvas);
      if (stampYear) drawDateStamp(context,canvas,file,stampYear);
      URL.revokeObjectURL(sourceUrl);
      let quality = .82;
      let data = canvas.toDataURL("image/jpeg", quality);
      while (data.length > 560_000 && quality > .4) { quality -= .04; data = canvas.toDataURL("image/jpeg", quality); }
      if (data.length > 1_100_000) { reject(new Error("This photo is too large for the local demo. Try a smaller image.")); return; }
      resolve({ data, width: canvas.width, height: canvas.height });
    };
    image.onerror = () => { URL.revokeObjectURL(sourceUrl); reject(new Error("That image couldn’t be opened. Try another photo.")); };
    image.src = sourceUrl;
  });
}

function finishFalPhoto(dataUrl: string, file: File, stampYear: "current" | "2006" | null): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      const context = canvas.getContext("2d");
      if (!context) { reject(new Error("This browser could not prepare FLUX’s edited image.")); return; }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      applyDigicamTexture(context, canvas);
      if (stampYear) drawDateStamp(context, canvas, file, stampYear);
      let quality = .86;
      let output = canvas.toDataURL("image/jpeg", quality);
      while (output.length > 560_000 && quality > .4) {
        quality -= .04;
        output = canvas.toDataURL("image/jpeg", quality);
      }
      if (output.length > 1_100_000) { reject(new Error("The edited photo is too large for local browser storage.")); return; }
      resolve(output);
    };
    image.onerror = () => reject(new Error("Could not read FLUX’s edited image."));
    image.src = dataUrl;
  });
}

export default function CapturePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { rolls, ready, addPhotos } = useApp();
  const roll = rolls.find((item)=>item.id===id);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const previewUrls = useRef<string[]>([]);
  const preparedUpload = useRef<{ key: string; additions: { uploadId: string; src: string; caption: string; filter: string; filterVersion: number; dateStampYear?: "current" | "2006" }[] } | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filterId, setFilterId] = useState("y2k");
  const [dateStampEnabled, setDateStampEnabled] = useState(true);
  const [dateStampYear, setDateStampYear] = useState<"current" | "2006">("2006");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [falStatus, setFalStatus] = useState<"checking" | "connected" | "local">("checking");
  const activeFilter = FILTERS.find((filter)=>filter.id===filterId) ?? FILTERS[0];
  useEffect(()=>()=>{previewUrls.current.forEach((url)=>URL.revokeObjectURL(url));},[]);
  useEffect(()=>{let current=true; void isFalConfigured().then((configured)=>{if(current)setFalStatus(configured?"connected":"local");}); return ()=>{current=false;};},[]);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!chosen.length || !roll) return;
    setError("");
    const room = Math.max(0, roll.photoLimit-roll.photos.length-files.length);
    if (room===0) { setError("This roll is full. You’ve used every frame."); return; }
    const valid = chosen.filter((item)=>item.type.startsWith("image/")&&item.size<=15*1024*1024);
    if (valid.length!==chosen.length) setError("Some files weren’t images or were over 15 MB, so they were skipped.");
    if (!valid.length) { if (!chosen.length) setError("Choose one or more image files."); return; }
    const accepted=valid.slice(0,room);
    if (accepted.length<valid.length) setError(`Only ${room} more ${room===1?"frame fits":"frames fit"} in this roll. The rest were skipped.`);
    const urls=accepted.map((item)=>URL.createObjectURL(item));
    previewUrls.current=[...previewUrls.current,...urls];
    setFiles((current)=>[...current,...accepted]);
    setPreviews((current)=>[...current,...urls]);
    setSelectedIndex(files.length);
  }

  function removeFile(index: number) {
    const url=previews[index];
    if (url) { URL.revokeObjectURL(url); previewUrls.current=previewUrls.current.filter((item)=>item!==url); }
    setFiles((current)=>current.filter((_,position)=>position!==index));
    setPreviews((current)=>current.filter((_,position)=>position!==index));
    setSelectedIndex((current)=>current>index?current-1:current===index?Math.max(0,index-1):current);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!roll || !files.length) { setError("Choose one or more photos or open the camera first."); return; }
    if (roll.photos.length+files.length > roll.photoLimit) { setError("There aren’t enough frames left for this batch. Remove a photo and try again."); return; }
    setSaving(true);
    try {
      const key = JSON.stringify({ roll: roll.id, files: files.map((file) => [file.name, file.size, file.lastModified]), filterId, dateStampEnabled, dateStampYear, caption: caption.trim() });
      const additions = preparedUpload.current?.key === key ? [...preparedUpload.current.additions] : [];
      for (let index=additions.length;index<files.length;index+=1) {
        setProgress(index+1);
        const useFal=falStatus==="connected"&&filterId==="y2k";
        const source=await compressPhoto(files[index],activeFilter,useFal?null:(dateStampEnabled?dateStampYear:null),useFal);
        const editedImage=useFal?await editPhotoWithFal(source.data,source.width,source.height):source.data;
        const editedData=useFal?await finishFalPhoto(editedImage,files[index],dateStampEnabled?dateStampYear:null):editedImage;
        additions.push({uploadId:createPhotoId(),src:editedData,caption:caption.trim(),filter:activeFilter.label,filterVersion:5,dateStampYear:dateStampEnabled?dateStampYear:undefined});
        preparedUpload.current = { key, additions: [...additions] };
      }
      await addPhotos(roll.id,additions);
      preparedUpload.current = null;
      router.push(`/rolls/${roll.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn’t save that photo. Try again."); setSaving(false);
    }
  }

  if (!ready) return <main className="min-h-screen px-5 py-28 text-center font-mono text-xs tracking-widest text-[#898378]">LOADING YOUR ROLL...</main>;
  if (!roll) return <main className="min-h-screen px-5 py-28 text-center"><p className="font-display text-3xl">That roll isn’t in this browser.</p><Link href="/dashboard" className="button-secondary mt-6">Back to your rolls</Link></main>;
  if (roll.status !== "active") return <main className="min-h-screen px-5 py-28 text-center"><p className="eyebrow">THIS ROLL IS CLOSED</p><p className="mt-3 font-display text-3xl">The photos are ready.</p><Link href={`/rolls/${roll.id}/reveal`} className="button-primary mt-6">Open the gallery</Link></main>;

  return <main className="mx-auto min-h-screen max-w-[1440px] px-5 pb-20 pt-8 sm:px-10 sm:pt-12 lg:px-16"><div className="mx-auto max-w-[940px]"><LocalDemoNote>{falStatus==="connected"?"FLUX.2 Flash · FAL.AI · Y2K photos are edited from your source frame.":falStatus==="checking"?"CHECKING FAL.AI SETUP…":"LOCAL DEMO · Add FAL_KEY to .env.local to enable FLUX.2 Flash."}</LocalDemoNote>
    <Link href={`/rolls/${roll.id}`} className="mt-8 inline-flex items-center gap-2 font-mono text-[10px] tracking-[.12em] text-[#8a8378] hover:text-[#eee9de]"><ArrowLeft size={13}/> BACK TO {roll.name.toUpperCase()}</Link>
    <div className="mt-6 grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
      <div><p className="eyebrow mb-3">YOUR TURN BEHIND THE LENS</p><h1 className="font-display text-5xl leading-[.94] tracking-[-.055em]">A few frames<br/><i className="text-[#b54b40]">from tonight.</i></h1><p className="mt-5 max-w-sm text-sm leading-6 text-[#918a7e]">Choose a batch from your camera roll, pick a look, and add a note for later. A little blurry is probably right.</p><div className="mt-6 inline-flex border border-white/10 bg-[#1a1815] px-3 py-2"><PhotoCount roll={roll}/><span className="mx-2 text-[#6d675e]">·</span><span className="font-mono text-[9px] text-[#797267]">{roll.photoLimit-roll.photos.length} LEFT</span></div>
        <div className="mt-8 hidden border-t border-white/10 pt-5 lg:block"><p className="font-mono text-[9px] leading-5 text-[#777168]">{falStatus==="connected"?"FAL.AI FLUX.2 Flash EDITS THE SOURCE PHOTO. THE AMBER SEVEN-SEGMENT IMPRINT IS ADDED AFTER FAL EDITING; FINISHED PHOTOS STAY IN THIS BROWSER.":"PHOTOS ARE RESIZED AND GIVEN A BASIC CAMERA LOOK IN YOUR BROWSER, THEN STORED LOCALLY FOR THIS PROTOTYPE."}</p></div>
      </div>
      <form onSubmit={submit} className="border border-white/10 bg-[#1a1815] p-4 sm:p-6">
        <div className={`photo-frame relative aspect-[1.1] border border-white/10 ${files.length?"":"flex items-center justify-center"}`}>
          {files.length ? <><img src={previews[selectedIndex]} alt={`Original preview of ${files[selectedIndex]?.name ?? "your selected photo"}`} className="absolute inset-0 h-full w-full bg-black/30" style={{objectFit:"contain"}}/><div className="absolute inset-x-0 bottom-0 z-[1] flex items-end justify-between bg-gradient-to-t from-black/85 to-transparent px-4 pb-4 pt-12"><div><span className="font-mono text-[9px] tracking-[.12em] text-white/80">ORIGINAL · FRAME {String(selectedIndex+1).padStart(2,"0")}</span><p className="mt-1 max-w-[220px] truncate text-xs text-white/70">{files[selectedIndex]?.name}</p></div><span className="font-mono text-[9px] text-white/75">{files.length} SELECTED</span></div></> : <div className="px-5 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center border border-white/15 text-[#b44f44]"><ImagePlus size={20}/></div><p className="mt-4 font-display text-xl">Choose a few frames.</p><p className="mt-1 text-xs text-[#7f786e]">Select multiple photos at once, up to {roll.photoLimit-roll.photos.length} remaining.</p></div>}
        </div>
        {files.length>0&&<div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">{files.map((item,index)=><div key={`${item.name}-${item.lastModified}-${index}`} className={`relative aspect-square border ${index===selectedIndex?"border-[#c55448]":"border-white/10"}`}><button type="button" onClick={()=>setSelectedIndex(index)} aria-label={`Preview photo ${index+1}: ${item.name}`} className="photo-frame h-full w-full"><img src={previews[index]} alt="" style={{objectFit:"cover"}}/><span className="absolute bottom-1 left-1 z-[2] bg-black/65 px-1.5 py-0.5 font-mono text-[8px] text-white">{String(index+1).padStart(2,"0")}</span></button><button type="button" onClick={()=>removeFile(index)} aria-label={`Remove photo ${index+1}`} className="absolute -right-1.5 -top-1.5 z-[3] flex h-6 w-6 items-center justify-center border border-white/25 bg-[#171613] text-[#c9c1b4] hover:text-white"><X size={11}/></button></div>)}</div>}
        <div className="mt-4 grid grid-cols-2 gap-2"><label className="button-primary relative cursor-pointer"><Upload size={14}/> Choose photos<input type="file" accept="image/*" multiple className="absolute inset-0 cursor-pointer opacity-0" onChange={chooseFile}/></label><label className="button-secondary relative cursor-pointer"><ImagePlus size={14}/> Open camera<input type="file" accept="image/*" capture="environment" multiple className="absolute inset-0 cursor-pointer opacity-0" onChange={chooseFile}/></label></div>
        <fieldset className="mt-6"><legend className="eyebrow">PICK A LOOK <span className="ml-1 text-[#6d675e]">· REVEALS WHEN THE ROLL ENDS</span></legend><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{FILTERS.map((filter)=><button type="button" key={filter.id} onClick={()=>setFilterId(filter.id)} aria-pressed={filter.id===filterId} className={`border p-1.5 text-left transition sm:p-2 ${filter.id===filterId?"border-[#a44b42] bg-[#a33a32]/[.07]":"border-white/10 hover:border-white/25"}`}><span className="mb-2 block aspect-[1.7]" style={{background:filter.swatch}}/><span className="block truncate text-[10px] text-[#e1dbcf] sm:text-[11px]">{filter.label}</span><span className="mt-0.5 block truncate font-mono text-[8px] text-[#777168] sm:text-[9px]">{filter.description}</span></button>)}</div><p className="mt-3 border-l border-[#a33a32]/60 pl-3 font-mono text-[8px] leading-4 tracking-[.04em] text-[#8c8377]">{filterId==="y2k"?"Y2K USES FAL.AI FLUX.2 Flash TO EDIT THE FULL PHOTO WITH A CCD-ERA DIRECT-FLASH LOOK. NO OVAL MASK OR VIGNETTE.":"THE ORIGINAL STAYS IN PREVIEW. YOUR SELECTED LOOK WILL APPEAR AFTER THIS SESSION ENDS."}</p></fieldset>
        <section className="mt-6 border border-white/10 bg-[#201d19] p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#d7963a]/35 text-[#efb653]"><CalendarClock size={16}/></span><div><p className="eyebrow">CYBERSHOT DATE + TIME</p><p className="mt-1 text-[10px] leading-4 text-[#8c8377]">Amber timestamp, burned into each final frame.</p></div></div>
            <button type="button" aria-pressed={dateStampEnabled} onClick={()=>setDateStampEnabled((current)=>!current)} className={`shrink-0 border px-3 py-2 font-mono text-[9px] tracking-[.12em] transition ${dateStampEnabled?"border-[#d7963a]/50 bg-[#d7963a]/10 text-[#f1bc61]":"border-white/15 text-[#8d867a]"}`}>{dateStampEnabled?"STAMP ON":"STAMP OFF"}</button>
          </div>
          {dateStampEnabled&&<div className="mt-4 grid grid-cols-2 gap-2"><button type="button" aria-pressed={dateStampYear==="current"} onClick={()=>setDateStampYear("current")} className={`border px-3 py-3 text-left transition ${dateStampYear==="current"?"border-[#d7963a]/50 bg-[#d7963a]/[.07]":"border-white/10 hover:border-white/25"}`}><span className="block font-mono text-[9px] tracking-[.1em] text-[#e9c681]">CURRENT YEAR</span><span className="mt-1 block text-[9px] text-[#81796e]">Keep this year on the stamp</span></button><button type="button" aria-pressed={dateStampYear==="2006"} onClick={()=>setDateStampYear("2006")} className={`border px-3 py-3 text-left transition ${dateStampYear==="2006"?"border-[#d7963a]/50 bg-[#d7963a]/[.07]":"border-white/10 hover:border-white/25"}`}><span className="block font-mono text-[9px] tracking-[.1em] text-[#e9c681]">SET YEAR TO 2006</span><span className="mt-1 block text-[9px] text-[#81796e]">Early-digital-camera nostalgia</span></button></div>}
          <p className="mt-3 font-mono text-[8px] leading-4 text-[#756e63]">THE IMPRINT IS HIDDEN WITH THE EDITED PHOTO UNTIL THE ROLL REVEALS.</p>
        </section>
        <label htmlFor="caption" className="eyebrow mt-6 block">CAPTION FOR THESE FRAMES <span className="text-[#6d675e]">(OPTIONAL · SAME ON ALL)</span></label><textarea id="caption" rows={2} maxLength={120} value={caption} onChange={(event)=>setCaption(event.target.value)} placeholder="what were we laughing at?" className="field mt-2 resize-none text-sm"/><div className="mt-1 text-right font-mono text-[8px] text-[#6d675e]">{caption.length}/120</div>
        {error && <p role="alert" className="mt-3 border-l-2 border-[#b54b40] pl-3 text-xs text-[#e08478]">{error}</p>}
        <button type="submit" disabled={!files.length||saving||falStatus==="checking"} className="button-primary mt-4 w-full disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-[#777168]">{saving?`Editing frame ${progress} of ${files.length}…`:falStatus==="checking"?"Checking fal.ai setup…":<><Check size={14}/> Add {files.length||"photos"} to the roll <span className="ml-auto font-mono text-[9px] text-white/70">{roll.photos.length+files.length} / {roll.photoLimit}</span></>}</button>
        <p className="mt-3 text-center font-mono text-[8px] leading-4 text-[#716b61]">{falStatus==="connected"?"Y2K EDITED WITH FAL.AI FLUX.2 Flash · AMBER SEVEN-SEGMENT DATE IMPRINT":"BASIC CAMERA LOOK · SAVED ON THIS DEVICE ONLY"}</p>
      </form>
    </div>
  </div></main>;
}
