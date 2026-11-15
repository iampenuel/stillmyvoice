# HP26-SMV-INTENT-01 — intent, context and voice compatibility

November 14, 2026. Additive checkpoint on 96e483b; accepted two-panel design, physical-input reducer, firmware, wiring and CDC protocol preserved. No dependency additions, deployment or DNS changes.

## LaSean investigation and repair

Exact approved ID remains `bQxW1c7YCr6VQgQhw8KX`, account name `LaSean Pickens`. Account metadata explicitly reports `failed` for Flash v2.5, including its alternate spelling, and Turbo v2.5; this is not an inference from missing metadata. Flash v2, Multilingual v2 and v4 Turbo report fine-tuned. The preferred-model-only availability check made a model-specific failure look like whole-voice unavailability.

Use server-only `eleven_flash_v2` for this voice's English demonstration. Other five identities retain `eleven_flash_v2_5`. No automatic fallback or voice substitution. The client cannot select arbitrary models. Identity, unique match, selected-model tuning, sharing expiry and standard sharing rate remain mandatory. Missing or failed selected-model evidence keeps Preview/Use unavailable.

The restricted key's earlier models/subscription endpoints returned 401; those do not prove TTS denial and permissions were not broadened. There was no LaSean synthesis error before repair: the metadata gate blocked it. A sandbox DNS failure during this checkpoint occurred before synthesis. After authorized network access, refreshed metadata verified all six assignments and **one fixed 27-character LaSean preview** returned 22,195 bytes of audio in **433 ms request-to-complete-audio**. This establishes account/model API compatibility, not audible quality or physical acceptance. No repeated failed audio generation occurred.

[Official models](https://elevenlabs.io/docs/overview/models) lists Flash v2 as supported, English-only. [Official pricing](https://elevenlabs.io/pricing) places Flash v2/v2.5 API usage at 0.5–1 credit per character. Budget the short check conservatively at no more than 27 base credits at verified standard voice rate; exact provider deduction was not independently measured. Multilingual v2 costs one credit/character and was unnecessary; v4 Turbo was not enabled or tested. Existing account gates and process budgets remain in force.

Changing voice candidates clears the preceding preview state, retires authorization and restores authored-message status. Tests cover candidate changes and late canceled audio. Opening a voice remains silent; Preview first, Use this voice and Back stay inside the existing panel.

## Context and expansion

General is the default. Optional Home, Healthcare, Community and Education & Work use a two-by-two choice grid plus General/Back, preserving the draft and selected context for this tab session. Context selection never requests AI or speech and cannot provide facts about the person.

Expand my words is available from composition and grouped spelling. One deliberate activation submits exact fictional keywords and optional context to direct `gemini-3.5-flash-lite`. One proposed sentence appears beside the unchanged original words. Edit stages a separate candidate buffer using the existing keyboard; Keep my words and Back preserve the source. Review this wording deliberately replaces the draft, supports Undo and enters complete silent review. A separate fresh Speak cycle remains necessary.

The response schema permits only candidate, clarify or insufficient_input with bounded fields. Independent validation rejects extra fields, missing cues, invented content, changed negation, directions, names, urgency and time tokens. Grammatical completion is deliberately narrow and is not semantic proof. Untrusted candidates always require inspection. Unknown ambiguity is withheld rather than guessed.

For `belly weak daily hurt`, a deterministic guard asks **Which happens daily?** with Belly pain / Weakness / Both / Keep my words. Only an explicit choice binds the duration. This audited clarification is application logic, not a claimed Gemini generation. More-qualified inputs outside this template are withheld.

Suggestions and expansion share the existing free-tier gate, 20-request process budget, five-second spacing, one in-flight request, unique IDs, ten-second timeout, 600 output tokens and no retries. Cancellation, source/revision/context checks and held-target deferral prevent obsolete results being applied. No model can access input or speech controllers. Manual phrases/spelling remain available without cloud.

## Verification and limits

Executed final checks: **121 Node tests passed**, including input/transport/lifecycle, candidate editing/rejection, stale results, schema/semantic guards, shared quotas, per-voice assignment and loopback API protections. Two local-listener tests initially hit sandbox EPERM; both passed with permitted loopback access, and the final complete run passed. Typecheck, production build, diff whitespace check and an 83-file source/bundle credential scan passed. Both private keys were checked without printing values; no matches were found in release files. Private configuration and evidence remain ignored.

Developer/browser observations:

- Live Gemini: `belly hurts weak today` with Healthcare context produced `My belly hurts and I feel weak today.` The source remained unchanged while the candidate was inspected and entered staged editing. Saving the candidate remained silent; Review this wording then showed the complete exact sentence with Awaiting approval. No speech request was made by entering Review.
- A second live fictional request, `not ready`, returned `I am not ready.` in **857 ms local API request-to-result**. Network/model portions were not separately measured.
- The ambiguous daily input displayed the one-question clarification. Selecting Belly pain produced `My belly hurts daily, and I feel weak.`; Keep my words restored the untouched keywords. These two responses were deterministic and consumed no Gemini generation.
- LaSean browser preview completed. Its first browser attempt after a controlled API restart failed closed because server voice discovery was empty (0 voices, 0 submitted characters), so no TTS request occurred. Refresh cloud status reverified metadata; a fresh deliberate preview then completed. This adds 27 fictional characters beyond the standalone compatibility test. Selecting Eric afterward cleared the stale preview status to Not spoken and kept the authored draft. No broad voice retest or substitution.
- Context is visibly two-by-two at 1440×756 and 1024×672, with stable document height and aligned panels. Candidate overflow stays inside the right panel. At 390×844, the context becomes one column with necessary document scrolling and no horizontal overflow. Actual Chrome 200% zoom was observed; effective viewport 720×378, document width 712 and scroll width 712. All context actions remained within that width. Zoom and viewport overrides were restored.
- Private visual evidence: `local-reports/INTENT_CONTEXT.jpg`, `INTENT_EXPANSION.jpg`, `INTENT_SILENT_REVIEW.jpg`, `INTENT_LASEAN.jpg`, `INTENT_CLARIFICATION.jpg`, `INTENT_CLARIFIED_CANDIDATE.jpg`, and context compact/narrow/200%-zoom images. These are fictional developer checks, not physical-switch observations.

[Matched efficiency comparison](INTENT_EFFICIENCY.md): six identical target meanings take **437→307 modeled selections** and **1,257→891 ideal scan advances**. Fixtures now pass the actual server validator before traversal. This is not an observed speed gain; provider/reading/recognition/setup delays and missed scans remain unmeasured. Quick phrases can beat either spelling route. Existing direct Space/Backspace, fixed letter groups and word correction are retained; no speculative keyboard reordering was introduced.

## Physical repeat and release decision

Completed owner evidence remains scoped to the accepted switch/recovery/edited-message flows and Cecily preview/exact phrase. **New intent expansion, LaSean audibility and physical Stop remain pending.** No physical success is inferred from fixtures or browser completion.

With the original SMV tab focused, switch released, debugging banner canceled, Companion setup → fictional consent → Refresh cloud status → verified CDC2 checkbox → Connect Pico. Use a new Resume cycle if offered. Using only the switch:

1. More controls → Settings → Voice → ElevenLabs voices → LaSean Pickens. Opening must stay silent and show Preview first. A fresh Preview cycle must speak only `This is the selected voice.` Then deliberately Use this voice.
2. From an empty fictional draft, Spell `not ready` using the existing alphabet groups and Space. Choose Expand my words. Original words remain on the left; no speech occurs. Inspect the full candidate. Keep my words is available if its meaning differs.
3. Choose Review this wording; remain silent. Use a separate new Speak exactly this cycle. Report the exact heard sentence, once, and any mismatch. Stop and leave the tab unrefreshed if an unintended action occurs.
4. Physical Stop and a longer/ambiguous expansion are subsequent checks; do not mark them passed from this short repeat.

GO for a controlled fictional local demonstration of the already accepted deterministic route. New intent/LaSean physical acceptance is pending; NO-GO for claiming all voices, all interruption cases, clinical benefit or faster physical communication. Public source remains 9983260 until newer publication is approved. Domain deployment, production security and Devpost submission are separate release actions. Optional gaze/Scribe remain deferred.

SpeakFaster is established related work, credited in the efficiency report. This prototype does not claim invention of abbreviated AAC expansion, clinical readiness or demonstrated speed gains.

Keyboard follow-up: 122 tests, typecheck, production build and final source/bundle credential scan passed. The compact overview and letter-group return were browser-verified without panel or page overflow at 1024×672; see [keyboard evaluation](KEYBOARD_EVALUATION.md). No hardware/input changes.
