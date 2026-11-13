import "server-only";
import { sendNotification, setVapidDetails } from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

type StoredSubscription = {
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
};

export function hasWebPushConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
    && process.env.VAPID_PRIVATE_KEY?.trim()
    && process.env.VAPID_SUBJECT?.trim(),
  );
}

export async function sendRollRevealedPush(admin: SupabaseClient, rollId: string) {
  if (!hasWebPushConfig()) return;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY!.trim();
  const subject = process.env.VAPID_SUBJECT!.trim();

  try {
    setVapidDetails(subject, publicKey, privateKey);
  } catch (error) {
    console.error("Push notifications have invalid VAPID settings.", error instanceof Error ? error.message : "Unknown error");
    return;
  }

  const { data: members, error: membersError } = await admin
    .from("roll_members")
    .select("user_id")
    .eq("roll_id", rollId);
  if (membersError) {
    console.error("Could not find roll members for push notifications.", membersError.message);
    return;
  }

  const userIds = [...new Set((members ?? []).map((member) => member.user_id as string))];
  if (!userIds.length) return;

  const { data: subscriptions, error: subscriptionsError } = await admin
    .from("push_subscriptions")
    .select("endpoint,p256dh_key,auth_key")
    .in("user_id", userIds);
  if (subscriptionsError) {
    console.error("Could not load push subscriptions.", subscriptionsError.message);
    return;
  }

  const payload = JSON.stringify({
    title: "A shared roll is ready",
    body: "The photos are unlocked. Open Afterhours to see them together.",
    url: `/rolls/${rollId}/reveal`,
    tag: `roll-${rollId}`,
  });

  await Promise.all((subscriptions ?? []).map(async (row: StoredSubscription) => {
    try {
      await sendNotification({
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh_key, auth: row.auth_key },
      }, payload, { TTL: 60 * 60 * 24 });
    } catch (error) {
      const statusCode = typeof error === "object" && error !== null && "statusCode" in error
        ? Number(error.statusCode)
        : null;
      if (statusCode === 404 || statusCode === 410) {
        const { error: deleteError } = await admin.from("push_subscriptions").delete().eq("endpoint", row.endpoint);
        if (deleteError) console.error("Could not remove an expired push subscription.", deleteError.message);
      } else {
        console.error("Could not deliver a roll reveal push notification.", statusCode ?? "Unknown error");
      }
    }
  }));
}
