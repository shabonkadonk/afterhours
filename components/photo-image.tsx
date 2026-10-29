"use client";

import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";

type PhotoImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "onError" | "onLoad"> & {
  src: string;
  fallbackSrc?: string;
};

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

export function PhotoImage({ src, fallbackSrc, alt, className, style, ...imageProps }: PhotoImageProps) {
  const [retry, setRetry] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const retryTimer = useRef<number | undefined>(undefined);
  const isAsyncCutout = src.includes("e_background_removal");

  useEffect(() => {
    setRetry(0);
    setReady(false);
    setFailed(false);
    return () => window.clearTimeout(retryTimer.current);
  }, [src]);

  const unavailable = <div role="img" aria-label={`${alt} (image unavailable)`} className={`grid min-h-36 place-items-center bg-[#211e1a] px-4 text-center font-mono text-[9px] tracking-[.08em] text-[#8c8377] ${className ?? ""}`} style={style}>PHOTO COULD NOT BE LOADED</div>;
  if (!src) return unavailable;
  if (!isAsyncCutout) {
    if (failed) return unavailable;
    return <img src={src} alt={alt} className={className} style={style} onError={() => setFailed(true)} {...imageProps} />;
  }

  const fallback = fallbackSrc ?? originalCloudinaryUrl(src);
  const candidate = withRetryQuery(src, retry);
  const handleError = () => {
    if (retry < 5) {
      const delay = Math.min(1100 + retry * 1000, 5000);
      retryTimer.current = window.setTimeout(() => setRetry((current) => current + 1), delay);
    } else {
      setFailed(true);
    }
  };

  return <span className="relative grid w-full min-w-0">
    <img src={fallback} alt={alt} className={`col-start-1 row-start-1 ${className ?? ""} transition-opacity duration-300 ${ready && !failed ? "opacity-0" : "opacity-100"}`} style={style} {...imageProps} />
    <img src={candidate} alt={ready && !failed ? alt : ""} aria-hidden={!ready || failed} className={`col-start-1 row-start-1 ${className ?? ""} transition-opacity duration-300 ${ready && !failed ? "opacity-100" : "opacity-0"}`} style={style} onLoad={() => setReady(true)} onError={handleError} />
  </span>;
}
