# Narrow freshness revision — approval required

November 14, 2026. The approved v1 boot.py and code.py are now installed and match their reviewed hashes. CIRCUITPY remounted with CircuitPython 10.3.2 and no boot error. IORegistry parent/child relationships identify console at `/dev/cu.usbmodem101` (CircuitPython CDC data, interface 1) and the dedicated channel at `/dev/cu.usbmodem103` (CircuitPython CDC2 data, interface 3). These names are observations for this attachment, not a permanent port-order rule.

The approved code's startup banner appeared during an eight-second console capture, with no traceback. The console was closed afterward; the data port has not been opened. GP1 input and LED behavior still need actual physical observation. No wiring or lamp connection was changed.

## Why another approval is necessary

The newly explicit adapter requirements include rejection of delayed buffered input and liveness/freshness controls. V1 supplies sequence and epoch but no event-generation time or non-disruptive heartbeat. Fresh and delayed bytes from the same epoch are indistinguishable to a receiver. Host receive timestamps alone cannot solve this. Repeated `sync` requests would cancel held input. This gap should have been identified in the original proposal review.

Do not enable physical selections with that requirement unresolved. No physical acceptance result is claimed. The browser serial adapter remains incomplete.

## Exact candidate

Only a further code.py replacement is proposed. **Not installed or approved.**

- [Complete candidate source](../firmware/review/code-v2.py)
- [Exact diff against the approved v1 source](../firmware/review/code-v2.patch)
- Candidate SHA-256: `75917ecc41ef3a66bc234bc022ff6f1543abbcf0856503dfa68ee83e00088747`
- Installed approved v1 SHA-256: `362d20d7509d825ddec0c504ac01c4c9b3751cc0b9ec1e1c4bb620d8cf76922c`

Changes: explicit protocol version 2; `tick_ms` on messages; actual keypad event timestamps on DOWN/UP; a nonce-echo `ping`/`pong` command that leaves held captures and edge sequence untouched. GP1 wiring, debounce, startup release gate, LED behavior, USB configuration and all other board files remain as approved. boot.py does not need another change.

CircuitPython documents [keypad event timestamps](https://docs.circuitpython.org/en/stable/shared-bindings/keypad/#keypad.Event.timestamp) in the [supervisor.ticks_ms clock](https://docs.circuitpython.org/en/stable/shared-bindings/supervisor/#supervisor.ticks_ms), which wraps at 2**29 milliseconds. The proposed browser freshness helper handles that wrap, rejects slow clock evidence and old/future events, and expires stale heartbeat evidence. Its 100 ms round-trip, 250 ms event-age, 1 second clock-evidence lifetime and 5 ms short-term clock allowance are conservative prototype trial settings, not physically validated guarantees.

Actual off-board results: 17 Node tests passed (including three new freshness cases); seven existing desktop session tests and three new protocol-review tests passed; TypeScript checking passed. The new tests confirm that event-generation time is retained rather than replaced by transmit time, and heartbeat creation does not cancel a hold. Serial I/O, full command-loop behavior and CircuitPython imports have not been exercised by those tests.

After approval, finish the strict v2 Web Serial adapter and its transport tests, install only the approved candidate, verify runtime output, and proceed to user-operated physical acceptance. Fresh connection and heartbeat nonces must be checked before clock evidence is trusted. Keep selection disabled on any failed framing, sequencing, freshness, focus or connection check.

Recovery remains available: restore the currently approved v1 code.py if this revision fails; for full original-diagnostic recovery, restore the verified original code.py and remove only the added boot.py under the documented controlled procedure. Preserve the private original and fresh snapshots. No recovery, reflash or extra board change was performed here.
