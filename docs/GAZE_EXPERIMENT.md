# Optional eye-gaze experiment — November 15, 2026

## Current result and release gate

Implementation status: **Experiment failed, switch-only path preserved.**

The first owner-confirmed real-camera pilot **failed**: **1 correct / 30 trials, 0 incorrect, 29 abstained**. The earlier broad tracking-loss counter recorded 82 lost-state events; these are not evidence of 82 physical camera dropouts. Trial 9, prompted Left, produced the one correct classification at 4,057 ms. All 30 trials remain in the denominator. The 27/30 pilot goal was not met.

Stage A remains isolated at `/gaze-experiment`. Normal SMV has no gaze scanner preference, synthetic input or camera acquisition on load. Stage B is disabled. Diagnostic repairs described below are implemented and regression-tested, but the owner's new six-trial diagnostic is still pending. Neither improved accuracy nor faster communication is claimed. Six diagnostic trials cannot substitute for the required 30-trial acceptance run.

Devpost remains DRAFT, 2/5 steps complete, with required story, tags, repository link, additional-info answers and acknowledgments missing. Current source is local only. If submission is still incomplete at 6:00 AM Eastern, stop experimental development and produce the submission handoff; preserve the earlier detailed-rules 8:00 AM deadline. No push, deployment, DNS change or Devpost edit/submission occurred.

## Isolated implementation and safety

The separate React route owns explicit camera opt-in, hidden-by-default preview and an actual camera-pixel canvas. It requests video only, never microphone. A classic worker runs RealEye away from the interface. Stop terminates initialization, inference or training, stops all tracks and discards ephemeral frame/model/calibration data. Retired permission or initializer results cannot restart the camera or dispose a newer session. Camera denial, unavailable/busy devices, interruption and initialization failure have bounded lifecycle handling.

Page hiding, page exit and true viewport geometry changes stop the camera. Resize events with unchanged CSS dimensions, device pixel ratio and visual-viewport scale do not falsely invalidate calibration. A change to actual camera-frame dimensions invalidates the fit and requires a new start/calibration. Preview mirroring is visual only; inference receives the unmirrored camera frame, while predictions use viewport CSS pixels.

Calibration uses the shipped recommended 17-point pattern, five face-present/eyes-open/finite-pose frames per point. After 1.4 seconds to orient, a point advances only when all five samples are accepted. Timed capture does not prove fixation. All 85 samples and successful library fitting are required before tracking. The calibration view keeps a visible Stop control and keyboard focus containment. Calibration re-entry, capture errors, stale asynchronous completions and model timeout cannot acquire speech or input authority.

No gaze module imports the communication model, switch reducer, serial adapter, speech controller or AI runtime. It cannot dispatch a click, DOWN/UP, text, wording approval or speech authorization. The accepted input state machine, CDC protocol and firmware remain unchanged. There is no gaze-assisted physical-switch acceptance or task-efficiency result because scanner integration is not active.

## Post-pilot diagnostic corrections

The failed pilot prompted software diagnosis; these findings do not establish that software timing was its sole cause.

- Freshness polling previously erased bounded sample history while a timestamp-contiguous inference was pending. Polling now expires the visible region immediately when stale without destroying otherwise continuous recent history. Actual excessive capture gaps, null/invalid observations and the bounded history window still clear it.
- Sampling targets a 150 ms start-to-start interval instead of adding another 150 ms after inference. Requests remain serial; no overlapping prediction calls or unbounded loop was added.
- The initial trial orientation interval no longer manufactures a missing-prediction event simply because classification is intentionally withheld.
- Viewport invalidation compares actual geometry; camera-frame size changes independently invalidate calibration.
- Head-pose references and angle differences use circular Euler arithmetic, avoiding a false full-turn movement at the ±π boundary.
- Diagnostics separate camera frames, face detections, finite/in-viewport raw predictions, accepted predictions, stale or unstable filtering, outside-region results and reason counts. They also show recent median inference/prediction timing and calibration frame/viewport provenance. Raw diagnostic coordinates never bypass the accepted-point gates.

The stability requirements were **not relaxed**: 600 ms stable span, at least five samples, 80 px dispersion, 350 ms freshness, 800 ms switching hysteresis and a 1,200 ms bounded history remain experimental engineering defaults. The 0.15 rad head-rotation, 0.08 normalized face-center and 20% size-change gates remain provisional. They are not calibrated confidence percentages or clinically validated thresholds.

## Measurement and pending owner repeat

The page maps accepted predictions to two large live-DOM rectangles. Plans are balanced and randomized: 15/15 for the 30-trial pilot, or 3/3 for the new six-trial diagnostic. Every prompt has a fixed 4.5-second interval including 1.4 seconds to orient. The first stable classification is retained, even if incorrect; no stable classification abstains. Missing and uncompleted trials never disappear from the denominator.

Completed/stopped runs retain frozen trial records, diagnostic counters and the fit provenance from that run, so continued tracking does not rewrite the evidence. Records include prompted/predicted region, outcome, broad tracking-loss events, stabilization time and start/end times. Calibration provenance includes samples per point, camera and viewport dimensions, fitting duration and training-frame reprojection summaries. Reprojection reuses training images and is explicitly **fit diagnostics, not held-out gaze accuracy**. Images are discarded; numeric summaries remain in tab memory.

Owner repeat, currently pending:

1. Open `/gaze-experiment`, deliberately start the MacBook camera, then complete the 17-point calibration.
2. Run the six-trial diagnostic and inspect the frozen records, reason counts, timing and calibration provenance. Report failures as well as successful classifications.
3. If the diagnostic justifies proceeding, repeat the full 30-trial pilot. At least 27/30 correct remains the proposed gate, with abstentions included.
4. Stop eye gaze and verify Camera off. Return to switch-only SMV; its established physical selection, silent Review, fresh Speak and Stop remain the communication path.

Do not claim gaze-assisted selection or perform a switch-only/gaze-assisted efficiency comparison until Stage B is safely implemented after usable real-camera evidence. No speed benefit is currently measured.

## Technology, license and local assets

RealEye `@realeye-io/webcam-eyetracker-light-open` **1.1.0** is pinned to npm commit `5ee44e9e0102b1583a9a2539525a89b2726651a9`. Installed declarations and source were inspected. `@mediapipe/tasks-vision` **0.10.18** and matching WASM are pinned. GPU is preferred; a clean CPU instance is attempted if GPU initialization fails.

The owner explicitly approved **AGPL-3.0-or-later** for the combined application. Root LICENSE, THIRD_PARTY_NOTICES and docs/licenses retain the selected license and upstream notices. No commercial, academic or hackathon exemption is assumed. Any later authorized distribution or applicable network use must include the corresponding tested source and notices; the older public checkpoint is not the corresponding source for this local implementation.

Official sources: [RealEye repository](https://github.com/RealEye-io/webcam-eyetracker-light-open), [AGPL option](https://github.com/RealEye-io/webcam-eyetracker-light-open/blob/5ee44e9e0102b1583a9a2539525a89b2726651a9/LICENSE-AGPL.md), [commercial option](https://github.com/RealEye-io/webcam-eyetracker-light-open/blob/5ee44e9e0102b1583a9a2539525a89b2726651a9/LICENSE-COMMERCIAL.md).

`npm run prepare:gaze` prepares ignored `public/gaze` assets: matching installed WASM, a classic IIFE worker and Google's versioned Face Landmarker model, checked against its pinned SHA256. The model is downloaded only during initial preparation if absent; browser configuration uses same-origin model/WASM URLs. Clean preparation needs network access; tested offline capability is not claimed. The library's fixed 0.95 detection value is not shown or used as measured gaze confidence.

There is no camera recording, persistent calibration storage, image upload, Scribe consent coupling, Gemini call or ElevenLabs call in this route. Frame and model data stay in memory and are discarded on Stop. Trial/diagnostic rows remain only in the current tab unless the owner deliberately retains them privately.

## Verification and footer correction

The current complete suite has **243 passing tests**, with typecheck and production build passing. The security audit reported zero vulnerabilities; the credential check compared two private keys in memory across 151 files and found zero matches. Mocked tests cover lifecycle/timeout/cleanup, worker cancellation, invalid/stale/null observations, oscillation, geometry/frame changes, circular angles, timing/history interaction, diagnostic accounting and honest trial denominators. These tests do not establish camera accuracy. The failed first owner pilot is real-camera evidence; the repaired six-trial repeat is still pending. Prior switch/Listening/speech acceptance remains inherited and scoped to its exercised pathway.

Chrome inspection verified the Companion setup footer is an underlined neutral text control with **outline: none** when idle/pointer-focused. Genuine keyboard focus uses **2 px solid #252525**, 2 px offset and 2 px corner radius. Its hit target and all actual scanned-button outlines are unchanged.

The separate Gemini allowance correction was live-checked after preserving consumed usage: the last verified local snapshot is **21/300 wording requests**, leaving 279 locally. This is not a daily or upstream remaining-quota guarantee. See [quota evidence](QUOTA_DIAGNOSTICS.md).
