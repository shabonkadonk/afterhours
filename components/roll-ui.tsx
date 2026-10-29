"use client";

import { Camera, Disc3, Users } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { useAuth } from "@/components/auth-provider";
import type { Participant, Roll } from "@/lib/types";

export function AvatarStack({ people, size = "md" }: { people: Participant[]; size?: "sm" | "md" | "lg" }) {
  const dimensions = size === "sm" ? "h-6 w-6 text-[8px]" : size === "lg" ? "h-10 w-10 text-[10px]" : "h-8 w-8 text-[9px]";
  return <div className="flex items-center -space-x-2">{people.slice(0, 5).map((person, index) => <span key={`${person.name}-${index}`} title={person.name} className={`${dimensions} relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#171613] bg-[#514138] font-mono text-[#eee9de]`} style={{ zIndex: 6 - index }}>{person.avatar ? <img src={person.avatar} alt="" className="h-full w-full object-cover"/> : person.initials}</span>)}{people.length > 5 && <span className={`${dimensions} flex items-center justify-center rounded-full border-2 border-[#171613] bg-[#2d2924] font-mono text-[#b3ac9f]`}>+{people.length - 5}</span>}</div>;
}

export function ThemeBadge({ theme }: { theme: string }) {
  return <span className="inline-flex items-center gap-1.5 border border-white/15 bg-black/25 px-2 py-1 font-mono text-[8px] tracking-[.13em] text-[#d5cfc3]"><Disc3 size={10}/>{theme.toUpperCase()}</span>;
}

export function LocalDemoNote({ children }: { children?: React.ReactNode }) {
  const { storageWarning } = useApp();
  const { configured, user } = useAuth();
  const defaultMessage = configured
    ? user ? "SHARED ROLLS · Your rolls and photos sync with your account." : "SIGN IN TO SYNC · You can still explore the local demo."
    : "LOCAL DEMO · Your rolls and photos are saved on this device only.";
  const warningMessage = configured && user
    ? "CLOUD SYNC FAILED · Check your connection, then refresh the page."
    : "BROWSER STORAGE IS FULL · These latest changes may not survive a refresh.";
  return <div role={storageWarning ? "alert" : undefined} className={`flex items-center gap-2 border px-3 py-2.5 font-mono text-[9px] leading-4 tracking-[.035em] ${storageWarning ? "border-[#d87b68]/50 bg-[#a33a32]/15 text-[#f2b8aa]" : "border-[#a33a32]/30 bg-[#a33a32]/[.07] text-[#c5b3a8]"}`}><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#b94b41]" />{storageWarning ? warningMessage : children ?? defaultMessage}</div>;
}
export function PhotoCount({ roll }: { roll: Roll }) {
  return <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-[#b9b2a6]"><Camera size={13}/>{roll.photos.length.toString().padStart(2, "0")} / {roll.photoLimit.toString().padStart(2, "0")}</span>;
}

export function ParticipantCount({ people }: { people: Participant[] }) {
  return <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-[#b9b2a6]"><Users size={13}/>{people.length.toString().padStart(2, "0")} IN THE ROLL</span>;
}

export function formatDate(value: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return new Intl.DateTimeFormat(undefined, options).format(new Date(value));
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
