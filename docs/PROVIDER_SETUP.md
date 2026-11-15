# Cloud providers — local fictional demonstration

Updated November 14, 2026. INTENT-01 supersedes the earlier preferred-model limitation and pending Cecily acceptance below: LaSean now uses a verified server-side Flash v2 exception; the other five retain Flash v2.5. The owner reports exact Cecily phrase playback once. Optional context and deliberate keyword expansion use the existing gated Gemini boundary. [Current evidence](HP26_INTENT_01.md). ElevenLabs and direct Gemini are wired into the existing communication controller. The deterministic phrase, spelling, correction and system-speech pathways remain available. No firmware or physical-input reducer changes were made.

## Final demonstration evidence

The existing gated Gemini API produced an actual browser Healthcare candidate with one upstream call and schema validation; content-free `/api/status` diagnostics now report route, model, call count, provider/total latency, outcome and schema-validation status. Audited local clarification reports `upstreamCalls: 0`, `providerOutcome: not_called`, and null provider latency/schema status. These counters retain no prompts, drafts, transcripts or request IDs. [Exact bounded fictional results](HP26_FINAL_DEMO.md). Actual Scribe microphone capture and the complete final physical workflow remain awaiting owner acceptance. The listening service, six voice IDs/models and speech authority are preserved.

## Account gates and privacy

Owner correction: the consumer promotion is **Google AI Plus**, not Google AI Pro. It is not evidence of API credits, paid API eligibility or higher Gemini limits. The existing key, separately verified free-tier API project and no-billing restriction remain the basis for the demo. No new key, billing activation, credit purchase or allowance increase was performed.

The quota follow-up separates application limits from provider errors and adds content-free counters; [precise diagnostic evidence](QUOTA_DIAGNOSTICS.md) includes the historical uncertainty. For a controlled API restart, inspect `/api/status` and carry the then-current `gemini.requests` through operator-only `SMV_GEMINI_START_REQUESTS` (integer 0–20); an invalid value disables Gemini. The private key file cannot set this operator flag. This preserves the consumed process budget, not the old request-ID set or cooldown; it is not a quota-reset mechanism or durable production accounting. The observed diagnostic restart carried 3, and one later browser request made the total 4/20.

Both keys remain in the ignored `.env`, server-side only. `.env` flags cannot enable live calls. The separate ignored `.local-cache/provider-gates.json` records verified account conditions. Missing/invalid verification disables synthesis and reasoning. Never commit that record, account details, credentials, private recordings or drafts. A companion must separately consent to fictional cloud-demo content in the UI. Provider status can be refreshed without reloading the draft.

Observed in the signed-in dashboards: ElevenLabs Creator, 131,000 remaining credits, 0 used, workspace credit ceiling 131,000, next payment $0 and automatic top-up Off. The owner confirmed the signed-in account and reported a 20,000-credit restricted-key limit with TTS/STT access and Voices read. The key refresh period was not independently established; no separate postpaid toggle was shown. The bounded demo budget is below the observed prepaid balance; do not infer unrestricted billing safety or enable purchases/top-up. Restricted subscription/model endpoint 401 responses did not prevent successful TTS.

The saved Gemini key matched the StillMyVoice project shown as Free tier / Set up billing. The project's displayed Gemini 3.5 Flash Lite quotas were 15 RPM, 250,000 TPM and 500 RPD. No paid project attachment was observed and none was enabled. Private evidence is outside tracked files. Recheck account conditions before future demonstrations; a local gate is not a provider-side spending control.

Use fictional examples only. Free-tier Gemini content may be used to improve products. ElevenLabs history/retention is not claimed disabled. No real private communication is approved for this demonstration.

## Run and boundaries

With the existing Node 24.22.1 runtime, run `npm run api` and `npm run dev` in separate terminals. The API binds only to `127.0.0.1:5174`; Vite on 5173 proxies `/api`. No public domain is configured. Static build success does not establish production API routing or deployment readiness.

The API enforces local Host/Origin checks, JSON and body limits, bounded timeouts, no content logging, sanitized errors, and cancellation. These are localhost development controls, not production authentication. Cloud mode is disabled for `NODE_ENV=production`; do not expose this server publicly.

## Verified voice collection

Exact IDs and names are maintained in `src/communication/cloud-contract.mts`. Discovery paginates the account voice API and rejects identity ambiguity, unsupported model tuning, withdrawal and custom usage rates. No library entries or key permissions were changed.

| Owner voice | Verified voice ID | Assigned-model evidence |
|---|---|---|
| Cecily — Clear and Warm | `Uc7anshoV8mdBhDnEZEX` | Metadata verified; live browser preview and phrase playback completed |
| Zoë — Casual millennial woman | `m1Edok6RLyT2Hz3OljNi` | Metadata verified; audition pending |
| Gramma Sherry — Narration | `mdpRX5ndZ28fmYwb5P0J` | Metadata verified; audition pending |
| James — Gen Z Comforting Southern Man | `mhJNZGgdePh7HbwWYwN2` | Metadata verified; audition pending |
| LaSean Pickens | `bQxW1c7YCr6VQgQhw8KX` | Flash v2.5 tuning failed; assigned Flash v2 verified by metadata, live synthesis and browser preview |
| Eric — Smooth, Trustworthy | `cjVigY5qzO86Huf0OWal` | Metadata verified; audition pending |

No voice substitution occurred. LaSean alone uses the authorized Flash v2 model exception; all other voices retain Flash v2.5. Metadata and playback events do not establish audible pronunciation. Preview and Use become available only after fresh metadata verification.

Opening voice details is silent and does not change the saved voice. Preview is the first scanned action; Use this voice separately confirms the choice. Preview deliberately authorizes only “This is the selected voice.” Message speech captures the exact reviewed text, revision, voice, rate and unique one-use authorization. The provider receives the exact text with normalization off. Audio is bounded and collected before playback. Stop/focus loss/edit/cancellation invalidates the authorization, aborts work and releases playback resources; late audio cannot start. Failed premium speech offers system voice, returns to silent review and requires another approval. No automatic retry, queue or fallback.

Limits per API process: 10,000 submitted characters, 100 distinct speech approvals, one synthesis in flight, 12-second provider timeout, 8 MiB audio. Failed/uncertain submissions still consume the local budget. Restart resets these counters; it is not permission to consume repeated budgets.

## Gemini

Direct `gemini-3.5-flash-lite`, official `@google/genai` 3.3.0; no Vertex, tools, paid fallback or automatic retry. Maximum three short suggestions, strict schema and independent validation, 600 output tokens, ten-second timeout, one request in flight, at least five seconds between requests and 20 requests per process. Fixed fictional context choices are offered through the same switch-scanned panel.

Suggestions never insert automatically, select controls or authorize speech. A deliberate choice creates an editable draft with Undo; complete review and new approval remain required. Request identity, exact source text and draft revision reject obsolete results. Focus/navigation/cancellation retires requests. Arrivals are deferred while a physical target is held or transport is synchronizing.

The conservative lexical validator rejects altered negations, directions, order and uncertain word substitutions. Spelling supports a small reviewed typo set. General wording suggestions are intentionally limited and may be withheld or unchanged; this is not proof of semantic safety or broad rewriting ability. Manual spelling and phrases remain available on empty/error results.

## Executed evidence

- 93 Node tests passed, including accepted transport/input/lifecycle regressions, five exact TTS phrase fixtures, eight consequential wording fixtures, quota spacing, malformed output, cancellation, duplicate approval, late audio and API origin protections. Typecheck, production build and source/bundle credential scan passed.
- Live browser: one Cecily fixed preview and one deliberately approved “Please repeat that.” playback reached completion. Browser events establish playback lifecycle, not human hearing or physical-switch approval. No physical cloud acceptance is claimed yet.
- Live Gemini: fictional context returned three neutral replies; draft stayed empty until deliberate selection. Selected text remained unspoken through Review. A separate live spelling request returned “Please do not reposition me.” from “Plese do not reposition me.” in 893 ms total API round-trip. Network/model portions were not separately timed.
- Controlled API outage: premium speech failed visibly, exact draft remained, fallback selection stayed silent, separate system-speech approval reached playback completion. Local API was restored afterward.
- Two TTS requests submitted 46 characters total before the controlled restart; two Gemini requests. No automatic six-voice batch generation. Audio latency and actual pronunciation are not yet measured.
- Inspected screenshots of voice picker, suggestions, review and compact failure state are private in `local-reports/FINAL_*.jpg`. Existing panel geometry was preserved. The configuration reload during integration cleared the earlier tab draft; normal focus recovery acceptance does not imply persistence across reload.

## Sources and prior code review

[ElevenLabs voices API](https://elevenlabs.io/docs/api-reference/voices/search), [speech API](https://elevenlabs.io/docs/api-reference/text-to-speech/stream), [models](https://elevenlabs.io/docs/overview/models); [Gemini pricing](https://aistudio.google.com/docs/pricing), [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), [official SDK](https://googleapis.github.io/js-genai/). Account conditions above came from the actual project dashboards, not pricing-page assumptions.

The owner's Sema, Alethia and Our Ground boundaries informed server separation, bounded data and sanitized errors; no repositories were merged or product logic copied. Their broader retries, agents and schemas were not imported.


### Voice workflow follow-up

The owner reports hearing Cecily during the first physical cloud test. The requested compact voice-detail workflow is now implemented, with developer browser checks on Cecily and Eric, including live preview completion and Stop during active Eric playback. Detailed evidence and pending physical acceptance are in [UX-VOICE-01](HP26_UX_VOICE_01.md). This does not mark the remaining physical speech/Stop/Gemini script passed.
