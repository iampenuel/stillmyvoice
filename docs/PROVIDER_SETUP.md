# Cloud provider setup and limits

Current status: isolated boundaries and synthetic tests only. No live provider calls, available-credit verification, premium voice audition, live Gemini execution, or audible cloud playback have occurred. The UI remains on browser speech while post-edit recovery acceptance is pending; the basic physical phrase-to-speech path is owner-confirmed.

Both credentials are present in the private Git-ignored .env file, verified without printing values. They must remain server-side, never in chat or a Vite-prefixed variable. `.env.example` contains names and disabled defaults only. Confirm the actual Gemini project is Free Tier with billing disabled, and confirm ElevenLabs promotional credits and paid overage settings before enabling the corresponding server gate. A flag records that account confirmation; it cannot enforce the provider's billing configuration. Missing keys/confirmation keep cloud calls disabled.

All services remain on loopback. The planned API accepts JSON from the known local UI origins only, rejects foreign Hosts/Origins, bounds request/response size, avoids content logs and returns sanitized errors. These are development controls, not production authentication or permission to expose a public server. The owner-reported registered domain stillmyvoice.club is not used in any API configuration; deployment is unconfirmed.

## ElevenLabs

The isolated implementation checks the accessible account voice list and actual `eleven_flash_v2_5` model capability before accepting speech. Up to six candidates are drawn from real returned voice IDs, targeting three provider-labeled male and three female voices where available. Labels are discovery metadata, not an acoustic judgment. None is marked auditioned; the owner must hear deliberate fixed-sample previews. Shortfall from six remains a visible limitation, not fabricated choices.

Speech sends the immutable exact approved text with normalization disabled, request-only voice settings, no context stitching, no extra prompts and no retries. Rate options are conservatively limited to 0.75, 1.0 and 1.2 for this provider. Audio is fetched through the streaming API but bounded and collected before browser playback in this first implementation; it does not yet claim incremental low-latency playback. Stop aborts fetch, stops audio, revokes its object URL and discards late completion. Failure must require a fresh explicit local-speech approval. Process limits: 10,000 submitted characters and 100 distinct approvals; uncertain failed requests still consume the local counter. These limits do not prove remaining provider credit.

Provider history/retention is **not** claimed disabled: the documented zero-retention option is enterprise-only. Use fictional test phrases until privacy conditions are reviewed.

## Gemini

Only direct `gemini-3.5-flash-lite` is allowlisted, with no paid fallback, tools, grounding, conversation history or automatic retry. The model proposes at most two bounded schema-validated suggestions; it has no references to input, navigation or speech controllers. Every request must be deliberately initiated and marked fictional/synthetic. Process limits are 20 requests, at least three seconds between requests, one in flight, and a ten-second timeout. No private patient/caregiver content is approved for the free-tier demonstration.

A conservative lexical filter rejects changed negations and directional order and withholds ambiguous content. This is not proof of semantic safety. Every suggestion still needs user inspection, explicit selection, complete review and a fresh speech approval. Neutral contextual replies are restricted to Yes, No and a repeat request. Malformed or rejected results leave manual communication available.

The official registry reports `@google/genai` **3.3.0**, Node `>=22.0.0`; the task uses Node 24.22.1. SDK 3.3.0 is now installed only in external node_modules and exercised against an injected synthetic HTTP response. Its request/header/schema and single-attempt behavior passed tests. Recording the dependency in the app manifest/lockfile and wiring the local API into the browser remain pending, to avoid refreshing an active physical test. The server entry point exists but has not been started for live provider use.

## Primary sources checked November 14, 2026

- [ElevenLabs streaming TTS guide](https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/streaming)
- [ElevenLabs speech API](https://elevenlabs.io/docs/api-reference/text-to-speech/stream), [voice discovery](https://elevenlabs.io/docs/api-reference/voices/search), [voice settings](https://elevenlabs.io/docs/api-reference/voices/settings/update)
- [Gemini Developer API pricing](https://aistudio.google.com/docs/pricing#gemini-3.5-flash-lite): standard input/output are listed free on Free Tier; content may be used to improve products. This is not verification of this owner's account tier or quota.
- [Official Google Gen AI SDK](https://googleapis.github.io/js-genai/), [structured output documentation](https://aistudio.google.com/docs/structured-output)

The owner's Sema provider core/fallback/schemas, Alethia server client, and Our Ground provider were read for separation, bounded data, explicit account gates and sanitized-error patterns. No source was copied or repositories merged. Sema's retry/fallback behavior is deliberately not adopted here; the master directive prohibits automatic retries or paid fallback. No medical schemas or agents were imported.
