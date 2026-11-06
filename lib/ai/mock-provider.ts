import { AWARD_CATEGORIES, type AwardCandidate, type AwardsPhotoInput, type AwardsProvider } from "./awards-types";

const sampleExplanations = [
  "Sample roast: who was in charge of the camera here 😭",
  "Sample roast: this is the one you all agreed to post?",
  "Sample roast: the background is doing way too much.",
  "Sample roast: incredible timing. Like, genuinely how did you catch that.",
  "Sample roast: putting this straight in the group chat evidence folder.",
  "Sample roast: nobody thought to take one more photo? just this one?",
  "Sample roast: this angle was a choice and we should talk about it.",
  "Sample roast: okay but why is the background the main character.",
];

export class MockAwardsProvider implements AwardsProvider {
  readonly name = "mock" as const;
  readonly model = "sample-awards-v1";

  async analyzePhoto(photo: AwardsPhotoInput, index: number): Promise<AwardCandidate> {
    const title = AWARD_CATEGORIES[index % (AWARD_CATEGORIES.length - 1)];
    return {
      photoId: photo.id,
      awardTitle: title,
      explanation: sampleExplanations[index % sampleExplanations.length],
      visualNote: "a sample standout moment from this roll",
      score: Math.max(1, 5 - (index % 3)),
    };
  }
}
