import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { sendRollRevealedPush } from "@/lib/web-push";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).host === request.headers.get("host"); }
  catch { return false; }
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin was not allowed." }, { status: 403 });
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: "That roll is not available." }, { status: 404 });

  const supabase = await getSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Shared rolls are not configured." }, { status: 503 });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to reveal this roll." }, { status: 401 });

  const { data: roll, error: rollError } = await supabase
    .from("rolls").select("id,status").eq("id", id).maybeSingle();
  if (rollError || !roll) return NextResponse.json({ error: "That roll is not available." }, { status: 404 });

  const wasActive = roll.status === "active";
  if (wasActive) {
    const { error } = await supabase.rpc("close_roll", { target_roll_id: id });
    if (error) return NextResponse.json({ error: "This roll cannot be revealed yet." }, { status: 409 });
  }

  if (wasActive) {
    const admin = getSupabaseAdminClient();
    if (admin) await sendRollRevealedPush(admin, id);
  }

  return NextResponse.json({ revealed: true }, { headers: { "Cache-Control": "no-store" } });
}
