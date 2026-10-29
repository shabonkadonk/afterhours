import { fal } from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "fal-ai/flux-2/flash/edit";
const MAX_INPUT_BYTES = 4 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const Y2K_PROMPT = "Restyle this exact photo as a candid snapshot taken with an early-2000s compact CCD digital camera and a small built-in straight-on flash. Preserve the same people and identities, facial features, exact pose, clothing, objects, room, background, and full framing. Keep the entire rectangular scene and original aspect ratio. Use harsh direct flash on the foreground, natural warm skin, slightly cool ambient shadows, moderate contrast, imperfect consumer-camera color, subtle CCD noise, and authentic dated point-and-shoot character. Keep whites detailed and exposure balanced. Do not crop, replace the background, add text or a date stamp, blur, or create an oval spotlight, vignette, radial gradient, cutout, halo, artificial studio lighting, or blown highlights.";

function hasSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === request.headers.get("host"); }
  catch { return false; }
}

export async function GET() {
  return NextResponse.json({ configured: Boolean(process.env.FAL_KEY?.trim()) }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "Request origin was not allowed." }, { status: 403 });
  }

  const apiKey = process.env.FAL_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "fal.ai is not configured. Add FAL_KEY to .env.local and restart the app." }, { status: 503 });
  }

  let body: { image?: unknown; width?: unknown; height?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: "The image request was not valid JSON." }, { status: 400 }); }

  if (typeof body.image !== "string") {
    return NextResponse.json({ error: "Choose an image to edit." }, { status: 400 });
  }
  const match = body.image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return NextResponse.json({ error: "Use a JPEG, PNG, or WebP image." }, { status: 400 });
  const inputBytes = Buffer.from(match[2], "base64");
  if (inputBytes.byteLength > MAX_INPUT_BYTES) {
    return NextResponse.json({ error: "This photo is too large to edit. Choose a smaller image." }, { status: 413 });
  }

  const width = Number(body.width);
  const height = Number(body.height);
  const aspectRatio = width / height;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 1600 || height > 1600 || aspectRatio < 0.25 || aspectRatio > 4) {
    return NextResponse.json({ error: "The photo dimensions are not supported." }, { status: 400 });
  }
  const scaleToOneMegapixel = Math.min(1, Math.sqrt(1_000_000 / (width * height)));
  const scaleToMinimumSide = 512 / Math.min(width, height);
  const outputScale = Math.min(2048 / Math.max(width, height), Math.max(scaleToOneMegapixel, scaleToMinimumSide));
  const outputWidth = Math.max(512, Math.round(width * outputScale));
  const outputHeight = Math.max(512, Math.round(height * outputScale));
  let imageUrlText: string;
  try {
    fal.config({ credentials: apiKey });
    const result = await fal.subscribe(MODEL, {
      input: {
        prompt: Y2K_PROMPT,
        image_urls: [body.image],
        image_size: { width: outputWidth, height: outputHeight },
        num_images: 1,
        output_format: "jpeg",
        sync_mode: true,
        enable_safety_checker: true,
      },
    });
    imageUrlText = result.data.images?.[0]?.url ?? "";
  } catch (error) {
    const message = error instanceof Error ? error.message : "fal.ai could not edit this photo.";
    const status = typeof error === "object" && error !== null && "status" in error
      ? Number(error.status)
      : undefined;
    const authFailure = status === 401 || status === 403 || /auth|unauthorized|credential|api.?key/i.test(message);
    return NextResponse.json({
      error: authFailure
        ? "fal.ai rejected FAL_KEY. Check the key in your fal.ai dashboard, update .env.local, then restart the app."
        : message || "fal.ai could not edit this photo.",
    }, { status: authFailure ? status === 401 ? 401 : 403 : 502 });
  }

  if (!imageUrlText) {
    return NextResponse.json({ error: "FLUX.2 Flash finished without returning an image." }, { status: 502 });
  }

  if (imageUrlText.startsWith("data:")) {
    const outputMatch = imageUrlText.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!outputMatch) return NextResponse.json({ error: "fal.ai returned an invalid image." }, { status: 502 });
    const outputBytes = Buffer.from(outputMatch[2], "base64");
    if (outputBytes.length > MAX_OUTPUT_BYTES) return NextResponse.json({ error: "The edited image is too large." }, { status: 502 });
    return NextResponse.json({ image: imageUrlText }, { headers: { "Cache-Control": "no-store" } });
  }

  let imageUrl: URL;
  try { imageUrl = new URL(imageUrlText); }
  catch { return NextResponse.json({ error: "fal.ai returned an invalid image URL." }, { status: 502 }); }
  const falHosts = ["fal.media", "fal.ai", "storage.googleapis.com"];
  if (imageUrl.protocol !== "https:" || !falHosts.some((host) => imageUrl.hostname === host || imageUrl.hostname.endsWith(`.${host}`))) {
    return NextResponse.json({ error: "fal.ai returned an unexpected image host." }, { status: 502 });
  }

  try {
    const imageResponse = await fetch(imageUrl, { signal: AbortSignal.timeout(15_000) });
    if (!imageResponse.ok) throw new Error("Image download failed");
    const outputType = imageResponse.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    if (!/^image\/(?:jpeg|png|webp)$/.test(outputType)) throw new Error("fal.ai returned a non-image result");
    const bytes = Buffer.from(await imageResponse.arrayBuffer());
    if (bytes.length > MAX_OUTPUT_BYTES) throw new Error("The edited image is too large");
    return NextResponse.json({ image: `data:${outputType};base64,${bytes.toString("base64")}` }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Could not download fal.ai’s edited photo." }, { status: 502 });
  }
}
