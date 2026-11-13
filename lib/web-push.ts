import "server-only";
import { sendNotification, setVapidDetails } from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

type StoredSubscription = {
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
};

type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

export function hasWebPushConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
    && process.env.VAPID_PRIVATE_KEY?.trim()
    && process.env.VAPID_SUBJECT?.trim(),
  );
}

async function sendPushToUsers(admin: SupabaseClient, userIds: string[], payload: PushPayload) {
  if (!hasWebPushConfig()) return;

  const uniqueUserIds = [...new Set(userIds)];
  if (!uniqueUserIds.length) return;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY!.trim();
  const subject = process.env.VAPID_SUBJECT!.trim();

  try {
    setVapidDetails(subject, publicKey, privateKey);
  } catch (error) {
    console.error("Push notifications have invalid VAPID settings.", error instanceof Error ? error.message : "Unknown error");
    return;
  }

  const { data: subscriptions, error: subscriptionsError } = await admin
    .from("push_subscriptions")
    .select("endpoint,p256dh_key,auth_key")
    .in("user_id", uniqueUserIds);
  if (subscriptionsError) {
    console.error("Could not load push subscriptions.", subscriptionsError.message);
    return;
  }

  const serializedPayload = JSON.stringify(payload);

  await Promise.all((subscriptions ?? []).map(async (row: StoredSubscription) => {
    try {
      await sendNotification({
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh_key, auth: row.auth_key },
      }, serializedPayload, { TTL: 60 * 60 * 24 });
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

async function getRollMemberIds(admin: SupabaseClient, rollId: string) {
  const { data: members, error } = await admin
    .from("roll_members")
    .select("user_id")
    .eq("roll_id", rollId);
  if (error) {
    console.error("Could not find roll members for push notifications.", error.message);
    return null;
  }
  return (members ?? []).map((member) => member.user_id as string);
}

export async function sendRollRevealedPush(admin: SupabaseClient, rollId: string) {
  const userIds = await getRollMemberIds(admin, rollId);
  if (!userIds) return;
  await sendPushToUsers(admin, userIds, {
    title: "A shared roll is ready",
    body: "The photos are unlocked. Open Afterhours to see them together.",
    url: `/rolls/${rollId}/reveal`,
    tag: `roll-${rollId}`,
  });
}

export async function sendRollMemberJoinedPush(admin: SupabaseClient, rollId: string, joiningUserId: string) {
  const userIds = await getRollMemberIds(admin, rollId);
  if (!userIds) return;
  await sendPushToUsers(admin, userIds.filter((userId) => userId !== joiningUserId), {
    title: "Someone joined your roll",
    body: "Open Afterhours to see who’s in the crew.",
    url: `/rolls/${rollId}`,
    tag: `roll-${rollId}-join-${joiningUserId}`,
  });
}
