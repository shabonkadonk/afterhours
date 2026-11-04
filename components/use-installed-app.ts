"use client";

import { useEffect, useState } from "react";

export function useInstalledApp() {
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const isStandalone = () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));

    setIsInstalled(isStandalone());
    const media = window.matchMedia("(display-mode: standalone)");
    const update = () => setIsInstalled(isStandalone());
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isInstalled;
}
