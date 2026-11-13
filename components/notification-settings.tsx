"use client";

import { Bell, BellOff, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

type NoticeState = "checking" | "supported" | "unsupported" | "unavailable";

function decodeApplicationServerKey(value: string) {
  const padded = value + "=".repeat((4 - value.length % 4) % 4);
  const decoded = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

async function postSubscription(subscription: PushSubscription) {
  const response = await fetch("/api/push/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Could not enable notifications.");
}

export function NotificationSettings() {
  const [state, setState] = useState<NoticeState>("checking");
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supported = "serviceWorker" in navigator
      && "PushManager" in window
      && "Notification" in window;
    if (!supported) {
      setState("unsupported");
      setPermission("unsupported");
      return;
    }

    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      setState("unavailable");
      setPermission(Notification.permission);
      return;
    }

    setPermission(Notification.permission);
    void navigator.serviceWorker.getRegistration("/").then((registration) => registration?.pushManager.getSubscription())
      .then(async (subscription) => {
        if (!subscription) return false;
        const query = new URLSearchParams({ endpoint: subscription.endpoint });
        const response = await fetch(`/api/push/subscriptions?${query.toString()}`);
        if (!response.ok) return false;
        const result = await response.json() as { enabled?: boolean };
        return result.enabled === true;
      })
      .then(setEnabled)
      .catch(() => setEnabled(false))
      .finally(() => setState("supported"));
  }, []);

  async function enable() {
    setBusy(true);
    setMessage("");
    try {
      const currentPermission = Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
      setPermission(currentPermission);
      if (currentPermission !== "granted") {
        throw new Error("Allow notifications in your browser settings to turn them on.");
      }

      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const subscription = await registration.pushManager.getSubscription()
        ?? await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeApplicationServerKey(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) as BufferSource,
        });
      await postSubscription(subscription);
      setEnabled(true);
      setMessage("Notifications are on for roll reveals.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not enable notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const response = await fetch("/api/push/subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Could not turn notifications off.");
        await subscription.unsubscribe();
      }
      setEnabled(false);
      setMessage("Notifications are off.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not turn notifications off.");
    } finally {
      setBusy(false);
    }
  }

  const unavailableText = state === "unsupported"
    ? "This browser does not support push notifications."
    : state === "unavailable"
      ? "Push notifications are not configured yet."
      : permission === "denied"
        ? "Notifications are blocked in your browser settings."
        : "Get a heads-up when a shared roll is ready to open.";

  return <section className="flow-panel mt-5 border border-white/10 bg-[#191714] p-6 sm:p-8">
    <div className="flex items-start gap-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#a33a32]/40 text-[#c55448]">
        {enabled ? <Bell size={18}/> : <BellOff size={18}/>}
      </span>
      <div className="min-w-0 flex-1">
        <p className="eyebrow">PUSH NOTIFICATIONS</p>
        <h2 className="mt-2 font-display text-2xl">Know when a roll opens.</h2>
        <p className="mt-2 text-sm leading-6 text-[#918a7e]">{unavailableText}</p>
        {message && <p role="status" className="mt-3 text-xs leading-5 text-[#c7bfb1]">{message}</p>}
        {permission === "denied" && <p className="mt-2 text-xs leading-5 text-[#c7bfb1]">Change the site’s notification permission in your browser settings, then come back here.</p>}
        {state === "supported" && (permission !== "denied" || enabled) && <button
          type="button"
          onClick={() => void (enabled ? disable() : enable())}
          disabled={busy}
          className="button-secondary mt-5 min-h-11"
        >
          {busy ? <LoaderCircle size={15} className="animate-spin"/> : enabled ? <BellOff size={15}/> : <Bell size={15}/>}
          {busy ? "Updating…" : enabled ? "Turn notifications off" : "Turn notifications on"}
        </button>}
        {state === "checking" && <p className="mt-4 flex items-center gap-2 text-xs text-[#80796d]"><LoaderCircle size={13} className="animate-spin"/> Checking this device…</p>}
      </div>
    </div>
  </section>;
}
