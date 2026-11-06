export const AWARD_CATEGORIES = [
  "Most Main Character Energy",
  "Funniest Photo",
  "Most Unhinged Moment",
  "Best Accidental Photo",
  "Best Photo Aesthetic",
  "Most Cinematic Moment",
  "Best Group Photo",
  "Most Mysterious Photo",
  "Photo of the Night",
  "Most Likely to Become a Meme",
  "Best Background Appearance",
  "Most Unexpected Moment",
] as const;

export type AwardCategory = (typeof AWARD_CATEGORIES)[number];

export type Award = {
  id: string;
  title: AwardCategory;
  photoId: string;
  explanation: string;
  runnerUpPhotoId: string | null;
};

export type AwardsResult = {
  awards: Award[];
  summary: string;
};

export type AwardsPhotoInput = {
  id: string;
  imageDataUrl?: string;
};

export type AwardCandidate = {
  photoId: string;
  awardTitle: AwardCategory | null;
  explanation: string | null;
  visualNote: string;
  score: number;
};

export interface AwardsProvider {
  readonly name: "mock" | "cloudflare";
  readonly model: string;
  analyzePhoto(photo: AwardsPhotoInput, index: number): Promise<AwardCandidate>;
}

export class AwardsProviderError extends Error {
  constructor(
    readonly code: "provider_unavailable" | "provider_auth" | "provider_model" | "provider_quota" | "invalid_response" | "photo_processing",
    message: string,
    readonly stage?: "provider_envelope" | "provider_output" | "candidate_validation",
  ) {
    super(message);
    this.name = "AwardsProviderError";
  }
}
