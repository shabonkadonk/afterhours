"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarClock, Camera, Check, ImagePlus, RefreshCw, Upload, X, Zap } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "@/components/app-provider";
import { useAuth } from "@/components/auth-provider";
import { PhotoCount } from "@/components/roll-ui";
import { blobToDataUrl, createPhotoThumbnail, getPhotoSeed, PHOTO_FILTER_VERSION, processPhotoFile, type PhotoFilterId } from "@/lib/photo-processing";
import { createPhotoId } from "@/lib/supabase/rolls";
import { useInstalledApp } from "@/components/use-installed-app";

type FilterPreset = { id: PhotoFilterId; label: string; description: string; swatch: string };
type OrientationControls = ScreenOrientation & { lock?: (orientation: "portrait-primary") => Promise<void> };
type TorchTrack = MediaStreamTrack & {
  getCapabilities?: () => MediaTrackCapabilities & { torch?: boolean[] };
};
type TorchConstraints = MediaTrackConstraints & { torch?: boolean };

const FILTERS: FilterPreset[] = [
  { id: "original", label: "Original", description: "as it was", swatch: "linear-gradient(135deg,#81796b,#39352e 58%,#b4a48b)" },
  { id: "y2k", label: "Y2K", description: "warm flash · violet shadows", swatch: "linear-gradient(135deg,#f08c66,#8b648b 48%,#30599a)" },
  { id: "flash", label: "Flash", description: "bright & bold", swatch: "linear-gradient(135deg,#f5c47e,#ad4236 52%,#241c22)" },
  { id: "disposable", label: "Disposable", description: "35mm color · grain & leaks", swatch: "linear-gradient(135deg,#e4b16b,#917454 55%,#353c39)" },
  { id: "rio", label: "Rio", description: "violet · magenta · coral", swatch: "linear-gradient(180deg,#514392 0%,#813d83 38%,#c72f7b 70%,#f35370 100%)" },
  { id: "mono", label: "B&W", description: "after the last song", swatch: "linear-gradient(135deg,#dad5ca,#77746f 55%,#272625)" },
];

export default function CapturePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { rolls, ready, addPhotos } = useApp();
  const { configured, user } = useAuth();
  const installed = useInstalledApp();
  const roll = rolls.find((item)=>item.id===id);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraTorchAvailable, setCameraTorchAvailable] = useState(false);
  const [cameraTorchEnabled, setCameraTorchEnabled] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const previewUrls = useRef<string[]>([]);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraRequestRef = useRef(0);
  const preparedUpload = useRef<{ key: string; additions: { uploadId: string; src: string; thumbnailSrc: string; caption: string; filter: string; filterVersion: number }[] } | null>(null);
  const ownedBlobUrls = useRef<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filterId, setFilterId] = useState<PhotoFilterId>("original");
  const [dateStampEnabled, setDateStampEnabled] = useState(false);
  const [dateStampOrientation, setDateStampOrientation] = useState<"horizontal" | "vertical">("vertical");
  const [dateStampYear, setDateStampYear] = useState<"photo" | "2006">("photo");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingStage, setSavingStage] = useState<"processing" | "uploading">("processing");
  const [progress, setProgress] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [smallScreen, setSmallScreen] = useState(false);
  const [captureStep, setCaptureStep] = useState(0);
  const [captionStepReady, setCaptionStepReady] = useState(false);
  const useWizard = installed === true || smallScreen;
  const activeFilter = FILTERS.find((filter)=>filter.id===filterId) ?? FILTERS[0];
  const cloudUpload = Boolean(configured && user);
  useEffect(()=>()=>{
    previewUrls.current.forEach((url)=>URL.revokeObjectURL(url));
    ownedBlobUrls.current.forEach((url)=>URL.revokeObjectURL(url));
  },[]);
  useEffect(()=>()=>{
    cameraRequestRef.current+=1;
    cameraStreamRef.current?.getTracks().forEach((track)=>track.stop());
    cameraStreamRef.current=null;
  },[]);
  useEffect(()=>{
    const video=cameraVideoRef.current;
    if(!cameraOpen||!cameraStream||!video) return;
    video.srcObject=cameraStream;
    void video.play().catch(()=>setCameraError("The camera preview could not start. Try again or choose photos instead."));
    return ()=>{video.pause();video.srcObject=null;};
  },[cameraOpen,cameraStream]);
  useEffect(()=>{
    if(!cameraOpen||installed!==true) return;
    const root=document.documentElement;
    const orientation=screen.orientation as OrientationControls | undefined;
    root.classList.add("is-native-camera-open");
    try { orientation?.unlock?.(); } catch { /* Rotation remains user-controlled when unsupported. */ }
    return ()=>{
      root.classList.remove("is-native-camera-open");
      try { void orientation?.lock?.("portrait-primary").catch(()=>undefined); } catch { /* Orientation locks are optional. */ }
    };
  },[cameraOpen,installed]);
  useEffect(()=>{
    if(!useWizard||captureStep!==2){setCaptionStepReady(false);return;}
    const timeout=window.setTimeout(()=>setCaptionStepReady(true),250);
    return ()=>window.clearTimeout(timeout);
  },[useWizard,captureStep]);
  useEffect(()=>{
    const media=window.matchMedia("(max-width: 1023px)");
    const update=()=>setSmallScreen(media.matches);
    update();
    media.addEventListener?.("change",update);
    return ()=>media.removeEventListener?.("change",update);
  },[]);
  useEffect(()=>{
    if(!saving) return;
    const beforeUnload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
    const guardNavigation=(event:MouseEvent)=>{
      if(!(event.target instanceof Element)) return;
      const anchor=event.target.closest("a[href]");
      if(!(anchor instanceof HTMLAnchorElement)) return;
      const destination=new URL(anchor.href,window.location.href);
      if(destination.origin!==window.location.origin||destination.pathname===window.location.pathname) return;
      if(!window.confirm("Photos are still being prepared or uploaded. Leave this page?")){
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("beforeunload",beforeUnload);
    document.addEventListener("click",guardNavigation,true);
    return ()=>{window.removeEventListener("beforeunload",beforeUnload);document.removeEventListener("click",guardNavigation,true);};
  },[saving]);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    if(saving) return;
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

  function addCameraFile(file: File) {
    if(!roll) return;
    const room=Math.max(0,roll.photoLimit-roll.photos.length-files.length);
    if(room===0) { setCameraError("This roll is full. Remove a frame before taking another photo."); return; }
    const url=URL.createObjectURL(file);
    previewUrls.current=[...previewUrls.current,url];
    setFiles((current)=>[...current,file]);
    setPreviews((current)=>[...current,url]);
    setSelectedIndex(files.length);
    setError("");
    setCameraError("");
  }

  function stopCamera() {
    cameraRequestRef.current+=1;
    cameraStreamRef.current?.getTracks().forEach((track)=>track.stop());
    cameraStreamRef.current=null;
    setCameraStream(null);
    setCameraOpen(false);
    setCameraBusy(false);
    setCameraReady(false);
    setCameraTorchAvailable(false);
    setCameraTorchEnabled(false);
    setCameraError("");
  }

  async function startCamera(facing: "environment" | "user" = cameraFacing) {
    if(saving||installed!==true) return;
    const requestId=++cameraRequestRef.current;
    setCameraOpen(true);
    setCameraError("");
    setCameraReady(false);
    setCameraTorchAvailable(false);
    setCameraTorchEnabled(false);
    setCameraBusy(true);
    cameraStreamRef.current?.getTracks().forEach((track)=>track.stop());
    cameraStreamRef.current=null;
    setCameraStream(null);
    setCameraFacing(facing);
    if(!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Live camera access needs HTTPS and a supported browser. You can choose photos instead.");
      setCameraBusy(false);
      return;
    }
    try {
      const stream=await navigator.mediaDevices.getUserMedia({
        audio:false,
        video:{facingMode:{ideal:facing},width:{ideal:1920},height:{ideal:1080}},
      });
      if(requestId!==cameraRequestRef.current) { stream.getTracks().forEach((track)=>track.stop()); return; }
      cameraStreamRef.current=stream;
      const videoTrack=stream.getVideoTracks()[0] as TorchTrack | undefined;
      let torchAvailable=false;
      try {
        const capabilities=videoTrack?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean[] }) | undefined;
        const torchValues=capabilities?.torch;
        torchAvailable=Array.isArray(torchValues)&&torchValues.includes(true)&&torchValues.includes(false);
      } catch {
        // Some browsers expose the camera stream but cannot report its torch capabilities.
      }
      setCameraTorchAvailable(torchAvailable);
      setCameraStream(stream);
    } catch(caught) {
      if(requestId!==cameraRequestRef.current) return;
      const name=caught instanceof Error?caught.name:"";
      setCameraError(name==="NotAllowedError"
        ?"Camera permission was blocked. Allow camera access in your browser settings, then try again."
        :name==="NotFoundError"
          ?"No camera was found. You can choose photos instead."
          :name==="NotReadableError"
            ?"The camera is being used by another app. Close it and try again."
            :"Couldn’t open the camera. Check camera permission or choose photos instead.");
    } finally {
      if(requestId===cameraRequestRef.current) setCameraBusy(false);
    }
  }

  async function toggleCameraTorch() {
    const stream=cameraStreamRef.current;
    const track=stream?.getVideoTracks()[0];
    if(!track||!cameraTorchAvailable||cameraBusy) return;
    const requestId=cameraRequestRef.current;
    const nextEnabled=!cameraTorchEnabled;
    setCameraBusy(true);
    setCameraError("");
    try {
      const currentConstraints=track.getConstraints();
      await track.applyConstraints({...currentConstraints,torch:nextEnabled} as TorchConstraints);
      if(requestId===cameraRequestRef.current) setCameraTorchEnabled(nextEnabled);
    } catch {
      if(requestId===cameraRequestRef.current) setCameraError("The flash couldn’t be changed on this camera. Try switching cameras.");
    } finally {
      if(requestId===cameraRequestRef.current) setCameraBusy(false);
    }
  }

  async function captureCameraFrame() {
    const video=cameraVideoRef.current;
    if(!video||!cameraReady||cameraBusy||!roll) return;
    if(roll.photos.length+files.length>=roll.photoLimit) {
      setCameraError("This roll is full. Remove a frame before taking another photo.");
      return;
    }
    setCameraBusy(true);
    setCameraError("");
    try {
      const width=video.videoWidth;
      const height=video.videoHeight;
      if(!width||!height) throw new Error("The camera is still getting ready. Try again in a moment.");
      const scale=Math.min(1,3200/Math.max(width,height));
      const canvas=document.createElement("canvas");
      canvas.width=Math.round(width*scale);
      canvas.height=Math.round(height*scale);
      const context=canvas.getContext("2d");
      if(!context) throw new Error("Couldn’t capture this frame. Try again.");
      if(cameraFacing==="user") { context.translate(canvas.width,0); context.scale(-1,1); }
      context.drawImage(video,0,0,canvas.width,canvas.height);
      const blob=await new Promise<Blob|null>((resolve)=>canvas.toBlob(resolve,"image/jpeg",0.94));
      if(!blob) throw new Error("Couldn’t save this frame. Try again.");
      const capturedAt=Date.now();
      addCameraFile(new File([blob],`afterhours-camera-${capturedAt}.jpg`,{type:"image/jpeg",lastModified:capturedAt}));
    } catch(caught) {
      setCameraError(caught instanceof Error?caught.message:"Couldn’t capture this photo. Try again.");
    } finally {
      setCameraBusy(false);
    }
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
    if(saving) return;
    if(useWizard&&(captureStep<2||!captionStepReady)) { setCaptureStep(2); return; }
    if (!roll || !files.length) { setError("Choose one or more photos or open the camera first."); return; }
    if (roll.photos.length+files.length > roll.photoLimit) { setError("There aren’t enough frames left for this batch. Remove a photo and try again."); return; }
    setSaving(true);
    setSavingStage("processing");
    setProgress(0);
    setProgressPercent(0);
    try {
      const imprintAllowed = filterId === "y2k" || filterId === "flash";
      const key = JSON.stringify({ version: PHOTO_FILTER_VERSION, roll: roll.id, files: files.map((file) => [file.name, file.size, file.lastModified]), filterId, dateStampEnabled: imprintAllowed&&dateStampEnabled, dateStampOrientation: imprintAllowed&&dateStampEnabled?dateStampOrientation:undefined, dateStampYear: imprintAllowed&&dateStampEnabled?dateStampYear:undefined, caption: caption.trim(), cloudUpload });
      const additions = preparedUpload.current?.key === key ? [...preparedUpload.current.additions] : [];
      setProgress(additions.length);
      setProgressPercent(Math.round((additions.length/files.length)*82));
      for (let index=additions.length;index<files.length;index+=1) {
        setProgress(index+1);
        setProgressPercent(Math.round((index/files.length)*82));
        const seed=await getPhotoSeed(files[index]);
        const imageBlob=await processPhotoFile(files[index],{
          filterId,
          seed,
          dateStamp:(filterId==="y2k"||filterId==="flash")&&dateStampEnabled,
          dateStampOrientation,
          dateStampYear,
          maxDimension:cloudUpload?3200:2560,
          maxPixels:cloudUpload?8_000_000:5_000_000,
          maxBytes:cloudUpload?4_800_000:430_000,
          quality:cloudUpload?0.92:0.87,
        });
        const thumbnailBlob=await createPhotoThumbnail(imageBlob);
        const imageUrl=cloudUpload?URL.createObjectURL(imageBlob):await blobToDataUrl(imageBlob);
        const thumbnailUrl=cloudUpload?URL.createObjectURL(thumbnailBlob):await blobToDataUrl(thumbnailBlob);
        if(cloudUpload)ownedBlobUrls.current.push(imageUrl,thumbnailUrl);
        additions.push({uploadId:createPhotoId(),src:imageUrl,thumbnailSrc:thumbnailUrl,caption:caption.trim(),filter:activeFilter.label,filterVersion:PHOTO_FILTER_VERSION});
        preparedUpload.current = { key, additions: [...additions] };
        setProgressPercent(Math.round(((index+1)/files.length)*82));
      }
      setSavingStage("uploading");
      await addPhotos(roll.id,additions);
      for(const item of additions){
        if(item.src.startsWith("blob:"))URL.revokeObjectURL(item.src);
        if(item.thumbnailSrc.startsWith("blob:"))URL.revokeObjectURL(item.thumbnailSrc);
      }
      ownedBlobUrls.current=ownedBlobUrls.current.filter((url)=>!url.startsWith("blob:")||!additions.some((item)=>item.src===url||item.thumbnailSrc===url));
      preparedUpload.current = null;
      setProgressPercent(100);
      router.push(`/rolls/${roll.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn’t save that photo. Try again."); setSaving(false); setSavingStage("processing");
    }
  }

  if (!ready) return <main className="min-h-screen px-5 py-28 text-center font-mono text-xs tracking-widest text-[#898378]">LOADING YOUR ROLL...</main>;
  if (!roll) return <main className="min-h-screen px-5 py-28 text-center"><p className="font-display text-3xl">That roll isn’t in this browser.</p><Link href="/dashboard" className="button-secondary mt-6">Back to your rolls</Link></main>;
  if (roll.status !== "active") return <main className="min-h-screen px-5 py-28 text-center"><p className="eyebrow">THIS ROLL IS CLOSED</p><p className="mt-3 font-display text-3xl">The photos are ready.</p><Link href={`/rolls/${roll.id}/reveal`} className="button-primary mt-6">Open the gallery</Link></main>;

  return <><main className={`mx-auto min-h-screen max-w-[1440px] px-5 pb-20 pt-8 sm:px-10 sm:pt-12 lg:px-16${useWizard?" capture-wizard":" capture-desktop-page"}`} data-capture-step={captureStep}><div className={useWizard?"capture-wizard__inner":"capture-desktop-page__inner mx-auto max-w-[940px]"}>
    <Link href={`/rolls/${roll.id}`} className={`mt-8 inline-flex items-center gap-2 font-mono text-[10px] tracking-[.12em] text-[#8a8378] hover:text-[#eee9de]${useWizard?" capture-wizard__desktop-back":""}`}><ArrowLeft size={13}/> BACK TO {roll.name.toUpperCase()}</Link>
    <div className={`mt-6 grid gap-6 lg:grid-cols-[.9fr_1.1fr]${useWizard?" capture-wizard__layout":" capture-desktop-page__layout"}`}>
      <div className={useWizard?"capture-wizard__intro":""}><p className="eyebrow mb-3">YOUR TURN BEHIND THE LENS</p><h1 className="font-display text-5xl leading-[.94] tracking-[-.055em]">A few frames<br/><i className="text-[#b54b40]">from tonight.</i></h1><p className="mt-5 max-w-sm text-sm leading-6 text-[#918a7e]">Choose a batch from your camera roll, pick a look, and add a note for later. A little blurry is probably right.</p><div className="mt-6 inline-flex border border-white/10 bg-[#1a1815] px-3 py-2"><PhotoCount roll={roll}/><span className="mx-2 text-[#6d675e]">·</span><span className="font-mono text-[9px] text-[#797267]">{roll.photoLimit-roll.photos.length} LEFT</span></div>
      </div>
      <form onSubmit={submit} className={`flow-panel border border-white/10 bg-[#1a1815] p-4 sm:p-6${useWizard?" capture-wizard__form":""}`}>
        {useWizard&&<div className="capture-wizard__top"><div className="capture-wizard__topline">{captureStep===0?<Link href={`/rolls/${roll.id}`} className="capture-wizard__back"><ArrowLeft size={15}/> Roll</Link>:<button type="button" onClick={()=>{setError("");setCaptureStep((step)=>step-1);}} className="capture-wizard__back"><ArrowLeft size={15}/> Back</button>}<span>{String(captureStep+1).padStart(2,"0")} <i>/</i> 03</span></div><div className="capture-wizard__progress"><span style={{width:`${((captureStep+1)/3)*100}%`}}/></div><div className="capture-wizard__title"><p className="eyebrow">{captureStep===0?"FIRST, THE FRAMES":captureStep===1?"MAKE IT YOURS":"ONE LAST THING"}</p><h1 className="font-display">{captureStep===0?"Choose photos.":captureStep===1?"Pick a look.":"Leave a note."}</h1></div></div>}
        <section className="capture-wizard__step capture-wizard__step--photos" style={useWizard?{display:captureStep===0?"flex":"none",flexDirection:"column"}:undefined}>
        <div className={`photo-frame relative aspect-[1.1] border border-white/10 ${files.length?"":"flex items-center justify-center"}`}>
          {files.length ? <><img src={previews[selectedIndex]} alt={`Original preview of ${files[selectedIndex]?.name ?? "your selected photo"}`} className="absolute inset-0 h-full w-full bg-black/30" style={{objectFit:"contain"}}/><div className="absolute inset-x-0 bottom-0 z-[1] flex items-end justify-between bg-gradient-to-t from-black/85 to-transparent px-4 pb-4 pt-12"><div><span className="font-mono text-[9px] tracking-[.12em] text-white/80">ORIGINAL · FRAME {String(selectedIndex+1).padStart(2,"0")}</span><p className="mt-1 max-w-[220px] truncate text-xs text-white/70">{files[selectedIndex]?.name}</p></div><span className="font-mono text-[9px] text-white/75">{files.length} SELECTED</span></div></> : <div className="px-5 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center border border-white/15 text-[#b44f44]"><ImagePlus size={20}/></div><p className="mt-4 font-display text-xl">Choose a few frames.</p><p className="mt-1 text-xs text-[#7f786e]">Select multiple photos at once, up to {roll.photoLimit-roll.photos.length} remaining.</p></div>}
        </div>
        {files.length>0&&<div className={`mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6${useWizard?" capture-wizard__thumbs":""}`}>{files.map((item,index)=><div key={`${item.name}-${item.lastModified}-${index}`} style={{animationDelay:`${Math.min(index*45,270)}ms`}} className={`photo-tile relative aspect-square border ${index===selectedIndex?"border-[#c55448]":"border-white/10"}`}><button type="button" disabled={saving} onClick={()=>setSelectedIndex(index)} aria-label={`Preview photo ${index+1}: ${item.name}`} className="photo-frame h-full w-full disabled:cursor-wait"><img src={previews[index]} alt="" style={{objectFit:"cover"}}/><span className="absolute bottom-1 left-1 z-[2] bg-black/65 px-1.5 py-0.5 font-mono text-[8px] text-white">{String(index+1).padStart(2,"0")}</span></button><button type="button" disabled={saving} onClick={()=>removeFile(index)} aria-label={`Remove photo ${index+1}`} className="absolute -right-1.5 -top-1.5 z-[3] flex h-7 w-7 items-center justify-center border border-white/25 bg-[#171613] text-[#c9c1b4] hover:text-white disabled:opacity-50"><X size={11}/></button></div>)}</div>}
        <div className={`capture-upload-actions mt-4 grid ${installed===true?"grid-cols-2":"grid-cols-1"} gap-2`}><label className={`button-primary relative min-h-12 cursor-pointer ${saving?"cursor-wait opacity-60":""}`}><Upload size={14}/> Choose photos<input ref={photoInputRef} type="file" accept="image/*" multiple disabled={saving} className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-wait" onChange={chooseFile}/></label>{installed===true&&<button type="button" disabled={saving} onClick={()=>void startCamera("environment")} className={`capture-camera-action button-secondary relative min-h-12 ${saving?"cursor-wait opacity-60":""}`}><Camera size={14}/> Open camera</button>}</div>
        </section>
        <section className="capture-wizard__step capture-wizard__step--look" data-y2k-selected={filterId==="y2k"} style={useWizard?{display:captureStep===1?"flex":"none",flexDirection:"column"}:undefined}>
        <fieldset disabled={saving} className="capture-wizard__look-fieldset disabled:opacity-70"><legend className="eyebrow">PICK A LOOK</legend><div className="capture-wizard__look-grid" style={{display:"grid",gridTemplateColumns:"repeat(3, minmax(0, 1fr))",gridTemplateRows:filterId==="y2k"?"repeat(2, 78px)":"repeat(2, minmax(0, 1fr))",gridTemplateAreas:'"original y2k flash" "disposable rio mono"'}}>{FILTERS.map((filter)=><button type="button" key={filter.id} data-filter={filter.id} onClick={()=>setFilterId(filter.id)} aria-pressed={filter.id===filterId} style={{gridArea:filter.id}} className={`capture-wizard__look-card choice-card border p-1.5 text-left ${filterId===filter.id?"border-[#a44b42] bg-[#a33a32]/[.07]":"border-white/10 hover:border-white/25"}`}><span className="capture-wizard__look-swatch mb-2 block" style={{background:filter.swatch}}/><span className="block truncate text-[10px] text-[#e1dbcf] sm:text-[11px]">{filter.label}</span><span className="mt-0.5 block truncate font-mono text-[8px] text-[#777168] sm:text-[9px]">{filter.description}</span></button>)}</div></fieldset>
        {(filterId==="y2k"||filterId==="flash")&&<section className="date-imprint-card mt-6 border border-white/10 bg-[#201d19] p-3 sm:p-4">
          <div className="date-imprint-header">
            <div className="date-imprint-heading"><span className="date-imprint-icon"><CalendarClock size={16}/></span><p className="date-imprint-title eyebrow">{filterId==="flash"?"FLASH DATE IMPRINT":"Y2K DATE STAMP"}</p></div>
            <button type="button" disabled={saving} aria-pressed={dateStampEnabled} onClick={()=>setDateStampEnabled((current)=>!current)} className={`date-imprint-toggle border font-mono tracking-[.1em] transition disabled:opacity-50 ${dateStampEnabled?"border-[#d7963a]/50 bg-[#d7963a]/10 text-[#f1bc61]":"border-white/15 text-[#8d867a]"}`}>{dateStampEnabled?"STAMP ON":"STAMP OFF"}</button>
            <p className="date-imprint-description text-[10px] leading-4 text-[#8c8377]">Keep the photo date, or use its month and day with vintage '06.</p>
          </div>
          <div className="date-imprint-settings">
            <div className="date-imprint-option-group"><span className="date-imprint-label">ORIENTATION</span><div className="date-imprint-group-buttons">
              <button type="button" disabled={saving} aria-pressed={dateStampOrientation==="horizontal"} onClick={()=>{setDateStampOrientation("horizontal");setDateStampEnabled(true);}} className={`date-imprint-choice border font-mono transition disabled:opacity-50 ${dateStampOrientation==="horizontal"?"border-[#d7963a]/50 bg-[#d7963a]/10 text-[#f1bc61]":"border-white/15 text-[#8d867a]"}`}>HORIZONTAL</button>
              <button type="button" disabled={saving} aria-pressed={dateStampOrientation==="vertical"} onClick={()=>{setDateStampOrientation("vertical");setDateStampEnabled(true);}} className={`date-imprint-choice border font-mono transition disabled:opacity-50 ${dateStampOrientation==="vertical"?"border-[#d7963a]/50 bg-[#d7963a]/10 text-[#f1bc61]":"border-white/15 text-[#8d867a]"}`}>VERTICAL · LEFT EDGE</button>
            </div></div>
            <div className="date-imprint-option-group"><span className="date-imprint-label">YEAR</span><div className="date-imprint-group-buttons">
              <button type="button" disabled={saving} aria-pressed={dateStampYear==="photo"} onClick={()=>{setDateStampYear("photo");setDateStampEnabled(true);}} className={`date-imprint-choice border font-mono transition disabled:opacity-50 ${dateStampYear==="photo"?"border-[#d7963a]/50 bg-[#d7963a]/10 text-[#f1bc61]":"border-white/15 text-[#8d867a]"}`}>PHOTO YEAR</button>
              <button type="button" disabled={saving} aria-pressed={dateStampYear==="2006"} onClick={()=>{setDateStampYear("2006");setDateStampEnabled(true);}} className={`date-imprint-choice border font-mono transition disabled:opacity-50 ${dateStampYear==="2006"?"border-[#d7963a]/50 bg-[#d7963a]/10 text-[#f1bc61]":"border-white/15 text-[#8d867a]"}`}>VINTAGE 2006</button>
            </div></div>
          </div>
          <p className="date-imprint-footnote font-mono">THE IMPRINT IS BAKED INTO THE EXPORTED PHOTO.</p>
        </section>}
        </section>
        <section className="capture-wizard__step capture-wizard__step--finish" style={useWizard?{display:captureStep===2?"flex":"none",flexDirection:"column"}:undefined}>
        <label htmlFor="caption" className="eyebrow mt-6 block">CAPTION FOR THESE FRAMES <span className="text-[#6d675e]">(OPTIONAL · SAME ON ALL)</span></label><textarea id="caption" rows={2} maxLength={120} disabled={saving} value={caption} onChange={(event)=>setCaption(event.target.value)} placeholder="what were we laughing at?" className="field mt-2 resize-none text-sm disabled:opacity-60"/><div className="mt-1 text-right font-mono text-[8px] text-[#6d675e]">{caption.length}/120</div>
        {error && !useWizard && <p role="alert" className="mt-3 border-l-2 border-[#b54b40] pl-3 text-xs text-[#e08478]">{error}</p>}
        {saving && <div role="status" className="mt-4 border border-white/10 bg-[#211e19] p-3">
          {savingStage==="processing"&&<div className="developing-roll" aria-hidden="true"><div className="developing-roll__reel"><span/></div><div className="developing-roll__feed"/><div className="developing-roll__tank"><div className="developing-roll__film">{Array.from({length:6},(_,index)=><span key={index}><i/></span>)}</div><div className="developing-roll__bath"/></div></div>}
          <div className="flex items-center justify-between gap-3"><span className="text-xs text-[#ded8cd]">{savingStage==="uploading"?(configured&&user?"Uploading frames to the shared roll…":"Saving your frames…"):`Preparing frame ${Math.max(1,progress)} of ${files.length}…`}</span><span className="font-mono text-[9px] text-[#8c8377]">{savingStage==="uploading"?"SAVING":`${progressPercent}%`}</span></div>
          <div role="progressbar" aria-label={savingStage==="uploading"?"Saving photos":"Preparing photos"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={savingStage==="uploading"?undefined:progressPercent} className={`upload-progress mt-3 h-1 ${savingStage==="uploading"?"upload-progress--indeterminate":""}`}><div className="upload-progress__bar" style={savingStage==="uploading"?undefined:{width:`${progressPercent}%`}}/></div>
        </div>}
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 mt-4 border-t border-white/10 bg-[#1a1815]/95 px-4 pb-2 pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0 capture-wizard__legacy-submit">
          <button type="submit" disabled={!files.length||saving} className="button-primary min-h-12 w-full disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-[#777168] disabled:opacity-50">{saving?"Working on your photos…":<><Check size={14}/> {files.length?`Add ${files.length} ${files.length===1?"photo":"photos"} to the roll`:"Choose photos to add"} <span className="ml-auto font-mono text-[9px] text-white/70">{roll.photos.length+files.length} / {roll.photoLimit}</span></>}</button>
        </div>
        </section>
        {useWizard&&<div className="capture-wizard__footer">
          {error&&<p role="alert" className="capture-wizard__error">{error}</p>}
          <div>
            {captureStep>0&&<button type="button" onClick={()=>{setError("");setCaptureStep((step)=>step-1);}} className="button-secondary">Back</button>}
            {captureStep<2||!captionStepReady?<button type="button" disabled={captureStep===0&&!files.length||captureStep===2&&!captionStepReady} onClick={()=>{setError("");setCaptureStep((step)=>Math.min(2,step+1));}} className="button-primary">{captureStep===2?"Opening your note…":<>Continue <ArrowRight size={15}/></>}</button>:<button type="submit" disabled={!files.length||saving} className="button-primary">{saving?"Working on your photos…":<>Add {files.length} {files.length===1?"photo":"photos"}<Check size={15}/></>}</button>}
          </div>
        </div>}
      </form>
    </div>
  </div></main>
  {cameraOpen&&typeof document!=="undefined"&&createPortal(<div className="camera-modal" role="dialog" aria-modal="true" aria-label="Afterhours camera">
    <header className="camera-modal__header">
      <button type="button" className="camera-modal__quiet-button" onClick={stopCamera}><X size={17}/> Close</button>
      <span className="camera-modal__wordmark">AFTERHOURS CAMERA</span>
      <div className="camera-modal__actions">
        <button type="button" className="camera-modal__quiet-button camera-modal__flash" disabled={!cameraTorchAvailable||cameraBusy||!cameraStream} onClick={()=>void toggleCameraTorch()} aria-label={!cameraTorchAvailable?"Flash unavailable":cameraTorchEnabled?"Turn flash off":"Turn flash on"} aria-pressed={cameraTorchEnabled} title={!cameraTorchAvailable?"Flash isn’t available on this camera":cameraTorchEnabled?"Turn flash off":"Turn flash on"}><Zap size={18}/></button>
        <button type="button" className="camera-modal__quiet-button camera-modal__switch" disabled={cameraBusy} onClick={()=>void startCamera(cameraFacing==="environment"?"user":"environment")} aria-label="Switch camera"><RefreshCw size={18}/></button>
      </div>
    </header>
    <div className="camera-modal__stage">
      {cameraStream&&<video ref={cameraVideoRef} className={`camera-modal__video${cameraFacing==="user"?" camera-modal__video--front":""}`} autoPlay playsInline muted onCanPlay={()=>setCameraReady(true)} aria-label="Live camera preview"/>}
      {cameraBusy&&!cameraStream&&<p className="camera-modal__status" role="status">Opening camera…</p>}
      {cameraError&&<div className="camera-modal__error" role="alert"><p>{cameraError}</p><div><button type="button" onClick={()=>void startCamera(cameraFacing)}>Try again</button><button type="button" onClick={()=>{stopCamera();photoInputRef.current?.click();}}>Choose photos</button></div></div>}
      {!cameraStream&&!cameraBusy&&!cameraError&&<p className="camera-modal__status" role="status">Camera is off.</p>}
      {previews.length>0&&<div className="camera-modal__thumbnails" aria-label={`${files.length} selected photo previews`}>{previews.slice(-5).map((src,index)=><img key={src} src={src} alt={`Selected frame ${Math.max(1,files.length-Math.min(previews.length,5)+1)+index}`} />)}</div>}
    </div>
    <footer className="camera-modal__controls">
      <div className="camera-modal__count"><strong>{files.length}</strong><span>{files.length===1?"FRAME":"FRAMES"}</span></div>
      <button type="button" className="camera-modal__shutter" disabled={!cameraReady||cameraBusy||files.length+roll.photos.length>=roll.photoLimit} onClick={()=>void captureCameraFrame()} aria-label="Take photo"><span/></button>
      <button type="button" className="camera-modal__done" onClick={stopCamera}><Check size={15}/> Done</button>
    </footer>
  </div>,document.body)}
  </>;
}
