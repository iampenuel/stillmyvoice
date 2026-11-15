# HP26-SMV-UX-VOICE-01 — direct preview and explicit voice confirmation

## Scope and owner evidence

The owner heard Cecily through ElevenLabs and reported successful voice selection. Preview was difficult to find after selection. This is positive owner-reported audible evidence for the exercised voice flow; it does not confirm the remaining exact-phrase, Stop, second-voice and Gemini physical tests.

The correction retains the existing panels, typography and buttons. No CSS, firmware, transport, credentials, provider model, voice ID or input-reducer changes. The published baseline is 9983260 at https://github.com/iampenuel/stillmyvoice; this follow-up is locally implemented pending review.

## Interaction

Opening any approved voice enters its compact detail state, showing its name/description and exactly three actions: Preview voice, Use this voice, Back to voices. Preview is first in the scan order after a fresh synchronized transition. Opening the detail is silent and preserves the saved voice. Only Use confirms the candidate, silently returning to composition.

Preview freezes the candidate ID and the existing fictional sample, “This is the selected voice.” It never uses or changes the composed draft. Existing synthesis/playback controllers are reused; loading and playing expose only Stop preview, preventing duplicate requests. Completion, Stop and failure return to the same candidate. Focus loss cancels and requires fresh Resume without replay. Stale callbacks cannot affect a new candidate. Preview status is explicitly labeled as preview rather than draft playback.

All six identities remain unchanged. LaSean can be inspected, but Preview and Use remain disabled because Flash v2.5 tuning is unavailable. This UX correction does not substitute a model or claim to resolve provider compatibility.

## Executed checks

- Seven new focused tests cover all six identities, first-target order, staged versus saved voice, Cecily/Eric previews, explicit confirmation, unavailable/consent gates, duplicate prevention, stale completion, Stop/error return, focus recovery and fresh simulated DOWN/UP cycles. Simulation is not physical evidence.
- Full suite: 100 tests passed. Typecheck and production build passed. Existing input/lifecycle and TTS regressions remain included.
- Chrome: Cecily and Eric live previews completed. A further Eric preview was stopped after its playing event; the detail returned with “Voice preview stopped.” Both Use actions returned silently to the unchanged fictional draft. No draft speech was requested during these checks.
- Desktop: 1440×756, 1280×720 and 1024×672 fit all three detail actions with no page or panel overflow. The longest James name was checked at 1024×672; final action ended at approximately y547.
- Actual Chrome 200% zoom was observed in browser chrome; one-column reflow and document scrolling kept the complete message and actions within the horizontal viewport. Narrow 390×844 testing likewise had no horizontal overflow. Temporary zoom/viewport settings were reset. These checks do not establish accessibility conformance.
- Private screenshots: `local-reports/VOICE_DETAIL_CECILY.jpg`, `VOICE_DETAIL_ERIC.jpg`, `VOICE_DETAIL_COMPACT.jpg`, `VOICE_DETAIL_NARROW.jpg`. Screenshots and browser evidence are not public release assets.

## Physical repeat

Keep the switch released and SMV focused. Companion setup → verify fictional cloud consent and CDC2 port → Connect Pico; new Resume cycle if offered. Close any debugging banner before testing.

1. Switch only: More controls → Settings → Voice → ElevenLabs voices → Cecily. Confirm the three actions are visible and Preview is first. Entering detail must stay silent.
2. New cycle on Preview voice: hear only the fixed sample. Completion returns to detail. New cycle on Use this voice: return to composition without audio.
3. If draft is empty, Phrases → “Please reposition me.” Otherwise use the existing fictional phrase rather than append it twice. Review silently; a new Speak exactly this cycle must play that exact phrase once.
4. Select Eric through settings; deliberately preview and stop it with a new cycle on Stop preview while it is playing. Confirm return to detail, then Use this voice. Review the same phrase and approve again separately.
5. Get suggestions → Suggest a reply → a fictional question. Results must not change or speak the draft. Choose one deliberately, review, then use a separate new Speak cycle. Reject all remains available.

Report the first mismatch and leave the tab unrefreshed. Audible wording and physical Stop remain owner observations, distinct from browser lifecycle and simulated tests.
