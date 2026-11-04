"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Download, Smartphone } from "lucide-react";
import { useInstalledApp } from "@/components/use-installed-app";

export default function InstallPage() {
  const router = useRouter();
  const isInstalled = useInstalledApp();

  useEffect(() => {
    if (isInstalled) router.replace("/");
  }, [isInstalled, router]);

  if (isInstalled) return null;

  return <main className="mx-auto min-h-[calc(100svh-90px)] max-w-[1440px] px-5 pb-20 pt-8 sm:px-10 sm:pt-12 lg:px-16">
    <div className="mx-auto max-w-[760px]">
      <Link href="/" className="inline-flex min-h-10 items-center gap-2 font-mono text-[10px] tracking-[.12em] text-[#8a8378] hover:text-[#eee9de]"><ArrowLeft size={13}/> AFTERHOURS HOME</Link>
      <section className="mt-6 border border-white/10 bg-[#191714] p-5 sm:p-9">
        <span className="flex h-10 w-10 items-center justify-center border border-[#a33a32]/50 text-[#c55448]"><Download size={18}/></span>
        <p className="eyebrow mt-6">TAKE THE CAMERA ROLL WITH YOU</p>
        <h1 className="mt-2 font-display text-4xl tracking-[-.045em] sm:text-5xl">Install Afterhours.</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[#918a7e]">Add Afterhours to your Home Screen for a full-screen app feel. Your rolls and photos still use the same account and privacy settings as the website.</p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <section className="border border-white/10 bg-[#1e1b17] p-5">
            <h2 className="flex items-center gap-2 font-display text-2xl"><Smartphone size={17} className="text-[#bc574b]"/> iPhone or iPad</h2>
            <ol className="mt-4 space-y-3 text-sm leading-5 text-[#a39a8d]">
              <li className="flex gap-3"><span className="font-mono text-[10px] text-[#c55448]">01</span><span>Open this page in Safari.</span></li>
              <li className="flex gap-3"><span className="font-mono text-[10px] text-[#c55448]">02</span><span>Tap <strong className="font-medium text-[#ded8cd]">Share</strong>, then choose <strong className="font-medium text-[#ded8cd]">Add to Home Screen</strong>.</span></li>
              <li className="flex gap-3"><span className="font-mono text-[10px] text-[#c55448]">03</span><span>Leave <strong className="font-medium text-[#ded8cd]">Open as Web App</strong> enabled if it appears, then tap <strong className="font-medium text-[#ded8cd]">Add</strong>.</span></li>
            </ol>
          </section>
          <section className="border border-white/10 bg-[#1e1b17] p-5">
            <h2 className="flex items-center gap-2 font-display text-2xl"><Download size={17} className="text-[#bc574b]"/> Android</h2>
            <ol className="mt-4 space-y-3 text-sm leading-5 text-[#a39a8d]">
              <li className="flex gap-3"><span className="font-mono text-[10px] text-[#c55448]">01</span><span>Open Afterhours in Chrome.</span></li>
              <li className="flex gap-3"><span className="font-mono text-[10px] text-[#c55448]">02</span><span>Tap the install icon in the address bar, or open the <strong className="font-medium text-[#ded8cd]">⋮</strong> menu.</span></li>
              <li className="flex gap-3"><span className="font-mono text-[10px] text-[#c55448]">03</span><span>Choose <strong className="font-medium text-[#ded8cd]">Install app</strong> or <strong className="font-medium text-[#ded8cd]">Add to Home screen</strong>.</span></li>
            </ol>
          </section>
        </div>
        <p className="mt-5 flex items-start gap-2 border-t border-white/10 pt-4 text-xs leading-5 text-[#817a70]"><Check size={14} className="mt-0.5 shrink-0 text-[#bc574b]"/> Afterhours does not cache private photos or account data for offline use.</p>
      </section>
    </div>
  </main>;
}
