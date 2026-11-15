# Current local Gemini wording-request allowance — November 15, 2026

The owner authorized raising the application allowance to **300 wording REQUESTS**, not tokens. `DEFAULT_GEMINI_REQUEST_LIMIT` in `server/gemini.mts` is the single default. An explicit server-process `SMV_GEMINI_REQUEST_LIMIT` may supply a positive safe integer; invalid configuration disables Gemini rather than silently accepting a malformed value. This local cap does not raise the upstream Gemini quota, change billing, or establish API entitlement from a consumer subscription.

`SMV_GEMINI_START_REQUESTS` preserves the consumed request count across a controlled restart. It accepts canonical integers from zero through the configured limit; invalid or excessive values fail closed. Both values come from explicit operator process state through `server/environment.mts`, not the private `.env` key file. Existing message lengths, output token limit, model, free-tier/account gates, one in-flight request, five-second spacing, duplicate IDs, timeouts and no-retry policy are unchanged.

API status reports `requests` and the resolved `sessionLimit`. A local-cap error includes sanitized numeric `sessionLimit` metadata; the UI states that exact number of **wording requests**, or uses generic local-allowance wording if the numeric metadata is absent/invalid. It never substitutes a client hardcoded limit. Provider 429 remains the separate `GEMINI_QUOTA` response.

## Controlled restart procedure

1. Read the current local `/api/status` response and wait for `inFlight:false`.
2. Record the observed `gemini.requests` before stopping the old API process. Do not use zero or an earlier checkpoint.
3. Start the same API with `SMV_GEMINI_START_REQUESTS=<observed requests>` and `SMV_GEMINI_REQUEST_LIMIT=300`, using the already-installed project Node environment.
4. Confirm status preserves `requests` / `diagnostics.startingRequests` and reports `sessionLimit:300` before one deliberately authorized live check.

The coordinating agent's pre-restart read reported requests 20 / sessionLimit 20, startingRequests 18, providerCalls 2, attempts 4, cap 2, provider429 0, no in-flight work and no cooldown. The controlled restart explicitly carried **20 consumed requests** into the new process; the initial new status confirmed requests 20, startingRequests 20 and sessionLimit 300. ElevenLabs and Scribe have separate process-local counters and currently no restart seeds; their counters must not be represented as preserved merely because Gemini's seed is preserved.

## Actual post-restart live check

The coordinating agent made exactly one controlled fictional expansion after verifying the carried checkpoint: `please repeat slowly` returned `Please repeat slowly.` with HTTP 200. Diagnostics recorded one upstream Gemini call, 1,166 ms provider latency and 1,168 ms total latency. The resulting local counter was **21/300**, leaving **279 local wording requests**; provider429 remained zero. This establishes the exercised request path after the local-cap change, not general wording accuracy or a guaranteed upstream allowance. No speech authorization follows from the expansion result.

The StillMyVoice project's Google AI Studio dashboard was separately observed as **Free tier** for Gemini 3.5 Flash Lite, displaying **15 RPM**, **250K TPM** and **500 RPD**. Its 28-day peak display showed 20/500, with an offline banner and a 15-minute reporting-delay notice. These are a dashboard snapshot, not proof of live remaining quota; 20/500 must not be interpreted as 480 requests currently available. No billing, key, model or provider-quota setting was changed. The local 300-request cap and the provider's displayed limits are different controls.

For another controlled restart, read the newest current counter; **21**, not 20 or 0, is the last verified checkpoint from this test.

## Mocked verification

36 targeted tests passed: the default 300-request boundary, configurable lower cap, seeds through 300, invalid limits/seeds, HTTP-to-UI numeric cap metadata, shared suggestion/expansion allowance, duplicate/in-flight/cooldown distinctions, actual provider-quota error normalization, cancellation, no retry and unchanged request/response bounds. These mocks do not consume a provider allowance and are not live-model evidence.

## Historical 20-request checkpoint

The following report is retained as historical evidence. Its observed counts and old 20-request implementation describe that earlier checkpoint, not the current default.

# Gemini quota diagnosis — bounded local follow-up

November 14, 2026, Eastern. The owner clarified Google AI Plus, not Pro. Consumer subscription benefits are not used as API entitlement. The existing private key, direct Gemini 3.5 Flash Lite free-tier gate and billing restrictions are preserved.

## What was actually observed

The prior UI converted every HTTP 429 into “Quota reached. Continue with your own words.” The backend also used one `ASSISTANCE_LIMIT` code for a request still running, the five-second cooldown and the 20-request process cap. That UI copy could not identify the cause.

The original failed response was not retained. Therefore its exact sanitized backend code cannot be recovered, and neither a transient provider quota nor a local cooldown is asserted as the historical cause. Inspection found only 2/20 consumed local requests. One controlled fictional `not ready` expansion on that same process returned HTTP 200 and `I am not ready.` in 842 ms, taking the count to 3. This rules out the 20-request cap at inspection time; it does not disprove an earlier transient provider limit.

The diagnostic restart carried those 3 consumed requests forward. In the isolated browser check, spelling `not ready` and deliberately selecting Expand produced `I am not ready.`. The original stayed in the message until explicit candidate selection; Review remained Awaiting approval. The new status then reported total requests 4/20, startingRequests 3, attempts 1, providerCalls 1, duplicate 0, busy 0, cooldown 0, cap 0, provider429 0, lastError null. No duplicate or actual provider quota failure was observed in this check. No further live generation was needed for limit tests.

## Exact sanitized error vocabulary

| Source | HTTP | Code | Meaning |
| --- | --- | --- | --- |
| Application | 409 | `ASSISTANCE_ALREADY_REQUESTED` | This request ID was already consumed; no second provider request. |
| Application | 409 | `ASSISTANCE_BUSY` | Another wording request remains in flight. |
| Application | 429 | `ASSISTANCE_COOLDOWN` | Five-second spacing; bounded retryAfterSeconds is supplied. |
| Application | 429 | `ASSISTANCE_SESSION_LIMIT` | Local allowance of 20 wording requests is used. |
| Application | 429 | `LOCAL_RATE_LIMIT` | Loopback API-wide request-rate protection. |
| Provider | 429 | `GEMINI_QUOTA` | Actual upstream Gemini rate/quota response. |

These are implemented codes and synthetic regression cases, not a claim that every error occurred live. A future provider error retains only HTTP status, fixed status enums, known quota metric names and a bounded numeric retry interval. Raw SDK messages, submitted words, transcripts and credentials are never retained in diagnostics or returned to the browser. Unknown 429 causes remain explicitly unknown.

## Preservation and validation

Both Gemini routes retain one shared 20-request budget, one in-flight operation, five-second spacing, duplicate-ID rejection, bounded response/timeout and no automatic retry. Clarifications that avoid the provider are counted separately from actual providerCalls. Operator-only restart seed accepts 0–20, invalid input fails closed, and `.env` cannot enable or change it. It preserves consumed totals only, not historical IDs or cooldown; production durability is outside this local demo.

148 automated tests pass, including local/provider error separation, no extra calls on duplicate/busy/cooldown/cap, sanitized metadata, malformed errors, preserved restart totals and invalid seeds. Strict Mode/HMR regression simulates lifecycle retirement before submission; the browser check establishes one actual request for one deliberate expansion, not exhaustive remount behavior. Independent read-only review found no actionable defect. Original firmware and deterministic physical-input sources are unchanged. Physical microphone/combined acceptance remains pending.
