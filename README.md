# SMV — Still My Voice

**Communication, on your terms.** A non-clinical single-switch communication prototype. The journey is compose, inspect, correct, review, then separately approve the exact words for speech.

## Current status

SMV opens with the existing context selector and preserves the message-left, actions-right workspace. Contextual phrases, visible alphabet scanning, spelling/correction, optional Listening and deliberate Expand lead to full silent Review and a separate fresh speech approval. The owner confirmed the exercised microphone transcript/context acceptance, edited audible message, physical speech authorization and Stop. This does not establish reliable interpretation of arbitrary wording; week/weak ambiguity remains inconsistent. [Current project state](docs/PROJECT_STATE.md) and [scoped communication evidence](docs/HP26_RELIABILITY.md).

The canonical public demonstration is **https://stillmyvoice.vercel.app**. Cloud services require Demo access on this exact origin plus fictional-content consent. One real public Gemini expansion and approved voice metadata were verified; audible public TTS, Scribe transcription and the complete physical flow remain pending owner acceptance. The recording preflight's native-fetch binding defect was fixed in `4db5237`; Chrome then reached microphone permission.

Companion setup now offers **Switch-only** (default) and **Eye gaze + switch (Experimental)** inside the main application. Camera activation and 17-point calibration stay in the workspace. Local gaze estimates nominate eligible visible controls; only the existing physical input reducer can confirm one captured target on a matching press/release. Lost, stale, changed or obscured targets cancel held selections. Camera-off returns to switch-only with the draft preserved. Main-app gaze accuracy and physical usability are **not physically verified**. The standalone `/gaze-experiment` route remains diagnostic only; earlier failed rectangle-region trials and owner-observed Left/None/Right behavior do not establish main-app acceptance. [Historical evidence](docs/GAZE_EXPERIMENT.md).

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

Keep dependencies and the project npm cache (`.local-cache/npm`) on the external drive. The existing predev/prebuild preparation generates ignored local gaze assets; a clean preparation downloads the pinned model if absent and verifies its hash. The camera requires explicit Start eye gaze after selecting the experimental input mode in Companion setup. The browser app binds to `127.0.0.1:5173`. Chrome port permission and independently verifying the dedicated CDC2 interface can require companion assistance. Native mouse/keyboard actions are labeled separately from hardware input. Browser speech is available independently of cloud services; offline behavior is unverified.

ElevenLabs and direct Gemini are integrated behind server-only keys, verified local demo gates and explicit fictional-content consent. Run `npm run api` in a second terminal. All six exact voices pass their assigned-model checks; LaSean uses a verified English Flash v2 exception while the other five retain Flash v2.5. Cecily exact phrase playback was owner-confirmed, and the owner reported success for the later complete LaSean/intent physical script. This does not establish audible acceptance for every voice. Optional context and Expand my words preserve authored keywords until deliberate candidate acceptance, silent review and a separate fresh Speak cycle. The exercised actual-microphone, reviewed-context and physical speech sequence has owner confirmation; this is scoped evidence, not acceptance of every voice or arbitrary AI wording. System speech remains independent. See [provider evidence and limits](docs/PROVIDER_SETUP.md). Do not use real private communication in the cloud demonstration.

Gemini has a server-side local allowance of **300 wording requests** by default, configurable with the process-only `SMV_GEMINI_REQUEST_LIMIT`. These are requests, not tokens or a provider-quota entitlement. Before any controlled API restart, read `/api/status` and carry the current `gemini.requests` into `SMV_GEMINI_START_REQUESTS`; never reset consumed usage to zero. The last verified live checkpoint was 21/300 after carrying 20 and completing one deliberate expansion. Five-second spacing, one in-flight request, duplicate protection, free-tier gates and no automatic retry remain. See [quota configuration and live evidence](docs/QUOTA_DIAGNOSTICS.md).

See [intent-first evidence](docs/HP26_INTENT_01.md) and [matched route comparison](docs/INTENT_EFFICIENCY.md). Abbreviated AAC expansion has established precedent in [SpeakFaster (Cai et al., 2024)](https://www.nature.com/articles/s41467-024-53873-3); SMV does not claim to have invented it. Modeled selection savings are distinct from measured physical speed.

## Public demonstration

`npm run build:public-demo` builds the authenticated Vercel API and frontend with optional local gaze, pinned assets and license notices. `npm run preview:public-demo` provides a static local preview, not a serverless API emulator. The existing Vercel project is used; secrets remain server-side, requests need same-origin authorization, and Redis enforces durable shared quotas and replay protection. See [release configuration](docs/VERCEL_FRONTEND_RELEASE.md).

`npm run build:demo` retains a separate static fallback without cloud or camera capabilities. The full local application remains available through the commands above. Source/license metadata records the exact release revision. Normal Git publication and deployment are owner-authorized; automatic Git deployments remain disabled. No further custom-domain work is planned.

## Credits and contributions

SMV's application, deterministic input/session logic, exact-message review and authorization, correction workflow and provider boundaries were developed with owner direction and Codex assistance. Frameworks: React/React DOM 19.3.1 (MIT), Vite 8.3.8 and React plugin 6.3.0 (MIT), TypeScript 7.0.2 (Apache-2.0), Google Gen AI SDK 3.3.0 (Apache-2.0), and DefinitelyTyped definitions (MIT). Runtime/platform services: Node.js, Chromium Web Serial/Web Speech, Raspberry Pi Pico and Adafruit CircuitPython, ElevenLabs and Gemini. These are credited dependencies/services, not original SMV work. See [notices](THIRD_PARTY_NOTICES.md). No clinical benefit, AAC-user validation, general semantic safety or competition ranking is claimed.

The owner selected **AGPL-3.0-or-later** for the combined application. RealEye Webcam EyeTracker Light Open 1.1.0 uses that approved option; MediaPipe Tasks Vision 0.10.18 retains its Apache-2.0 notices. See [LICENSE](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md). Public builds provide corresponding source links and license notices.

The public code repository preserves normal Git history. The owner reports sole team membership, event registration/check-in and code written during the event; this is owner-reported provenance, not an independent originality audit. Devpost remains read-only here; required submission fields and final submission are owner actions.

## Project references

- [Current project state](docs/PROJECT_STATE.md)
- [Architecture and authority boundaries](docs/ARCHITECTURE.md)
- [Protected input and speech-approval contract](docs/INTERFACE_CONTRACT.md)
- [Approved UI direction](docs/UI_SPEC.md) and [detailed specification](docs/UI_SPEC_V2_PROPOSAL.md)
- [Operator acceptance checklist](docs/OPERATOR_CHECKLIST.md)
- [Firmware review, accepted hashes and rollback](docs/FIRMWARE_V2_REVIEW.md)
- [Branding boundaries](docs/BRANDING.md): historical domain notes. Use https://stillmyvoice.vercel.app for the current demonstration.
- [Third-party notices](THIRD_PARTY_NOTICES.md) and [local instruction registry](docs/SKILLS_REGISTRY.md)

This prototype has no clinical validation or accessibility-conformance claim. The public demonstration is deployed; Devpost was last observed as a draft with 3/5 steps complete. Switch-only remains the fallback. A successful build or mocked test does not establish real-camera accuracy, physical usability or audible correctness.
