"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Camera, Disc3, UserRound } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { useAuth } from "@/components/auth-provider";

export function SiteHeader() {
  const path = usePathname();
  const isHome = path === "/";
  const { rolls } = useApp();
  const { user, configured } = useAuth();
  const rollId = path.match(/^\/(?:rolls|capture)\/([^/]+)/)?.[1];
  const currentRoll = rolls.find((roll) => roll.id === rollId);
  const quickHref = path.startsWith("/capture/") && currentRoll
    ? `/rolls/${currentRoll.id}`
    : currentRoll?.status === "revealed"
      ? `/rolls/${currentRoll.id}/reveal`
      : currentRoll
        ? `/capture/${currentRoll.id}`
        : "/rolls/new";
  const quickLabel = path.startsWith("/capture/") ? "SESSION"
    : currentRoll?.status === "revealed" ? "GALLERY"
      : currentRoll ? "ADD PHOTOS" : "NEW ROLL";
  return (
    <>
    <header className="relative z-20 border-b border-white/10 bg-[#141311]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-[66px] max-w-[1440px] items-center justify-between px-5 sm:h-[72px] sm:px-10 lg:px-16">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="Afterhours home">
          <span className="flex h-8 w-8 items-center justify-center border border-[#a33a32] text-[#c55448]"><Disc3 size={17} strokeWidth={1.4}/></span>
          <span className="text-[12px] font-semibold tracking-[.24em]">AFTERHOURS<span className="ml-1 text-[#a44940]">®</span></span>
        </Link>
        <nav className="flex items-center gap-4 sm:gap-8">
          <Link href="/dashboard" className={`text-[9px] tracking-[.12em] transition sm:text-[10px] sm:tracking-[.17em] ${path.startsWith("/dashboard") ? "text-[#eee9de]" : "text-[#898378] hover:text-[#eee9de]"}`}><span className="hidden sm:inline">YOUR ROLLS</span><span className="sm:hidden">ROLLS</span></Link>
          <span className="hidden h-4 w-px bg-white/15 sm:block" />
          {isHome ? <Link href="/rolls/new" className="button-primary min-h-9 px-3 text-[10px] tracking-[.1em] sm:min-h-10 sm:px-4">START A ROLL <ArrowUpRight size={13}/></Link> : <Link href="/rolls/new" className="flex items-center gap-2 text-[10px] tracking-[.12em] text-[#d5cfc3] transition hover:text-white"><Camera size={14} className="text-[#b54b40]"/><span className="hidden sm:inline">NEW ROLL</span><span className="sm:hidden">CREATE</span></Link>}
          {configured && <Link href={user ? "/account" : "/login"} aria-label={user ? "Account" : "Sign in"} className="flex min-h-9 items-center gap-1.5 text-[#aaa396] transition hover:text-white"><UserRound size={15}/><span className="hidden text-[9px] tracking-[.1em] sm:inline">{user ? "ACCOUNT" : "SIGN IN"}</span></Link>}
        </nav>
      </div>
      {!isHome && <div className="border-t border-white/[.06] px-5 py-2 text-center font-mono text-[8px] tracking-[.13em] text-[#817a70] sm:hidden">LOCAL DEMO · THIS BROWSER ONLY</div>}
    </header>
    {!isHome && <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#141311]/95 px-4 pt-2 backdrop-blur-md sm:hidden" style={{ paddingBottom: "max(.5rem, env(safe-area-inset-bottom))" }}>
      <div className="mx-auto grid max-w-md grid-cols-2 gap-2">
        <Link href="/dashboard" aria-current={path.startsWith("/dashboard") ? "page" : undefined} className={`flex min-h-12 items-center justify-center gap-2 border text-[10px] tracking-[.14em] ${path.startsWith("/dashboard") ? "border-white/20 bg-white/[.06] text-[#eee9de]" : "border-white/10 text-[#aaa396]"}`}><Disc3 size={14}/> MY ROLLS</Link>
        <Link href={quickHref} className="flex min-h-12 items-center justify-center gap-2 border border-[#a33a32]/50 bg-[#a33a32]/10 text-[10px] tracking-[.14em] text-[#eee9de]"><Camera size={14} className="text-[#c55448]"/> {quickLabel}</Link>
      </div>
    </nav>}
    </>
  );
}
