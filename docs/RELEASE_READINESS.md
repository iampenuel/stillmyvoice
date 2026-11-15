# HackPrinceton release readiness

## Confirmed rules and deadlines

Read the [official Fall 2026 rules](https://hackprinceton-fall-26.devpost.com/rules) in Chrome on November 14. Work to the **November 15, 8:00 AM Eastern** hard Devpost cutoff, not the later schedule listing. Owner's internal target remains **November 14, 10:00 PM Eastern**.

The rules require code built within the November 13 8 PM–November 15 8 AM event window, a public GitHub repository linked in Devpost with code uploaded before cutoff, explicit framework/library credits in README and submission, at least 85% event-written code, human understanding of AI-assisted decisions, and an in-person presentation of at most two minutes. These requirements are not a claim that eligibility/provenance has been certified. Owner has confirmed registration/check-in, sole team membership, and that 100% of their code was written during the event. Record this as owner-reported evidence, not independent verification. Git history was not rewritten.

## Current readiness

INTENT-01 current update: 121 automated tests, typecheck, production build and an 83-file source/bundle credential scan passed. Live keyword expansion and negation preservation succeeded; ambiguous duration required explicit clarification. LaSean now has verified Flash v2 synthesis and browser preview completion. Cecily exact phrase is owner-confirmed; new intent/LaSean physical acceptance remains pending. Public main remains the approved 9983260; newer source is local and requires publication approval. See [checkpoint evidence](HP26_INTENT_01.md). Older counts and preferred-model blocker below describe the earlier checkpoint.

- Reliable local phrase/spelling/correction/system-speech path has owner-reported physical acceptance for the exercised scenarios. Released-switch focus recovery at c0d4d27 was also confirmed.
- Existing two-panel UI retained; compact recovery and provider notices inspected.
- 93 automated tests, typecheck, production build and source/bundle credential scan passed. No accepted firmware/input reducer changes.
- Live Cecily playback lifecycle and two Gemini requests succeeded. New physical cloud acceptance, Stop/negation/direction listening and remaining voice auditions are pending. LaSean has a genuine preferred-model compatibility blocker.
- README and notices credit frameworks, SDK, hardware/platforms, services and Codex assistance. No project-source license selected yet.
- Secrets, provider gates, account evidence, device backups and screenshots remain ignored/private. Review the complete tracked-file and history inventory before publication.
- The owner-approved 9983260 checkpoint is published at https://github.com/iampenuel/stillmyvoice, public main, with existing history. The voice-detail follow-up is local pending review. No Devpost submission, domain configuration or deployment has occurred. The localhost server is explicitly unsuitable for public exposure without separate production security/routing work.
- Optional Scribe and gaze: **deferred / no-go for this release until P0/P1 acceptance is complete**. No microphone/camera activation, libraries, calibration or benefit measurements.

## Physical cloud acceptance — fictional content only

Do not run another serial monitor. Keep the SMV tab focused and the arcade button released before setup. Companion setup: enable fictional cloud-demo consent, Refresh cloud status, verify both Ready; select the independently verified CDC2 port. Close setup and use a new Resume cycle if offered.

1. With the switch only: More controls → Settings → Voice → ElevenLabs voices → Cecily. The compact detail must show Preview voice first, Use this voice, and Back to voices. Opening it stays silent. Preview deliberately; hear only the fixed sample. Stop preview cancels it and returns to the detail. Use this voice explicitly confirms the choice and returns to the message.
2. Phrases → “Please reposition me.” (in Quick phrases) → Review message. Review stays silent. A new cycle on Speak exactly this must produce that exact phrase once.
3. Repeat with Eric or another available approved voice. Hear the change; deliberately stop one playback. LaSean details are inspectable, but Preview and Use remain disabled for its unavailable preferred model.
4. Get suggestions → Suggest a reply → a fictional question. Waiting/results must neither change the draft nor speak. Choose one, inspect the editable draft, review silently, then authorize it with a fresh cycle.
5. Check spelling/negation with fictional wording, and explicitly reject or Undo an unwanted suggestion. Verify manual spelling remains available.
6. Controlled cloud-failure test requires coordination with engineering; preserve draft, select system fallback, then separately approve it. No automatic fallback.
7. Switch away and return with the switch released; draft stays, input synchronizes, a fresh Resume is required, and no speech replays.

Record which actions were physically performed, exact heard text/voice, failures and unintended events. Stop immediately on unintended selection/speech and leave the tab unrefreshed. Browser completion events alone do not establish audibility.

## Two-minute demonstration draft

0:00–0:20 — “Still My Voice is a single-switch communication prototype. The person composes, inspects and corrects their words, then separately approves exactly what will be spoken.” Show the physical button and stable message workspace.

0:20–0:55 — Select a fictional phrase, review silently, and use a new switch cycle to speak. Explain target capture on press and one commit on matching release. Holding does not repeat.

0:55–1:20 — Show deliberate keyword expansion with optional context, keeping the person’s words visible until they accept a candidate. Nothing enters the message until selected; nothing speaks until separately approved. Do not claim unrestricted rewriting or measured clinical benefit.

1:20–1:40 — Demonstrate selected voice or correction and Stop. If cloud is unavailable, use deliberate system fallback with fresh review/approval.

1:40–2:00 — Explain cancellation on interruption, preserved draft on temporary focus loss, tested scope and limits. State that this is developer/owner prototype testing, not clinical validation. Gaze and transcription are deferred.

## Devpost draft claims to use after verification

Built with React, TypeScript, Vite, Node.js, CircuitPython on Raspberry Pi Pico, Chrome Web Serial/Web Speech, ElevenLabs and direct Gemini via the Google Gen AI SDK. Owner-directed engineering used Codex assistance. Original contributions are the integrated communication workflow, deterministic selection and authorization boundaries, correction/review UI, session recovery, and constrained provider adapters/tests. Credit the underlying frameworks and services separately.

Do not claim all six voices work, full offline operation, medical-grade eye tracking, clinical efficacy, accessibility conformance, live deployment, public submission, or physical cloud success before the corresponding evidence exists. Preserve actual Git dates and disclose the inherited diagnostic/hardware baseline. The owner reports 100% of their code was written during the event; distinguish that attestation from commit-date evidence and from third-party dependency code.
