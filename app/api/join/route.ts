import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).host === request.headers.get("host"); }
  catch { return false; }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin was not allowed." }, { status: 403 });
  const supabase = await getSupabaseServerClient();
  const admin = getSupabaseAdminClient();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabase || !admin || !serviceKey) {
    return NextResponse.json({ error: "Guest invitations are not configured yet." }, { status: 503 });
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Start a guest session before joining." }, { status: 401 });

  let body: { token?: unknown; code?: unknown; displayName?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: "Enter a valid invitation." }, { status: 400 }); }
  const token = typeof body.token === "string" && /^[0-9a-f]{64}$/i.test(body.token) ? body.token.toLowerCase() : null;
  const code = typeof body.code === "string" && /^(?:AFTR-[0-9A-F]{8}|[0-9A-F]{10})$/i.test(body.code.trim()) ? body.code.trim().toUpperCase() : null;
  const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 48) : "";
  if ((!token && !code) || !displayName) return NextResponse.json({ error: "Enter your name and a valid invitation." }, { status: 400 });

  const address = request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "local-unknown";
  const rateKey = createHmac("sha256", serviceKey).update(address).digest("hex");
  const { data, error } = await admin.rpc("join_roll_by_invitation", {
    target_user_id: user.id,
    target_invite_token: token,
    target_join_code: code,
    target_display_name: displayName,
    target_rate_key: rateKey,
  });
  if (error) {
    console.error("Guest invitation join failed.", error.message);
    return NextResponse.json({ error: "Could not join this roll. Try again." }, { status: 503 });
  }
  if (data?.error === "rate_limited") {
    return NextResponse.json({ error: "Too many code attempts. Wait 15 minutes and try again." }, { status: 429 });
  }
  if (!data?.roll_id) return NextResponse.json({ error: "That invitation is invalid, disabled, or the roll has closed." }, { status: 404 });
  return NextResponse.json({ rollId: data.roll_id }, { headers: { "Cache-Control": "no-store" } });
}
