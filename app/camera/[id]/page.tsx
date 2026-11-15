"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Bell, Camera, Check, Flashlight, ImagePlus, LoaderCircle } from "lucide-react";
import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { NotificationSettings } from "@/components/notification-settings";
import { useApp } from "@/components/app-provider";
import { useAuth } from "@/components/auth-provider";
import { createPhotoThumbnail, getPhotoSeed, PHOTO_FILTER_VERSION, processPhotoFile, type PhotoFilterId } from "@/lib/photo-processing";
import { guestCameraFrameLimit, hasGuestCameraSetup, rememberGuestCameraSetup } from "@/lib/guest-camera-session";
import type { Roll } from "@/lib/types";

const CAMERA_FILTERS: Array<{ id: PhotoFilterId; label: string }> = [
  { id: "original", label: "Original" },
  { id: "disposable", label: "Dispo" },
  { id: "flash", label: "Flash look" },
  { id: "y2k", label: "Y2K" },
  { id: "rio", label: "Rio" },
  { id: "mono", label: "Mono" },
];

async function requestRearCamera() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser can't open a live camera. Try opening the invite in Safari or Chrome.");
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: "environment" } },
  });
}

type CameraStage = "checking" | "camera-permission" | "notifications" | "camera";

function GuestCamera({ roll }: { roll: Roll }) {
  const { configured, user } = useAuth();
  const { addPhotos } = useApp();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stage, setStage] = useState<CameraStage>("checking");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captured, setCaptured] = useState<File | null>(null);
  const [capturedPreview, setCapturedPreview] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [openingCamera, setOpeningCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(0);
  const [captureFlash, setCaptureFlash] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<PhotoFilterId>("disposable");
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState<boolean | null>(null);
  const sharedRemaining = Math.max(0, roll.photoLimit - roll.photos.length);
  const myFrames = user ? roll.photos.filter((photo) => photo.uploadedBy === user.id).length : 0;
  const participantCount = Math.max(1, roll.participants.length);
  const personalLimit = guestCameraFrameLimit(roll.photoLimit, participantCount);
  const remaining = Math.min(sharedRemaining, Math.max(0, personalLimit - myFrames));

  useEffect(() => {
    document.documentElement.classList.add("is-guest-camera");
    return () => document.documentElement.classList.remove("is-guest-camera");
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!hasGuestCameraSetup()) {
      setStage("camera-permission");
      return () => { cancelled = true; };
    }

    void requestRearCamera().then((nextStream) => {
      if (cancelled) {
        nextStream.getTracks().forEach((track) => track.stop());
        return;
      }
      setStream(nextStream);
      setStage("camera");
    }).catch((error: unknown) => {
      if (cancelled) return;
      setCameraError(error instanceof Error ? error.message : "Couldn't open the camera. Check your browser settings and try again.");
      setStage("camera-permission");
    });
    return () => { cancelled = true; };
  }, [roll.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => setCameraError("The camera preview couldn't start. Try opening the camera again."));
  }, [stream]);

  useEffect(() => {
    const track = stream?.getVideoTracks()[0];
    if (!track) {
      setTorchAvailable(null);
      setTorchOn(false);
      return;
    }
    try {
      const capabilities = track.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
      const supported = navigator.mediaDevices.getSupportedConstraints?.() as (MediaTrackSupportedConstraints & { torch?: boolean }) | undefined;
      setTorchAvailable(capabilities?.torch === true || supported?.torch === true);
    } catch {
      setTorchAvailable(null);
    }
  }, [stream]);

  useEffect(() => () => stream?.getTracks().forEach((track) => track.stop()), [stream]);

  useEffect(() => {
    if (!captured) {
      setCapturedPreview("");
      return;
    }
    const url = URL.createObjectURL(captured);
    setCapturedPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [captured]);

  async function openCamera() {
    if (openingCamera) return;
    setOpeningCamera(true);
    setCameraError("");
    try {
      const nextStream = await requestRearCamera();
      stream?.getTracks().forEach((track) => track.stop());
      setStream(nextStream);
      setStage("notifications");
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "Couldn't open the camera. Check your browser settings and try again.");
    } finally {
      setOpeningCamera(false);
    }
  }

  const finishSetup = useCallback(() => {
    rememberGuestCameraSetup();
    setStage("camera");
  }, []);

  async function toggleTorch() {
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    const nextTorchState = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: nextTorchState } as MediaTrackConstraintSet] });
      setTorchAvailable(true);
      setTorchOn(nextTorchState);
      setCameraError("");
    } catch {
      setTorchOn(false);
      setTorchAvailable(false);
      setCameraError("This camera doesn't expose a browser flash control. You can still take the photo.");
    }
  }

  async function saveFrame(file: File) {
    if (busy) return;
    setBusy(true);
    setSaveError("");
    try {
      const seed = await getPhotoSeed(file);
      const image = await processPhotoFile(file, {
        filterId: selectedFilter,
        seed,
        dateStamp: selectedFilter === "y2k" || selectedFilter === "disposable" || selectedFilter === "flash",
        dateStampOrientation: "horizontal",
        maxDimension: 3600,
        maxPixels: 10_000_000,
        maxBytes: 5_000_000,
        quality: 0.95,
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
        const filterLabel = CAMERA_FILTERS.find((filter) => filter.id === selectedFilter)?.label ?? "Dispo";
        await addPhotos(roll.id, [{ src, thumbnailSrc, caption: "", filter: filterLabel, filterVersion: PHOTO_FILTER_VERSION }]);
      } finally {
        if (src.startsWith("blob:")) URL.revokeObjectURL(src);
        if (thumbnailSrc.startsWith("blob:")) URL.revokeObjectURL(thumbnailSrc);
      }
      setCaptured(null);
      setSaved((current) => current + 1);
      window.setTimeout(() => setSaved(0), 2400);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Couldn't save that frame. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function takePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight || remaining <= 0 || busy) return;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 3200 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Couldn't capture this frame. Try again.");
      return;
    }
    setCaptureFlash(true);
    window.setTimeout(() => setCaptureFlash(false), 220);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError("Couldn't save this frame. Try again.");
        return;
      }
      const timestamp = Date.now();
      const file = new File([blob], `afterhours-${timestamp}.jpg`, { type: "image/jpeg", lastModified: timestamp });
      setCaptured(file);
      setCameraError("");
      void saveFrame(file);
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
    void saveFrame(file);
  }

  const frameLabel = remaining === 0
    ? sharedRemaining === 0 ? "ROLL FULL" : "NO FRAMES LEFT"
    : `${remaining} ${remaining === 1 ? "FRAME" : "FRAMES"} LEFT`;
  const captureDate = new Date();
  const dateImprint = `'${String(captureDate.getFullYear()).slice(-2)} ${String(captureDate.getMonth() + 1).padStart(2, "0")} ${String(captureDate.getDate()).padStart(2, "0")}`;

  return <main className="guest-camera" data-filter={selectedFilter}>
    <video ref={videoRef} autoPlay playsInline muted className={`guest-camera__video${captured ? " is-covered" : ""}`} aria-label="Live camera viewfinder"/>
    {captured && <img src={capturedPreview} alt="Just captured" className="guest-camera__captured"/>}
    {captureFlash && <div className="guest-camera__flash-overlay" aria-hidden="true"/>}
    {(selectedFilter === "y2k" || selectedFilter === "disposable" || selectedFilter === "flash") && stage === "camera" && !captured && <div className="guest-camera__date-imprint" aria-hidden="true">{dateImprint}</div>}
    {!stream && stage === "camera" && <div className="guest-camera__no-feed"><Camera size={26}/><p>Camera paused</p><button type="button" onClick={() => void openCamera()}>Open camera</button></div>}

    <header className="guest-camera__topbar">
      <Link href="/join" className="guest-camera__icon-button" aria-label="Open another invite"><ArrowLeft size={19}/></Link>
      <div className="guest-camera__roll-name"><span>{roll.name}</span><small>{frameLabel}</small></div>
      <div className="guest-camera__top-actions">
        <button type="button" onClick={() => setStage("notifications")} className="guest-camera__icon-button" aria-label="Notification settings"><Bell size={17}/></button>
        <button type="button" onClick={() => void toggleTorch()} disabled={!stream} aria-pressed={torchOn} className={`guest-camera__icon-button${torchOn ? " is-on" : ""}`} aria-label={torchOn ? "Turn flash off" : "Turn flash on"} title={torchAvailable === false ? "Try flash; availability depends on this camera" : "Flash / torch"}><Flashlight size={18}/></button>
      </div>
    </header>

    {stage === "camera-permission" && <div className="guest-camera__permission-scrim">
      <section className="guest-camera__permission-card" aria-labelledby="guest-camera-permission-title">
        <p className="guest-camera__permission-kicker">YOUR CAMERA, YOUR ROLL</p>
        <span className="guest-camera__permission-icon"><Camera size={23}/></span>
        <h1 id="guest-camera-permission-title">Let the night in.</h1>
        <p>First, allow camera access. Then we’ll ask if you want a reminder when the roll opens.</p>
        {cameraError && <p className="guest-camera__permission-message" role="alert">{cameraError}</p>}
        <button type="button" onClick={() => void openCamera()} disabled={openingCamera} className="guest-camera__permission-primary">{openingCamera ? <LoaderCircle size={17} className="animate-spin"/> : <Camera size={17}/>} {openingCamera ? "Opening camera…" : "Allow camera & continue"}</button>
        {cameraError && <button type="button" onClick={() => setStage("notifications")} className="guest-camera__permission-skip">Use photo picker instead</button>}
        <p className="guest-camera__permission-footnote">Your photos stay hidden until the host opens the roll.</p>
      </section>
    </div>}

    {stage === "notifications" && <div className="guest-camera__permission-scrim">
      <NotificationSettings guestMode setupMode onSetupComplete={finishSetup}/>
    </div>}

    {stage === "checking" && <div className="guest-camera__checking-screen"><LoaderCircle size={20} className="animate-spin"/><span>OPENING YOUR CAMERA</span></div>}

    {stage === "camera" && <>
      <div className="guest-camera__filter-rail" role="group" aria-label="Choose a photo look">
        {CAMERA_FILTERS.map(({ id, label }) => <button type="button" key={id} data-filter={id} aria-pressed={selectedFilter === id} disabled={busy} onClick={() => setSelectedFilter(id)}>{label}</button>)}
      </div>

      <footer className="guest-camera__controls">
        <span className="guest-camera__frame-count" aria-live="polite">{remaining.toString().padStart(2, "0")}<small>LEFT</small></span>
        <button type="button" className="guest-camera__shutter" aria-label={busy ? "Saving photo" : "Take photo"} disabled={remaining <= 0 || busy || !stream} onClick={takePhoto}>
          {busy ? <LoaderCircle size={22} className="animate-spin"/> : <span/>}
        </button>
        <label className={`guest-camera__import${busy ? " is-busy" : ""}`} aria-label="Choose a photo"><ImagePlus size={21}/><input type="file" accept="image/*" capture="environment" disabled={busy} onChange={choosePhoto}/></label>
      </footer>
    </>}

    {saved > 0 && stage === "camera" && <div className="guest-camera__toast" role="status"><Check size={15}/> Frame added</div>}
    {(cameraError || saveError) && stage === "camera" && <div className="guest-camera__error" role="alert">{saveError || cameraError}{captured && saveError && <button type="button" onClick={() => void saveFrame(captured)} disabled={busy}>Try again</button>}</div>}
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
