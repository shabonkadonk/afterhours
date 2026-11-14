# Awards Caption Settings Update

This update simplifies the Awards caption controls to one per-roll switch.

## What changed

- The settings panel now shows an **18+** switch instead of profanity, roast intensity, and humor style controls.
- With 18+ on, the prompt aims for blunt, uncensored party group-chat reactions, including natural swearing in most captions.
- With 18+ off, the same savage, unfiltered voice stays in place, but captions must contain no profanity.
- Prompt guidance now draws on visible details from parties and nights out, such as flash photos, dancing, drinks, and bar or bathroom chaos. It should not assume every image was taken at a party.

## Data and deployment

The switch reads and writes the existing `awards_profanity` roll column. The older roast intensity and humor style columns remain in the database for compatibility, but the Awards API and prompt no longer use them. No additional database migration is needed if the existing Awards customization migration has already been applied. Deploy the app code to make the simplified control available.

The current default is 18+ on, matching the existing `awards_profanity` default. The roll owner can turn it off for clean captions before generating the ceremony.

## Files involved

- `components/awards/awards-section.tsx` — the 18+ switch and its clean/on descriptions.
- `lib/ai/awards-settings.ts` — the single profanity setting.
- `lib/ai/cloudflare-provider.ts` — fixed savage, unfiltered-friend prompt with clean and 18+ variants.
- `app/api/rolls/[id]/awards/route.ts` — reads and updates only the profanity setting.
- `tests/awards.test.cjs` — prompt expectations updated for the two modes.

