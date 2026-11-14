export const ROAST_INTENSITIES = ["mild", "unhinged", "savage"] as const;
export const HUMOR_STYLES = ["brainrot", "dry_sarcasm", "fake_hype", "unfiltered_friend"] as const;

export type RoastIntensity = (typeof ROAST_INTENSITIES)[number];
export type HumorStyle = (typeof HUMOR_STYLES)[number];

export type AwardsSettings = {
  profanity: boolean;
  roastIntensity: RoastIntensity;
  humorStyle: HumorStyle;
};

export const DEFAULT_AWARDS_SETTINGS: AwardsSettings = {
  profanity: true,
  roastIntensity: "unhinged",
  humorStyle: "brainrot",
};

export function parseAwardsSettings(value: unknown): AwardsSettings | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const settings = value as Record<string, unknown>;
  if (typeof settings.profanity !== "boolean"
    || typeof settings.roastIntensity !== "string"
    || !ROAST_INTENSITIES.includes(settings.roastIntensity as RoastIntensity)
    || typeof settings.humorStyle !== "string"
    || !HUMOR_STYLES.includes(settings.humorStyle as HumorStyle)) return null;
  return {
    profanity: settings.profanity,
    roastIntensity: settings.roastIntensity as RoastIntensity,
    humorStyle: settings.humorStyle as HumorStyle,
  };
}

export function awardsSettingsFromRoll(row: Record<string, unknown>): AwardsSettings {
  return parseAwardsSettings({
    profanity: row.awards_profanity,
    roastIntensity: row.awards_roast_intensity,
    humorStyle: row.awards_humor_style,
  }) ?? DEFAULT_AWARDS_SETTINGS;
}
