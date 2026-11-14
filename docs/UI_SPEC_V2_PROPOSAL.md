# StillMyVoice UI UX Specification Proposal v2

Checkpoint review, November 14, 2026 (HP26-RECOVERY-02 → HP26-SW-01): the user explicitly approved the adaptive message-left/interaction-right workspace, restrained design principles, contextual correction, unrestricted spelling fallback, visible scan focus, distinct held/selected states, and separate final speech approval. This specification is now checkpointed for that direction. Exact dimensions (including the 44/56 starting ratio), timings, shortcut vocabulary, interaction-count estimates, and rendered accessibility remain provisional and untested. The screenshot/research observations below belong to the original design handoff; this checkpoint reviewed the document and protected contract, not those original artifacts or physical behavior. The current engineering authorization permits a dependency-free input kernel while storage is low; it does not establish a working browser transport.

Status: overall UI/UX architecture approved by the user as the preferred implementation direction, subject to the three focused revisions recorded here, November 14, 2026. Baseline repository commit: `f2cb6c762fa8878ddd3e260323049190f1946bea`. The adaptive 44/56 layout, message-first hierarchy, restrained palette, stable targets, and distinct states are retained. Contextual correction choices, detailed navigation behavior, timings, dimensions, and indicator treatments below are proposed and untested; selection counts are predictions and contrast ratios are calculations, not browser or physical-switch results. This document does not alter the [protected interaction contract](INTERFACE_CONTRACT.md). This task changes the specification only; engineering is proceeding separately with physical-switch-to-browser integration, as reported by the user.

Use a persistent message region on the left and a changing interaction region on the right. The message remains the visual anchor; the right region contains the next useful choices. Selecting wording enters Review. Only a separate, fresh approval of the exact text starts speech.

The supplied description calls the preferred image the second concept. In this upload, the two-column concept is Image #1, filename ending `09_39_42 PM.png`. Image #2, ending `09_39_54 PM.png`, is stacked. This proposal follows the explicitly preferred two-column organization.

## Screenshot assessment

| Reference | Preserve | Change and reason |
| --- | --- | --- |
| Two-column image | Persistent authored message; adjacent alternatives; visible correction and route to review; large readable targets. | The large product heading competes with the utterance. Nested Suggestions, Repair, and Review panels repeat the structure without adding useful selection boundaries. Remove the decorative window frame, shadows, sparkle, four-stage tracker, duplicate Review card, and duplicate original-text strip. Keep individual choice boundaries. |
| Two-column image | The draft remains visible while alternatives are considered. | The blue outline and empty radio circle do not explain whether the first suggestion is scanned, chosen, or recommended. Remove radio styling; distinguish a temporary scan outline from an accepted wording label. The tracker also suggests a linear workflow despite editing and backtracking. |
| Stacked image | Message prominence; broad choices; compact access to some navigation. | The green speaker-icon “Use this suggestion” button can imply immediate speech. Replace selection-plus-generic-CTA with an explicit “Review this wording” action on the candidate itself. Its six-item bottom bar is crowded, mixes states, and does not explain scanning order. Remove imitation macOS traffic-light controls. |
| Both | Adult language, strong message legibility, limited number of suggestions. | Reduce pervasive heavy weights, rounded enclosing panels, status pills, and repeated instructions. “Switch ready” must be derived from a working transport and armed state, not a mockup label. Neither image establishes a scan route or recovery behavior. The promise that alternatives “keep your meaning” is also too strong: even changing “I need” to “Please give” can alter tone or force. Use the neutral heading “Suggested wording.” |

Two columns are the stronger desktop starting point because the source and proposed wording can be compared without moving the person's message to another screen. This is a design judgment, not a measured efficiency finding. The stacked image contributes a useful responsive pattern: message first, choices below, with fewer simultaneous controls.

The app-specific [OpenAI guidance](https://developers.openai.com/blog/designing-delightful-frontends-with-gpt-5-4) supports a primary workspace with restrained chrome. [Apple's principles](https://developer.apple.com/design/human-interface-guidelines/design-principles.md) support agency and recovery. [Uber's Base Web explanation](https://www.uber.com/us/en/blog/introducing-base-web/) supports shared tokens and predictable components. These inform the proposal without importing those companies' assets or component frameworks.

## A Workspace architecture

### Message and authorship

The left region has a small provenance label, the actual words, and one truthful speech-status line. It is a reading surface, not a collection of cards. The right region has a short state heading, relevant targets, and a navigation row. Brand text is small and appears once.

Keep these concepts separate without exposing engineering terminology in the product:

- Original words: the user's authored draft at the time assistance was requested. Preserve this source while candidates are considered.
- Suggestions: at most two alternatives. They never replace the original by merely arriving or receiving scan focus.
- Working wording: text explicitly chosen by the user, including later corrections. Selecting a suggestion visibly transitions to Review and changes the provenance label.
- Reviewed wording: the exact complete current working text. Entering this state grants no speech permission.
- Approved wording: a frozen copy authorized by a fresh complete switch cycle. Any edit invalidates that authorization.

Use labels such as “Your words,” “Suggestion selected,” “Your edited wording,” and “Review before speaking.” Under the text use “Not spoken,” “Awaiting approval,” “Preparing speech,” “Speaking,” “Speech stopped,” or “Playback finished” only when supported by actual state. “Not spoken” applies only when the current wording has not begun playback in this message's history. Returning to previously played wording instead says “Previously played. Approval required to speak again.” An interrupted playback must not be relabeled as never spoken. Playback finishing does not prove that someone heard it. Never label an utterance “Delivered.”

The original remains directly available in Suggestions and through the message reader after a candidate is chosen. Reading the original does not make it the selected wording. No comparison view silently changes what will be spoken.

### Desktop and responsive layout

| Property | Proposed value or behavior |
| --- | --- |
| Main width | Maximum 85 rem, centered; 24 px page margins at ordinary desktop size. |
| Columns | 44% message / 56% interaction after subtracting a 24 px gap. |
| Two-column eligibility | At least 64 rem equivalent usable viewport width, with message region at least 26 rem and interaction region at least 30 rem at the chosen text scale. If either minimum fails, stack. |
| Narrow layout | Message first, current interaction next; 16 px side margins and 24 px separation. Keep the same target IDs and logical order. |
| Vertical layout | Normal document flow. No fixed-height app that clips text, and no fixed footer covering targets. A message region may remain visually anchored only while it fits without obscuring content. |
| Reading width | Up to 34 characters per line for large message text; natural wrapping. Do not shrink text to fit a sentence. |
| Enlargement | Text-size settings scale typography and controls. Re-evaluate column eligibility from actual space at that scale; a viewport breakpoint alone is insufficient. |

The 13-inch MacBook is the initial hardware target, but its actual browser viewport and display scaling still need measurement. Validate at the measured viewport, then at 200% zoom and a 320 CSS-pixel equivalent width. Allow vertical scrolling; do not require horizontal scrolling for this interface. These checks follow the relevant [WCAG 2.2 contrast, resize, and reflow criteria](https://www.w3.org/TR/WCAG22/).

There is one scanner, not a separate scanner for each column. Routine right-region choices need no extra “select this column” activation. “More controls → Read message” enters the reading route. Returning restores the caller's “More controls” target; it does not require selecting a column again.

If a newly scanned control lies below the viewport, reveal it immediately before arming that target; do not animate the scroll. During a held press, preserve the captured target's geometry, or cancel pending input if a resize/reflow makes that impossible. After resize, zoom, or text-scale changes, pause and require Resume after the new layout is stable. No release may act on a target at its former coordinates. During speech or voice preview, an access-invalidating reflow instead requests speech cancellation and keeps Stop available until playback stops; never replace Stop with Resume while audio remains active.

### Full-message reading

Keep one exact text value independent of its visual pages. When the complete utterance does not fit at the chosen size, present contiguous readable parts with a small “Part 1 of 3” indicator. Break at rendered word/line boundaries; preserve all text and whitespace in the underlying utterance. A very long token may wrap visually without changing its characters. No ellipses or line clamping.

The dedicated reader offers “Next part,” “Previous part,” “Read original words” or “Read selected wording” when a comparison exists, “Return,” and “Pause scanning,” in that order, skipping unavailable targets. Initial target: Next part, otherwise Return. Reading pages does not edit wording or approve speech. Return restores the calling state and target.

For Review, use the stricter page behavior specified in “Long-message Review” below: present every part of the current text revision before making final speech approval available. Passive reading of the original does not count as review of different working wording. Presentation proves neither reading nor understanding and grants no permission to speak. If the message fits, there is no extra reading selection.

## B Single switch navigation

### Common rules

One selection means one deliberate valid DOWN/UP pair. A DOWN captures the current target identity and relevant revision and pauses scanning. Its matching valid UP commits that target once. A hold never repeats. Every transition invalidates the prior capture; a release that caused a transition cannot activate anything in the next state.

Use individual scanning for short action lists and row-then-item scanning for the spelling keyboard. These are forms of indirect selection described by [ASHA's AAC selection guidance](https://www.asha.org/practice-portal/professional-issues/augmentative-and-alternative-communication/); the particular grouping and timings here are project proposals.

- Proposed scan interval: 1.6 seconds per target. On first entering a new state or group, leave the initial target highlighted for 2.4 seconds. These are adjustable trial defaults, not a clinical recommendation.
- Repeat the list indefinitely. Missing a target causes another pass, not a selection or a timeout-based decision.
- Tables below give visual/DOM scan order. Start at the first available target unless a return rule names another target. Do not move DOM keyboard focus on every scan tick; show a separate functional scan indicator and retain normal keyboard access.
- Unavailable targets are explained visibly and skipped. Their availability and target list change only at a released, stable scan boundary. Never remove or repurpose a held target.
- Back restores the previous navigation context, page/group, and triggering target while preserving the current authored draft. Only the explicitly uncommitted Repair replacement buffer is discarded by its Back action. If the prior target no longer exists, restore the nearest surviving predecessor; otherwise the first available target. Review returns are special: no old approval is restored.
- Ordinary mistakes have a Back or Undo route. A late AI result never replaces an edited draft, a paused menu, a captured target, or approved text.

Deliberate pointer or keyboard navigation pauses automatic scanning and cancels any pending switch capture. Normal keyboard controls remain usable. Resuming never activates whichever element happened to receive keyboard focus. Any pointer/keyboard rescue during a claimed switch-only trial must be recorded.

### Utilities and stationary controls

“More controls” opens a short list in this order: Undo, Read message, Settings, New message, Pause scanning, Back. Omit New message outside Compose, Suggestions, or Review; skip Undo when there is no applicable edit. Back closes the menu and restores its caller. Reader and Settings are temporary destinations; returning from them restores the caller directly at More controls.

Undo reverses one authored change: a phrase/character edit in Compose, one buffer edit during Repair, or the latest applied correction in Review. It does not undo speech, select another AI candidate, or restore speech approval. The original source of an assistance round stays intact. Settings and passive reading do not expose an Undo that changes the draft underneath them.

New message opens “Keep message” then “Clear message,” with Keep message highlighted first. Clear is a separate deliberate selection, returns to empty Compose, and retains the cleared draft in the session's undo history. No automatic clearing occurs after speech.

The ordinary three-selection round trip is **More controls → Pause scanning → Resume scanning**: two selections to stop automatic scanning, then one later selection to restart it. It is not three selections just to pause, nor a special press pattern. This placement avoids another permanent target in every short action list, at the cost of menu traversal and scan waiting. Its acceptability is untested; do not infer low effort from the count alone.

| Starting context | Pause/Resume route and predicted selections | Return after Resume |
| --- | --- | --- |
| Ordinary state, including Review or the Repair word list | More controls → Pause scanning → Resume scanning: 3 total. | Close the utility menu; restore its caller, unchanged text/page, at More controls for a full initial dwell. |
| Keyboard root | Navigation → Pause scanning → Resume scanning: 3 total. | Restore the Navigation submenu at Pause scanning for a full initial dwell; its next scan target is More controls. No character is inserted. |
| Already inside More controls or keyboard Navigation | Pause scanning → Resume scanning: 2 total. | Use the corresponding return rule above. |
| Dedicated message reader | Pause scanning → Resume scanning: 2 total. | Same text and part; resume at Pause scanning, then continue the reader's cyclic order. |

Pause keeps the message visible and replaces active controls with the single stationary Resume target. Preserve the editing buffer and, within the same Review visit and pagination, the part-presentation record. There is no timeout, automatic page advance, or automatic resume. A fresh complete cycle on Resume only restarts scanning; its release cannot select the restored target. Pending AI results remain staged while paused. A held DOWN merely suspends scanning for its captured action and is not a Pause command. Speech uses the distinct Stop route below, never this menu.

During speech, the sole active switch target is a stationary “Stop speaking.” There is no scan delay to reach Stop and no confirmation after selecting it. A press begun as Stop cannot become a selection if speech finishes before its release. Speaking has no Pause-scanning command because its target is already stationary. The single switch is devoted to Stop during playback; inspect long-message parts before or after speech. Keep the approved text visible without karaoke highlighting or automatic scrolling that depends on unverified word-boundary events.

### State specification

| State | Information and exact target order | Entry and transitions | Back and important failures |
| --- | --- | --- | --- |
| Compose | Left: Your words and the truthful playback status above. Right: Phrases → Spell → Get suggestions → Review message → More controls. Skip Get suggestions and Review for empty input; explain unavailable AI without blocking other routes. | Empty entry starts Phrases. Phrases or spelling changes the authored draft. Returning after a completed entry starts Review message if nonempty, without entering Review automatically. Get suggestions preserves a source snapshot and enters Generating. Review message enters Review directly. | This is the root workspace. Undo and New message are in More controls. AI absence never disables phrase/spelling entry or review. |
| Generating | Left: unchanged source. Right: “Preparing suggestions” and Back to composing → More controls. No fake percentage or streaming candidates. | Initial target Back to composing; it cancels the request and returns to the same draft. A valid result may transition to Suggestions only at the end of a scan cycle while released, with the request still current and this state still active. Start the new list with a full initial dwell. | If paused or in another menu, stage the result. Stale/cancelled results are discarded. Timeout, malformed, or empty result enters the AI recovery route without changing the source. |
| Suggestions | Left: Your words. Right: candidate 1 → candidate 2 → Review my original words → Edit original words → Back → More controls. A single valid candidate occupies its original position; no empty second option. | Initial target candidate 1; this is scan focus, not recommendation. Each candidate is itself a button containing its full wording and a small “Review this wording” label. One selection chooses that wording and enters Review. Review my original words rejects both alternatives and enters Review of the source. | Back returns to Compose with the original draft and cancels this assistance round; start at Get suggestions. Edit original words opens Repair for that source with Compose as its return destination; applying the edit ends this assistance round. Returning to Suggestions from unedited Review restores the action that opened Review. |
| Repair | Left: current text with the selected word distinctly marked. Right: words 1–5 of the current page → Next words → Previous words → Back → More controls. Word labels retain source order and identify repeated occurrences by position. | Start at the first displayed word. Selecting a word opens the replacement editor: supported contextual quick replacements, then the existing keyboard groups, as specified below. Spelling remains unrestricted, including several words. A later page adds one Next words activation per page. A quick replacement or spelled Apply changes only the selected span and returns to the originating Compose or Review state, marks the change, and invalidates approval. | Back before editing returns to the caller unchanged. Keyboard Back cancels only its uncommitted replacement buffer and returns to the chosen word. Undo reverses a buffer edit or an applied correction at the appropriate level. No model call is required. |
| Review | Left: exact current utterance and provenance; truthful playback history and review-progress status. Right: Next part → Previous part → Speak this message → Make changes → Back → More controls. For a repeat playback, label the same approval target “Speak this message again.” Keep paging/approval slots stable; skip unavailable controls. | Follow the full process below. For one part, start the speech-approval target only after the complete text is presented. For longer text, start Next part; approval is unavailable until every part is presented and ordinary speech/input prerequisites are valid. On the last part, start Previous part; approval follows. A fresh cycle on approval freezes the full utterance and enters Speaking. Make changes enters Repair. | Back and Make changes remain available on every part, including before approval is available. Before corrections, Back returns to the source choice/Compose route. After a correction, Back returns to Compose with corrected wording, not stale AI candidates; the source remains readable until the next assistance round. No exit, page change, or Resume approves speech. |
| Speaking | Left: frozen approved words. Right: Stop speaking, stationary. Status distinguishes speech pending from actual playback. | Start Stop immediately after authorization, including while the browser is preparing output. Stop cancels queued and active speech. On end/stop, retain the words and enter a completion substate: Review again → Edit wording → New message. | Completion starts Review again. A repeat utterance therefore requires Review again and then a fresh Speak cycle. Speech failure enters Recovery. Losing the only usable input or document focus requests speech cancellation and never auto-resumes; verify the browser behavior with engineering. |
| Settings | Left: current message retained. Right: Scan pace → Text size → Voice → Speech rate → Preview voice → Back → More controls. | Start Scan pace. Each field opens a list of values; choosing one applies that setting and returns to its field. Back returns to the original workspace target. No slider or drag is necessary. | Text geometry changes return in paused state; Resume uses the same switch. Voice changes never play audio automatically. Missing voices disable speech selection, not message composition. |
| Recovery | Left: retained source/working message; never a cleared screen. Right: one cause-specific list below. | No retry reuses approval or silently replays speech. Initial target is the non-destructive continuation. | Input loss is different from an AI failure: an unplugged sole switch cannot operate any recovery control. Reconnection or browser/OS permission assistance may be needed before switch control resumes. |

### Long-message Review

This is a proposed navigation rule, not a comprehension check. Keep the complete utterance intact; pages are only a reading presentation. Pagination must leave the current part and its navigation readable at the selected text size. If that is impossible, keep speech unavailable and preserve switch access to Back and Settings; never count clipped or unrendered text as presented.

1. **Enter at part 1.** Start a new presentation record for this Review visit, exact working-text revision, and pagination. Show “Part 1 of P” and “Review all P parts before speaking.” Count a part only after its complete content is visibly rendered in a stable layout. Do not count hidden/preloaded parts, scroll-through animation, or a timed dwell as review. There is no minimum reading timer and no automatic page advance.
2. **Navigate with the switch.** Keep the state-table order: Next part → Previous part → Speak this message → Make changes → Back → More controls. Next is unavailable on the last part; Previous is unavailable on the first. Unavailable paging/approval positions stay in place and are skipped by scanning. Each valid Next/Previous cycle shows exactly one adjacent part. Start the next page at Next if available, otherwise Previous; no activation carries into the new page. Revisit any part as often as needed. Pause through More freezes scanning on the current part for unlimited reading time.
3. **Expose approval without choosing it.** Before every part has been presented, keep Speak visibly unavailable with the reason “Review all P parts before speaking.” Once all parts of this unchanged text have been presented, show “All P parts shown. Approval required to speak.” Enable the existing Speak position only at a released, stable scan boundary and only if the speech/input prerequisites are also satisfied. On reaching the last page, scanning starts at Previous, not Speak; Speak is next in the existing order. Do not jump focus to it or reuse the Next release. The user can revisit earlier parts without losing the record while this Review visit and pagination remain unchanged.
4. **Approve the whole message separately.** The approval area explicitly says “Speaks the whole message — P parts.” A fresh DOWN captures this action and the exact full text revision; only its matching valid UP can freeze that full text for speech. It never approves just the displayed part. Input cancellation, missing voice, or another invalid prerequisite leaves speech unauthorized and offers the existing recovery route. A one-part message follows the same rule after its full text is presented, without extra paging selections.
5. **Leave safely at any point.** Back preserves the wording and follows the Review return rule, without clearing or speaking. Make changes opens Repair even before all parts have been shown. More retains Undo, reader, Settings, New message, and Pause as applicable; New message still requires its separate explicit Clear action. Returning from an unchanged temporary menu/reader or a deliberate Pause restores the current Review part and record. Viewing the original in the passive reader neither replaces working wording nor satisfies missing Review parts.
6. **Reset when the basis changes.** Any edit, including a quick replacement or Undo, or any repagination resets the record and disables approval. A newly entered Review visit, including after Back, completed/stopped speech, reload, or failure recovery, starts at part 1 with no reused authorization. A cancelled hold cannot mark an unvisited part or approve anything. All input interruptions cancel pending capture and invalidate authorization under the protected contract; resumption never replays an action. Reflow first follows the existing cancellation/Pause rule; after Resume, review the new pagination from part 1. Preserve authored text through these resets.

Example: a three-part message requires Next → Next → a separate Speak selection, **3 predicted selections after entering Review**, plus scan waiting and reading. Before the last step, Back, correction, reverse paging, and Pause remain available. Displaying all parts only makes approval eligible; it never certifies that the person has read them or authorizes speech.

### Contextual quick correction

Retain unrestricted spelling, but do not require four letters to be entered individually when a supported critical detail has one explicit alternative. The recommended proposal is to put a small, deterministic quick-replacement list on the same replacement screen as the keyboard, without another menu layer. These are optional editing shortcuts, not AI judgments about the intended meaning.

| Proposed initial support | Example context and offered change | Boundary |
| --- | --- | --- |
| Left/right side or direction | “Move me to the right.” → button “Change ‘right’ to ‘left’”; also explicit “my left side” / “my right side.” | Only agreed side/direction contexts. Do not interpret “You are right” as a side. |
| Up/down direction | “Move me up.” → “Change ‘up’ to ‘down’,” and the reverse. | Only explicit movement contexts; not every occurrence of “up” or “down.” |
| Now/later timing | “I need help now.” → “Change ‘now’ to ‘later’,” and the reverse. | Only agreed temporal contexts; changing urgency is always a deliberate authored edit, never a default. |

These three paired sets and example contexts are proposed initial coverage, not an implemented language classifier or validated vocabulary. Use an explicitly reviewed, bounded context list; if context is ambiguous or unsupported, offer spelling alone. Do not infer numbers, dates, amounts, negation, or other critical details. The user can spell any replacement, including names and multiword text. The shortcuts must work without AI or a network request.

- After the user selects a specific word occurrence, freeze its span, current wording revision, context, and available replacements. Show that occurrence in its sentence and the exact before→after replacement on each button. Preserve the rest of the utterance, including punctuation and whitespace outside that span. Display the exact replacement case; never silently normalize other text.
- Scan root order is quick replacement 1 → quick replacement 2 (if supported) → A–E → F–J → K–O → P–T → U–Z → Space and editing → Navigation. Initial target is the first quick choice, otherwise A–E. The initial paired sets yield just one alternative; never pad the list, include the unchanged word as a replacement, or generate extra suggestions. Highlighting a choice is not endorsement or selection.
- The existing letter groups are directly selectable on that screen: there is no mandatory “Spell instead” selection. Quick choices retain their positions throughout editing; skip and visibly disable them after a buffer edit, with “Undo typed changes to use a quick replacement.” Re-enable only when that buffer has returned to its untouched initial state. No quick choice may silently discard typed text. Changes in eligibility obey the released-boundary rule and never alter a held target.
- A valid cycle on an explicitly labeled quick change applies that **draft edit only**, records one undoable correction, clears any approval, and returns to the originating Review or Compose. In Review, show the complete corrected wording with a “Changed ‘right’ to ‘left’” status and changed-span mark. The ordinary fresh speech-approval action remains separate; longer text must pass its reset part-presentation gate. Back before choosing a replacement changes nothing. No global replace, automatic choice, hold shortcut, or direct speech is allowed.

Comparison for changing “right” to “left” on the current Repair page, starting in Review of a one-part message:

| Alternative examined | Predicted selections through separate speech approval | Decision/tradeoff |
| --- | ---: | --- |
| Unrestricted row/item spelling | 13: Make changes + word + 8 letter selections + Navigation + Apply + Speak. | Retained fallback; not accepted as an efficiency target. |
| Extra “Quick replacements” submenu after choosing the word | 5: Make changes + word + submenu + replacement + Speak. | Unnecessary extra selection for this supported case; not recommended. |
| Quick choices beside the existing keyboard groups | 4: Make changes + word + explicit replacement + Speak. | Recommended, untested. Spelling still takes 13 selections, but quick choices can add scan waiting. |

With one or two quick choices, each full root scan loop is longer by 1.6 or 3.2 seconds at the proposed ordinary interval; the initial extended dwell also affects first-pass waiting. This is a calculated tradeoff, not measured performance. Compare correction success, waiting, missed targets, and unsupported spelling on the real switch before accepting the shortcut as an improvement.

### Phrase entry and spelling

For the first prototype, use one small phrase list rather than an unapproved vocabulary taxonomy: “Yes.” → “No.” → “Please wait.” → “Please stop.” → “I need help.” → “I want to say something else.” → Back → More controls. This provisional content supports refusal and independent communication and is not a personalized AAC vocabulary. One phrase selection appends the displayed phrase to Compose; insert a single visible separating space only when needed between existing non-whitespace text and the new phrase. Record the entire insertion as one undoable edit. It never speaks.

The proposed spelling keyboard is English alphabetic for this prototype; it preserves arbitrary existing Unicode text. Do not silently change spelling, capitalization, punctuation, or grammar.

Root keyboard scanning is grouped, in this exact visual row order. In the contextual Repair editor only, the eligible quick-choice positions described above precede these same groups; spelling needs no additional entry selection:

1. A–E
2. F–J
3. K–O
4. P–T
5. U–Z
6. Space and editing
7. Navigation

Select a letter row, then scan its characters left to right, followed by Back to rows. Individual keys display the characters they will insert, lowercase by default; the capital row-range labels above are navigation labels. Selecting a character inserts it once and returns to the same row at root level. Back to rows also returns to that row without inserting. Alphabetic display is chosen for predictable ordering, not a claim of optimal spelling speed.

Space and editing contains: Space → Backspace → Undo → Uppercase next → Numbers → Punctuation → Delete selected word (Repair only) → Back to rows. A non-mode-changing selection returns to the Space and editing group. Uppercase next affects one subsequently entered letter and is visibly indicated; it does not alter existing text.

Numbers has groups 0–4 → 5–9 → Space and editing → Navigation → Letters. Punctuation has groups `. , ? ! '` and `- : ; / ( )`, then Space and editing → Navigation → Letters. A selected symbol follows the same two-cycle row/item path. Letters returns to the previous alphabetic row. In a mode, its own mode-switch control is unavailable.

Navigation contains Done (Compose) or Apply correction (Repair) → Back → Pause scanning → More controls → Back to rows. Thus exiting a keyboard normally costs two cycles: select Navigation, then Done/Apply. After Pause/Resume, return to the exact keyboard group/item context rather than selecting a character.

Compose spelling appends at the visible insertion point; Back/Done preserves already-entered draft text and returns to Compose. Repair uses a separate replacement buffer initially empty and clearly labeled “Replace [word].” Typed characters affect only that buffer. Apply replaces the selected token; the rest of the text is unchanged, including adjacent punctuation/whitespace outside the selection. Back discards only this uncommitted buffer. Delete selected word deliberately prepares an empty replacement; Apply remains a separate action. No empty-buffer Apply is available until Delete has been explicitly chosen. To correct a multiword detail, replace one token with the intended words and delete any obsolete neighboring token through the same route.

### Settings values and returns

- Scan pace: 0.8, 1.2, 1.6, 2.0, 3.0 seconds; default 1.6. Apply after the committing UP and a stable boundary. The first-target dwell remains 1.5 times the selected interval. No claim that any listed pace suits a particular person.
- Text size: 100%, 125%, 150%, 200%; default 100%. These apply to message, controls, labels, and layout capacity; browser zoom remains available independently. Reflow pauses scanning and cancels pending input.
- Speech rate: 0.75, 1.0, 1.25; default 1.0, with browser-specific behavior verified later. Voice labels use the actual voice name and language. List up to five voices per page in a stable name/language order captured on entering that picker; then Next voices, Previous voices, Back. Preserve the chosen voice by identity rather than array position. Never silently substitute an unavailable selected voice.
- Preview voice displays the fixed sample “This is the selected voice.” Selecting Preview explicitly authorizes only that sample. Show the stationary Stop control during preview, then return to Settings at Preview voice. It never speaks the draft.
- Preserve preferences for the session. Persistent preference/draft storage and reload recovery mechanisms remain engineering decisions requiring their own privacy review; do not claim reload persistence before implemented and tested. After reload, show “Your message is kept” only if the draft has actually been restored; inability to recover a draft is a release-blocking limitation, not a successful recovery state.

Each fixed-value picker scans the listed values from lowest to highest, then Back; initially highlight the current value. Voice initially highlights the current voice if present. Choosing a value returns to the Settings field that opened it. A picker opened from paused state returns paused. Preview cancellation does not discard the draft or settings.

### Recovery routes

| Cause | Right-region sequence and effect |
| --- | --- |
| AI unavailable or malformed result | Keep composing → Try suggestions again (only when available) → More controls. Keep composing returns to the preserved source and highlights Spell. Retry starts a new request with the current source; never resurrect a cancelled result. |
| Generation cancelled | Return directly to Compose, same source, initial Get suggestions. No error screen is needed. |
| Speech failure or selected voice unavailable | Back to review → Choose a voice → More controls. Retain exact wording; clear authorization. After voice selection, return to Review and require fresh approval. Do not provide a button that silently retries previously approved speech. |
| Switch disconnected or unarmed | No active switch targets while unavailable. Show “Switch disconnected. Your message is kept,” or “Release the switch to continue,” according to actual state. After a verified new session and observed release, offer stationary Resume scanning. That cycle only resumes. |
| Focus lost, interrupted hold, or malformed input | Cancel the capture; preserve wording; suspend scanning. When the session and released state are valid again, stationary Resume scanning returns to the prior safe state. Any speech approval remains invalid. |
| Optional gaze lost | Keep draft and switch-only access. Offer Continue with switch → Recalibrate gaze, only when gaze exists. Continue requires a deliberate cycle and resumes the scanner without a selection. No automatic choice on camera reacquisition. |

If available hardware input is the only access channel, reconnection and initial browser permission dialogs are setup assistance boundaries. Do not present a clickable Connect button as proof that the user can operate a disconnected switch. This limitation must be tested and disclosed.

### Predicted interaction costs

Assumptions: ordinary direct lists above; one complete switch cycle per selected item or group; one-part utterance unless stated; target word on the current Repair page; lowercase alphabetic replacement; no missed targets. These are predicted selection counts, not measured speed, effort, or clinical results.

| Task and starting state | Predicted cycles |
| --- | ---: |
| Choose either candidate from Suggestions and enter Review | 1 |
| Choose candidate and authorize speech | 2 |
| Reject all candidates and review original words | 1 |
| Reject all candidates and speak original words | 2 |
| Enter Review from a nonempty Compose draft | 1 |
| Request AI from Compose, choose a result, and approve speech | 3, plus generation and scan waiting |
| Return from candidate Review to Suggestions, then review original words | 2 |
| Cancel Generating and retain the draft | 1 |
| Cancel Review and return to its originating choice | 1 |
| Open More controls and Undo an applicable edit | 2 |
| Pause from an ordinary state, then resume | 3 total: More, Pause, Resume; 2 to pause and 1 to resume, plus menu/scan waiting |
| Pause from the dedicated reader, then resume | 2: Pause, Resume |
| Stop pending/active speech | 1, with no scan wait because Stop is stationary |
| From Review, replace a word with L lowercase letters and return to Review | 4 + 2L: Make changes, word, two cycles per letter, Navigation, Apply |
| Change supported “right” to “left” from Review, then separately approve speech | 4: Make changes, word, quick replacement, Speak |
| Spell “left” from Review, then separately approve speech | 13: 1 + 1 + 8 + 2 + 1; retained unrestricted fallback, not an accepted efficiency target |
| Review and approve a P-part message after entering Review | P cycles: P−1 Next part selections, then Speak |

Add two cycles for each inserted space or keyboard editing command reached through its group, two for each required mode change, and one for each Next words page traversal. A missed scan target adds waiting without necessarily adding selections. Repair that requires deleting another token adds its own explicit repair route; it is not included in the one-token example. A quick change returns to Review in 3 selections; if the corrected utterance spans P parts, correction through speech approval costs P+3 selections, including the reset review pass. Unrestricted spelling through that same approval costs 4+2L+P. These formulas exclude any extra revisiting, Pause, Undo, or recovery.

For a simple N-target list with equal interval T, starting at the beginning and equally likely target positions, average wait to the target's first appearance is `(N−1)T/2`. At N=6 and T=1.6 seconds this is 4.0 seconds; the proposed extended first dwell raises that first-pass average to about 4.67 seconds. A missed target can add a full 9.6-second ordinary loop. These estimates exclude press/release duration, reading, cognition, and AI latency. Keyboard group selection adds a second waiting stage: two activations per letter does not mean two seconds per letter. Measure whether this alphabetic grouping is usable before optimizing it.

## C Proposed design tokens and component states

### Typography and geometry

| Token | Proposed specification |
| --- | --- |
| Family | `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`; no downloaded proprietary font. |
| Message | 36 px / 48 px line-height, weight 400, left aligned; same base size in Compose and Review. Never shrink with message length. |
| Choices and primary actions | 24 px / 32 px, weight 500; full labels wrap. |
| State heading | 24 px / 32 px, weight 600; one short heading, such as “Suggested wording.” |
| Labels and body | 18 px / 26 px, weight 400; labels 500. |
| Brand and compact status | Brand 18 px / 24 px, weight 600; status 16 px / 24 px, weight 500. Critical instructions use body size. |
| Spacing | 4, 8, 12, 16, 24, 32, 48 px; 24 px region padding; at least 12 px clear space between adjacent controls' reserved indicator envelopes, defined below. |
| Targets | Standard buttons at least 64 px tall; candidate choices at least 72 px tall; 16 px horizontal padding. Grow vertically for wrapping and text enlargement. |
| Corners | 8 px for actionable controls and the reading surface. No pill-shaped status containers. |
| Borders | 1.5 px strong control boundary; 1 px subtle dividers only where grouping needs explanation. No enclosing border around each right-region section. |
| Elevation | No decorative shadows or gradients. One opaque white reading surface; ordinary layout and whitespace separate other content. |

These dimensions are initial design targets, not gaze-target or clinical access specifications. Enlarged controls may require fewer visible choices per page or document scrolling; do not scale the entire UI down to preserve the layout.

### Color roles and calculated contrast

| Role | Proposed color | Use and calculated contrast |
| --- | --- | --- |
| Canvas / reading surface | `#F5F6F7` / `#FFFFFF` | Neutral opaque backgrounds. |
| Primary text / primary action | `#17191C` | Text on white 17.61:1; white text on the dark primary action also 17.61:1. |
| Secondary text | `#555D66` | 6.68:1 on white; 6.17:1 on canvas. |
| Control border | `#7B828A` | 3.89:1 on white; 3.59:1 on canvas. |
| Nonessential divider | `#D5D9DE` | Decorative grouping only; never the sole target boundary or state signal. |
| Scan outline / scan fill | `#185ADB` / `#EDF3FF` | Outline against scan fill 5.35:1; primary text on scan fill 15.82:1. |
| Held outline / held fill | `#0F3E9E` / `#DCE7FF` | Outline against fill 7.68:1. |
| Chosen wording | `#E9EDF1` plus `#17191C` text | 14.97:1; add a check and “Chosen wording,” never blue scan styling alone. |
| Unavailable text / fill | `#5D6670` / `#EEF0F2` | 5.11:1; no opacity fading that weakens readability. Explain why unavailable. |
| Error or active recording | `#A6212D` on `#FFF0F2` | 6.60:1; explicit error text or “Recording” label and Stop. Recording appears only when implemented and active. |
| Completion text | `#235E43` on white | 7.63:1, optional and paired with truthful text; no permanent green ready badge. |

Ratios were calculated from the proposed opaque sRGB color pairs. Rendered states, focus combinations, browser zoom, and actual text still require inspection. The baseline is 4.5:1 for ordinary text and 3:1 for qualifying large text and relevant nontext information, with the applicable WCAG exceptions; this table does not establish conformance or individual AAC suitability.

### Scan and keyboard-focus indicators

Resolve the dark-action contrast issue with a mandatory opaque separator, not blue directly touching the dark fill. The latter pair is **2.9559:1**, below 3:1; rounding does not make it pass. Held blue directly against that dark fill is also insufficient at **1.8478:1**. Both treatments therefore use the same isolated ring construction. The palette stays unchanged.

From the painted control edge outward, reserve these fixed bands on all four sides, including corners:

1. 3 CSS px opaque white separator.
2. 3 CSS px solid scan ring: `#185ADB`, changing to `#0F3E9E` only for the captured held target.
3. 2 CSS px opaque white outer separator when an indicator is visible.
4. 2 CSS px solid `#17191C` outer ring only for actual keyboard focus. When no scan ring is active, its reserved band remains white; the keyboard ring stays at the same outer position.

Reserve the full **10 CSS px outward envelope per side in layout before scanning**, even when unpainted. The 12 px clear gap in the spacing table is between these envelopes, not between button edges. Control dimensions exclude the envelope. This prevents adjacent rings from touching or being clipped; it is a proposed spacing adjustment requiring viewport/zoom inspection. Neither focus nor DOWN changes target geometry. Containers and viewport edges must leave the entire envelope visible; reveal an off-screen target and its envelope before arming it. Do not substitute a box shadow that can disappear in forced-colors mode.

| Relevant surface or combination | Calculated contrast and required treatment |
| --- | --- |
| White separator / reading surface | Scan blue 5.96:1; held blue 9.53:1; keyboard dark 17.61:1. These are the actual immediate ring/separator pairs. |
| Canvas `#F5F6F7` | Scan blue 5.51:1; held blue 8.81:1; keyboard dark 16.28:1. Keep separators even here. |
| Scan, held, chosen, unavailable, or error pale surfaces | Across `#EDF3FF`, `#DCE7FF`, `#E9EDF1`, `#EEF0F2`, and `#FFF0F2`, scan blue is at least 4.80:1, held blue 7.68:1, and keyboard dark 14.19:1. Do not fade the rings with the surface. Unavailable targets remain absent from switch scanning. |
| Dark primary-action fill `#17191C` | White separator against the action is 17.61:1, then blue against white is 5.96:1, or held blue against white 9.53:1. Blue must never directly adjoin the dark fill or its dark border. The surrounding region remains an approved light surface. |
| Simultaneous scan and keyboard focus | Distinct inner blue 3 px and outer dark 2 px rings, separated by 2 px white. They may appear on the same target or different targets without merging. Keyboard navigation still pauses automatic scanning; retaining DOM focus alone must not fabricate a keyboard action. |

Scan focus, held input, and chosen wording also differ through structure and text: a moving inner perimeter for scanning, a stationary captured perimeter plus “Release to choose” while held, and a check with “Chosen wording” for selection. The keyboard indicator is the separate outer perimeter. None relies solely on a pale fill or color change. A status label must not replace a visible ring.

Use genuine border/outline treatments that survive reduced motion and browser zoom. In forced-colors mode, allow system colors, retain the separate perimeter geometry and held/selected labels, and use the system's focus treatment; do not force the sRGB palette or suppress the native indicator. Verify distinguishability on the actual supported browser because the calculations above do not describe user-selected contrast themes.

The [WCAG non-text contrast explanation](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) informs the 3:1 adjacent-color check. Its separate [Focus Appearance criterion](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html) is Level AAA; use its area and same-pixel contrast checks as inspection targets, not an achieved conformance claim. All numbers above are calculated opaque-sRGB ratios, displayed to two decimals, or four for the failing pairs. Actual ring area, clipping, focus coexistence, forced colors, and 200% zoom remain untested.

### Component semantics

| State | Presentation and behavior |
| --- | --- |
| Normal | White action surface, strong boundary, readable text. Only the current principal action may use a dark fill. Informational status has no button border. |
| Scan focused | Isolated blue inner ring using the full construction above; optional pale blue fill on ordinary choices. At most one item or one group is the active switch target. This is not an AI endorsement. |
| Held | Keep the same captured target; use the darker isolated ring, optional pale held fill on ordinary choices, and a reserved “Release to choose” status line. Keep white separators on dark actions. No scaling, movement, repeat, or new action. |
| Chosen | Check plus explicit wording/provenance label; neutral chosen fill where a retained choice is shown. Selection alone never displays Speaking. |
| Unavailable | Legible subdued text, visible reason, absent from scanning; no indistinguishable low-opacity disabled control. |
| Loading | Static “Preparing suggestions” or “Preparing speech,” according to actual state. Keep draft and cancel/Stop route. No shimmer, spinner-dependent information, or fake progress. |
| Error | Persistent inline explanation, retained text, and cause-specific recovery actions. Do not rely on a temporary toast. |
| Completed | “Playback finished” or “Speech stopped,” retained utterance, and deliberate next action. No automatic clearing, replay, celebratory animation, or claim of delivery. |

Component responsibilities: message reader with provenance; candidate/choice target; grouped keyboard row; navigation controls; status line; inline recovery region; discrete setting picker. No additional generic dashboard-card component is required.

### Motion and writing

Scan changes, DOWN acknowledgement, capture cancellation, page changes, Stop availability, and target enablement must be immediate and geometry-stable. Do not crossfade two active target sets. Keep the active state's controls available as soon as it is stable.

An optional 140 ms opacity transition with cubic-bezier `(0.2, 0, 0, 1)` may clarify a noninteractive status change. Under reduced motion, use zero duration. No translate, scale, parallax, typewriter text, or animated scrolling. Preserve functional outlines under reduced motion.

Use direct adult copy: “Review this wording,” “Review my original words,” “Make changes,” “Speak this message,” “Stop speaking,” and “Resume scanning.” Avoid “Looks good,” “Confirm” without its consequence, “AI magic,” and claims that a suggestion is better or more correct. Do not put a speaker icon on wording-selection actions. Reserve optional speaker imagery for actual speech/preview actions, always with text. No routine explanatory paragraph is needed under every control.

## D Design and engineering handoff

| Category | Decision or responsibility |
| --- | --- |
| Already governed by the user's contract | One ordinary press/release; capture-on-DOWN and commit-on-valid-UP; no hold repeats; cancellation on interruptions; source preservation; fresh exact-text speech approval; switch-operable correction/rejection; privacy; no second repository. |
| User-approved preferred direction | Adaptive 44/56 two-column architecture, message-first hierarchy, restrained palette, stable scan targets, and distinct interaction states. Approval is subject to the three focused revisions in this document; it is not evidence of implementation or usability. |
| Focused revisions and provisional details | Contextual quick replacements with unrestricted spelling; clarified Pause/Resume and long-message approval paths; isolated scan/keyboard rings and clearance. These remain proposed and untested, as do exact dimensions, 1.6-second timing, phrase vocabulary, and English keyboard defaults. No new frontend work is performed in this task. |
| Engineering ownership | Firmware, transport/session validation, debounce, event sequencing, cancellation ordering, target identity/revisions, reducer implementation, AI limits/validation, voice API availability, speech queue/cancel behavior, storage/reload handling, and tests. Design states describe observable requirements, not a finalized wire protocol or implementation schema. |
| Requires physical/browser evidence | Actual viewport and text scale; real switch selection and holds; safe reconnect/focus recovery; ability to reach Pause and repair at the chosen scan pace; keyboard effort; readable long-message paging; spoken output/Stop; actual voices and offline behavior; optional gaze feasibility. |

For implementation review, walk a fictional message through Compose, AI rejection, a wrong-word correction, every part of Review, fresh approval, Stop, and reconnect. Compare the supported right→left quick correction with spelling, unsupported/ambiguous contexts, repeated-word selection, Back, and Undo. Check that an edit resets multipart review, every page offers safe exits, and Pause/Resume cannot authorize speech. Inspect both indicator rings on dark actions and every pale state, with focus coexistence, enlargement, and forced colors. Include a held press while AI finishes, a focus loss while approval is pending, resize during a hold, and speech failure after authorization. Record actual selections, waiting, reading, errors, corrections, and any mouse/keyboard rescue separately. This document supplies scenarios, not executed tests or a test suite.

The user reports that engineering is proceeding separately with real-switch-to-browser integration in the same repository. Its progress and physical results have not been inspected in this design task. This revision supplies observable UI requirements without changing engineering's input or speech-authorization requirements, initiating integration work here, or authorizing a broad frontend build. The existing React, web-guidelines, and Playwright packages are for later applicable review; no code review or browser inspection is claimed here. Apple references are official links; the skipped community bundle is not treated as installed. vgpu and MotionSites have no runtime role.

## E Approval status and focused revisions

The overall architecture is approved as the preferred implementation direction; it is not being reopened for competing concepts. The requested focused revisions are:

1. **Correction:** propose bounded contextual replacements on the existing editor. The supported right→left example takes 4 predicted selections through separate speech approval, compared with the retained 13-selection spelling route. Coverage, scan-wait tradeoffs, and real effort require validation.
2. **Pause and long messages:** distinguish two selections to pause from one to resume; preserve the current reading/editing context. Specify switch-only paging, safe exits, the complete-part presentation gate, and a fresh action approving the whole unchanged utterance. Page exposure is never consent.
3. **Focus contrast:** retain the palette, isolate scan and held rings from dark controls with opaque white bands, and distinguish the keyboard perimeter. Reserve geometry in advance and validate every surface and contrast mode. Calculations resolve the identified color-pair issue in the specification, not rendered accessibility conformance.

Exact values and shortcut vocabulary remain proposed trial choices, not measured outcomes. Optional gaze, listening, animation libraries, GPU effects, a marketing page, and alternative visual themes remain outside this revision. Handoff files are this specification and [INTERFACE_CONTRACT.md](INTERFACE_CONTRACT.md), with the baseline commit above; no automatic transfer to the separate engineering chat is claimed.

### Context inspected

The two attached screenshots, the four requested repository documents, and the previously supplied UI/UX handoff inform this proposal. The research dossier's pages 19–21 were text-inspected for meaning-preserving repair, exact speech approval, and optional listening boundaries; its older schedule and implementation assumptions do not override current instructions. No claim of rereading all 41 pages or running an intended-user study is made.
