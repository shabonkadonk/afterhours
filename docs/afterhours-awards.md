# Afterhours Awards

Awards appears in the revealed-roll gallery. It lets a roll member choose photos, confirm the processing notice, and replay a saved ceremony. The standalone demo preview stays in that browser; it does not upload, analyze, or save demo photos.

## Current provider state

Cloudflare currently lists [`@cf/meta/llama-3.2-11b-vision-instruct`](https://developers.cloudflare.com/ai/models/%40cf/meta/llama-3.2-11b-vision-instruct/) as a vision model and documents the `prompt` plus single `image` input. The provider sends one reduced-size image per inference request, so a ceremony with ten selected photos makes up to ten requests. It does not swap to a text-only model.

The model page says its first use requires agreement to Meta's Llama license and Acceptable Use Policy. The application will not send the agreement request automatically. Account-specific model availability has not been verified because this repository environment has no `CLOUDFLARE_ACCOUNT_ID` or `CLOUDFLARE_API_TOKEN`. There is no subscription requirement for Awards. The app has no age-verification flow, so real photo processing is disabled by default until applicable requirements are reviewed.

Cloudflare describes standard Workers AI inference as zero data retention after processing and says it does not use customer content to train models; operational metadata can still be retained, and model-provider terms also apply. Review [Workers AI data usage](https://developers.cloudflare.com/workers-ai/platform/data-usage/) and Meta's applicable [Llama 3.2 license](https://dev.meta.ai/llama/llama3_2/license) and [Acceptable Use Policy](https://dev.meta.ai/llama/llama3_2/use-policy) before enabling real processing.

## Supabase migration

Apply `supabase/migrations/20261105000000_afterhours_awards.sql` after the existing migrations. It creates the roll-scoped award record, row-level access policies, atomic generation claim/completion functions, and usage counters. Roll members can read saved awards; only the roll owner can delete them. Deleting a selected photo clears its ceremony so results cannot retain stale photo references.

The database claim checks revealed status, roll membership, selected photo IDs, and a three-generation daily user limit. Any authenticated roll member with access to a revealed roll can generate Awards; no subscription or billing integration is needed. It also applies a five-generation global daily cap. Successful results are cached one per roll; failed attempts can be retried. A generation stuck in `generating` for over five minutes can be reclaimed.

## Environment variables

These values belong in `.env.local` for development and in Vercel **Settings → Environment Variables** for each relevant deployment environment. Cloudflare credentials are server-only: do not add a `NEXT_PUBLIC_` prefix.

| Variable | Default | Purpose |
| --- | --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | empty | Cloudflare account for Workers AI REST API |
| `CLOUDFLARE_API_TOKEN` | empty | Secret bearer token for Workers AI |
| `CLOUDFLARE_MODEL_ID` | `@cf/meta/llama-3.2-11b-vision-instruct` | Documented vision model ID |
| `AWARDS_MAX_PHOTOS` | `10` | Maximum selected photos; server clamps this to 1–10 |
| `AWARDS_MOCK_MODE` | `true` | Use sample output without sending photos to Cloudflare |
| `AWARDS_LIVE_PROCESSING_ENABLED` | `false` | Explicit live-inference switch |
| `AWARDS_PROVIDER_REQUIREMENTS_CONFIRMED` | `false` | Operator confirmation of account, model, license, privacy, and age checks |

Keep mock mode on and both live flags false while configuring Cloudflare. To prepare the account, confirm that this exact model is available in the account and accept Meta's model terms through Cloudflare's documented process. Then assess the privacy disclosure and applicable age requirements for the people whose photos could be submitted. Only after those checks should an operator set the two live flags to `true`, set `AWARDS_MOCK_MODE=false`, and add the account ID, token, and model ID in Vercel. Redeploy after changing environment variables. Do not send real photos as part of an automated test.

## Cost, limits, and image handling

Each generation is limited to ten selected photos by default, three attempts per user per day, and five attempts globally per day. The database enforces both rate limits; cached results do not consume another attempt. Failed attempts count against the limits. Cloudflare can still enforce its own model/account allocation and rate limits; the app returns a retryable message for quota errors. Check Cloudflare's current [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) and [limits](https://developers.cloudflare.com/workers-ai/platform/limits/) before enabling the feature.

Uploads already create a 560-pixel JPEG thumbnail. The server signs only those private thumbnails for a short time, checks MIME type and a 1 MB size ceiling, and sends only the chosen previews. It does not log image data, persist a second copy, or expose signed URLs to Cloudflare as public URLs. The result stores award text and photo IDs, not images.

## Error and recovery behavior

The API rechecks authentication, roll membership, revealed status, and photo membership for every request. A unique roll record and an atomic database claim prevent two inference requests from racing for the same roll. Failed generations save a safe error code, not provider response bodies or credentials; the user can retry within the daily limits. Existing site routes remain usable if Awards or Cloudflare is unavailable.

## Local preview and verification

Without Supabase, the revealed-roll page has a non-persistent ceremony preview with clearly marked sample awards. With Supabase and mock mode, any revealed-roll member can generate and save sample results; no selected image is sent to an AI service. The Cloudflare adapter is server-only and makes no request unless the explicit live gates are enabled.

Run `npm run test:awards`, `npm run typecheck`, and `npm run build` to check the app. The Awards tests use mock image responses and do not make real provider requests. Do not use real provider credentials in automated tests.
