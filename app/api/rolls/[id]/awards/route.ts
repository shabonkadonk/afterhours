import { NextResponse, type NextRequest } from "next/server";
import { AwardsProviderError } from "@/lib/ai/awards-types";
import { CloudflareAwardsProvider, DEFAULT_CLOUDFLARE_AWARDS_MODEL, MAX_AWARDS_IMAGE_BYTES } from "@/lib/ai/cloudflare-provider";
import { generateAwards } from "@/lib/ai/awards-service";
import { MockAwardsProvider } from "@/lib/ai/mock-provider";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };
type ProviderMode = "mock" | "cloudflare" | "unavailable";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function photoLimit() {
  const value = Number.parseInt(process.env.AWARDS_MAX_PHOTOS ?? "10", 10);
  if (!Number.isFinite(value)) return 10;
  return Math.max(1, Math.min(10, value));
}

function providerMode(): ProviderMode {
  const mockMode = process.env.AWARDS_MOCK_MODE?.trim().toLowerCase() !== "false";
  if (mockMode) return "mock";
  const enabled = process.env.AWARDS_LIVE_PROCESSING_ENABLED?.trim().toLowerCase() === "true";
  const requirementsConfirmed = process.env.AWARDS_PROVIDER_REQUIREMENTS_CONFIRMED?.trim().toLowerCase() === "true";
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  const model = process.env.CLOUDFLARE_MODEL_ID?.trim() || DEFAULT_CLOUDFLARE_AWARDS_MODEL;
  const validModel = /^@cf\/[A-Za-z0-9._/-]+$/.test(model);
  return enabled && requirementsConfirmed && accountId && token && validModel ? "cloudflare" : "unavailable";
}

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, ...(code ? { code } : {}) }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function failureMessage(code: string) {
  switch (code) {
    case "provider_auth": return "The AI provider or its model terms aren’t ready yet. Your photos weren’t processed.";
    case "provider_model": return "The selected vision model isn’t available right now.";
    case "provider_quota": return "The AI provider has reached a usage limit. Try again later.";
    case "invalid_response": return "We couldn’t safely use the AI’s response. You can try again.";
    case "photo_processing": return "One of the selected photo previews could not be prepared. Choose another photo or try again.";
    default: return "Awards are temporarily unavailable. Please try again in a bit.";
  }
}

async function getRequestContext(context: RouteContext) {
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) return { response: jsonError("That roll isn’t available for Awards.", 404) } as const;
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { response: jsonError("Shared roll storage isn’t configured.", 503) } as const;
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { response: jsonError("Sign in to open Awards for this roll.", 401) } as const;
  const { data: roll, error: rollError } = await supabase
    .from("rolls").select("id,status,owner_id").eq("id", id).maybeSingle();
  if (rollError || !roll) return { response: jsonError("That roll isn’t available for Awards.", 404) } as const;
  if (roll.status !== "revealed") return { response: jsonError("Awards are available after the roll is revealed.", 409) } as const;
  return { id, supabase, user, roll } as const;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const access = await getRequestContext(context);
  if ("response" in access) return access.response;

  const [{ data: saved, error: savedError }] = await Promise.all([
    access.supabase.from("roll_awards").select("id,generation_status,awards_json,provider,model,error_code,selected_photo_ids,created_at,updated_at")
      .eq("roll_id", access.id).maybeSingle(),
  ]);
  if (savedError) return jsonError("Saved Awards couldn’t be loaded. Try refreshing the page.", 503);
  const mode = providerMode();
  const staleGeneration = saved?.generation_status === "generating" && Date.now() - Date.parse(saved.updated_at) >= 5 * 60_000;
  const status = staleGeneration ? "failed" : saved?.generation_status ?? "none";
  return NextResponse.json({
    generationStatus: status,
    awards: status === "completed" ? saved?.awards_json : null,
    provider: status === "completed" ? saved?.provider : null,
    model: status === "completed" ? saved?.model : null,
    errorCode: status === "failed" ? staleGeneration ? "generation_timeout" : saved?.error_code : null,
    providerMode: mode,
    maxPhotos: photoLimit(),
    canGenerate: mode !== "unavailable" && (status === "none" || status === "failed"),
    canDelete: access.roll.owner_id === access.user.id && status !== "none",
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const access = await getRequestContext(context);
  if ("response" in access) return access.response;
  if (request.headers.get("content-length") && Number(request.headers.get("content-length")) > 16_384) {
    return jsonError("That Awards request is too large.", 413);
  }

  let body: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return jsonError("Choose photos and confirm before generating Awards.", 400);
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      totalBytes += next.value.byteLength;
      if (totalBytes > 16_384) {
        await reader.cancel();
        return jsonError("That Awards request is too large.", 413);
      }
      chunks.push(next.value);
    }
    body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch { return jsonError("Choose photos and confirm before generating Awards.", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return jsonError("Choose photos and confirm before generating Awards.", 400);
  const payload = body as { photoIds?: unknown; consent?: unknown };
  if (payload.consent !== true) return jsonError("Confirm the photo-processing notice before continuing.", 400, "consent_required");
  const maxPhotos = photoLimit();
  if (!Array.isArray(payload.photoIds) || payload.photoIds.length < 1 || payload.photoIds.some((photoId) => typeof photoId !== "string" || !UUID_PATTERN.test(photoId))) {
    return jsonError("Select at least one available photo.", 400, "invalid_selection");
  }
  const photoIds = payload.photoIds as string[];
  if (new Set(photoIds).size !== photoIds.length) return jsonError("A selected photo appears more than once.", 400, "invalid_selection");
  if (photoIds.length > maxPhotos) return jsonError(`Choose up to ${maxPhotos} photos for one ceremony.`, 400, "too_many_photos");

  const mode = providerMode();
  if (mode === "unavailable") return jsonError("Awards aren’t ready yet. The provider or its privacy and eligibility checks still need configuration.", 503, "provider_unavailable");

  const { data: existing, error: existingError } = await access.supabase.from("roll_awards")
    .select("id,generation_status,awards_json,provider,model,updated_at").eq("roll_id", access.id).maybeSingle();
  if (existingError) return jsonError("Saved Awards couldn’t be checked. Try again.", 503);
  if (existing?.generation_status === "completed") {
    return NextResponse.json({ generationStatus: "completed", awards: existing.awards_json, provider: existing.provider, model: existing.model, cached: true }, { headers: { "Cache-Control": "no-store" } });
  }
  if (existing?.generation_status === "generating" && Date.now() - Date.parse(existing.updated_at) < 5 * 60_000) {
    return jsonError("Awards are already being prepared for this roll.", 409, "generation_in_progress");
  }

  const { data: photoRows, error: photoError } = await access.supabase.from("photos")
    .select("id,object_path").eq("roll_id", access.id).in("id", photoIds);
  if (photoError || !photoRows || photoRows.length !== photoIds.length) {
    return jsonError("One or more selected photos are no longer available in this roll.", 400, "photo_unavailable");
  }

  let preparedPhotos: Array<{ id: string; imageDataUrl?: string }> = photoRows.map((photo) => ({ id: photo.id as string }));
  if (mode === "cloudflare") {
    try {
      const thumbnailPaths = photoRows.map((photo) => (photo.object_path as string).replace(/\.jpg$/i, ".thumb.jpg"));
      const { data: signed, error: signError } = await access.supabase.storage.from("roll-photos").createSignedUrls(thumbnailPaths, 90);
      if (signError || !signed || signed.length !== photoRows.length) throw new Error("thumbnail signing failed");
      const images = await Promise.all(photoRows.map(async (photo, index) => {
        const signedUrl = signed[index]?.signedUrl;
        if (!signedUrl || signed[index]?.error) throw new Error("thumbnail unavailable");
        const response = await fetch(signedUrl, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
        if (!response.ok) throw new Error("thumbnail download failed");
        const mimeType = response.headers.get("content-type")?.split(";")[0]?.toLowerCase();
        if (!mimeType || !/^image\/(?:jpeg|png|webp)$/.test(mimeType)) throw new Error("thumbnail type unsupported");
        const declaredLength = Number(response.headers.get("content-length") ?? 0);
        if (declaredLength > MAX_AWARDS_IMAGE_BYTES) throw new Error("thumbnail too large");
        const bytes = Buffer.from(await response.arrayBuffer());
        if (!bytes.length || bytes.length > MAX_AWARDS_IMAGE_BYTES) throw new Error("thumbnail too large");
        return { id: photo.id as string, imageDataUrl: `data:${mimeType};base64,${bytes.toString("base64")}` };
      }));
      preparedPhotos = images;
    } catch {
      return jsonError(failureMessage("photo_processing"), 422, "photo_processing");
    }
  }

  const { data: claim, error: claimError } = await access.supabase.rpc("claim_roll_awards", {
    target_roll_id: access.id,
    target_photo_ids: photoIds,
  });
  if (claimError) {
    const message = claimError.message;
    if (message.includes("AWARDS_RATE_LIMIT")) return jsonError("You’ve reached today’s Awards limit. Try again tomorrow.", 429, "rate_limited");
    if (message.includes("AWARDS_DAILY_LIMIT")) return jsonError("Today’s Awards generation limit has been reached. Try again tomorrow.", 429, "daily_limit");
    if (message.includes("AWARDS_ROLL_UNAVAILABLE")) return jsonError("That roll isn’t available for Awards.", 404);
    if (message.includes("AWARDS_ROLL_NOT_REVEALED")) return jsonError("Awards are available after the roll is revealed.", 409);
    if (message.includes("AWARDS_TOO_MANY_PHOTOS")) return jsonError(`Choose up to ${maxPhotos} photos for one ceremony.`, 400, "too_many_photos");
    return jsonError("Awards couldn’t be started. Refresh the roll and try again.", 503);
  }
  if (!claim || typeof claim !== "object") return jsonError("Awards couldn’t be started. Try again.", 503);
  const claimResult = claim as { state?: string; id?: string; awards?: unknown; provider?: string; model?: string };
  if (claimResult.state === "completed") return NextResponse.json({ generationStatus: "completed", awards: claimResult.awards, provider: claimResult.provider, model: claimResult.model, cached: true }, { headers: { "Cache-Control": "no-store" } });
  if (claimResult.state === "generating") return jsonError("Awards are already being prepared for this roll.", 409, "generation_in_progress");
  if (claimResult.state !== "claimed" || !claimResult.id) return jsonError("Awards couldn’t be started. Try again.", 503);

  try {
    const provider = mode === "mock" ? new MockAwardsProvider() : new CloudflareAwardsProvider();
    const result = await generateAwards(provider, preparedPhotos);
    const { data: completed, error: completeError } = await access.supabase.rpc("complete_roll_awards", {
      target_generation_id: claimResult.id,
      target_awards_json: result,
      target_provider: provider.name,
      target_model: provider.model,
    });
    if (completeError || completed !== true) {
      console.warn("[awards] saved-result validation failed", {
        stage: "supabase_completion",
        databaseCode: completeError?.code ?? null,
        returnedSuccess: completed === true,
      });
      throw new AwardsProviderError("invalid_response", "Awards could not be saved.");
    }
    return NextResponse.json({ generationStatus: "completed", awards: result, provider: provider.name, model: provider.model, cached: false }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const failureCode = error instanceof AwardsProviderError ? error.code : "internal";
    if (error instanceof AwardsProviderError) {
      console.warn("[awards] generation failed", { code: failureCode, stage: error.stage ?? "provider_or_persistence" });
    } else {
      console.warn("[awards] generation failed", { code: failureCode, stage: "result_assembly_or_validation" });
    }
    try {
      await access.supabase.rpc("fail_roll_awards", {
        target_generation_id: claimResult.id,
        target_error_code: failureCode,
      });
    } catch {
      // A failure to update the status must not leak provider details to the user.
    }
    return jsonError(failureMessage(failureCode), failureCode === "provider_quota" ? 429 : failureCode === "provider_unavailable" ? 503 : 502, failureCode);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const access = await getRequestContext(context);
  if ("response" in access) return access.response;
  if (access.roll.owner_id !== access.user.id) return jsonError("Only the roll owner can clear its Awards.", 403);
  const { error } = await access.supabase.from("roll_awards").delete().eq("roll_id", access.id);
  if (error) return jsonError("Saved Awards couldn’t be deleted. Try again.", 503);
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
