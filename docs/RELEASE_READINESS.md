# Current checkpoint — isolated pointer sandbox and frontend release preparation

November 15, 2026. The unresolved `./GazeSandbox` import was transient during implementation: the parent referenced the new component before its file was complete. The named component/export, conservative pointer filter, four fictional actions and physical confirmation controller are now present. Chrome renders the experiment and main interface. Genuine serial input passes through the unchanged adapter/reducer; gaze never generates clicks, DOWN/UP, message edits or speech approval. Production gaze integration remains disabled. [Sandbox evidence and short owner check](GAZE_EXPERIMENT.md#pointer-and-physical-switch-sandbox-follow-up).

The owner observed Left / None / Right with the horizontal classifier from `1128019`, but did not complete a new six-trial test. This is not the earlier rectangle-classifier 1/6 result and is not formal accuracy acceptance. Pointer/target/physical-switch acceptance remains pending; no speed improvement is claimed. The local full application keeps Gemini, ElevenLabs and consent-based Listening behind their existing safeguards.

A separate **frontend-demo** build profile prepares static hosting with cloud features unavailable before recording/network access, camera/microphone disabled by policy, and experimental gaze excluded from the bundle. Browser speech still needs exact silent review and separate approval; it may use a network. The local loopback API is deliberately not production-ready: production provider gates, local-only origins, process-memory limits and missing public authentication/routing must not be bypassed. [Exact Vercel configuration, account findings and remaining release steps](VERCEL_FRONTEND_RELEASE.md).

No push, deployment, DNS change or Devpost edit/submission is authorized by this preparation. Public GitHub main remains `a0c6491707f8c06cc9a12d2e8e3c2a5d9124fd44`; the corresponding tested source and source/license links must be published and verified after approval before any public release. No matching SMV project or domain attachment was found in the connected Vercel team; this does not establish that the owner has no project/domain elsewhere. Devpost's last read-only result remains DRAFT, 2/5, with required content/acknowledgments missing. Preserve the 8:00 AM Eastern submission cutoff; stop experimental work at 6:00 AM if submission readiness remains incomplete.

**Verification:** 324 automated tests passed, including pointer/reducer integration and actual frontend bundle exclusion checks; typecheck, the full local build and frontend-demo build passed. `npm audit` reported zero vulnerabilities. Two private key values were compared in memory with source/build outputs: 161 files for the local build and 149 for the frontend demo, zero matches. Chrome rendered both local routes and the static demo with no current Vite overlay; the fresh main/demo tabs had no console errors. A temporary loopback preview log observed only the document, CSS and JS during fresh demo load/navigation, with zero application API requests. Explicit HTTP checks returned 404 for API/gaze routes and verified matching CSP/Permissions Policy and license files. No physical sandbox/camera acceptance is claimed.

The following sections preserve historical checkpoints; their counts and pending statements do not override this entry.

# Current release gate — November 15, 2026

**The horizontal-mapping follow-up passed 269 automated tests, typecheck and production build.** The final credential scan compared two private API key values in memory across 153 repository/source/build files and found zero matches. The dependency audit's zero vulnerabilities remain prior-checkpoint evidence; dependencies are unchanged. The established switch-only Listening → Gemini → correction → silent Review → fresh Speak/Stop sequence has owner acceptance for its exercised case. General Gemini ambiguity usefulness remains limited. Chrome verified the final Companion setup idle link and compact charcoal keyboard focus without changing actual scanned targets.

The isolated gaze experiment is **not accepted for scanner integration**. The latest owner-operated six-trial run completed all six trials with **1 correct, 0 incorrect and 5 abstained**, no interruptions and no measured geometry changes. The owner observed the Left/Right indicator responding to their eyes, then intentionally changed tabs; the subsequent page-hidden camera shutdown was expected privacy behavior, not a trial tracking failure. Frozen run evidence contains 175 face detections and finite predictions, 128 worker-accepted predictions, a 154.6 ms median prediction interval and 25.7 ms median inference. After orientation, mean raw x was 196.1 px for Left and 1328.8 px for Right in a 1440 px viewport. Twenty worker-accepted predictions were rejected by the rectangle classifier. Horizontal separation is promising, but reliable acceptance is unproven. A focused mapping-only follow-up opts this isolated route into horizontal viewport bands: Left at x < 40% width, Right at x > 60%, with both boundary values and the central 20% uncertain. Coordinates must remain finite and strictly inside the viewport; there is no nearest-region assignment or off-screen clamping. DOM rectangles remain fixation targets and geometry guards. The 80 px two-dimensional dispersion gate, 600 ms/five-sample acquisition, 800 ms switching hysteresis, freshness, blink and head-movement protections are unchanged. Diagnostic aggregates compare active-band mapping with rectangle mapping and separate raw predictions from worker-accepted predictions. This is a new prospective diagnostic policy, not a rescore of the failed run; physical verification is pending. [Gaze evidence and scope](GAZE_EXPERIMENT.md).

The last verified Gemini local snapshot is **21/300 wording requests**, leaving 279 locally after a restart that preserved 20 consumed requests and one successful live check. This is not daily or upstream quota remaining. [Quota evidence](QUOTA_DIAGNOSTICS.md).

Current source is local only; public main was last verified at a0c6491. The owner approved AGPL-3.0-or-later for the combined application; preserve the license, notices and corresponding tested source in any later authorized release. No push, deployment, DNS change or Devpost edit/submission occurred.

Owner-authorized read-only Devpost inspection confirmed **DRAFT, 2/5 steps complete**. Story, Built with tags, repository URL and required additional-info answers are blank; rules/sponsor acknowledgments and final terms are unchecked. Media and prize opt-ins are also empty. Detailed private findings remain in local-reports/DEVPOST_READONLY_AUDIT.md. These submission blockers remain open.

Stop experimental development and prepare the submission handoff at **6:00 AM Eastern** if readiness is still incomplete. Work to the official detailed-rules **November 15, 8:00 AM Eastern** cutoff, not the conflicting 8:30 banner. Publication and submission still require separate owner authorization.

The following material is historical preparation and the prior demonstration script. Its earlier pending acceptance statements, test counts, license status and public commits are superseded by the current paragraphs above.

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
