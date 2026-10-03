from pathlib import Path
import sys
import threading
import types
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from capture import capture_frames
from main import process_frame, watch_parent


class CaptureTests(unittest.TestCase):
    def test_capture_passes_bgr_frames_to_hook_and_releases_camera_on_stop(self):
        stop = threading.Event()
        frame = types.SimpleNamespace(shape=(1080, 1920, 3))
        settings = {}

        class Camera:
            is_capturing = True
            latest_frame_time = 1.0
            released = False
            def __enter__(self): return self
            def __exit__(self, *_): self.released = True
            def start(self, **kwargs): settings.update(kwargs)
            def grab(self, **kwargs):
                self.copy = kwargs["copy"]
                return frame

        camera = Camera()
        def create(**kwargs):
            settings.update(kwargs)
            return camera
        frames = []
        statuses = []
        def on_frame(value):
            frames.append(value)
            stop.set()
        with patch.dict(sys.modules, dxcam=types.SimpleNamespace(create=create)):
            capture_frames(stop, on_frame, lambda **status: statuses.append(status))
        self.assertEqual(frames, [frame])
        self.assertTrue(camera.released)
        self.assertTrue(camera.copy)
        self.assertEqual(settings["output_color"], "BGR")
        self.assertEqual(settings["processor_backend"], "cv2")
        self.assertEqual(settings["max_buffer_len"], 2)
        self.assertEqual(settings["target_fps"], 60)
        self.assertEqual(statuses[0]["width"], 1920)

    def test_no_frames_reports_waiting_and_still_stops(self):
        stop = threading.Event()
        class Camera:
            is_capturing = True
            latest_frame_time = None
            def __enter__(self): return self
            def __exit__(self, *_): pass
            def start(self, **_): pass
        statuses = []
        def report(**status):
            statuses.append(status)
            stop.set()
        with patch.dict(sys.modules, dxcam=types.SimpleNamespace(create=lambda **_: Camera())):
            capture_frames(stop, lambda _: self.fail("No frame expected"), report)
        self.assertEqual(statuses[0]["capture"], "waiting")

    def test_phase_two_hook_emits_no_recognition_events(self):
        events = []
        process_frame(object(), events.append)
        self.assertEqual(events, [])

    def test_stop_command_and_parent_eof_stop_capture(self):
        for value in [b'{"command":"stop"}\n', b'bad json\n']:
            stop = threading.Event()
            with patch("main.os.read", side_effect=[value, b""]):
                watch_parent(stop)
            self.assertTrue(stop.is_set())


if __name__ == "__main__":
    unittest.main()
