import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

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
  if (!admin) return NextResponse.json({ error: "Expiration cleanup is not configured." }, { status: 503 });

  const { data: claims, error: claimError } = await admin.rpc("claim_expired_rolls", { batch_size: 5 });
  if (claimError) {
    console.error("Could not claim expired rolls.", claimError.message);
    return NextResponse.json({ error: "Could not start expiration cleanup." }, { status: 500 });
  }

  let deleted = 0;
  let retrying = 0;
  for (const claim of claims ?? []) {
    const rollId = claim.roll_id as string;
    const leaseToken = claim.lease_token as string;
    const paths = (claim.object_paths as string[] | null) ?? [];
    if (paths.length) {
      const { error } = await admin.storage.from("roll-photos").remove(paths);
      if (error) {
        console.error("Storage cleanup failed; roll will be retried.", rollId, error.message);
        await admin.from("rolls").update({ deletion_lease_until: new Date().toISOString() })
          .eq("id", rollId).eq("deletion_lease_token", leaseToken);
        retrying += 1;
        continue;
      }
    }
    const { data: finalized, error: finalizeError } = await admin.rpc("finalize_expired_roll", {
      target_roll_id: rollId,
      target_lease_token: leaseToken,
    });
    if (finalizeError) {
      console.error("Database cleanup failed after Storage removal; roll will be retried.", rollId, finalizeError.message);
      await admin.from("rolls").update({ deletion_lease_until: new Date().toISOString() })
        .eq("id", rollId).eq("deletion_lease_token", leaseToken);
      retrying += 1;
    } else if (finalized) {
      deleted += 1;
    }
  }

  const { data: anonymousUsersRemoved, error: authCleanupError } = await admin.rpc("cleanup_old_anonymous_users");
  if (authCleanupError) console.error("Anonymous guest cleanup failed; it will be retried.", authCleanupError.message);

  return NextResponse.json({ claimed: claims?.length ?? 0, deleted, retrying, anonymousUsersRemoved: anonymousUsersRemoved ?? 0 }, {
    headers: { "Cache-Control": "no-store" },
  });
}
