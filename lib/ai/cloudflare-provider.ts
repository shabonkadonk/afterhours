import { parseAwardCandidate } from "./awards-validation";
import { AwardsProviderError, type AwardCandidate, type AwardsPhotoInput, type AwardsProvider } from "./awards-types";

const DEFAULT_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
const MAX_IMAGE_BYTES = 1_000_000;

function getConfig() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  const model = process.env.CLOUDFLARE_MODEL_ID?.trim() || DEFAULT_MODEL;
  if (!accountId || !token) throw new AwardsProviderError("provider_unavailable", "Awards provider is not configured.");
  if (!/^@cf\/[A-Za-z0-9._/-]+$/.test(model)) throw new AwardsProviderError("provider_model", "Awards model configuration is invalid.");
  return { accountId, token, model };
}

const categories = [
  "Most Main Character Energy", "Funniest Photo", "Most Unhinged Moment", "Best Accidental Photo",
  "Best Photo Aesthetic", "Most Cinematic Moment", "Best Group Photo", "Most Mysterious Photo",
  "Most Likely to Become a Meme", "Best Background Appearance", "Most Unexpected Moment", "Photo of the Night",
];

function promptForPhoto() {
  return [
    "You are a funny friend looking at a photo in the group chat. Keep it casual, blunt, and specific. Analyze only what is visibly established in this one photograph.",
    "Do not name or identify people, infer sensitive traits or relationships, or comment on attractiveness or bodies. Roast the photo, composition, background, camera timing, or harmless visible chaos; never attack a person's identity or worth.",
    "Refer to the frame, visible objects, and visible actions; do not assign personality or personal traits to anyone.",
    "Do not invent events. If there is no clear fit, use null for awardTitle. Write one short, natural-sounding roast about a visible detail. No polished slogans, dramatic comparisons, fake formality, or 'X says Y' constructions. It should sound like something a friend would actually text.",
    `Choose at most one exact awardTitle from this list: ${categories.join(" | ")}.`,
    "Return exactly four labeled lines in plain text, with no markdown or extra commentary:",
    "Award Title: one exact title from the list, or NONE",
    "Visual Note: one short detail visible in the frame",
    "Score: an integer from 1 to 5 for how visually memorable this frame is",
    "Explanation: one casual, funny line grounded in a visible detail; teasing, never cruel",
    "Keep Visual Note under 100 characters and Explanation under 160 characters.",
  ].join(" ");
}

function parsePlainTextCandidate(value: unknown, photoId: string): AwardCandidate | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/```[^\n]*\n?|```/g, "").trim();
  if (text.length < 12 || text.length > 2_000 || /[{}\[\]]/.test(text)
    || /\b(?:cannot|can't|unable to|could not|couldn't|no image provided)\b/i.test(text)) return null;

  const field = (label: string) => text.match(new RegExp(`(?:^|\\n)\\s*(?:${label})\\s*:\\s*(.+)`, "im"))?.[1]?.trim();
  const rawTitle = field("Award\\s+Title|Category");
  const titleText = rawTitle?.replace(/[.。]$/, "").trim();
  const awardTitle = !titleText || /^none$/i.test(titleText)
    ? null
    : categories.find((category) => category.toLowerCase() === titleText.toLowerCase()) ?? null;
  const visualNote = field("Visual\\s+Note|Note") ?? text;
  const explanation = field("Explanation|Citation") ?? (awardTitle ? visualNote : null);
  const scoreValue = Number.parseInt(field("Score") ?? "3", 10);

  return parseAwardCandidate({
    visualNote,
    score: Number.isFinite(scoreValue) ? scoreValue : 3,
    awardTitle,
    explanation,
  }, photoId);
}

function parseGeneratedOutput(value: unknown, depth = 0): unknown {
  if (depth > 3) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = parseGeneratedOutput(item, depth + 1);
      if (candidate) return candidate;
    }
    return null;
  }
  if (typeof value === "string") {
    const text = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      // Some model responses wrap a valid JSON object in a short preamble.
      let start = -1;
      let braceDepth = 0;
      let inString = false;
      let escaped = false;
      for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        if (start < 0) {
          if (character === "{") {
            start = index;
            braceDepth = 1;
          }
          continue;
        }
        if (inString) {
          if (escaped) escaped = false;
          else if (character === "\\") escaped = true;
          else if (character === '"') inString = false;
          continue;
        }
        if (character === '"') inString = true;
        else if (character === "{") braceDepth += 1;
        else if (character === "}") {
          braceDepth -= 1;
          if (braceDepth === 0) {
            try {
              parsed = JSON.parse(text.slice(start, index + 1)) as unknown;
              break;
            } catch {
              start = -1;
            }
          }
        }
      }
    }
    return parsed === undefined ? null : parseGeneratedOutput(parsed, depth + 1);
  }
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};
  const fieldNames: Record<string, string> = {
    visualnote: "visualNote",
    note: "visualNote",
    awardtitle: "awardTitle",
    award: "awardTitle",
    category: "awardTitle",
    score: "score",
    rating: "score",
    explanation: "explanation",
    citation: "explanation",
    reason: "explanation",
  };
  for (const [key, field] of Object.entries(record)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    const target = fieldNames[normalizedKey];
    if (target && !(target in normalized)) normalized[target] = field;
  }
  if ("visualNote" in normalized || "awardTitle" in normalized || "explanation" in normalized) return normalized;

  const keys = Object.keys(record);
  const wrapperKeys = ["response", "result", "output", "data", "content", "json"];
  const orderedKeys = [...wrapperKeys.filter((key) => keys.includes(key)), ...keys.filter((key) => !wrapperKeys.includes(key))];
  for (const key of orderedKeys) {
    const unwrapped = parseGeneratedOutput(record[key], depth + 1);
    if (unwrapped) return unwrapped;
  }
  return null;
}

export class CloudflareAwardsProvider implements AwardsProvider {
  readonly name = "cloudflare" as const;
  readonly model: string;
  private readonly accountId: string;
  private readonly token: string;

  constructor() {
    const config = getConfig();
    this.model = config.model;
    this.accountId = config.accountId;
    this.token = config.token;
  }

  async analyzePhoto(photo: AwardsPhotoInput): Promise<AwardCandidate> {
    if (!photo.imageDataUrl) throw new AwardsProviderError("photo_processing", "A prepared photo is missing.");
    const match = photo.imageDataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) throw new AwardsProviderError("photo_processing", "The selected photo format is not supported.");
    const bytes = Buffer.from(match[2], "base64");
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new AwardsProviderError("photo_processing", "The selected photo could not be prepared.");

    let response: Response;
    try {
      response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(this.accountId)}/ai/run/${this.model}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: promptForPhoto(),
          image: photo.imageDataUrl,
          max_tokens: 220,
          temperature: 0.25,
        }),
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new AwardsProviderError("provider_unavailable", "The awards provider could not be reached.");
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new AwardsProviderError("provider_auth", "The awards provider rejected its credentials or model terms.");
      if (response.status === 404) throw new AwardsProviderError("provider_model", "The configured awards model is unavailable.");
      if (response.status === 402 || response.status === 429) throw new AwardsProviderError("provider_quota", "The awards provider quota is unavailable.");
      if (response.status === 400) {
        const providerError = await response.text().catch(() => "");
        if (/license|acceptable use|terms|agree/i.test(providerError)) {
          throw new AwardsProviderError("provider_auth", "The model license and acceptable-use terms have not been accepted.");
        }
        throw new AwardsProviderError("provider_model", "The configured model rejected the documented image request.");
      }
      throw new AwardsProviderError("provider_unavailable", "The awards provider could not complete the request.");
    }

    let payload: unknown;
    try { payload = await response.json(); }
    catch { throw new AwardsProviderError("invalid_response", "The awards provider returned an invalid response.", "provider_envelope"); }
    if (!payload || typeof payload !== "object") throw new AwardsProviderError("invalid_response", "The awards provider returned an invalid response.", "provider_envelope");
    const envelope = payload as { success?: unknown; result?: unknown };
    if (envelope.success === false || !envelope.result || typeof envelope.result !== "object") {
      throw new AwardsProviderError("invalid_response", "The awards provider returned an invalid response.", "provider_envelope");
    }
    const result = envelope.result as { response?: unknown; result?: unknown };
    const generated = result.response ?? result.result;
    if (!generated) throw new AwardsProviderError("invalid_response", "The awards provider returned an invalid response.", "provider_output");

    const parsed = parseGeneratedOutput(generated);
    const candidate = parsed
      ? parseAwardCandidate(parsed, photo.id)
      : parsePlainTextCandidate(generated, photo.id);
    if (!candidate) {
      throw new AwardsProviderError("invalid_response", "The awards provider returned an invalid response.", parsed ? "candidate_validation" : "provider_output");
    }
    if (!candidate || !candidate.visualNote) {
      throw new AwardsProviderError("invalid_response", "The awards provider returned an invalid response.", "candidate_validation");
    }
    return candidate;
  }
}

export { DEFAULT_MODEL as DEFAULT_CLOUDFLARE_AWARDS_MODEL, MAX_IMAGE_BYTES as MAX_AWARDS_IMAGE_BYTES };
