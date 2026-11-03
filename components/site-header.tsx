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
  const quickLabel = path.startsWith("/capture/") ? "Session"
    : currentRoll?.status === "revealed" ? "Gallery"
      : currentRoll ? "Add photos" : "New roll";
  return (
    <>
    <header className="relative z-20 border-b border-white/10 bg-[#141311]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-[66px] max-w-[1440px] items-center justify-between px-5 sm:h-[72px] sm:px-10 lg:px-16">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="Afterhours home">
          <span className="flex h-8 w-8 items-center justify-center border border-[#a33a32] text-[#c55448]"><Disc3 size={17} strokeWidth={1.4}/></span>
          <span className="text-[12px] font-semibold tracking-[.2em]">AFTERHOURS</span>
        </Link>
        <nav className="flex items-center gap-4 sm:gap-8">
          <Link href="/dashboard" className={`text-xs transition ${path.startsWith("/dashboard") ? "text-[#eee9de]" : "text-[#898378] hover:text-[#eee9de]"}`}><span className="hidden sm:inline">Your rolls</span><span className="sm:hidden">Rolls</span></Link>
          <span className="hidden h-4 w-px bg-white/15 sm:block" />
          {isHome ? <Link href="/rolls/new" className="button-primary min-h-9 px-3 text-xs sm:min-h-10 sm:px-4">Create a roll <ArrowUpRight size={13}/></Link> : <Link href="/rolls/new" className="flex items-center gap-2 text-xs text-[#d5cfc3] transition hover:text-white"><Camera size={14} className="text-[#b54b40]"/><span className="hidden sm:inline">New roll</span><span className="sm:hidden">Create</span></Link>}
          {configured && <Link href={user ? "/account" : "/login"} aria-label={user ? "Account" : "Sign in"} className="flex min-h-9 items-center gap-1.5 text-xs text-[#aaa396] transition hover:text-white"><UserRound size={15}/><span className="hidden sm:inline">{user ? "Account" : "Sign in"}</span></Link>}
        </nav>
      </div>
    </header>
    {!isHome && <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#141311]/95 px-4 pt-2 backdrop-blur-md sm:hidden" style={{ paddingBottom: "max(.5rem, env(safe-area-inset-bottom))" }}>
      <div className="mx-auto grid max-w-md grid-cols-2 gap-2">
        <Link href="/dashboard" aria-current={path.startsWith("/dashboard") ? "page" : undefined} className={`flex min-h-12 items-center justify-center gap-2 border text-xs ${path.startsWith("/dashboard") ? "border-white/20 bg-white/[.06] text-[#eee9de]" : "border-white/10 text-[#aaa396]"}`}><Disc3 size={14}/> My rolls</Link>
        <Link href={quickHref} className="flex min-h-12 items-center justify-center gap-2 border border-[#a33a32]/50 bg-[#a33a32]/10 text-xs text-[#eee9de]"><Camera size={14} className="text-[#c55448]"/> {quickLabel}</Link>
      </div>
    </nav>}
    </>
  );
}
