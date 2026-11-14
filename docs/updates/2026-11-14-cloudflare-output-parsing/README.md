# Cloudflare Awards Output Parsing Update

The Vercel log showed `invalid_response` at `provider_output`: Cloudflare returned output that the Awards adapter could not parse into a candidate.

## What changed

- The output prompt now explicitly asks for four plain-text labeled lines, without bullets, JSON, quotes, or an introduction.
- The parser accepts common label variations, markdown bullets, quoted JSON-like fields, nested text responses, and a short caption-only fallback.
- The existing safety validation still runs on the parsed caption and visual note.
- The prompt explicitly avoids guessing intoxication, relationships, or other personal details that the safety checks reject.

## Deployment and limits

No database migration is needed. Deploy the app update to use the more tolerant parser. A failed generation has already counted against the daily Awards counters, so avoid repeated attempts until this update is deployed.

## Files involved

- `lib/ai/cloudflare-provider.ts` — output-format guidance and tolerant response parsing.

