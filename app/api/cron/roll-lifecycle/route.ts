import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasWebPushConfig, sendRollPreRevealPush, sendRollRevealedPush } from "@/lib/web-push";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret) return false;
  const expectedBytes = Buffer.from(secret);
  const suppliedBytes = Buffer.from(supplied);
  if (suppliedBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(suppliedBytes, expectedBytes);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Roll notifications are not configured." }, { status: 503 });

  let reminders: { roll_id: string; roll_name: string }[] = [];
  if (hasWebPushConfig()) {
    const { data, error } = await admin.rpc("claim_roll_pre_reveal_notifications");
    if (error) {
      console.error("Could not claim roll reminders.", error.message);
      return NextResponse.json({ error: "Could not load roll reminders." }, { status: 500 });
    }
    reminders = (data ?? []) as typeof reminders;
  }
  for (const reminder of reminders) {
    await sendRollPreRevealPush(admin, reminder.roll_id, reminder.roll_name);
  }

  const { data: revealed, error: revealError } = await admin.rpc("reveal_due_rolls");
  if (revealError) {
    console.error("Could not reveal due rolls.", revealError.message);
    return NextResponse.json({ error: "Could not reveal due rolls." }, { status: 500 });
  }
  for (const roll of revealed ?? []) await sendRollRevealedPush(admin, roll.roll_id as string);

  return NextResponse.json({ reminders: reminders.length, revealed: revealed?.length ?? 0 }, {
    headers: { "Cache-Control": "no-store" },
  });
}
