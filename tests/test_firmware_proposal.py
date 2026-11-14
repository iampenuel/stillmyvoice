"""Desktop tests of proposed session logic, not CircuitPython or physical tests."""
import importlib.util
from pathlib import Path
import unittest

source = Path(__file__).resolve().parents[1] / 'firmware/proposed/code.py'
spec = importlib.util.spec_from_file_location('proposed_input', source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
SwitchSession = module.SwitchSession


class ProposedSessionTests(unittest.TestCase):
    def test_ten_cycles(self):
        session = SwitchSession(False)
        self.assertFalse(session.synchronize('test:1')['pressed'])
        for i in range(10):
            down = session.transition(True)
            up = session.transition(False)
            self.assertEqual(down['sequence'], 2 * i + 1)
            self.assertEqual(up['sequence'], 2 * i + 2)
            self.assertEqual(up['downSequence'], down['sequence'])

    def test_hold_never_repeats(self):
        session = SwitchSession(False)
        session.synchronize('test:1')
        session.transition(True)
        for _ in range(1000):
            self.assertIsNone(session.transition(True))
        self.assertEqual(session.transition(False)['type'], 'up')
        self.assertIsNone(session.transition(False))

    def test_initial_hold_release_only_arms(self):
        session = SwitchSession(True)
        self.assertTrue(session.synchronize('test:1')['pressed'])
        self.assertEqual(session.transition(False)['type'], 'sync')
        self.assertEqual(session.transition(True)['type'], 'down')

    def test_disconnect_cancels_pending(self):
        session = SwitchSession(False)
        session.synchronize('old:1')
        session.transition(True)
        session.cancel()
        self.assertIsNone(session.transition(False))
        session.synchronize('new:1')
        self.assertEqual(session.transition(True)['epoch'], 'new:1')

    def test_new_challenge_during_hold_cannot_release_old_selection(self):
        session = SwitchSession(False)
        session.synchronize('old:1')
        session.transition(True)
        session.synchronize('new:2')
        self.assertEqual(session.transition(False)['type'], 'sync')

    def test_no_host_means_no_protocol_edges(self):
        session = SwitchSession(False)
        self.assertIsNone(session.transition(True))
        self.assertIsNone(session.transition(False))

    def test_invalid_challenges_are_rejected(self):
        for value in [None, '', 3, 'x' * 129, 'bad\nchallenge', '../file']:
            with self.assertRaises(ValueError):
                SwitchSession(False).synchronize(value)


if __name__ == '__main__':
    unittest.main()
