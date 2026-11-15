"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Camera, Check, LoaderCircle, RotateCcw, Upload } from "lucide-react";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { NotificationSettings } from "@/components/notification-settings";
import { useApp } from "@/components/app-provider";
import { useAuth } from "@/components/auth-provider";
import { getPhotoSeed, PHOTO_FILTER_VERSION, processPhotoFile, createPhotoThumbnail } from "@/lib/photo-processing";
import { guestCameraFrameLimit } from "@/lib/guest-camera-session";
import type { Roll } from "@/lib/types";

function GuestCamera({ roll }: { roll: Roll }) {
  const { configured, user } = useAuth();
  const { addPhotos } = useApp();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captured, setCaptured] = useState<File | null>(null);
  const [capturedPreview, setCapturedPreview] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(0);
  const sharedRemaining = Math.max(0, roll.photoLimit - roll.photos.length);
  const myFrames = user ? roll.photos.filter((photo) => photo.uploadedBy === user.id).length : 0;
  const participantCount = Math.max(1, roll.participants.length);
  const personalLimit = guestCameraFrameLimit(roll.photoLimit, participantCount);
  const remaining = Math.min(sharedRemaining, Math.max(0, personalLimit - myFrames));

  useEffect(() => {
    if (!videoRef.current || !stream) return;
    videoRef.current.srcObject = stream;
    void videoRef.current.play().catch(() => setCameraError("The camera preview could not start. Try choosing a photo instead."));
  }, [stream]);

  useEffect(() => {
    if (!captured) {
      setCapturedPreview("");
      return;
    }
    const url = URL.createObjectURL(captured);
    setCapturedPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [captured]);

  useEffect(() => () => stream?.getTracks().forEach((track) => track.stop()), [stream]);

  async function openCamera() {
    setCaptured(null);
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access needs a supported browser. Choose a photo instead.");
      return;
    }
    try {
      stream?.getTracks().forEach((track) => track.stop());
      const nextStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
      setStream(nextStream);
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      setCameraError(name === "NotAllowedError" ? "Allow camera access in your browser settings, then try again." : "Couldn’t open the camera. Choose a photo instead.");
    }
  }

  function takePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight || remaining <= 0) return;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 3200 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Couldn’t capture this frame. Try again.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError("Couldn’t save this frame. Try again.");
        return;
      }
      const timestamp = Date.now();
      setCaptured(new File([blob], `afterhours-${timestamp}.jpg`, { type: "image/jpeg", lastModified: timestamp }));
      stream?.getTracks().forEach((track) => track.stop());
      setStream(null);
      setCameraError("");
      setSaveError("");
    }, "image/jpeg", 0.94);
  }

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024) {
      setSaveError("Choose an image under 15 MB.");
      return;
    }
    setCaptured(file);
    setSaveError("");
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
  }

  async function saveFrame() {
    if (!captured || busy) return;
    setBusy(true);
    setSaveError("");
    try {
      const seed = await getPhotoSeed(captured);
      const image = await processPhotoFile(captured, {
        filterId: "disposable",
        seed,
        maxDimension: 3200,
        maxPixels: 8_000_000,
        maxBytes: 4_800_000,
        quality: 0.92,
      });
      const thumbnail = await createPhotoThumbnail(image);
      const cloudUpload = Boolean(configured && user);
      const src = cloudUpload ? URL.createObjectURL(image) : await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not prepare this photo."));
        reader.onerror = () => reject(new Error("Could not prepare this photo."));
        reader.readAsDataURL(image);
      });
      const thumbnailSrc = cloudUpload ? URL.createObjectURL(thumbnail) : await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not prepare this photo."));
        reader.onerror = () => reject(new Error("Could not prepare this photo."));
        reader.readAsDataURL(thumbnail);
      });
      try {
        await addPhotos(roll.id, [{ src, thumbnailSrc, caption: "", filter: "Disposable", filterVersion: PHOTO_FILTER_VERSION }]);
      } finally {
        if (src.startsWith("blob:")) URL.revokeObjectURL(src);
        if (thumbnailSrc.startsWith("blob:")) URL.revokeObjectURL(thumbnailSrc);
      }
      setCaptured(null);
      setSaved((current) => current + 1);
      window.setTimeout(() => setSaved(0), 2800);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Couldn’t save that frame. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))]">
    <header className="flex items-center justify-between border-b border-white/10 pb-4">
      <Link href="/" className="font-mono text-[10px] tracking-[.18em] text-[#a9a194]">AFTERHOURS</Link>
      <span className="max-w-[58%] truncate font-mono text-[9px] tracking-[.12em] text-[#777168]">{roll.name.toUpperCase()}</span>
    </header>
    <section className="my-6 flex items-end justify-between gap-4">
      <div><p className="eyebrow">YOUR DISPOSABLE CAMERA</p><h1 className="mt-2 font-display text-4xl leading-none tracking-[-.04em]">Use it wisely.</h1><p className="mt-2 text-sm text-[#918a7e]">Your share is {personalLimit} {personalLimit === 1 ? "frame" : "frames"}, split across {participantCount} {participantCount === 1 ? "person" : "people"}. Photos stay hidden till the roll opens.</p></div>
      <div className="shrink-0 border border-white/10 px-3 py-2 text-right"><strong className="block font-mono text-xl text-[#eee9de]">{String(remaining).padStart(2, "0")}</strong><span className="font-mono text-[8px] tracking-[.12em] text-[#827b70]">FRAMES LEFT</span></div>
    </section>
    <section className="relative flex min-h-[min(58svh,520px)] flex-1 items-center justify-center overflow-hidden border border-white/10 bg-[#201d19]">
      {captured ? <img src={capturedPreview} alt="Your frame ready to save" className="absolute inset-0 h-full w-full object-contain"/> : stream ? <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover"/> : <div className="px-8 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center border border-[#a33a32]/40 text-[#c55448]"><Camera size={22}/></span><p className="mt-5 font-display text-2xl">One night. A few frames.</p><p className="mt-2 text-xs leading-5 text-[#827b70]">No previews from anyone else until the roll opens.</p></div>}
      {stream && <span className="absolute left-3 top-3 z-[1] border border-white/20 bg-black/45 px-2 py-1 font-mono text-[8px] tracking-[.15em] text-white">FRAME {String(roll.photoLimit - remaining + 1).padStart(2, "0")}</span>}
    </section>
    <div className="mt-4 min-h-5 text-center text-xs text-[#b7b0a4]" role="status">{saved ? <span className="inline-flex items-center gap-2"><Check size={14} className="text-[#b3c597]"/> Frame added to the roll.</span> : ""}</div>
    {(cameraError || saveError) && <p role="alert" className="mt-2 border-l border-[#a33a32]/60 pl-3 text-xs leading-5 text-[#e08478]">{saveError || cameraError}</p>}
    {remaining > 0 ? <div className="mt-3 grid grid-cols-2 gap-2">
      {captured ? <><button type="button" onClick={() => void openCamera()} disabled={busy} className="button-secondary min-h-12"><RotateCcw size={15}/> Retake</button><button type="button" onClick={() => void saveFrame()} disabled={busy} className="button-primary min-h-12 disabled:opacity-60">{busy ? <LoaderCircle size={15} className="animate-spin"/> : <Check size={15}/>} {busy ? "Saving…" : "Save this frame"}</button></> : <><button type="button" onClick={stream ? takePhoto : () => void openCamera()} disabled={busy} className="button-primary min-h-12"><Camera size={16}/> {stream ? "Take photo" : "Open camera"}</button><label className="button-secondary relative min-h-12 cursor-pointer"><Upload size={15}/> Choose photo<input ref={inputRef} type="file" accept="image/*" capture="environment" className="absolute inset-0 cursor-pointer opacity-0" onChange={choosePhoto}/></label></>}
    </div> : <p className="mt-4 border border-white/10 bg-[#1b1916] p-4 text-center text-sm text-[#b3aa9c]">{sharedRemaining === 0 ? "The shared roll is full. We’ll let you know when it opens." : "That’s the last frame on your camera. We’ll let you know when the roll opens."}</p>}
    {roll.status === "active" && <NotificationSettings guestMode/>}
    <p className="mt-4 text-center font-mono text-[8px] tracking-[.1em] text-[#6e685e]">{roll.photos.length} OF {roll.photoLimit} SHARED FRAMES USED</p>
  </main>;
}

export default function CameraPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { rolls, ready } = useApp();
  const { user, loading: authLoading } = useAuth();
  const roll = rolls.find((item) => item.id === id);

  useEffect(() => {
    if (authLoading || !ready || !roll) return;
    if (roll.status === "revealed") router.replace(`/rolls/${roll.id}/reveal`);
    else if (user && !user.is_anonymous && roll.ownerId === user.id) router.replace(`/rolls/${roll.id}`);
  }, [authLoading, ready, roll, router, user]);

  if (!ready || authLoading) return <main className="grid min-h-screen place-items-center font-mono text-[10px] tracking-[.16em] text-[#827b70]">LOADING YOUR CAMERA…</main>;
  if (!roll) return <main className="mx-auto grid min-h-screen max-w-md place-content-center px-6 text-center"><p className="eyebrow">NO CAMERA FOUND</p><h1 className="mt-3 font-display text-3xl">This roll isn’t on this account.</h1><Link href="/join" className="button-secondary mt-6">Open another invite</Link></main>;
  if (roll.status === "revealed" || (user && !user.is_anonymous && roll.ownerId === user.id)) return <main className="grid min-h-screen place-items-center font-mono text-[10px] tracking-[.16em] text-[#827b70]">OPENING…</main>;
  return <GuestCamera roll={roll}/>;
}
