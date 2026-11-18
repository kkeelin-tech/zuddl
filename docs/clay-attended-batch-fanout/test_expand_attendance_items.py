import importlib.util
import unittest
from pathlib import Path


def load_module():
    path = Path(__file__).with_name("expand_attendance_items.py")
    spec = importlib.util.spec_from_file_location("expand_attendance_items", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class FakeContext:
    def __init__(self, inputs):
        self._inputs = inputs

    def get_input(self, key):
        return self._inputs.get(key)


class ExpandAttendanceItemsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mod = load_module()

    def test_batch_preserves_every_email(self):
        emails = [
            "hi.alvesdasilva@gmail.com",
            "kurtis@securesave.com",
            "annelismit@pa.gov",
            "raneem.rizvi@syndigo.com",
            "scummin3@jaguarlandrover.com",
            "veera.chithirala@anthem.com",
            "fabiola.rivera@pwc.com",
            "srujay.reddy-vangoor-ext@hpe.com",
            "kate.baillargeon@capitalone.com",
            "you@ptc.com",
        ]
        payload = [
            {
                "action": "ATTENDED",
                "actionId": f"action-{i}",
                "actionCreatedAt": "2026-11-18T17:19:07Z",
                "event": {"id": "evt", "name": "How to design with code in Figma"},
                "registration": {
                    "id": f"reg-{i}",
                    "profile": {"email": email, "firstName": "A", "lastName": "B"},
                },
            }
            for i, email in enumerate(emails)
        ]

        result = self.mod.handler(FakeContext({"payload": payload}))

        self.assertEqual(result["item_count"], 10)
        got = [
            item["registration"]["profile"]["email"] for item in result["items"]
        ]
        self.assertEqual(got, emails)
        self.assertIn("annelismit@pa.gov", got)

    def test_single_object_payload(self):
        result = self.mod.handler(
            FakeContext(
                {
                    "payload": {
                        "action": "ATTENDED",
                        "event": {"id": "evt"},
                        "registration": {"profile": {"email": "one@example.com"}},
                    }
                }
            )
        )
        self.assertEqual(result["item_count"], 1)
        self.assertEqual(
            result["items"][0]["registration"]["profile"]["email"],
            "one@example.com",
        )

    def test_flat_replay_fields(self):
        result = self.mod.handler(
            FakeContext(
                {
                    "event": {"id": "evt"},
                    "registration": {"profile": {"email": "flat@example.com"}},
                    "action": "ATTENDED",
                    "actionId": "a1",
                    "actionCreatedAt": "2026-11-18T17:19:07Z",
                }
            )
        )
        self.assertEqual(result["item_count"], 1)
        self.assertEqual(result["items"][0]["action"], "ATTENDED")
        self.assertEqual(
            result["items"][0]["registration"]["profile"]["email"],
            "flat@example.com",
        )

    def test_empty_shells_dropped(self):
        result = self.mod.handler(
            FakeContext({"payload": [{}, {"action": "ATTENDED", "event": {"id": "e"}}]})
        )
        self.assertEqual(result["item_count"], 1)
        self.assertEqual(result["items"][0]["action"], "ATTENDED")


if __name__ == "__main__":
    unittest.main()
