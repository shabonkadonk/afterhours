import type { Metadata } from "next";
import InstallPageClient from "./install-page-client";

type PageProps = {
  searchParams: Promise<{ invite?: string | string[]; code?: string | string[] }>;
};

const INVITE_TOKEN_PATTERN = /^[0-9a-f]{64}$/i;
const INVITE_CODE_PATTERN = /^(?:AFTR-[0-9A-F]{8}|[0-9A-F]{10})$/i;

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const rawInvite = Array.isArray(params.invite) ? params.invite[0] : params.invite;
  const rawCode = Array.isArray(params.code) ? params.code[0] : params.code;
  const invite = rawInvite?.trim();
  const code = rawCode?.trim().toUpperCase();
  const manifestParams = new URLSearchParams();

  if (invite && INVITE_TOKEN_PATTERN.test(invite)) manifestParams.set("invite", invite.toLowerCase());
  else if (code && INVITE_CODE_PATTERN.test(code)) manifestParams.set("code", code);

  const query = manifestParams.toString();
  return { manifest: query ? `/api/install-manifest?${query}` : "/manifest.webmanifest" };
}

export default function InstallPage() {
  return <InstallPageClient/>;
}
