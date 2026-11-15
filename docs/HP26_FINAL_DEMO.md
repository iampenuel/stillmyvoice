# Final context-first AI demonstration checkpoint

November 14, 2026, Eastern. This is a focused change to the accepted two-panel prototype. No firmware, physical-input reducer, wiring, dependencies, billing, key, domain, DNS or deployment changes.

## Implemented and tested

Fresh application sessions enter Communication context: Home, Healthcare, Community, Education & Work, General. A context selection directly enters Make your message. Context persists in tab memory and focus recovery; New message does not require another choice. Changing context preserves the exact draft, settings, undo history, optional reviewed transcript and session. Context is a vocabulary/context hint, never a diagnosis or authority over the user's meaning.

Each context has six concise initial fictional quick phrases. Stop and Help are always present; General retains the prior quick phrase set. All categories and ordinary spelling remain reachable. The main primary targets are Phrases, Spell, Listen and Expand; selected context/change, Review and More controls form compact secondary navigation. Disabled Expand remains visible, explains missing words/consent/service readiness and is excluded from scanning.

The candidate is labeled AI suggestion. Use this wording enters existing silent review; Edit stages candidate-only editing; Keep my words rejects it; Back remains available. A separate fresh valid Speak cycle approves the exact full utterance. No AI or transcript can authorize speech.

## Browser and real provider evidence

- Fresh context entry, Healthcare and Home vocabulary, direct Listening consent/Cancel, draft-preserving context changes and silent candidate acceptance were inspected with semantic companion clicks. These are **not physical switch tests**.
- At 1024×672, context and normal main choice regions had client/scroll heights both 359 px; all five opening contexts, four principal controls and compact secondary controls fit without page/internal scrolling. The short candidate's controls also fit at 359/359. Both desktop panels stay aligned. Longer content may scroll internally. At 390×844, document/client widths were 375 with no horizontal overflow. Actual Chrome 200% zoom used a 720×406 CSS viewport with necessary vertical reflow. The existing target outline plus status strip preserve scan/held feedback; redundant scan text is omitted only in compact desktop states.
- Actual browser Gemini request, Healthcare keywords `belly hurts weak today`: candidate `My belly hurts and I feel weak today.` The original draft stayed unchanged before Use this wording. Review showed Awaiting approval; no speech was requested. Model `gemini-3.5-flash-lite`, success, one actual upstream call, provider latency 772 ms, server completion 774 ms, schemaValidated true. The fictional screenshot is private local evidence, not a stored user transcript.
- Actual negation fixture `do not reposition me`: `Do not reposition me.`, HTTP 200, one upstream call, 1,252 ms provider / 1,253 ms server / 1,304 ms local round-trip, schemaValidated true.
- Ambiguous `belly weak daily hurt`: `Which happens daily?`, choices Belly pain / Weakness / Both / Keep my words; no candidate and **zero upstream calls**. This was the existing deterministic clarification safeguard, not a fabricated Gemini response. No symptom's daily scope was inferred.
- The API restart preserved 4 already-consumed wording requests. Two live generations plus one counted local clarification made the total 7/20. No retries or allowance increase. Consumer subscription is Google AI Plus, not an API entitlement. The existing key/free-tier/no-billing restrictions remain.

## Listening and speech acceptance status

Listening remains microphone-off by default, consent-based, at most 20 seconds, memory-only, Stop/Cancel accessible, with stale session/track cleanup and explicit transcript review before context acceptance. Actual Scribe transcription from the MacBook microphone is **awaiting owner acceptance**. The prior generated-audio transcription is not substituted for a microphone pass. If Chrome's first permission prompt causes focus cancellation, grant permission, return focused, Resume if offered, then explicitly retry/start; genuine focus-loss cancellation is preserved.

Six verified voices and per-voice models remain intact. LaSean has prior owner-reported acceptance for the earlier intent flow. The new complete context → actual microphone → keywords → Gemini → exact LaSean speech workflow is **awaiting owner acceptance**. The acceptance tab was prepared with LaSean selected explicitly and no preview or composed speech triggered by setup.

## Verification and limitations

157 automated tests passed in one complete run, including mocked HTTP API boundaries, deterministic input/session regressions, fresh row/letter cycles, new context/vocabulary/draft preservation, separate speech approval, permission/recording cleanup, provider quotas and evidence metadata. Typecheck and production build passed. A 102-file source/bundle credential scan compared both private key values without printing them and found zero matches. No claim of clinical benefit, measured cognitive improvement, full semantic equivalence or accessibility conformance.

Existing task measurement scripts now explicitly choose General before counted work. Initial context selection is disclosed as uncounted setup. Historical baseline model hashes/results remain historical; current modeled intent traversal is 437→307 choices and 1,389→999 ideal advances, and visible-keyboard comparison remains 135→135 choices / 391→445 advances. These are scripted ideal routes, not physical timing or cognitive-load measurements.

## Git and release

Before this work, public main was verified at 6165d71. Future author/committer name is iampenuel using an exact email observed on an already linked Our Ground commit; global configuration and earlier public commits are unchanged. The final report must verify the newly published commit's `author.login` rather than assume email linkage. Local keys, gates, backups, recordings, screenshots and detailed personal reports remain ignored.

The Devpost draft was reviewed read-only and remains 2/5 steps complete. Prepared copy is private; required owner facts and explicit final submission approval are still outstanding. No agreements or submission action were performed. Gaze is deferred until physical acceptance and release readiness are protected.

## Exact owner repeat

Single original SMV tab, switch released. Companion setup: fictional consent and verified-port checks; Connect Pico → independently verified cu.usbmodem103. Cancel automation banner if present. A new Resume may be required.

1. Select Healthcare physically. Inspect healthcare phrases and shared Stop/Help, then Back.
2. Listen directly → speaker agrees → Continue → Start recording. Say only `How are you feeling today?` → Stop recording. Inspect actual transcript and deliberately accept correct text as context; reject errors. Permission cancellation may require focused retry/Resume.
3. Spell `belly hurts weak today` with separate row and letter cycles; Done.
4. Expand; original keywords must remain unchanged. Inspect real candidate, Use this wording, then complete silent review.
5. Use a separate new Speak exactly this cycle. Report exact transcript and exact approved/heard sentence once, voice and any mismatch.
6. Verify rejection/Undo and focus-return recovery without unintended action. For Stop, deliberately authorize a second playback, then use a new Stop cycle immediately. Stop on unexpected input or speech and leave the tab unrefreshed.
