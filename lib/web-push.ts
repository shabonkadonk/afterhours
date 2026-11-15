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
  ttl?: number;
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

  const { ttl = 60 * 60 * 24, ...notification } = payload;
  const serializedPayload = JSON.stringify(notification);

  await Promise.all((subscriptions ?? []).map(async (row: StoredSubscription) => {
    try {
      await sendNotification({
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh_key, auth: row.auth_key },
      }, serializedPayload, { TTL: ttl });
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
  const { data: roll } = await admin.from("rolls").select("name").eq("id", rollId).maybeSingle();
  const messages = [
    "The roll's back from the lab.",
    "It's up. Good luck explaining frame 12.",
    "Fresh from the lab. Go look.",
    "The photos are out. Proceed carefully.",
    "Your roll's up. Get in there.",
  ];
  await sendPushToUsers(admin, userIds, {
    title: roll?.name || "Roll's up",
    body: messages[Math.floor(Math.random() * messages.length)],
    url: `/rolls/${rollId}/reveal`,
    tag: `roll-${rollId}-revealed`,
  });
}

export async function sendRollPreRevealPush(admin: SupabaseClient, rollId: string, rollName: string) {
  const userIds = await getRollMemberIds(admin, rollId);
  if (!userIds) return;
  const messages = [
    "5 min. Then we see what made the cut.",
    "Five minutes. Try to act normal.",
    "5 min till the evidence drops.",
    "Almost developed. Give it 5.",
    "Your roll's nearly ready. 5 min.",
  ];
  await sendPushToUsers(admin, userIds, {
    title: rollName || "5 minutes",
    body: messages[Math.floor(Math.random() * messages.length)],
    url: `/camera/${rollId}`,
    tag: `roll-${rollId}-pre-reveal`,
    ttl: 10 * 60,
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
