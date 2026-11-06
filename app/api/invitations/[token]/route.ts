import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!/^[0-9a-f]{64}$/i.test(token)) return NextResponse.json({ error: "This invitation is unavailable." }, { status: 404 });
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Invitations are not configured yet." }, { status: 503 });
  const { data, error } = await admin.from("rolls")
    .select("name,theme,status,ends_at,photo_count,photo_limit")
    .eq("invite_token", token.toLowerCase()).eq("invitation_enabled", true).maybeSingle();
  if (error) return NextResponse.json({ error: "This invitation could not be loaded." }, { status: 503 });
  if (!data || data.status !== "active" || Date.parse(data.ends_at) <= Date.now()) {
    return NextResponse.json({ error: "This invitation is unavailable or the roll has closed." }, { status: 404 });
  }
  return NextResponse.json({
    roll: { name: data.name, theme: data.theme, photoCount: data.photo_count, photoLimit: data.photo_limit },
  }, { headers: { "Cache-Control": "no-store" } });
}
