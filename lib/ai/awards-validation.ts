import { randomUUID } from "node:crypto";
import { AWARD_CATEGORIES, type Award, type AwardCandidate, type AwardCategory, type AwardsResult } from "./awards-types";

const allowedCategories = new Set<string>(AWARD_CATEGORIES);
const unsafePersonalClaims = /\b(?:attractive|beauty|sexy|ugly|fat|skinny|dating|boyfriend|girlfriend|husband|wife|pregnant|race|ethnicity|religion|disabled|disability|gay|lesbian|transgender|drunk|intoxicated|high)\b/i;

function cleanText(value: string, maxLength: number) {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function parseAwardCandidate(value: unknown, photoId: string): AwardCandidate | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const title = typeof candidate.awardTitle === "string" && allowedCategories.has(candidate.awardTitle)
    ? candidate.awardTitle as AwardCategory
    : null;
  const explanation = typeof candidate.explanation === "string" ? cleanText(candidate.explanation, 180) : null;
  const visualNote = typeof candidate.visualNote === "string" ? cleanText(candidate.visualNote, 140) : "";
  if (unsafePersonalClaims.test(`${explanation ?? ""} ${visualNote}`)) return null;
  const score = typeof candidate.score === "number" && Number.isFinite(candidate.score)
    ? Math.max(1, Math.min(5, Math.round(candidate.score)))
    : 1;
  return {
    photoId,
    awardTitle: title,
    explanation: explanation || null,
    visualNote,
    score,
  };
}

export function validateAwardsResult(value: unknown, allowedPhotoIds: string[]): AwardsResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid awards response.");
  const result = value as Record<string, unknown>;
  if (!Array.isArray(result.awards) || result.awards.length < 1 || result.awards.length > 8) {
    throw new Error("Invalid awards response.");
  }
  const photos = new Set(allowedPhotoIds);
  const categoryTitles = new Set<string>();
  const mainPhotoCounts = new Map<string, number>();
  const awards: Award[] = [];

  for (const item of result.awards) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Invalid awards response.");
    const row = item as Record<string, unknown>;
    if (typeof row.title !== "string" || !allowedCategories.has(row.title)) throw new Error("Invalid awards response.");
    const title = row.title as AwardCategory;
    const normalizedTitle = title.toLocaleLowerCase("en-US");
    if (categoryTitles.has(normalizedTitle)) throw new Error("Invalid awards response.");
    categoryTitles.add(normalizedTitle);
    if (typeof row.photoId !== "string" || !photos.has(row.photoId)) throw new Error("Invalid awards response.");
    const photoId = row.photoId;
    const nextCount = (mainPhotoCounts.get(photoId) ?? 0) + 1;
    if (nextCount > 2) throw new Error("Invalid awards response.");
    mainPhotoCounts.set(photoId, nextCount);
    if (typeof row.explanation !== "string") throw new Error("Invalid awards response.");
    const explanation = cleanText(row.explanation, 220);
    if (!explanation) throw new Error("Invalid awards response.");
    let runnerUpPhotoId: string | null = null;
    if (row.runnerUpPhotoId !== null && row.runnerUpPhotoId !== undefined) {
      if (typeof row.runnerUpPhotoId !== "string" || !photos.has(row.runnerUpPhotoId) || row.runnerUpPhotoId === photoId) {
        throw new Error("Invalid awards response.");
      }
      runnerUpPhotoId = row.runnerUpPhotoId;
    }
    awards.push({ id: `award_${randomUUID()}`, title, photoId, explanation, runnerUpPhotoId });
  }

  const finale = awards.find((award) => award.title === "Photo of the Night");
  if (!finale || awards[awards.length - 1] !== finale) throw new Error("Invalid awards response.");
  const summary = typeof result.summary === "string" ? cleanText(result.summary, 180) : "The night, framed by your crew.";
  return { awards, summary: summary || "The night, framed by your crew." };
}

export function buildAwardsResult(candidates: AwardCandidate[], selectedPhotoIds: string[]): AwardsResult {
  if (!candidates.length || !selectedPhotoIds.length) throw new Error("No photo analysis was available.");
  const byCategory = new Map<AwardCategory, AwardCandidate[]>();
  for (const candidate of candidates) {
    if (!candidate.awardTitle || !candidate.explanation) continue;
    const group = byCategory.get(candidate.awardTitle) ?? [];
    group.push(candidate);
    byCategory.set(candidate.awardTitle, group);
  }

  const orderedGroups = [...byCategory.entries()].sort((a, b) => {
    if (a[0] === "Photo of the Night") return 1;
    if (b[0] === "Photo of the Night") return -1;
    return Math.max(...b[1].map((item) => item.score)) - Math.max(...a[1].map((item) => item.score));
  });
  const selected: Array<{ title: AwardCategory; winner: AwardCandidate; runnerUpPhotoId: string | null }> = [];
  const photoUse = new Map<string, number>();

  for (const [title, group] of orderedGroups) {
    const ranked = [...group].sort((a, b) => b.score - a.score);
    const winner = ranked.find((candidate) => (photoUse.get(candidate.photoId) ?? 0) < 1);
    if (!winner) continue;
    photoUse.set(winner.photoId, (photoUse.get(winner.photoId) ?? 0) + 1);
    const runnerUp = ranked.find((candidate) => candidate.photoId !== winner.photoId);
    selected.push({ title, winner, runnerUpPhotoId: runnerUp?.photoId ?? null });
  }

  let finale = selected.find((item) => item.title === "Photo of the Night");
  if (!finale) {
    const standout = [...candidates].sort((a, b) => b.score - a.score)[0];
    const description = standout.visualNote || "The frame that holds the clearest visual moment.";
    finale = {
      title: "Photo of the Night",
      winner: {
        ...standout,
        awardTitle: "Photo of the Night",
        explanation: `The clearest standout of the night: ${description}`.slice(0, 180),
      },
      runnerUpPhotoId: candidates.find((candidate) => candidate.photoId !== standout.photoId)?.photoId ?? null,
    };
  }

  const regularAwards = selected.filter((item) => item.title !== "Photo of the Night").slice(0, 7);
  const finaleIndex = selected.findIndex((item) => item.title === "Photo of the Night");
  if (finaleIndex >= 0) finale = selected[finaleIndex];
  const compactFinale = finale.runnerUpPhotoId === finale.winner.photoId ? null : finale.runnerUpPhotoId;
  const raw = {
    awards: [
      ...regularAwards.map((item) => ({
        title: item.title,
        photoId: item.winner.photoId,
        explanation: item.winner.explanation,
        runnerUpPhotoId: item.runnerUpPhotoId,
      })),
      {
        title: "Photo of the Night",
        photoId: finale.winner.photoId,
        explanation: finale.winner.explanation || "The frame that best holds the feeling of the night.",
        runnerUpPhotoId: compactFinale,
      },
    ],
    summary: `A night told in ${selectedPhotoIds.length} frames, with one clear standout.`,
  };
  return validateAwardsResult(raw, selectedPhotoIds);
}
