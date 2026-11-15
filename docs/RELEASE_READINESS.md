# HackPrinceton release readiness

## Confirmed rules and deadlines

The [official Fall 2026 rules](https://hackprinceton-fall-26.devpost.com/rules) were verified in Chrome on November 14. The hard Devpost cutoff is **November 15, 8:00 AM Eastern**. The owner's internal **November 14, 10:00 PM Eastern** target has passed. Do not represent the internal target as the official cutoff or claim submission has occurred.

The rules require code built within the November 13 8 PM–November 15 8 AM event window, a public GitHub repository linked in Devpost with code uploaded before cutoff, explicit framework/library credits in README and submission, at least 85% event-written code, human understanding of AI-assisted decisions, and an in-person presentation of at most two minutes. These requirements are not a claim that eligibility/provenance has been certified. Owner has confirmed registration/check-in, sole team membership, and that 100% of their code was written during the event. Record this as owner-reported evidence, not independent verification. Git history was not rewritten.

## Current readiness

Final demonstration follow-up: context-first entry, contextual quick phrases and direct Listen/Expand are implemented. 157 tests pass; final typecheck/build and credential checks are recorded in [checkpoint evidence](HP26_FINAL_DEMO.md). Real browser Gemini Healthcare expansion and negation succeeded with measured upstream evidence. Local ambiguity clarification is explicitly distinguished from Gemini output. The full actual-microphone/physical AI/speech run is awaiting owner confirmation; the single original tab is prepared. Future commits use repository-local iampenuel attribution with an observed account-associated email; no public history rewrite.

The paragraphs below describe the published 6165d71 baseline and subsequent work before this final follow-up.


Public main was verified at [`6165d71`](https://github.com/iampenuel/stillmyvoice/tree/6165d71). The newer keyboard UI/diagnostic follow-up is local pending publication. Final verification passed: 148 automated tests, typecheck, production build, and a 98-file source/bundle scan with zero credential findings. Both private key values were compared without displaying them.

- **Owner physical evidence:** phrase/spelling/correction/system speech and released-switch focus recovery have acceptance for their exercised scenarios. Cecily's exact phrase was confirmed. At `18b92a6`, the owner reported that the complete LaSean preview, voice choice, switch spelling, intent expansion, silent review and separate Speak script worked. The owner did not separately supply timings or transcribe that run's heard words. [Intent evidence](HP26_INTENT_01.md), [ACCESS-02 scope](HP26_ACCESS_02.md).
- **Voice compatibility:** all six verified voice identities retain their assigned models. LaSean's Flash v2 exception is implemented and tested; the previous Flash v2.5 issue is not a current release blocker. No automatic voice replacement or global-model change was made. Remaining unexercised voice auditions and interruption/Stop scenarios must not be described as passed.
- **Local browser UI:** stable bordered letters and compact controls passed 1440×756 and 1024×672 checks. At 1024×672 the choice region had equal scroll/client heights of 367 px, with the footer ending inside its visible bounds. The 390×844 check had document/client widths of 375 px with no horizontal overflow. Actual Chrome 200% zoom produced a 720×378 viewport with accessible vertical reflow. These are browser observations, not new physical-switch acceptance.
- **Listening/context:** optional consent-based Scribe v3 recording, Stop/Cancel, transcript review and deliberate context acceptance are implemented. Generated fictional audio was transcribed successfully, and a controlled transcript-plus-keyword Gemini request succeeded. Actual microphone capture, permission/recovery and the combined physical workflow remain pending. Transcripts never become authored words or authorize speech automatically.
- **Preserved boundaries:** accepted firmware, wiring, input reducer, fresh speech approval and local fallback are unchanged. Gaze is deferred; no camera experiment is part of this checkpoint.
- **Release assets:** README/notices credit frameworks, SDK, hardware/platforms, services and Codex assistance. No project-source license is selected. Secrets, provider gates, account evidence, backups and screenshots remain ignored/private; recheck the final tracked inventory and bundle before publishing the follow-up.
- **External state:** no DNS change, deployment or Devpost submission occurred. The loopback demonstration server is not suitable for public exposure without separate production security/routing work.

## Latest bounded Gemini checks

The original quota-related failure cannot be reconstructed from retained evidence; its cause is not claimed resolved retrospectively. In the new controlled check, the local counter started at **2/20**, one request returned HTTP 200 in **842 ms**, and the counter became **3**. Restart preserved a used-request seed of **3** rather than resetting the allowance. A subsequent browser request expanded fictional `not ready` to `I am not ready.` and advanced the counter to **4**. That observed browser attempt recorded one provider call, zero duplicates and zero provider 429s; candidate display and review remained silent. These bounded observations do not establish that every historical error was local or that future quota errors cannot occur.

The reviewed consumer subscription is **Google AI Plus, not AI Pro**. This does not change the Gemini API's verified free-tier gate. The existing private key, model/account restrictions and server-side secret boundary are preserved; no billing upgrade or allowance reset was performed.

## Remaining physical acceptance — fictional content only

Do not run another serial monitor. Keep the SMV tab focused and the arcade button released before setup. Companion setup: enable fictional cloud-demo consent, Refresh cloud status, verify both Ready; select the independently verified CDC2 port. Close setup and use a new Resume cycle if offered.

1. Spell with the visible keyboard: one fresh cycle chooses a row, another its letter. Verify stable letter positions, exactly one character, no hold repeats, and accessible Space/Delete/Done. Restore the fictional draft after this check.
2. More controls → Listen → obtain the speaker's agreement → Continue → Start recording. Companion assistance may be needed for the first browser permission. If permission causes safe cancellation, return and start a fresh session. Say only `How are you feeling today?`, then select Stop recording and verify capture stops.
3. Inspect the transcript; reject incorrect wording. Accept correct wording as conversation context. The draft must remain unchanged and silent. Start another recording and Cancel to verify that capture stops without changing the message.
4. Compose fictional keywords such as `not ready`, choose Expand, inspect the candidate, and accept it into complete Review. Review stays silent. Only a separate fresh Speak cycle may produce the exact approved wording once. Report actual heard text and any failure.
5. Finish any still-unexercised selected-voice Stop, rejection and controlled-fallback checks separately. Do not repeat already accepted flows as though they were failures or treat their success as evidence for the new microphone path.

Record which actions were physically performed, exact heard text/voice, failures and unintended events. Stop immediately on unintended selection/speech and leave the tab unrefreshed. Browser completion events alone do not establish audibility.

## Two-minute demonstration draft

0:00–0:20 — “Still My Voice is a single-switch communication prototype. The person composes, inspects and corrects their words, then separately approves exactly what will be spoken.” Show the physical button and stable message workspace.

0:20–0:55 — Select a fictional phrase, review silently, and use a new switch cycle to speak. Explain target capture on press and one commit on matching release. Holding does not repeat.

0:55–1:20 — Show deliberate keyword expansion with optional context, keeping the person’s words visible until they accept a candidate. Nothing enters the message until selected; nothing speaks until separately approved. Do not claim unrestricted rewriting or measured clinical benefit.

1:20–1:40 — Demonstrate selected voice or correction and Stop. If cloud is unavailable, use deliberate system fallback with fresh review/approval.

1:40–2:00 — Explain cancellation on interruption, preserved draft on temporary focus loss, tested scope and limits. State that this is developer/owner prototype testing, not clinical validation. Optional transcription is implemented but its microphone/combined physical demonstration remains pending; omit it from the live demonstration until accepted. Gaze is deferred.

## Devpost draft claims to use after verification

Built with React, TypeScript, Vite, Node.js, CircuitPython on Raspberry Pi Pico, Chrome Web Serial/Web Speech, ElevenLabs and direct Gemini via the Google Gen AI SDK. Owner-directed engineering used Codex assistance. Original contributions are the integrated communication workflow, deterministic selection and authorization boundaries, correction/review UI, session recovery, and constrained provider adapters/tests. Credit the underlying frameworks and services separately.

Do not claim audible acceptance of every voice, full offline operation, medical-grade eye tracking, clinical efficacy, accessibility conformance, live deployment, public submission, or success of unexercised physical cloud scenarios. Preserve actual Git dates and disclose the inherited diagnostic/hardware baseline. The owner reports 100% of their code was written during the event; distinguish that attestation from commit-date evidence and from third-party dependency code.
