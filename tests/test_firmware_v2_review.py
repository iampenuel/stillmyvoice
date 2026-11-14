"""Off-board checks only. The reviewed installed v1 file remains unchanged."""
import importlib.util
from pathlib import Path
import unittest

root = Path(__file__).resolve().parents[1]
def load(relative, name):
    spec = importlib.util.spec_from_file_location(name, root / relative)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.SwitchSession
V1 = load('firmware/proposed/code.py', 'approved_v1')
V2 = load('firmware/review/code-v2.py', 'unapproved_v2')

class FreshnessReview(unittest.TestCase):
    def test_v1_has_no_generation_time_evidence(self):
        s = V1(False)
        s.synchronize('same:1')
        down = s.transition(True)
        up = s.transition(False)
        self.assertNotIn('tick_ms', down)
        self.assertNotIn('tick_ms', up)
        # Buffering these same dictionaries cannot add event-age information.

    def test_v2_preserves_event_time_instead_of_transmit_time(self):
        s = V2(False, lambda: 1000)
        self.assertEqual(s.synchronize('fresh:1')['tick_ms'], 1000)
        down = s.transition(True, 700)
        up = s.transition(False, 800)
        self.assertEqual(down['tick_ms'], 700)
        self.assertEqual(up['tick_ms'], 800)
        self.assertEqual(up['downSequence'], down['sequence'])
        self.assertEqual(up['v'], 2)

    def test_heartbeat_does_not_cancel_a_held_press_or_advance_edge_sequence(self):
        s = V2(False, lambda: 1000)
        s.synchronize('fresh:1')
        down = s.transition(True, 900)
        pong = s.message('pong', nonce='unique-challenge')
        self.assertEqual(pong['nonce'], 'unique-challenge')
        self.assertEqual(s.pending, down['sequence'])
        self.assertEqual(s.sequence, down['sequence'])
        self.assertEqual(s.transition(False, 1100)['downSequence'], down['sequence'])

if __name__ == '__main__':
    unittest.main()
