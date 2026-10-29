"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createDemoRolls } from "@/lib/demo-data";
import type { Photo, Roll } from "@/lib/types";
import { useAuth } from "@/components/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { addCloudPhotos, closeCloudRoll, createCloudRoll, deleteCloudRoll, loadCloudRolls } from "@/lib/supabase/rolls";

type CreateRollInput = { name: string; durationHours: number; photoLimit: number; theme: string };
type AppContextValue = {
  rolls: Roll[];
  ready: boolean;
  storageWarning: boolean;
  createRoll: (input: CreateRollInput) => Promise<Roll>;
  addPhotos: (rollId: string, photos: Omit<Photo, "id" | "at" | "by">[]) => Promise<void>;
  deleteRoll: (rollId: string) => Promise<void>;
  revealRoll: (rollId: string) => Promise<void>;
};

const STORAGE_KEY = "afterhours-prototype-v1";
const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user, configured, loading: authLoading } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const cloudMode = Boolean(configured && user && supabase);
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [ready, setReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);

  const refreshCloudRolls = useCallback(async () => {
    if (!supabase || !user) return;
    const next = await loadCloudRolls(supabase, user);
    setRolls(next);
    setStorageWarning(false);
  }, [supabase, user]);

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    setReady(false);
    if (cloudMode) {
      setRolls([]);
      void refreshCloudRolls().catch(() => { if (active) setStorageWarning(true); }).finally(() => { if (active) setReady(true); });
    } else {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        const parsed = saved === null ? null : JSON.parse(saved) as Roll[];
        setRolls(Array.isArray(parsed) ? parsed : createDemoRolls());
      } catch {
        setRolls(createDemoRolls());
      }
      setReady(true);
    }
    return () => { active = false; };
  }, [authLoading, cloudMode, refreshCloudRolls]);

  useEffect(() => {
    if (!ready || cloudMode) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rolls)); setStorageWarning(false); }
    catch { setStorageWarning(true); }
  }, [ready, cloudMode, rolls]);

  useEffect(() => {
    if (!ready || authLoading) return;
    if (cloudMode) {
      const refresh = () => { if (document.visibilityState === "visible") void refreshCloudRolls().catch(() => setStorageWarning(true)); };
      const timer = window.setInterval(refresh, 15000);
      window.addEventListener("focus", refresh);
      return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
    }
    const closeExpiredRolls = () => {
      const now = Date.now();
      setRolls((current) => {
        let changed = false;
        const next = current.map((roll) => {
          if (roll.status === "active" && new Date(roll.endsAt).getTime() <= now) {
            changed = true;
            return { ...roll, status: "revealed" as const };
          }
          return roll;
        });
        return changed ? next : current;
      });
    };
    closeExpiredRolls();
    const timer = window.setInterval(closeExpiredRolls, 5000);
    return () => window.clearInterval(timer);
  }, [ready, authLoading, cloudMode, refreshCloudRolls]);

  const createRoll = useCallback(async (input: CreateRollInput) => {
    if (cloudMode && supabase && user) {
      const created = await createCloudRoll(supabase, user, input);
      setRolls((current) => [created, ...current]);
      return created;
    }
    const now = new Date();
    const id = `roll-${now.getTime().toString(36)}`;
    const roll: Roll = {
      id, name: input.name.trim(), theme: input.theme, status: "active", createdAt: now.toISOString(),
      endsAt: new Date(now.getTime() + input.durationHours * 3600000).toISOString(), photoLimit: input.photoLimit,
      inviteCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
      participants: [{ name: "You", initials: "YO" }], photos: [],
    };
    setRolls((current) => [roll, ...current]);
    return roll;
  }, [cloudMode, supabase, user]);

  const addPhotos = useCallback(async (rollId: string, photos: Omit<Photo, "id" | "at" | "by">[]) => {
    if (cloudMode && supabase && user) {
      await addCloudPhotos(supabase, user, rollId, photos);
      await refreshCloudRolls();
      return;
    }
    setRolls((current) => current.map((roll) => {
      if (roll.id !== rollId || roll.status !== "active" || roll.photos.length >= roll.photoLimit) return roll;
      const now = Date.now();
      const available = Math.max(0, roll.photoLimit-roll.photos.length);
      const additions = photos.slice(0,available).map((photo,index)=>({
        ...photo, id: `photo-${(now+index).toString(36)}`, at: new Date(now+index).toISOString(), by: "You",
      }));
      return { ...roll, photos: [...roll.photos, ...additions] };
    }));
  }, [cloudMode, supabase, user, refreshCloudRolls]);

  const deleteRoll = useCallback(async (rollId: string) => {
    if (cloudMode && supabase) {
      await deleteCloudRoll(supabase, rollId);
      setRolls((current) => current.filter((roll) => roll.id !== rollId));
      return;
    }
    setRolls((current) => current.filter((roll) => roll.id !== rollId));
  }, [cloudMode, supabase]);

  const revealRoll = useCallback(async (rollId: string) => {
    if (cloudMode && supabase) {
      await closeCloudRoll(supabase, rollId);
      await refreshCloudRolls();
      return;
    }
    setRolls((current) => current.map((roll) => roll.id === rollId ? { ...roll, status: "revealed", endsAt: new Date().toISOString() } : roll));
  }, [cloudMode, supabase, refreshCloudRolls]);

  const value = useMemo(() => ({ rolls, ready, storageWarning, createRoll, addPhotos, deleteRoll, revealRoll }), [rolls, ready, storageWarning, createRoll, addPhotos, deleteRoll, revealRoll]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}
