"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, LogOut } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

export default function AccountPage() {
  const router = useRouter();
  const { user, configured, signOut } = useAuth();
  const [error, setError] = useState("");

  async function handleSignOut() {
    try { await signOut(); router.replace("/dashboard"); router.refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not sign out."); }
  }

  return <main className="mx-auto min-h-[calc(100svh-90px)] max-w-[1440px] px-5 pb-20 pt-8 sm:px-10 sm:pt-12 lg:px-16"><div className="mx-auto max-w-[560px]">
    <Link href="/dashboard" className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[.12em] text-[#8a8378] hover:text-[#eee9de]"><ArrowLeft size={13}/> YOUR ROLLS</Link>
    <section className="mt-8 border border-white/10 bg-[#191714] p-6 sm:p-8"><p className="eyebrow">YOUR AFTERHOURS ACCOUNT</p><h1 className="mt-2 break-all font-display text-3xl">{user?.email ?? "Not signed in"}</h1><p className="mt-3 text-sm leading-6 text-[#918a7e]">{configured ? "Your shared rolls are saved to your Afterhours account." : "Connect Supabase to enable account sign-in."}</p>
      {error && <p role="alert" className="mt-5 text-xs text-[#e08478]">{error}</p>}
      {user ? <button onClick={handleSignOut} className="button-secondary mt-6 min-h-11"><LogOut size={14}/> Sign out</button> : <Link href="/login" className="button-primary mt-6 min-h-11">Sign in <LogOut size={14}/></Link>}
    </section>
  </div></main>;
}
