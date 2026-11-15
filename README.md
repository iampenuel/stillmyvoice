# SMV — Still My Voice

**Communication, on your terms.** A non-clinical single-switch communication prototype. The journey is compose, inspect, correct, review, then separately approve the exact words for speech.

## Current status

The final demonstration checkpoint opens with the existing context selector and keeps the same communication workspace across all contexts. Contextual phrase sets share Stop/Help and unrestricted spelling. Phrases, Spell, Listen and Expand are directly visible; optional AI wording preserves the original until chosen, then enters complete silent review before a fresh speech approval. [Current implementation and scoped evidence](docs/HP26_FINAL_DEMO.md).


ACCESS-02 adds an experimental all-letter row-column keyboard with grouped fallback and optional consent-based, bounded Scribe v3 Listening. Transcripts are reviewed as context, never inserted as authored words. The owner reported that the complete LaSean/intent physical script at `18b92a6` worked; this covers that exercised flow, not the new microphone/combined workflow. [Implementation and physical script](docs/HP26_ACCESS_02.md).

The latest local UI follow-up gives letters stable individual boundaries in both scanning stages and keeps Space, Delete, Expand and Review in a compact action area. Browser checks passed at 1440×756 and 1024×672 with all letters and actions visible and no page scroll. Narrow 390×844 and actual Chrome 200% zoom reflow preserve access through necessary vertical scrolling without horizontal overflow. These are browser observations; physical acceptance of the new keyboard and microphone/combined workflow remains pending. [Current release status](docs/RELEASE_READINESS.md).

The React + TypeScript + Vite workspace implements phrase categories, grouped spelling, occurrence-specific correction, Undo, deliberate clear, Pause/Resume, complete exact-text review, browser voice settings, fixed-sample preview, and stationary Stop. Drafts and authorizations stay in tab memory; reloading clears them.

The approved Pico v2 firmware and dedicated CDC2 input passed SW-01 diagnostic acceptance. The owner subsequently confirmed physical navigation, silent review, separate approval, audible exact speech and editing with corrected-wording playback. The historical combined transport-fault reason remains unproven; targeted cleanup and diagnostic fixes remain in place. See [communication evidence](docs/HP26_SW_02A.md).

The UX-03 / SESSION-01 checkpoint adds matching stable desktop panels, responsive reflow, quick phrases, direct editing controls and safe foreground recovery. Temporary inactivity preserves the draft/correction, cancels input and speech authority, then attempts a fresh handshake with the same verified port. A fresh Resume is required. The owner confirmed the released-switch focus-return scenario; other interruption scenarios remain separately scoped; [results and exact repeat instructions](docs/HP26_UX_03_SESSION_01.md) distinguish automated, browser and physical evidence.

The accepted input/firmware sources are unchanged. All readable original device files and subsequent approved snapshots remain preserved privately; `.Trashes` is the sole approved exclusion, so no complete full-volume backup is claimed. Do not write to CIRCUITPY or alter wiring for this task.

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

Keep dependencies and the project npm cache (`.local-cache/npm`) on the external drive. The browser app binds to `127.0.0.1:5173`. Chrome port permission and independently verifying the dedicated CDC2 interface can require companion assistance. Native mouse/keyboard actions are labeled separately from hardware input. Browser speech is available independently of cloud services; offline behavior is unverified.

ElevenLabs and direct Gemini are integrated behind server-only keys, verified local demo gates and explicit fictional-content consent. Run `npm run api` in a second terminal. All six exact voices pass their assigned-model checks; LaSean uses a verified English Flash v2 exception while the other five retain Flash v2.5. Cecily exact phrase playback was owner-confirmed, and the owner reported success for the later complete LaSean/intent physical script. This does not establish audible acceptance for every voice. Optional context and Expand my words preserve authored keywords until deliberate candidate acceptance, silent review and a separate fresh Speak cycle. Scribe and transcript-plus-keyword Gemini calls have developer-controlled fictional evidence; actual microphone and combined physical acceptance remain pending. System speech remains independent. See [provider evidence and limits](docs/PROVIDER_SETUP.md). Do not use real private communication in the cloud demonstration.

See [intent-first evidence](docs/HP26_INTENT_01.md) and [matched route comparison](docs/INTENT_EFFICIENCY.md). Abbreviated AAC expansion has established precedent in [SpeakFaster (Cai et al., 2024)](https://www.nature.com/articles/s41467-024-53873-3); SMV does not claim to have invented it. Modeled selection savings are distinct from measured physical speed.

## Credits and contributions

SMV's application, deterministic input/session logic, exact-message review and authorization, correction workflow and provider boundaries were developed with owner direction and Codex assistance. Frameworks: React/React DOM 19.3.1 (MIT), Vite 8.3.8 and React plugin 6.3.0 (MIT), TypeScript 7.0.2 (Apache-2.0), Google Gen AI SDK 3.3.0 (Apache-2.0), and DefinitelyTyped definitions (MIT). Runtime/platform services: Node.js, Chromium Web Serial/Web Speech, Raspberry Pi Pico and Adafruit CircuitPython, ElevenLabs and Gemini. These are credited dependencies/services, not original SMV work. See [notices](THIRD_PARTY_NOTICES.md). No clinical benefit, AAC-user validation, general semantic safety or competition ranking is claimed.

The official event requires a public code repository and accurate attribution. Public main is verified at checkpoint [`c1da080`](https://github.com/iampenuel/stillmyvoice/tree/c1da080); the newer UI/diagnostic follow-up remains local pending publication. The owner reports sole team membership, event registration/check-in and that 100% of their code was written during the event. This is owner-reported provenance, not an independent originality audit; Git history has not been altered. [Release checklist and draft presentation](docs/RELEASE_READINESS.md) track remaining validation, publication and submission work.

## Project references

- [Current project state](docs/PROJECT_STATE.md)
- [Architecture and authority boundaries](docs/ARCHITECTURE.md)
- [Protected input and speech-approval contract](docs/INTERFACE_CONTRACT.md)
- [Approved UI direction](docs/UI_SPEC.md) and [detailed specification](docs/UI_SPEC_V2_PROPOSAL.md)
- [Operator acceptance checklist](docs/OPERATOR_CHECKLIST.md)
- [Firmware review, accepted hashes and rollback](docs/FIRMWARE_V2_REVIEW.md)
- [Branding boundaries](docs/BRANDING.md): `stillmyvoice.club`, registered according to the owner, deployment unconfirmed; no production domain is configured.
- [Third-party notices](THIRD_PARTY_NOTICES.md) and [local instruction registry](docs/SKILLS_REGISTRY.md)

This prototype has no clinical validation or accessibility-conformance claim. It is not deployed or submitted. Optional Listening is implemented pending actual microphone and combined physical acceptance; gaze remains deferred. The latest local follow-up passed 157 tests, typecheck, build and credential scanning; its publication remains pending. A successful build or synthetic test is not evidence of real physical or audible success.
