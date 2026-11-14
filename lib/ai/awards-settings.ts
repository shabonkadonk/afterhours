export type AwardsSettings = {
  profanity: boolean;
};

export const DEFAULT_AWARDS_SETTINGS: AwardsSettings = {
  profanity: true,
};

export function parseAwardsSettings(value: unknown): AwardsSettings | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const settings = value as Record<string, unknown>;
  if (typeof settings.profanity !== "boolean") return null;
  return { profanity: settings.profanity };
}

export function awardsSettingsFromRoll(row: Record<string, unknown>): AwardsSettings {
  return parseAwardsSettings({
    profanity: row.awards_profanity,
  }) ?? DEFAULT_AWARDS_SETTINGS;
}
