# HP26-SW-01 — firmware v2 review and installation record

November 14, 2026. The user subsequently approved the exact candidate below. Only `code.py` was replaced. Its live hash matches; the normal CircuitPython startup banner appeared without a traceback during an eight-second console capture. All nine other readable files retained their hashes, including `boot.py`. The console was closed before browser data access. No reflash, wiring, lamp, library, setting or USB configuration change occurred.

## Exact review artifacts

- [Complete v2 code.py](../firmware/review/code-v2.py), SHA-256 `75917ecc41ef3a66bc234bc022ff6f1543abbcf0856503dfa68ee83e00088747`.
- [Exact unified diff](../firmware/review/code-v2.patch), generated from the live installed v1 bytes before replacement. The `installed-v1` label identifies that preserved source, not the current live v2 file.
- Preserved v1 SHA-256: `362d20d7509d825ddec0c504ac01c4c9b3751cc0b9ec1e1c4bb620d8cf76922c`.
- Unchanged boot.py SHA-256: `0c5622734d4a8936552eccca9146819867ef37b2b684f868b77497f9c9c9fe02`.

The source's historical “UNAPPROVED / NOT installed” docstring was intentionally left unchanged to preserve the exact approved hash; this record supplies current status. Approval and installation do not establish physical acceptance.

## Scope and protocol

V1 lacked event-generation timestamps and a non-disruptive heartbeat. Host receive times cannot distinguish old buffered DOWN/UP messages from fresh ones within the same epoch. Repeated synchronization would cancel held captures. This gap should have been identified in the original proposal review.

V2 changes only the protocol version, message timestamps and nonce-echo heartbeat. GP1, the onboard LED, debounce, startup release gate and queue bounds remain unchanged. The browser initiates every connection through the Web Serial permission chooser and asserts DTR after opening. It never auto-reconnects or guesses port order.

Every device message has exactly `v`, `type`, `epoch`, `sequence`, `tick_ms`, plus these fields:

| Type | Additional fields | Meaning |
|---|---|---|
| `sync` | `pressed` boolean | Fresh state snapshot; never a selection |
| `down` | none | Debounced press; sequence advances once |
| `up` | `downSequence` integer | Observed matching release; sequence advances once |
| `pong` | `nonce` string | Heartbeat reply; edge sequence unchanged |
| `fault` | none | Cancel input immediately |

Host commands are `{"v":2,"type":"sync","epoch":"fresh-unpredictable-epoch"}` and `{"v":2,"type":"ping","epoch":"same-epoch","nonce":"fresh-unpredictable-nonce"}`, each newline-terminated. Initial sync sequence is zero. Reconnect while already pressed remains unarmed; the observed release sends a subsequent released `sync`, not an `up`. A new DOWN/UP pair is required to select. On a USB power cycle while pressed, the existing startup release gate must clear before the firmware command loop starts.

## Freshness and cancellation

1. **Clock synchronization:** Each connection/recovery gets a new `crypto.randomUUID()` identity and derived epoch. The echoed-epoch sync and echoed-nonce pongs must arrive within 100 ms of their challenges. If device tick `d` is sampled during host request/response interval `[s,r]`, that tick occurred within `[s,r]`; no wall-clock equality is assumed. Host time uses `performance.now()`.
2. **Wraparound:** `supervisor.ticks_ms()` wraps modulo `2**29` ms. CircuitPython initializes it so the first wrap occurs approximately 65 seconds after power-on. Signed modular differences handle that wrap and later ones. Tests cross a wrap with both edges and a heartbeat. Successive clock intervals must agree within a 5 ms short-term allowance; a stopped/jumping clock is rejected instead of silently reanchored.
3. **Buffered events:** DOWN/UP retain `keypad.Event.timestamp` from generation, rather than transmit time. For wrapped delta `eventTick-d`, the earliest plausible host event time is `s+delta-5`. An edge is rejected if that time is in the future or older than 250 ms at delivery. Both edges require exact version/epoch, consecutive sequence and current clock evidence; UP must match and cannot predate the captured DOWN. This permits bounded latency, not zero delay or a hard real-time guarantee.
4. **Heartbeat:** The adapter polls every 25 ms, challenges after 200 ms without a new anchor, expires a challenge after 100 ms, and rejects evidence older than 1 second. A processing gap over 250 ms cancels before consuming a delayed read. Nonce and current edge sequence are checked before trusting a pong. Heartbeats never refresh a queued edge's timestamp.
5. **Focus, loss and errors:** Blur, hidden visibility, unload, port loss, EOF, read/write errors, malformed framing, stale input or invalid clock evidence synchronously retire the session and cancel the capture. Stream teardown follows. Restored focus alone does not rearm. Reconnect/reload needs explicit action, a fresh epoch and state snapshot. Old input cannot be relabeled into the new session.

**Heartbeats never create selections, manufacture releases, advance scanning or authorize speech.** They are not forwarded to the reducer. Only a validated matching DOWN/UP pair can select the frozen target/revision. No speech, AI or gaze exists in this milestone.

Timing thresholds and the 5 ms allowance are prototype trial settings. Device clock accuracy, host scheduling, suspend/resume and loaded-system reliability require physical validation. A conservative timeout may stop valid input; it must never become a synthesized UP.

## Browser implementation and evidence

Implementation: `src/input/web-serial-adapter.mts`, `serial-protocol.mts`, and `freshness.mts`. Web Streams owns partial OS writes; commands are awaited and serialized, without retrying uncertain prefixes. Read fragments accumulate only to a bounded 511-byte line. Duplicate/unknown fields, malformed data and excessive chunks/message counts fail closed.

The existing three-target diagnostic labels physical and simulated input separately; simulator controls cannot inject into an active hardware session. Web Serial exposes VID/PID but not interface number or OS path: the operator verifies the chooser path against OS USB ancestry. On this attachment, `CircuitPython CDC2 data@3` maps to `/dev/cu.usbmodem103`; console interface 1 maps to `/dev/cu.usbmodem101`. These are observations, not permanent port-order assumptions. The actual chooser selection was checked against this identity before opening. No competing monitor uses the data port.

Observed automated results: **35 Node tests passed; TypeScript checking and the production build passed.** The unchanged firmware session logic previously passed 10 desktop Python tests. Coverage includes fragmented reads, ten simulated cycles through protocol/reducer, a simulated 60-second hold with heartbeats, buffered/late events, clock discontinuity/wrap, malformed fields, pairing failures, partial-write failure, focus/visibility/unload/port loss, and safe rearming. Python tests cover session logic, not CircuitPython hardware imports or the complete GPIO/USB loop.

The physical reload/reconnection attempt exposed a host focus race: immediately after `requestPort()` returned, the old guard could reject before document focus returned. The error occurred before port opening, DTR or synchronization, with count zero. The regression failed with the original error and passes with a bounded pre-open focus wait. No port is opened while waiting. Hidden/unloaded pages or a 3-second timeout abort; late focus cannot revive an expired attempt. Once opening starts, the original immediate blur/visibility cancellation remains in effect. The existing local log now includes timing, session/sequence, pressed snapshots and cleanup reasons. Neither firmware nor protocol freshness limits changed. Subsequent real held reconnect, actual focus-loss and held reload repeats passed. The earlier ambiguous selection-13 run is excluded; it does not establish deliberate human intent.

Physical acceptance: ten ordinary cycles gave ten selections; the prolonged hold, interrupted USB hold, release/fresh-cycle recovery, manual held reconnect, actual focus loss without Pause, and held reload were checked with the user. Browser logs verified pressed snapshots, release-only rearming and new matched DOWN/UP cycles. In the final reload session, SYNC sequences 0/1 reported pressed/released; only a fresh DOWN 2 and matching UP 3 produced count 1. Returning away from the page then cancelled input and closed serial access. Detailed results and the resolved failure remain private, separating browser observations from user-reported physical actions, hold duration and LED behavior. No simulated result is counted as a physical result. Long-duration/load/suspend testing, clinical claims, speech and AI remain outside this acceptance.

## Precise preservation and rollback procedure

Before installation, candidate/v1/boot hashes and both original diagnostic backups were rechecked. No competing callout/dial-in serial sessions were observed. Fresh external snapshot identifier: `HP26-SW-01_v1_before_v2_2026-11-14T17-02-57Z`. All 10 readable files and 3 directories were copied; SHA-256 hashes matched a stable source inventory. **All readable files verified; `.Trashes` not backed up (sole approved exclusion). This is not a complete full-volume backup.** The exact path, per-file manifest and console log remain outside Git.

Before any further board write: stop browser selection, close data access, verify no competing sessions and recheck current/source hashes. Stop on unexpected content or unreadable files. Preserve another uniquely named verified readable-file snapshot; never overwrite existing backups.

To roll back v2 **only after explicit rollback authorization**:

1. Stop selection and close serial sessions. Verify CIRCUITPY is the intended Pico and its code hash is the approved v2 hash; stop on unexpected content.
2. Verify the preserved snapshot's `board/code.py` is a readable regular file matching the v1 hash above. Recheck its manifest and the unchanged boot.py hash.
3. Copy only those verified v1 bytes to `/Volumes/CIRCUITPY/code.py`; flush/fsync, independently reread and hash the live file. Do not move the backup or write another file; leave boot.py unchanged.
4. Observe normal auto-reload/startup through the verified console and close it. Keep the v2-only adapter disabled because v1 lacks freshness evidence. Confirm all other readable file hashes remain unchanged; record results privately.
5. If startup is absent or safe mode appears, stop and preserve errors. Do not reflash, alter boot.py or perform repeated speculative resets.

Full original-diagnostic recovery is separate: original code SHA-256 `570535c6d1c6e6a80249fe5cb7dbc6f1d0118356d26d97989f889c0466cad421`. Removing boot.py to restore the original USB layout is **outside the current code.py-only authorization** and requires separate approval plus controlled eject/reconnection. No rollback was performed.

References: [keypad timestamps](https://docs.circuitpython.org/en/stable/shared-bindings/keypad/#keypad.Event.timestamp), [supervisor clock and early wrap](https://docs.circuitpython.org/en/stable/shared-bindings/supervisor/#supervisor.ticks_ms), [Web Serial activation, signals and streams](https://developer.chrome.com/docs/capabilities/serial).
