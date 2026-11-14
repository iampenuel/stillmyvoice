# UI/UX direction and approval status

This is a coordination contract, not a rendered design, approved token sheet, or implemented interface. UI/UX owns visual specifications, layout, copy, and review; admin owns scope. Engineering preserves the [input/approval contract](INTERFACE_CONTRACT.md).

## Locked direction

StillMyVoice is an original adult communication workspace. Borrow principles: OpenAI's direct task access and restrained chrome; Apple's hierarchy, continuity, agency, feedback, and recovery; Uber's labeled controls, legibility, spacing consistency, and operational clarity. Do not copy logos, proprietary font files, brand assets, or complete layouts. A system font is acceptable.

The prior screenshot's functional simplicity was approved; its styling was rejected. It is a critique reference, not a pixel target. Avoid the oversized task heading, nested rounded panels, excessive bold text, duplicate status badges, and ambiguous actions. No new mockup or pixel-level critique occurred in HP26-SW-00.

- Let message content dominate the title and brand. Use explicit labels and stable, predictable actions.
- Keep authored text, AI proposals, selected wording, approval, and playback distinguishable. Scan focus never means recommendation or correctness.
- Distinguish scan focus, held input, selected wording, approval, playback, error, and unavailability using more than color alone.
- No assistant chat transcript, decorative gradients/glows, particles, floating assistant, glass behind message text, fake confidence metrics, or forced AI branding.
- No EDEN/Our Ground assets or assumptions; no authentication, dashboard, mandatory welcome page, or medical questionnaire.
- Preserve full utterances and switch-operable correction, rejection, reading, navigation, Pause/Resume, and Stop.

## Proposals awaiting owner approval

- Light neutral opaque reading surfaces, near-black primary text, restrained secondary text; exact palette and accent remain open.
- One readable font family. Starting hypotheses: message 32–40 CSS px; major choices 22–28 CSS px, adjusted through actual viewport/access testing.
- A small shared spacing, radius, and typography system. Prefer alignment and whitespace; keep boundaries when they clarify actionable targets.
- Persistent readable message area, contextual choices, predictable navigation, and compact truthful status. Persistence must not prevent zoom or reflow.
- Immediate scan/press feedback; optional approximately 120–180 ms transitions for noncritical changes. No movement, scaling, reordering, or delayed availability of active targets.
- Respect reduced motion while retaining functional highlights. No typewriter utterances, looping shimmer, parallax, confetti, or bouncing controls.

These are design hypotheses, not universal clinical settings. Exact layout, labels, scan order, tokens, and state treatments require UI/UX review before implementation.

## Planned states and later checks

States: Compose, Generating, Suggestions, Repair, Review, Speaking, Settings, Recovery. Listening and gaze controls appear only when actually implemented. Generating must preserve the draft and allow cancellation/non-AI continuation. Review displays every word; Speaking retains approved text and an accessible Stop.

Later checks use [WCAG 2.2](https://www.w3.org/TR/WCAG22/) as a reference: 4.5:1 ordinary-text contrast; 3:1 qualifying large text and relevant nontext information as applicable; visible unobscured focus; semantic buttons and keyboard access; 200% text/zoom and narrow-width reflow. Ordinary 24/44 CSS-pixel pointer-target criteria are not gaze-target specifications. Do not announce every scan tick. Automated scores alone do not establish conformance or clinical accessibility.

Start ordinary transitions with CSS in the later authorized build. MotionSites is a catalog/reference source, not a selected installation. Motion for React is separate and remains a candidate only. Any later graphics experiment requires a specific approved purpose, measured performance, static/no-WebGPU fallback, reduced-motion support, and no critical-state or speech-authorization role.
