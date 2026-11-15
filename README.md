# SMV — Still My Voice

**Communication, on your terms.** A non-clinical single-switch communication prototype. The journey is compose, inspect, correct, review, then separately approve the exact words for speech.

## Current status

SMV opens with the existing context selector and preserves the message-left, actions-right workspace. Contextual phrases, visible alphabet scanning, spelling/correction, optional Listening and deliberate Expand lead to full silent Review and a separate fresh speech approval. The owner confirmed the exercised microphone transcript/context acceptance, edited audible message, physical speech authorization and Stop. This does not establish reliable interpretation of arbitrary wording; week/weak ambiguity remains inconsistent. [Current project state](docs/PROJECT_STATE.md) and [scoped communication evidence](docs/HP26_RELIABILITY.md).

An optional, isolated webcam experiment is available at `/gaze-experiment`; normal SMV does not start a camera or use gaze to move scanning. The first pilot failed at **1/30 correct, 29 abstained**. After an interrupted diagnostic and geometry repairs, the latest six-trial run completed with **1 correct, 0 incorrect, 5 abstained**, without a geometry change. The owner observed Left/Right responses; the later tab-switch shutdown was expected. A mapping-only horizontal-band diagnostic with a central uncertainty zone is implemented for prospective testing; off-screen rejection and all stability/worker gates remain. Scanner integration stays disabled; no reliable gaze accuracy or speed benefit is accepted. [Evidence and repeat](docs/GAZE_EXPERIMENT.md).

The owner subsequently observed Left / None / Right after calibration with the new classifier, without completing a formal six-trial run. An isolated charcoal gaze pointer and four-action physical-switch sandbox now exist on the experimental route. The pointer only proposes; a real press captures the target and a matching release performs one fictional action. Production communication never receives gaze selections. Physical pointer/target/switch acceptance is pending. [Sandbox acceptance steps](docs/GAZE_EXPERIMENT.md#next-owner-check-short-sandbox-run-not-30-trials).

The accepted Pico firmware, CDC protocol, input state machine and exact-message authorization remain unchanged. Drafts and authorizations stay in tab memory; reloading clears them. Browser speech remains independent of cloud services. All readable original device files remain preserved privately; `.Trashes` is the sole approved backup exclusion. No CIRCUITPY or wiring changes are part of this checkpoint.

## Run locally

Use the already-installed Node **24.22.1** and npm **11.19.1** for task commands, without changing the global default:

```sh
export PATH="/Users/admin/.nvm/versions/node/v24.22.1/bin:$PATH"
cd '/Volumes/Penuel Back/Development/StillMyVoice'
npm run dev
npm test
npm run typecheck
npm run build
```

Keep dependencies and the project npm cache (`.local-cache/npm`) on the external drive. The existing predev/prebuild preparation generates ignored local gaze assets; a clean preparation downloads the pinned model if absent and verifies its hash. The camera still requires explicit Start eye gaze on the isolated experiment route. The browser app binds to `127.0.0.1:5173`. Chrome port permission and independently verifying the dedicated CDC2 interface can require companion assistance. Native mouse/keyboard actions are labeled separately from hardware input. Browser speech is available independently of cloud services; offline behavior is unverified.

ElevenLabs and direct Gemini are integrated behind server-only keys, verified local demo gates and explicit fictional-content consent. Run `npm run api` in a second terminal. All six exact voices pass their assigned-model checks; LaSean uses a verified English Flash v2 exception while the other five retain Flash v2.5. Cecily exact phrase playback was owner-confirmed, and the owner reported success for the later complete LaSean/intent physical script. This does not establish audible acceptance for every voice. Optional context and Expand my words preserve authored keywords until deliberate candidate acceptance, silent review and a separate fresh Speak cycle. The exercised actual-microphone, reviewed-context and physical speech sequence has owner confirmation; this is scoped evidence, not acceptance of every voice or arbitrary AI wording. System speech remains independent. See [provider evidence and limits](docs/PROVIDER_SETUP.md). Do not use real private communication in the cloud demonstration.

Gemini has a server-side local allowance of **300 wording requests** by default, configurable with the process-only `SMV_GEMINI_REQUEST_LIMIT`. These are requests, not tokens or a provider-quota entitlement. Before any controlled API restart, read `/api/status` and carry the current `gemini.requests` into `SMV_GEMINI_START_REQUESTS`; never reset consumed usage to zero. The last verified live checkpoint was 21/300 after carrying 20 and completing one deliberate expansion. Five-second spacing, one in-flight request, duplicate protection, free-tier gates and no automatic retry remain. See [quota configuration and live evidence](docs/QUOTA_DIAGNOSTICS.md).

See [intent-first evidence](docs/HP26_INTENT_01.md) and [matched route comparison](docs/INTENT_EFFICIENCY.md). Abbreviated AAC expansion has established precedent in [SpeakFaster (Cai et al., 2024)](https://www.nature.com/articles/s41467-024-53873-3); SMV does not claim to have invented it. Modeled selection savings are distinct from measured physical speed.

## Prepared frontend-only public demonstration

`npm run build:demo` produces the proposed static `dist` release; `npm run preview:demo` serves it locally with the proposed security headers and no API proxy. This profile omits experimental gaze assets and disables Listening, Gemini and ElevenLabs before microphone or provider requests. Phrases, spelling, physical input, silent review and separately approved browser speech remain. Browser voices can use a network; offline speech is not guaranteed. The default local development/build commands above retain the full authorized local application.

The proposed Vercel configuration has no API functions, no provider keys and automatic Git deployments disabled. Source/license metadata records the exact Git revision and warns about uncommitted builds. Publish corresponding tested source only after owner approval, verify the source link, then separately approve the exact deployment and DNS changes. See [Vercel preparation](docs/VERCEL_FRONTEND_RELEASE.md). Nothing is deployed by these build commands.

## Credits and contributions

SMV's application, deterministic input/session logic, exact-message review and authorization, correction workflow and provider boundaries were developed with owner direction and Codex assistance. Frameworks: React/React DOM 19.3.1 (MIT), Vite 8.3.8 and React plugin 6.3.0 (MIT), TypeScript 7.0.2 (Apache-2.0), Google Gen AI SDK 3.3.0 (Apache-2.0), and DefinitelyTyped definitions (MIT). Runtime/platform services: Node.js, Chromium Web Serial/Web Speech, Raspberry Pi Pico and Adafruit CircuitPython, ElevenLabs and Gemini. These are credited dependencies/services, not original SMV work. See [notices](THIRD_PARTY_NOTICES.md). No clinical benefit, AAC-user validation, general semantic safety or competition ranking is claimed.

The owner selected **AGPL-3.0-or-later** for the combined application. RealEye Webcam EyeTracker Light Open 1.1.0 uses that approved option; MediaPipe Tasks Vision 0.10.18 retains its Apache-2.0 notices. See [LICENSE](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md). A later authorized release must provide the corresponding tested source and notices.

The official event requires a public code repository and accurate attribution. Public main was last verified at checkpoint [`a0c6491`](https://github.com/iampenuel/stillmyvoice/tree/a0c6491); the current gaze, UI and quota work remains local pending separate publication authorization. The owner reports sole team membership, event registration/check-in and that 100% of their code was written during the event. This is owner-reported provenance, not an independent originality audit; Git history has not been altered. [Release checklist and draft presentation](docs/RELEASE_READINESS.md) track remaining validation, publication and submission work.

## Project references

- [Current project state](docs/PROJECT_STATE.md)
- [Architecture and authority boundaries](docs/ARCHITECTURE.md)
- [Protected input and speech-approval contract](docs/INTERFACE_CONTRACT.md)
- [Approved UI direction](docs/UI_SPEC.md) and [detailed specification](docs/UI_SPEC_V2_PROPOSAL.md)
- [Operator acceptance checklist](docs/OPERATOR_CHECKLIST.md)
- [Firmware review, accepted hashes and rollback](docs/FIRMWARE_V2_REVIEW.md)
- [Branding boundaries](docs/BRANDING.md): `stillmyvoice.club`, registered according to the owner, deployment unconfirmed; no production domain is configured.
- [Third-party notices](THIRD_PARTY_NOTICES.md) and [local instruction registry](docs/SKILLS_REGISTRY.md)

This prototype has no clinical validation or accessibility-conformance claim. It is not deployed or submitted. Devpost remains a read-only-verified draft with 2/5 steps complete and known missing fields. Switch-only communication remains the supported path; gaze is an isolated, unaccepted experiment. A successful build or mocked test does not establish real-camera accuracy, physical usability or audible correctness. [Current release blockers](docs/RELEASE_READINESS.md).
