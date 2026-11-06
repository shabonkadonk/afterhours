"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, House, KeyRound, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useInstalledApp } from "@/components/use-installed-app";

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
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (!installed) return;
    document.documentElement.classList.add("is-installed-app");
    try {
      void screen.orientation?.lock?.("portrait-primary").catch(() => undefined);
    } catch {
      // Some installed browsers expose orientation data but do not allow a lock.
    }
    return () => {
      document.documentElement.classList.remove("is-installed-app");
      screen.orientation?.unlock?.();
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
