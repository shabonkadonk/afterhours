"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Camera, Disc3, Download, House, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useInstalledApp } from "@/components/use-installed-app";

function isMobileDevice() {
  const browser = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  if (typeof browser.userAgentData?.mobile === "boolean") return browser.userAgentData.mobile;

  const userAgent = navigator.userAgent;
  const touchMac = /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1;
  return touchMac || /Android|iPhone|iPad|iPod|IEMobile|Windows Phone|Mobile/i.test(userAgent);
}

export function SiteHeader() {
  const path = usePathname();
  const isHome = path === "/";
  const { user, configured } = useAuth();
  const isInstalled = useInstalledApp();
  const [mobileDevice, setMobileDevice] = useState<boolean | null>(null);
  const onCreate = path === "/rolls/new";
  const onRolls = path.startsWith("/dashboard") || path.startsWith("/capture/") || path.startsWith("/join") || (path.startsWith("/rolls/") && !onCreate);
  const isGuest = Boolean(user?.is_anonymous);
  const accountHref = isGuest ? "/login?next=%2Fdashboard" : user ? "/account" : "/login";
  const accountLabel = isGuest ? "Host sign in" : user ? "Account" : "Sign in";
  const showBrowserNavigation = mobileDevice === false;
  const showInstallOnlyNavigation = mobileDevice === true && isInstalled === false;

  useEffect(() => { setMobileDevice(isMobileDevice()); }, []);

  if (isInstalled || isGuest) return null;
  return (
    <>
    <header className="site-header relative z-20 border-b border-white/10 bg-[#141311]/95 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
        <div className="site-header__inner mx-auto flex h-[66px] max-w-[1440px] items-center justify-between px-5 sm:h-[72px] sm:px-10 lg:px-16">
        {showBrowserNavigation ? <Link href="/" className="group flex items-center gap-2.5" aria-label="Afterhours home">
          <span className="brand-mark flex h-8 w-8 items-center justify-center"><Disc3 size={17} strokeWidth={1.4}/></span>
          <span className="text-[12px] font-semibold tracking-[.2em]">AFTERHOURS</span>
        </Link> : <div className="group flex items-center gap-2.5" aria-label="Afterhours">
          <span className="brand-mark flex h-8 w-8 items-center justify-center"><Disc3 size={17} strokeWidth={1.4}/></span>
          <span className="text-[12px] font-semibold tracking-[.2em]">AFTERHOURS</span>
        </div>}
        <div className="site-header__desktop-note" aria-hidden="true"><span>SHARED PHOTO ROLLS</span><span>NO FEED. JUST FRAMES.</span></div>
        <div className="site-header__links flex items-center gap-3">
          {showBrowserNavigation && <nav aria-label="Primary navigation" className="site-header__nav hidden items-center gap-8 sm:flex">
            <Link href="/dashboard" aria-current={onRolls ? "page" : undefined} className={`site-header__nav-link flex items-center gap-2 text-xs transition ${onRolls ? "text-[#eee9de]" : "text-[#898378] hover:text-[#eee9de]"}`}><Disc3 size={15}/>Your rolls</Link>
            {isHome ? <Link href="/rolls/new" className="button-primary min-h-9 px-3 text-xs sm:min-h-10 sm:px-4">Create a roll <ArrowUpRight size={13}/></Link> : <Link href="/rolls/new" aria-current={onCreate ? "page" : undefined} className="flex items-center gap-2 text-xs text-[#d5cfc3] transition hover:text-white"><Camera size={14} className="text-[#b54b40]"/>New roll</Link>}
            {configured && <Link href={accountHref} className="flex min-h-9 items-center gap-1.5 text-xs text-[#aaa396] transition hover:text-white"><UserRound size={15}/>{accountLabel}</Link>}
          </nav>}
          {showBrowserNavigation && configured && <Link href={accountHref} aria-label={accountLabel} className="flex h-12 w-12 shrink-0 items-center justify-center text-[#eee9de] transition hover:text-white sm:hidden"><UserRound size={19}/></Link>}
        </div>
        <div className="site-header__rail-footer" aria-hidden="true"><span>AFTERHOURS FIELD NOTES</span><p>Made for the moments<br/>between the photos.</p><i>EST. AFTER DARK</i></div>
      </div>
    </header>
    {showBrowserNavigation && <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#141311]/95 px-3 pt-2 backdrop-blur-md sm:hidden" style={{ paddingBottom: "max(.5rem, env(safe-area-inset-bottom))" }}>
      <div className={`mx-auto grid max-w-md ${isInstalled ? "grid-cols-3" : "grid-cols-4"}`}>
        <Link href="/" aria-current={isHome ? "page" : undefined} className={`flex min-h-12 flex-col items-center justify-center gap-1 text-[9px] tracking-[.04em] ${isHome ? "text-[#eee9de]" : "text-[#898378]"}`}><House size={16} strokeWidth={1.6}/>Home</Link>
        <Link href="/dashboard" aria-current={onRolls ? "page" : undefined} className={`flex min-h-12 flex-col items-center justify-center gap-1 text-[9px] tracking-[.04em] ${onRolls ? "text-[#eee9de]" : "text-[#898378]"}`}><Disc3 size={16} strokeWidth={1.6}/>My rolls</Link>
        <Link href="/rolls/new" aria-current={onCreate ? "page" : undefined} className={`flex min-h-12 flex-col items-center justify-center gap-1 text-[9px] tracking-[.04em] ${onCreate ? "text-[#eee9de]" : "text-[#898378]"}`}><Camera size={16} strokeWidth={1.6} className={onCreate ? "text-[#c55448]" : ""}/>Create roll</Link>
        {!isInstalled && <Link href="/install" aria-current={path === "/install" ? "page" : undefined} className={`flex min-h-12 flex-col items-center justify-center gap-1 text-[9px] tracking-[.04em] ${path === "/install" ? "text-[#eee9de]" : "text-[#898378]"}`}><Download size={16} strokeWidth={1.6}/>Install</Link>}
      </div>
    </nav>}
    {showInstallOnlyNavigation && <nav aria-label="Install Afterhours" className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#141311]/95 px-3 pt-2 backdrop-blur-md sm:hidden" style={{ paddingBottom: "max(.5rem, env(safe-area-inset-bottom))" }}>
      <div className="mx-auto grid max-w-md grid-cols-1">
        <Link href="/install" aria-current={path === "/install" ? "page" : undefined} className={`flex min-h-12 flex-col items-center justify-center gap-1 text-[9px] tracking-[.04em] ${path === "/install" ? "text-[#eee9de]" : "text-[#898378]"}`}><Download size={16} strokeWidth={1.6}/>Install Afterhours</Link>
      </div>
    </nav>}
    </>
  );
}
