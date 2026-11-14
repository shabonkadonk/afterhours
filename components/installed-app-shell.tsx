"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, House, KeyRound, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useInstalledApp } from "@/components/use-installed-app";

type OrientationLock = ScreenOrientation & {
  lock?: (orientation: "portrait-primary") => Promise<void>;
};

function isMobileDevice() {
  const browser = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  if (typeof browser.userAgentData?.mobile === "boolean") return browser.userAgentData.mobile;

  const userAgent = navigator.userAgent;
  const touchMac = /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1;
  return touchMac || /Android|iPhone|iPad|iPod|IEMobile|Windows Phone|Mobile/i.test(userAgent);
}

function AppNavigation() {
  const path = usePathname();
  const { user, configured } = useAuth();
  const guest = Boolean(user?.is_anonymous);
  const items = [
    { href: "/", label: "Home", icon: House, active: path === "/" || path === "/dashboard" },
    ...(!guest ? [{ href: "/rolls/new", label: "Create", icon: Camera, active: path === "/rolls/new" }] : []),
    ...(guest || (configured && !user) ? [{ href: "/join", label: "Join", icon: KeyRound, active: path.startsWith("/join") }] : []),
    ...(user && !guest ? [{ href: "/account", label: "Profile", icon: UserRound, active: path === "/account" }] : []),
  ];

  return <nav className="installed-nav" aria-label="App navigation" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
    {items.map(({ href, label, icon: Icon, active }) => <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`installed-nav__item${active ? " is-active" : ""}`}>
      <Icon size={19} strokeWidth={1.7}/><span>{label}</span>
    </Link>)}
  </nav>;
}

export function InstalledAppShell({ children }: { children: React.ReactNode }) {
  const installed = useInstalledApp();
  const path = usePathname();
  const [mobileDevice, setMobileDevice] = useState<boolean | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => { setMobileDevice(isMobileDevice()); }, []);

  const needsInstallation = installed === false && mobileDevice === true && path !== "/install";
  useEffect(() => {
    if (!needsInstallation) return;

    const inviteToken = /^\/join\/([0-9a-f]{64})$/i.exec(path)?.[1]?.toLowerCase();
    const queryCode = new URLSearchParams(window.location.search).get("code")?.trim().toUpperCase();
    const inviteCode = queryCode && /^(?:AFTR-[0-9A-F]{8}|[0-9A-F]{10})$/.test(queryCode) ? queryCode : null;
    const installUrl = new URL("/install", window.location.origin);
    if (inviteToken) installUrl.searchParams.set("invite", inviteToken);
    else if (path === "/join" && inviteCode) installUrl.searchParams.set("code", inviteCode);
    window.location.replace(`${installUrl.pathname}${installUrl.search}`);
  }, [needsInstallation, path]);

  useEffect(() => {
    if (!installed) return;
    document.documentElement.classList.add("is-installed-app");
    try {
      const orientation = screen.orientation as OrientationLock | undefined;
      void orientation?.lock?.("portrait-primary").catch(() => undefined);
    } catch {
      // Some installed browsers expose orientation data but do not allow a lock.
    }
    return () => {
      document.documentElement.classList.remove("is-installed-app");
      (screen.orientation as OrientationLock | undefined)?.unlock?.();
    };
  }, [installed]);

  useEffect(() => {
    if (!installed || !("serviceWorker" in navigator)) return;
    const register = () => void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    if (process.env.NODE_ENV === "production") register();
  }, [installed]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  if (needsInstallation) return null;
  if (installed !== true) return <>{children}</>;
  return <div className={`installed-app${path === "/rolls/new" ? " installed-app--no-scroll" : ""}`}>
    <header className="installed-topbar">
      <Link href="/" className="installed-topbar__brand" aria-label="Afterhours home"><House size={17} strokeWidth={1.5}/><span>AFTERHOURS</span></Link>
      {!online && <span className="installed-offline" role="status">Offline</span>}
    </header>
    <div key={path} className={`installed-page${path.startsWith("/capture/") ? " installed-page--capture" : ""}`}>{children}</div>
    <AppNavigation/>
  </div>;
}
