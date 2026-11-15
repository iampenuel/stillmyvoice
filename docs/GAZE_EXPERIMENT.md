# Optional eye-gaze experiment — November 15, 2026

## Current result and release gate

Implementation status: **Experiment failed, switch-only path preserved.**

The latest owner-operated six-trial run completed all six trials with **1 correct, 0 incorrect and 5 abstained**, no interruptions and no measured geometry changes. The owner observed the Left/Right indicator responding to their eyes, then intentionally changed tabs; the subsequent page-hidden camera shutdown was expected privacy behavior, not a trial tracking failure. Frozen run evidence contains 175 face detections and finite predictions, 128 worker-accepted predictions, a 154.6 ms median prediction interval and 25.7 ms median inference. After orientation, mean raw x was 196.1 px for Left and 1328.8 px for Right in a 1440 px viewport. Twenty worker-accepted predictions were rejected by the rectangle classifier. Horizontal separation is promising, but reliable acceptance is unproven.

A focused mapping-only follow-up opts this isolated route into horizontal viewport bands: Left at x < 40% width, Right at x > 60%, with both boundary values and the central 20% uncertain. Coordinates must remain finite and strictly inside the viewport; there is no nearest-region assignment or off-screen clamping. DOM rectangles remain fixation targets and geometry guards. The 80 px two-dimensional dispersion gate, 600 ms/five-sample acquisition, 800 ms switching hysteresis, freshness, blink and head-movement protections are unchanged. Diagnostic aggregates compare active-band mapping with rectangle mapping and separate raw predictions from worker-accepted predictions. This is a new prospective diagnostic policy, not a rescore of the failed run; physical verification is pending.

The first owner-confirmed real-camera pilot **failed**: **1 correct / 30 trials, 0 incorrect, 29 abstained**. The earlier broad tracking-loss counter recorded 82 lost-state events; these are not evidence of 82 physical camera dropouts. Trial 9, prompted Left, produced the one correct classification at 4,057 ms. All 30 trials remain in the denominator. The 27/30 pilot goal was not met.

The subsequent six-trial diagnostic was **interrupted**, not completed. Its original numeric record is preserved privately at `/private/tmp/SMV_GAZE_INTERRUPTED_RUN.json`. Trial 1, Right, completed its full 4,500 ms interval correctly, stabilizing at 3,162.7 ms. Trial 2, Left, ended after 2,735.7 ms when the viewport changed from 1440 × 756 to 1440 × 812. The old code incorrectly scored that partial interval as an abstention. Correct accounting is **1 completed correct, 1 interrupted, 4 not started: 5 unfinished out of 6**, with no completed incorrect or abstained trial. This is not a six-trial pass or a 1/1 accuracy claim; the saved original record has not been rewritten.

That interrupted run recorded 47 camera frames, 47 face detections and 47 finite raw predictions; 45 raw predictions were in the viewport and 43 passed the worker gates. Reasons were 43 accepted, two blinks and two outside-viewport predictions. No arriving prediction was rejected as stale; median inference was 24.1 ms and median prediction interval 153.9 ms. The old raw-range count of 55 included worker-lifetime predictions before the run, a diagnostic scope defect now corrected to use run-only observations. These counters do not establish reliable region classification.

A later developer Chrome observation reproduced a **56 CSS px browser content-area change** while activating the gaze tab: inner height 812 → 756 with outer height fixed at 812. The `window.resize` event was classified as browser-chrome/content-viewport change, and the screenshot showed the debugging infobar occupying that 56 px. This demonstrates a mechanism of the same magnitude; it does **not** prove the exact cause of the earlier 756 → 812 interruption. The final owner repeat must begin only after browser automation ends, so automation attachment or banner changes do not invalidate an early-started calibration.

Stage A remains isolated at `/gaze-experiment`. Normal SMV has no gaze scanner preference, synthetic input or camera acquisition on load. Stage B is disabled. The focused geometry, interruption-accounting and diagnostic changes below are implemented; 269 tests, typecheck and production build passed. A fresh owner diagnostic after these changes is pending. Neither improved accuracy nor faster communication is claimed. Six diagnostic trials cannot substitute for the required 30-trial acceptance run.

Devpost remains DRAFT, 2/5 steps complete, with required story, tags, repository link, additional-info answers and acknowledgments missing. Current source is local only. If submission is still incomplete at 6:00 AM Eastern, stop experimental development and produce the submission handoff; preserve the earlier detailed-rules 8:00 AM deadline. No push, deployment, DNS change or Devpost edit/submission occurred.

## Isolated implementation and safety

The separate React route owns explicit camera opt-in, hidden-by-default preview and an actual camera-pixel canvas. It requests video only, never microphone. A classic worker runs RealEye away from the interface. Stop terminates initialization, inference or training, stops all tracks and discards ephemeral frame/model/calibration data. Retired permission or initializer results cannot restart the camera or dispose a newer session. Camera denial, unavailable/busy devices, interruption and initialization failure have bounded lifecycle handling.

Page hiding, page exit and true viewport geometry changes stop the camera. Numeric geometry evidence includes inner/outer dimensions, DPR, visual-viewport dimensions/scale/offsets, screen dimensions, fullscreen state, document dimensions, scrolling and target rectangles. Event categories distinguish window sizing, browser content-area changes, zoom, visual viewport, scrolling and app layout without claiming user intent or identifying a toolbar from an event alone. Unchanged geometry does not invalidate calibration; Start, calibration and trial entry require two seconds of settled geometry. A change to actual camera-frame dimensions invalidates the fit and requires a new start/calibration. Preview mirroring is visual only; inference receives the unmirrored camera frame, while predictions use viewport CSS pixels.

Calibration uses the shipped recommended 17-point pattern, five face-present/eyes-open/finite-pose frames per point. After 1.4 seconds to orient, a point advances only when all five samples are accepted. Timed capture does not prove fixation. All 85 samples and successful library fitting are required before tracking. The calibration view keeps a visible Stop control and keyboard focus containment. Calibration re-entry, capture errors, stale asynchronous completions and model timeout cannot acquire speech or input authority.

No gaze module imports the communication model, switch reducer, serial adapter, speech controller or AI runtime. It cannot dispatch a click, DOWN/UP, text, wording approval or speech authorization. The accepted input state machine, CDC protocol and firmware remain unchanged. There is no gaze-assisted physical-switch acceptance or task-efficiency result because scanner integration is not active.

## Post-pilot diagnostic corrections

The failed pilot prompted software diagnosis; these findings do not establish that software timing was its sole cause.

- Freshness polling previously erased bounded sample history while a timestamp-contiguous inference was pending. Polling now expires the visible region immediately when stale without destroying otherwise continuous recent history. Actual excessive capture gaps, null/invalid observations and the bounded history window still clear it.
- Sampling targets a 150 ms start-to-start interval instead of adding another 150 ms after inference. Requests remain serial; no overlapping prediction calls or unbounded loop was added.
- The initial trial orientation interval no longer manufactures a missing-prediction event simply because classification is intentionally withheld.
- Viewport invalidation compares actual geometry; camera-frame size changes independently invalidate calibration.
- Head-pose references and angle differences use circular Euler arithmetic, avoiding a false full-turn movement at the ±π boundary.
- Diagnostics separate camera frames, face detections, finite/in-viewport raw predictions, accepted predictions, stale or unstable filtering, outside-region results and reason counts. They now retain run-scoped raw ranges, worker/filter reason counts, filter transitions/history drops and timing summaries, including p95. Quantiles use the latest 120 observations; moments and maxima cover the run. Raw diagnostic coordinates never bypass the accepted-point gates.
- Trial entry freezes the two target rectangles. Movement beyond 0.5 CSS px interrupts the run separately from viewport invalidation; both targets must be fully visible and the camera preview hidden. Completed trials and interrupted partial trials have separate records and honest unfinished counts.
- Post-fit trial observations now aggregate error from the prompted target center and target box, split by prompt/trial after orientation. These held-out observations do not reuse training images; they still rely on the instructed fixation and do not prove where the owner actually looked. Training reprojection remains separately labeled fit diagnostics.

The stability requirements were **not relaxed**: 600 ms stable span, at least five samples, 80 px dispersion, 350 ms freshness, 800 ms switching hysteresis and a 1,200 ms bounded history remain experimental engineering defaults. The 0.15 rad head-rotation, 0.08 normalized face-center and 20% size-change gates remain provisional. They are not calibrated confidence percentages or clinically validated thresholds.

## Measurement and pending owner repeat

The page maps accepted predictions to two horizontal viewport bands with a central uncertainty zone. The two displayed rectangles are fixation targets frozen at trial-run entry and checked against their current DOM bounds. Plans are balanced and randomized: 15/15 for the 30-trial pilot, or 3/3 for the six-trial diagnostic. Every completed prompt has a fixed 4.5-second interval including 1.4 seconds to orient. The first stable classification is retained, even if incorrect; a fully completed interval with no stable classification abstains. Stop, viewport changes and target movement preserve a separate interrupted partial record, never score it as an abstention, and leave it in the unfinished count. Unstarted trials also remain in the denominator.

Completed/interrupted runs retain frozen trial records, the partial interruption and reason where present, geometry evidence, diagnostic counters and the fit provenance from that run, so continued tracking does not rewrite the evidence. Records include prompted/predicted region, outcome, broad tracking-loss events, stabilization time and start/end times. Calibration provenance includes samples per point, camera and viewport dimensions, fitting duration and training-frame reprojection summaries. Reprojection reuses training images and is explicitly **fit diagnostics, not held-out gaze accuracy**. Images are discarded; numeric summaries remain in tab memory.

Owner repeat, currently pending:

1. Wait for the final handoff after all browser automation ends. Open the prepared `/gaze-experiment` tab, let geometry settle for two seconds, deliberately start the MacBook camera, then complete the 17-point calibration. Keep browser controls, window size and zoom unchanged.
2. With both targets visible and the preview hidden, run the six-trial diagnostic. Inspect frozen completed/partial records, geometry events, worker/filter reasons, timing and held-out target-center errors. Report interruptions and failures as well as successful classifications; do not treat a partial run as six completed trials.
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

The horizontal-mapping follow-up passed **269 tests**, typecheck and production build. The final credential scan compared two private API key values in memory across 153 repository/source/build files and found zero matches. The dependency audit's zero vulnerabilities remain prior-checkpoint evidence; dependencies are unchanged. Mocked tests cover lifecycle/timeout/cleanup, worker cancellation, invalid/stale/null observations, oscillation, geometry/frame changes, circular angles, timing/history interaction, diagnostic accounting and honest trial denominators. These tests do not establish camera accuracy. The failed first owner pilot and the subsequently interrupted diagnostic are real-camera evidence; the fresh repeat after the focused repairs is still pending. Prior switch/Listening/speech acceptance remains inherited and scoped to its exercised pathway.

Chrome inspection verified the Companion setup footer is an underlined neutral text control with **outline: none** when idle/pointer-focused. Genuine keyboard focus uses **2 px solid #252525**, 2 px offset and 2 px corner radius. Its hit target and all actual scanned-button outlines are unchanged.

The separate Gemini allowance correction was live-checked after preserving consumed usage: the last verified local snapshot is **21/300 wording requests**, leaving 279 locally. This is not a daily or upstream remaining-quota guarantee. See [quota evidence](QUOTA_DIAGNOSTICS.md).
