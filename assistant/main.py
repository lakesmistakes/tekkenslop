"""Local capture sidecar and an explicit simulated-event test command."""
import argparse
import importlib
import json
import os
import sys
import threading
import time

from transport import AssistantClient, default_connection_path

DEMO_EVENTS = [
    {"type": "punish", "opponent": "Jin", "move": "d+2", "onBlock": -14,
     "response": {"character": "Bryan", "move": "f,b+2"}},
    {"type": "matchup_tip", "opponent": "King", "move": "string", "advice": "DUCK SECOND HIT"},
    {"type": "throw_break", "opponent": "King", "breakInput": "1+2"},
]


def report_status(**fields):
    print(json.dumps({"type": "status", **fields}), flush=True)


def watch_parent(stop):
    # A normal Stop command or parent stdin EOF both release capture resources.
    # Raw reads avoid holding Python's buffered stdin lock during shutdown.
    pending = b""
    while not stop.is_set():
        chunk = os.read(0, 4096)
        if not chunk:
            break
        pending += chunk
        while b"\n" in pending:
            line, pending = pending.split(b"\n", 1)
            try:
                if json.loads(line).get("command") == "stop":
                    stop.set()
                    return
            except (ValueError, AttributeError):
                continue
        if len(pending) > 4096:
            break
    stop.set()


def process_frame(frame, emit_event):
    """Future recognition hook: BGR ndarray in, emit_event(existing JSON) out.

    Deliberately does nothing in Phase 2. Frames are not recorded or sent over TCP.
    """


def run_capture(args):
    stop = threading.Event()
    try:
        if sys.platform != "win32":
            raise RuntimeError("DXcam capture requires Windows.")
        with AssistantClient(args.connection) as client:
            client.request("ping")
            report_status(capture="connected")
            # Initialize native libraries before another thread blocks on stdin;
            # Windows DLL initialization can otherwise wait on the CRT I/O lock.
            importlib.import_module("dxcam")
            importlib.import_module("cv2")
            threading.Thread(target=watch_parent, args=(stop,), daemon=True).start()
            from capture import capture_frames
            def on_frame(frame):
                process_frame(frame, client.send_event)
            def report(**fields):
                client.request("ping")  # Detect Electron disconnects even before recognition emits events.
                report_status(**fields)
            capture_frames(stop, on_frame, report, device=args.device, output=args.output, fps=args.fps)
        return 0
    except Exception as error:
        message = str(error)
        if isinstance(error, ModuleNotFoundError):
            message = "Capture dependencies are missing. Install assistant/requirements.txt in the assistant Python environment."
        report_status(capture="error", error=message)
        return 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["capture", "test-events"])
    parser.add_argument("--connection", default=str(default_connection_path()))
    parser.add_argument("--device", type=int, default=0)
    parser.add_argument("--output", type=int, default=0)
    parser.add_argument("--fps", type=int, default=60)
    parser.add_argument("--interval", type=float, default=4.5, help="Seconds between simulated cues.")
    args = parser.parse_args()
    if args.device < 0 or args.output < 0 or not 1 <= args.fps <= 120 or not 0 <= args.interval <= 60:
        parser.error("device/output must be nonnegative; fps must be 1–120; interval must be 0–60.")
    if args.command == "capture":
        return run_capture(args)
    try:
        with AssistantClient(args.connection) as client:
            for index, event in enumerate(DEMO_EVENTS):
                client.send_event(event)
                print(f"Sent {event['type']}", flush=True)
                if index < len(DEMO_EVENTS) - 1:
                    time.sleep(args.interval)
        return 0
    except (OSError, ValueError, KeyError) as error:
        print(f"Could not send test events: {error}. Start Electron first.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
