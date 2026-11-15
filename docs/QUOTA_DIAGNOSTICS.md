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
