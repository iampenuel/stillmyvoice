# SMV — Still My Voice

**Communication, on your terms.** A non-clinical single-switch communication prototype. The journey is compose, inspect, correct, review, then separately approve the exact words for speech.

## Current status

The React + TypeScript + Vite workspace implements phrase categories, grouped spelling, occurrence-specific correction, Undo, deliberate clear, Pause/Resume, complete exact-text review, browser voice settings, fixed-sample preview, and stationary Stop. Drafts and authorizations stay in tab memory; reloading clears them.

The approved Pico v2 firmware and dedicated CDC2 input passed SW-01 diagnostic acceptance. The owner subsequently confirmed physical navigation, silent review, separate approval, audible exact speech and editing with corrected-wording playback. The historical combined transport-fault reason remains unproven; targeted cleanup and diagnostic fixes remain in place. See [communication evidence](docs/HP26_SW_02A.md).

The UX-03 / SESSION-01 checkpoint adds matching stable desktop panels, responsive reflow, quick phrases, direct editing controls and safe foreground recovery. Temporary inactivity preserves the draft/correction, cancels input and speech authority, then attempts a fresh handshake with the same verified port. A fresh Resume is required. Owner visual review and physical acceptance of this updated lifecycle remain pending; [results and exact repeat instructions](docs/HP26_UX_03_SESSION_01.md) distinguish automated, browser and physical evidence.

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

Isolated ElevenLabs/Gemini server work is in progress and not yet wired into the UI. Both credentials are present privately and Git-ignored; live requests remain disabled pending account protections. No real provider request or expense is claimed. Gemini is restricted to a confirmed no-billing free-tier project and fictional examples. See [provider setup and current integration limits](docs/PROVIDER_SETUP.md). Do not use real patient/caregiver content for free-tier demonstrations.

## Project references

- [Current project state](docs/PROJECT_STATE.md)
- [Architecture and authority boundaries](docs/ARCHITECTURE.md)
- [Protected input and speech-approval contract](docs/INTERFACE_CONTRACT.md)
- [Approved UI direction](docs/UI_SPEC.md) and [detailed specification](docs/UI_SPEC_V2_PROPOSAL.md)
- [Operator acceptance checklist](docs/OPERATOR_CHECKLIST.md)
- [Firmware review, accepted hashes and rollback](docs/FIRMWARE_V2_REVIEW.md)
- [Branding boundaries](docs/BRANDING.md): `stillmyvoice.club`, registered according to the owner, deployment unconfirmed; no production domain is configured.
- [Third-party notices](THIRD_PARTY_NOTICES.md) and [local instruction registry](docs/SKILLS_REGISTRY.md)

This prototype has no clinical validation or accessibility-conformance claim. It is not deployed or submitted. Optional transcription, premium voices, Gemini UI integration and release acceptance remain unfinished. A successful build or synthetic test is not evidence of real physical or audible success.
