import { buildAwardsResult } from "./awards-validation";
import type { AwardCandidate, AwardsPhotoInput, AwardsProvider, AwardsResult } from "./awards-types";

export async function generateAwards(provider: AwardsProvider, photos: AwardsPhotoInput[]): Promise<AwardsResult> {
  if (!photos.length || photos.length > 10) throw new Error("Invalid number of selected photos.");
  const candidates: AwardCandidate[] = await Promise.all(photos.map((photo, index) => provider.analyzePhoto(photo, index)));
  return buildAwardsResult(candidates, photos.map((photo) => photo.id));
}

export { validateAwardsResult } from "./awards-validation";
