"use client";

import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";

type PhotoImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "onError" | "onLoad"> & {
  src: string;
  thumbnailSrc?: string;
  fallbackSrc?: string;
};

function thumbnailCandidate(src: string) {
  try {
    const url = new URL(src);
    if (url.hostname === "images.unsplash.com") {
      const width = Number(url.searchParams.get("w"));
      if (!width || width > 640) url.searchParams.set("w", "640");
      const quality = Number(url.searchParams.get("q"));
      if (!quality || quality > 76) url.searchParams.set("q", "76");
      return url.toString();
    }
  } catch {
    // Local data URLs and signed non-image URLs should pass through untouched.
  }
  return src;
}

function originalCloudinaryUrl(src: string) {
  const uploadPath = "/image/upload/";
  const uploadIndex = src.indexOf(uploadPath);
  if (uploadIndex < 0) return src;

  const assetStart = uploadIndex + uploadPath.length;
  const version = src.slice(assetStart).match(/(?:^|\/)v\d+\//);
  if (!version || version.index === undefined) return src;

  const versionStart = assetStart + version.index + (version[0].startsWith("/") ? 1 : 0);
  return `${src.slice(0, assetStart)}${src.slice(versionStart)}`;
}

function withRetryQuery(src: string, retry: number) {
  if (!retry) return src;
  return `${src}${src.includes("?") ? "&" : "?"}afterhours_retry=${retry}`;
}

export function PhotoImage({ src, thumbnailSrc, fallbackSrc, alt, className, style, ...imageProps }: PhotoImageProps) {
  const [retry, setRetry] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const retryTimer = useRef<number | undefined>(undefined);
  const displaySrc = thumbnailFailed ? src : thumbnailSrc ?? thumbnailCandidate(src);
  const isAsyncCutout = displaySrc.includes("e_background_removal");
  const loading = imageProps.loading ?? "lazy";
  const decoding = imageProps.decoding ?? "async";

  useEffect(() => {
    setRetry(0);
    setReady(false);
    setFailed(false);
    setThumbnailFailed(false);
    return () => window.clearTimeout(retryTimer.current);
  }, [src, thumbnailSrc]);

  const unavailable = <div role="img" aria-label={`${alt} (image unavailable)`} className={`grid min-h-36 place-items-center bg-[#211e1a] px-4 text-center font-mono text-[9px] tracking-[.08em] text-[#8c8377] ${className ?? ""}`} style={style}>PHOTO COULD NOT BE LOADED</div>;
  if (!src) return unavailable;
  if (!isAsyncCutout) {
    if (failed) return unavailable;
    return <img src={displaySrc} alt={alt} className={className} style={style} loading={loading} decoding={decoding} onError={() => {
      if (displaySrc !== src) setThumbnailFailed(true);
      else setFailed(true);
    }} {...imageProps} />;
  }

  const fallback = fallbackSrc ?? originalCloudinaryUrl(displaySrc);
  const candidate = withRetryQuery(displaySrc, retry);
  const handleError = () => {
    if (retry < 5) {
      const delay = Math.min(1100 + retry * 1000, 5000);
      retryTimer.current = window.setTimeout(() => setRetry((current) => current + 1), delay);
    } else {
      setFailed(true);
    }
  };

  return <span className="relative grid w-full min-w-0">
    <img src={fallback} alt={alt} loading={loading} decoding={decoding} className={`col-start-1 row-start-1 ${className ?? ""} transition-opacity duration-300 ${ready && !failed ? "opacity-0" : "opacity-100"}`} style={style} {...imageProps} />
    <img src={candidate} alt={ready && !failed ? alt : ""} aria-hidden={!ready || failed} loading={loading} decoding={decoding} className={`col-start-1 row-start-1 ${className ?? ""} transition-opacity duration-300 ${ready && !failed ? "opacity-100" : "opacity-0"}`} style={style} onLoad={() => setReady(true)} onError={handleError} />
  </span>;
}
