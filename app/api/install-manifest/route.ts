import { NextRequest, NextResponse } from "next/server";

const INVITE_TOKEN_PATTERN = /^[0-9a-f]{64}$/i;
const INVITE_CODE_PATTERN = /^(?:AFTR-[0-9A-F]{8}|[0-9A-F]{10})$/i;

export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rawToken = params.get("invite")?.trim() ?? "";
  const rawCode = params.get("code")?.trim().toUpperCase() ?? "";
  const inviteToken = INVITE_TOKEN_PATTERN.test(rawToken) ? rawToken.toLowerCase() : "";
  const inviteCode = INVITE_CODE_PATTERN.test(rawCode) ? rawCode : "";
  const startUrl = inviteToken
    ? `/join/${inviteToken}`
    : inviteCode
      ? `/join?code=${encodeURIComponent(inviteCode)}`
      : "/";

  return new NextResponse(JSON.stringify({
    id: "/",
    name: "Afterhours",
    short_name: "Afterhours",
    description: "A shared camera roll for nights out.",
    start_url: startUrl,
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#141311",
    theme_color: "#141311",
    shortcuts: [
      { name: "My rolls", short_name: "Rolls", url: "/dashboard", icons: [{ src: "/icons/afterhours-192.png", sizes: "192x192" }] },
      { name: "Create a roll", short_name: "Create", url: "/rolls/new", icons: [{ src: "/icons/afterhours-192.png", sizes: "192x192" }] },
      { name: "Join a roll", short_name: "Join", url: "/join", icons: [{ src: "/icons/afterhours-192.png", sizes: "192x192" }] },
    ],
    icons: [
      { src: "/icons/afterhours-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/afterhours-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/afterhours-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/manifest+json; charset=utf-8",
    },
  });
}
