import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { hasWebPushConfig } from "@/lib/web-push";

export const runtime = "nodejs";

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).host === request.headers.get("host"); }
  catch { return false; }
}

function isPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 4096) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const trustedHost = host === "fcm.googleapis.com"
      || host === "web.push.apple.com"
      || host === "push.services.mozilla.com"
      || host.endsWith(".push.services.mozilla.com")
      || host === "notify.windows.com"
      || host.endsWith(".notify.windows.com");
    return url.protocol === "https:" && !url.username && !url.password && trustedHost;
  } catch {
    return false;
  }
}

async function getSignedInAccount() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { response: NextResponse.json({ error: "Accounts are not configured." }, { status: 503 }) } as const;
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Sign in to manage notifications." }, { status: 401 }) } as const;
  if (user.is_anonymous) return { response: NextResponse.json({ error: "Sign in to an account to enable notifications." }, { status: 403 }) } as const;
  return { user } as const;
}

export async function GET(request: NextRequest) {
  const account = await getSignedInAccount();
  if ("response" in account) return account.response;
  const endpoint = new URL(request.url).searchParams.get("endpoint");
  if (!isPushEndpoint(endpoint)) return NextResponse.json({ error: "The push subscription is invalid." }, { status: 400 });

  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Push notifications are not configured yet." }, { status: 503 });
  const { data, error } = await admin.from("push_subscriptions").select("endpoint")
    .eq("user_id", account.user.id)
    .eq("endpoint", endpoint)
    .maybeSingle();
  if (error) {
    console.error("Could not check push notification settings.", error.message);
    return NextResponse.json({ error: "Could not load notification settings." }, { status: 500 });
  }
  return NextResponse.json({ enabled: Boolean(data) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin was not allowed." }, { status: 403 });
  const account = await getSignedInAccount();
  if ("response" in account) return account.response;
  if (!hasWebPushConfig()) return NextResponse.json({ error: "Push notifications are not configured yet." }, { status: 503 });

  let body: { subscription?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: "The push subscription is invalid." }, { status: 400 }); }

  const subscription = body && typeof body === "object"
    ? body.subscription as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | undefined
    : undefined;
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (!isPushEndpoint(endpoint) || typeof p256dh !== "string" || p256dh.length < 1 || p256dh.length > 256 || typeof auth !== "string" || auth.length < 1 || auth.length > 128) {
    return NextResponse.json({ error: "The push subscription is invalid." }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Push notifications are not configured yet." }, { status: 503 });
  const { error } = await admin.from("push_subscriptions").upsert({
    user_id: account.user.id,
    endpoint,
    p256dh_key: p256dh,
    auth_key: auth,
  }, { onConflict: "endpoint" });
  if (error) {
    console.error("Could not save a push subscription.", error.message);
    return NextResponse.json({ error: "Could not save notification settings." }, { status: 500 });
  }

  return NextResponse.json({ enabled: true }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin was not allowed." }, { status: 403 });
  const account = await getSignedInAccount();
  if ("response" in account) return account.response;

  let body: { endpoint?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: "The push subscription is invalid." }, { status: 400 }); }
  if (!body || typeof body !== "object" || !isPushEndpoint(body.endpoint)) {
    return NextResponse.json({ error: "The push subscription is invalid." }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Push notifications are not configured yet." }, { status: 503 });
  const { error } = await admin.from("push_subscriptions").delete()
    .eq("user_id", account.user.id)
    .eq("endpoint", body.endpoint);
  if (error) {
    console.error("Could not remove a push subscription.", error.message);
    return NextResponse.json({ error: "Could not update notification settings." }, { status: 500 });
  }

  return NextResponse.json({ enabled: false }, { headers: { "Cache-Control": "no-store" } });
}
