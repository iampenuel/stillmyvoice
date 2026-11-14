# Protected input and authorial-control requirements

HP26-SW-00 records requirements only. No public API, wire protocol, application types, state machine, or speech controller is implemented or finalized here.

## Physical input and selection

- Use one deliberate press-and-release with automatic scanning. No double-tap or hold command; holding never repeats.
- A valid DOWN captures the visible target's identity and relevant UI/draft revision and pauses scanning. Only its matching valid UP commits that captured target, once, if still valid.
- Cable loss, focus/visibility loss, stale session, malformed transport, reload, queue failure, or invalid UI state cancels pending input. None manufactures UP, a selection, or approval.
- Recovery establishes current released/armed state before new actions. Reconnect and retry never replay a stale selection.
- AI arrivals and gaze estimates cannot move or replace a captured target, reorder selectable choices during a press, or overwrite an edited/approved utterance.
- Native pointer/keyboard behavior must remain semantic and must not cause duplicate activation with the physical switch. Keyboard simulation is not hardware validation.

## Review and speech authorization

- Selecting wording or entering Review never speaks. Show the full exact utterance without truncation, with switch-operable reading/paging when needed.
- Require a fresh separate deliberate press-and-release on the approval action after review. Freeze the exact full text and its revision for speech.
- Editing invalidates approval. Late AI output, reconnect, retry, or reload cannot replace or silently replay approved speech.
- Resume only resumes scanning; it cannot select a hidden pending target. Stop speech is directly accessible without extra confirmation.
- Keep Back, Undo, Pause/Resume, Stop, phrase/spelling entry, targeted correction, and rejection operable through the same switch. The user can reject every AI proposal and communicate without AI.

## Optional inputs, privacy, and boundaries

- Microphone off by default; no always-on recording or autonomous answer. Listening, if later implemented, requires explicit activation, consent, and correctable/discardable transcript handling.
- Gaze estimates broad regions only and never authorizes speech. A complete switch-only route remains available; loss or reacquisition must not select anything.
- Preserve original input and drafts through navigation and understandable failure recovery. AI proposes data only and cannot own navigation or authorization.
- Keep drafts/transcripts out of URLs, analytics, public logs, screenshots shared publicly, and the repository. Future API keys remain server-side.
- This is a non-clinical prototype, without patient tests, validated benefits, clinical accuracy, or automated-score-based conformance claims.

## Later transport candidate and acceptance scenarios

Dedicated USB CDC + Web Serial is the first candidate; HID is a conditional fallback. The diagnostic currently prints console events and implements neither. Do not modify firmware or finalize a wire schema in this task.

A separately authorized integration task must demonstrate exactly one real browser selection per valid physical cycle and cancellation on interrupted holds, lost focus, disconnection, reload, malformed input, duplicate/stale events, and session change. Reconnection must rearm without fabricated release or replay. Browser/OS permission setup may need assistance and must be disclosed. Later speech checks must distinguish authorized API calls from actually heard audio.
