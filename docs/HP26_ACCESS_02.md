# HP26-SMV-UX-ACCESS-02 — visible alphabet and optional Listening

November 14, 2026. Additive checkpoint after 18b92a6. The owner replied **“it all worked well”** to the complete LaSean preview, explicit voice choice, switch spelling, intent expansion, silent review and separate Speak script. Record this as owner-reported success for that exercised flow; the owner did not separately transcribe the heard words or supply timings. It does not validate the new keyboard or microphone flow below.

## Implemented

The experimental default displays all 26 letters in five stable alphabetical rows, retaining the accepted row membership. One fresh cycle chooses a row; another chooses its letter. Other rows stay visible. Completed letters return predictably to row scanning. The previous grouped display remains selectable as a reversible fallback. Space, Backspace, Editing, Expand, Review, Done and Back remain switch targets. No input reducer, firmware, protocol, timing contract or speech-approval changes.

Listening is optional under More controls. The microphone is off initially. A separate speaker-consent step precedes Start recording; browser microphone permission may require companion assistance. Capture stops on Stop, Cancel, track loss, focus/visibility loss, mode exit, retired session or the 20-second maximum. Every acquired track is stopped, including late permission grants after cancellation. Up to 1 MiB of supported WebM/Opus, Ogg or MP4 audio is held only in memory, then sent through the loopback API. No local audio/transcript persistence or background capture is implemented. Permission-dialog focus loss may cancel the first attempt safely; return and start a fresh session after permission if needed.

The server uses **Scribe v3** at POST `/v1/speech-to-text`, with multipart file upload, diarization/audio-event tags disabled, a 12-second timeout, no retry, one in-flight operation, duplicate-ID rejection, ten-recording and 120-second declared-duration process caps. It checks consent, fictional flag, canonical base64, MIME/magic bytes and size. Duration is enforced by the browser timer and declared-duration validation; there is no server audio-duration decoder. This local prototype boundary is unsuitable for public deployment as-is.

A transcript appears only as a partner's words for review. Accepting it saves optional context, never the draft. Exact keywords and the reviewed transcript reach Gemini only on deliberate Expand. Contradictory negation/direction cues withhold a candidate rather than rewrite the person's meaning. Context supplies no facts. Transcript-only neutral replies are fixed Yes / No / Please repeat that choices, explicitly not model-generated; choosing one enters complete silent review. Fresh final speech approval remains mandatory.

Official [transcription documentation](https://elevenlabs.io/docs/overview/capabilities/speech-to-text) recommends Scribe v3 for recorded audio; [API](https://elevenlabs.io/docs/api-reference/speech-to-text/convert) documents the batch route and formats. [Pricing](https://elevenlabs.io/pricing) lists approximately 330 credits/minute for STT; a 20-second demo is approximately 110 credits before any applicable provider rounding. Existing verified prepaid/account gates remain required. Provider retention is **not** claimed disabled: zero-retention requests require Enterprise. Use only consenting fictional speakers, never actual private health conversations.

## Executed evidence

- **140 tests passed**, including fresh row/letter cycles, hold nonrepeat, consent and context acceptance, cancel/focus retirement, late permission release, microphone track failure, maximum recording duration, size/MIME validation, API origin/size controls, context conflicts, and existing input/speech regressions. Typecheck and production build passed; the 95-file source/bundle credential scan found no private-key or credential-pattern matches.
- Actual Scribe v3 call transcribed the existing roughly two-second generated fictional sample exactly as `This is the selected voice.` in **410 ms request-to-result**. This was generated audio, **not a microphone or physical-switch test**.
- Actual Gemini call with reviewed fictional context `How are you feeling today?` and keywords `belly hurts weak today` returned `My belly hurts and I feel weak today.` in **1,217 ms local API request-to-result**. These are single observations, not performance estimates.
- Browser: all letters were visible; separate companion row/letter actions entered `h` and returned to row scanning. At 1024×672 the alphabet ended at y534 inside the right region ending at y579, with unchanged page height. Secondary actions use internal scrolling. At 390×844, document/client widths were 375 with no horizontal overflow and necessary page scrolling. The inherited 200%-zoom reflow remains; actual 200% zoom was not repeated for this new alphabet surface.
- Listening consent view was inspected; entering it never requested microphone access. Actual microphone permission, recording, Stop, transcription review and combined physical speech remain **pending owner acceptance**.
- Private screenshots: `local-reports/ACCESS02_ALPHABET.jpg`, `ACCESS02_ALPHABET_NARROW.jpg`, `ACCESS02_LISTENING.jpg`. No recordings or private conversation evidence are release assets.
- [Matched comparison and primary research](ACCESS02_KEYBOARD_EVALUATION.md): five tasks use **135→135 modeled choices**, with **391→445 ideal scan advances**. Added navigation targets increase scan distance. No improved speed, cognitive load or clinical outcome is claimed. These are simulations, not physical timings/errors.

## Physical acceptance script

Keep SMV focused and the switch released. Cancel the debugging banner if present. Companion setup → fictional cloud consent → Refresh cloud status → Connect verified Pico CDC2; use a new Resume cycle if offered. Keep the existing fictional draft until deliberately starting another.

1. Spell: select a visible row, then a letter with another fresh cycle. Verify all other letters stay visible, only one character appears, and a hold never repeats. Backspace that test character to restore the draft.
2. More controls → Listen → obtain the speaker's agreement → Continue → Start recording. Grant microphone permission with companion assistance if needed. If permission causes safe cancellation, return and start again. Say only the fictional question `How are you feeling today?` and select Stop recording. Verify capture stops.
3. Inspect the transcript. Reject errors; accept correct text as context. The composed message must remain unchanged and silent.
4. Deliberately compose the fictional keywords `not ready` (or retain the prior accepted wording), choose Expand, inspect and accept the candidate into Review. Only a separate new Speak cycle may speak it once. Report actual wording and any failure.
5. Start a new recording and Cancel; confirm recording stops and nothing transcribes or changes the message. Stop on any unintended selection/speech; leave the tab unrefreshed.

## Release boundary

Prior accepted AAC/LaSean/intent route is the reliable demonstration baseline. New visible alphabet/Listening is experimental pending the physical script. Gaze is deferred. Public GitHub remains 9983260 pending newer publication approval; no deployment, DNS change or Devpost submission occurred. This checkpoint adds no dependencies, exposes no keys, and makes no clinical or compliance claim.
