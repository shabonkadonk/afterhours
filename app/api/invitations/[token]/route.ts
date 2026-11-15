import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!/^[0-9a-f]{64}$/i.test(token)) return NextResponse.json({ error: "This invitation is unavailable." }, { status: 404 });
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Invitations are not configured yet." }, { status: 503 });
  const { data, error } = await admin.from("rolls")
    .select("id,name,theme,status,ends_at,photo_count,photo_limit,invitation_enabled")
    .eq("invite_token", token.toLowerCase()).maybeSingle();
  if (error) return NextResponse.json({ error: "This invitation could not be loaded." }, { status: 503 });
  if (!data) return NextResponse.json({ error: "This invitation is unavailable." }, { status: 404 });

  const supabase = await getSupabaseServerClient();
  let userId: string | null = null;
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  }
  let alreadyJoined = false;
  if (userId) {
    const { data: membership } = await admin.from("roll_members").select("roll_id")
      .eq("roll_id", data.id).eq("user_id", userId).maybeSingle();
    alreadyJoined = Boolean(membership);
  }
  const closed = data.status !== "active" || Date.parse(data.ends_at) <= Date.now();
  if ((closed || !data.invitation_enabled) && !alreadyJoined) {
    return NextResponse.json({ error: "This invitation is unavailable or the roll has closed." }, { status: 404 });
  }
  return NextResponse.json({
    roll: {
      id: alreadyJoined ? data.id : undefined,
      name: data.name,
      theme: data.theme,
      photoCount: data.photo_count,
      photoLimit: data.photo_limit,
      status: closed ? "revealed" : "active",
      alreadyJoined,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
