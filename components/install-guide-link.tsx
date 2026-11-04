"use client";

import Link from "next/link";
import { useInstalledApp } from "@/components/use-installed-app";

export function InstallGuideLink({ className, children }: { className?: string; children: React.ReactNode }) {
  const isInstalled = useInstalledApp();
  if (isInstalled) return null;
  return <Link href="/install" className={className}>{children}</Link>;
}
