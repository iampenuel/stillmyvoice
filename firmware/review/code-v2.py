"""UNAPPROVED HP26-SW-01 protocol v2 candidate; NOT installed.

Original RP2040 Pico H / CircuitPython 10.3.2. GP1 to GND, internal pull-up.
GP25 onboard LED only. No arcade lamp, HID events, speech, reset or disk writes.
The original diagnostic must remain recoverable from its verified backup.
"""
import json


class SwitchSession:
    """Track observed debounced state and bind edges to a fresh host challenge."""

    def __init__(self, pressed, clock=lambda: 0):
        self.clock = clock
        self.pressed = pressed
        self.cancel()

    def cancel(self):
        self.epoch = None
        self.sequence = 0
        self.armed = False
        self.pending = None

    def message(self, kind, **fields):
        return dict(v=2, type=kind, epoch=self.epoch,
                    sequence=self.sequence, tick_ms=self.clock(), **fields)

    def synchronize(self, epoch):
        if (not isinstance(epoch, str) or not 1 <= len(epoch) <= 128
                or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:-' for c in epoch)):
            raise ValueError('Invalid synchronization challenge')
        self.epoch = epoch
        self.sequence = 0
        self.pending = None
        self.armed = not self.pressed
        return self.message('sync', pressed=self.pressed)

    def transition(self, pressed, event_tick_ms=None):
        if pressed == self.pressed:
            return None
        self.pressed = pressed
        if self.epoch is None:
            return None
        if not self.armed:
            if not pressed:
                self.armed = True
                self.sequence += 1
                return self.message('sync', pressed=False)
            return None
        self.sequence += 1
        if pressed:
            self.pending = self.sequence
            message = self.message('down')
            if event_tick_ms is not None:
                message['tick_ms'] = event_tick_ms
            return message
        if self.pending is not None:
            down_sequence = self.pending
            self.pending = None
            message = self.message('up', downSequence=down_sequence)
            if event_tick_ms is not None:
                message['tick_ms'] = event_tick_ms
            return message
        # An unmatched observed release must not manufacture a completed cycle.
        self.cancel()
        return None


def main():
    import time
    import board
    import digitalio
    import keypad
    import usb_cdc
    import supervisor

    data = usb_cdc.data
    if data is None:
        raise RuntimeError('Dedicated CDC data is unavailable; approved boot.py required')
    data.timeout = 0
    data.write_timeout = 0.1
    led = digitalio.DigitalInOut(board.LED)
    led.switch_to_output(value=False)
    keys = None
    probe = None
    session = None

    def transmit(message):
        if message is None:
            return
        payload = (json.dumps(message) + '\n').encode('utf-8')
        if len(payload) > 512 or data.write(payload) != len(payload):
            raise RuntimeError('Incomplete CDC write; stop and reconnect')

    try:
        print('PROPOSED HP26-SW-01 dedicated CDC diagnostic')
        for _ in range(3):
            led.value = True
            time.sleep(0.12)
            led.value = False
            time.sleep(0.12)
        # Preserve the original startup release gate and initial debounce values.
        probe = digitalio.DigitalInOut(board.GP1)
        probe.switch_to_input(pull=digitalio.Pull.UP)
        released_samples = 0
        while released_samples < 5:
            released = probe.value
            led.value = not released
            released_samples = released_samples + 1 if released else 0
            time.sleep(0.01)
        probe.deinit()
        probe = None
        keys = keypad.Keys((board.GP1,), value_when_pressed=False, pull=True,
                           interval=0.01, debounce_threshold=3, max_events=32)
        keys.events.clear()
        keys.reset()
        session = SwitchSession(False, supervisor.ticks_ms)
        line = bytearray()
        was_connected = False

        while True:
            connected = data.connected
            if connected != was_connected:
                session.cancel()
                line = bytearray()
                data.reset_input_buffer()
                data.reset_output_buffer()
                was_connected = connected

            if keys.events.overflowed:
                raise RuntimeError('Input queue overflow; stop and reconnect')
            # Drain observed transitions before answering a state challenge.
            while True:
                event = keys.events.get()
                if event is None:
                    break
                message = session.transition(event.pressed, event.timestamp)
                led.value = session.pressed
                if connected:
                    transmit(message)
            if keys.events.overflowed:
                raise RuntimeError('Input queue overflow during synchronization')

            if connected and data.in_waiting:
                chunk = data.read(min(data.in_waiting, 64))
                for byte in chunk:
                    if byte == 10:
                        command = json.loads(line.decode('utf-8'))
                        line = bytearray()
                        if (not isinstance(command, dict) or type(command.get('v')) is not int
                                or command.get('v') != 2):
                            raise ValueError('Unexpected CDC command')
                        if command.get('type') == 'sync' and set(command) == {'v', 'type', 'epoch'}:
                            transmit(session.synchronize(command.get('epoch')))
                        elif (command.get('type') == 'ping'
                              and set(command) == {'v', 'type', 'epoch', 'nonce'}
                              and command.get('epoch') == session.epoch
                              and isinstance(command.get('nonce'), str)
                              and 1 <= len(command['nonce']) <= 64
                              and all(c in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:-' for c in command['nonce'])):
                            transmit(session.message('pong', nonce=command['nonce']))
                        else:
                            raise ValueError('Unexpected CDC command')
                    else:
                        line.append(byte)
                        if len(line) > 256:
                            raise ValueError('CDC command exceeds bounded buffer')
            time.sleep(0.001)
    except Exception:
        if session is not None and session.epoch is not None and data.connected:
            try:
                transmit(session.message('fault'))
            except Exception:
                pass
        raise
    finally:
        if session is not None:
            session.cancel()
        if keys is not None:
            keys.deinit()
        if probe is not None:
            probe.deinit()
        led.value = False
        led.deinit()


if __name__ == '__main__':
    main()
