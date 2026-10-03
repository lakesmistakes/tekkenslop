# Python Sidecar (Phase 2)

The training assistant captures a Windows display locally with DXcam's DXGI
Desktop Duplication backend. Frames are BGR NumPy arrays, suitable for OpenCV.
Electron starts and stops Python from the editor and displays connection,
capture dimensions, fresh-frame rate, and errors. Capture does not generate
training advice: move recognition, ML, OCR, and a move database are not included.

## Setup and use

Windows with Python 3.10–3.14, 64-bit:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r assistant/requirements.txt
npm start
```

Click **Start Assistant**. Electron automatically uses the project's
`.venv\Scripts\python.exe` when present, otherwise `python` from PATH. Capture
starts at 60 FPS on DXGI device 0 / output 0. The status counts fresh frames
consumed, rather than repeating a static frame to inflate FPS; the display's
update rate and desktop activity affect the reported value. `waiting` means no
recent fresh frames are available. Click **Stop Assistant** to release capture.
Closing the app also stops Python and closes the local server.

The existing combo controls and developer simulation buttons remain independent
of Python. The overlay always passes mouse input through to the desktop.

## Test the Python → Electron event path

With Electron running, from the repository root:

```powershell
python assistant/main.py test-events
```

Or run `npm run assistant:test`. This command sends the existing Jin punish,
King duck, and King throw-break fixtures, 4.5 seconds apart so each HUD cue is
visible. It only uses Python's standard library; capture dependencies and a
running capture process are unnecessary. Electron's existing event validator
and `publishAssistantEvent` handle these messages exactly like the developer
buttons. `--interval 0` sends all three immediately for integration testing.

## Display / interpreter options

Set these in PowerShell before starting Electron; there is no monitor picker yet:

```powershell
$env:TEKKEN_ASSISTANT_PYTHON = 'C:\path\to\python.exe'
$env:TEKKEN_CAPTURE_DEVICE = '0'
$env:TEKKEN_CAPTURE_OUTPUT = '0'
$env:TEKKEN_CAPTURE_FPS = '60'
npm start
```

Device/output indices must be nonnegative; FPS must be 1–120. To inspect DXGI
display indices with the installed capture environment:

```powershell
.\.venv\Scripts\python.exe -c "import dxcam; print(dxcam.device_info()); print(dxcam.output_info())"
```

Capture covers the selected display, including desktop apps and the overlay.
Tekken should run on that display. Actual game capture compatibility depends on
display mode and driver; this foundation has not been tested inside Tekken.
Frames stay in Python memory and are not recorded, streamed, or saved.

## Small integration boundaries

- `assistant/capture.py`: DXcam capture with a two-frame ring buffer. Consumers
  read the latest frame, without accumulating a processing queue. Resources are
  released by the camera context manager.
- `assistant/main.py`: CLI, parent stop/EOF handling, status reporting, and the
  empty `process_frame(frame, emit_event)` hook for future CV. Native libraries
  initialize before the blocking stdin reader starts on Windows.
- `assistant/transport.py`: synchronous event client, acknowledgments, and
  connection discovery; usable without DXcam or OpenCV installed.
- `src/assistant-transport.cjs`: TCP server bound only to `127.0.0.1` on an
  OS-assigned port. It authenticates messages using a per-run random token,
  bounds messages to 8192 bytes, and calls the existing publisher.
- `src/assistant-service.cjs`: owned Python process, connection/capture status,
  startup timeout, graceful Stop, and a two-second forced process-tree shutdown
  fallback for a stuck Windows process. Spawned windows stay hidden.
- `src/assistant-controls.js`: editor controls and status updates that do not
  rebuild the combo editor.

External clients find the endpoint in
`%LOCALAPPDATA%\Tekken8ComboOverlay\assistant-connection.json`. The file holds
`host`, `port`, and `token`; it is removed on normal app exit. The most recently
opened app is the default destination if multiple instances are open. The owned
capture process receives its own connection data through its environment.
`TEKKEN_ASSISTANT_CONNECTION` or CLI `--connection` overrides the discovery path.

The wire format is UTF-8 JSON, one message per line. Do not change the existing
assistant event contract inside the `event` envelope:

```json
{"token":"<discovered token>","kind":"event","event":{"type":"throw_break","opponent":"King","breakInput":"1+2"}}
```

Electron replies with `{"ok":true}` or `{"ok":false,"error":"..."}` followed by
a newline. A `ping` message verifies the connection without displaying a cue.
Capture status is newline JSON on the owned child's stdout; Stop travels on
stdin. This keeps raw frames out of the transport and separates process status
from the temporary HUD event stream.

## Packaging and verification

Electron Builder copies the Python sources and requirements into
`resources/assistant`, outside `app.asar`. A Python interpreter and capture
dependencies must be installed separately on the target machine; this phase
does not bundle Python. Set `TEKKEN_ASSISTANT_PYTHON` to that interpreter for a
packaged executable. The local `.venv` is ignored by Git and is not packaged.

```powershell
npm test
python -m unittest discover -s assistant/tests -v
```

Tests cover JSON framing, authentication, event validation and Python delivery
through the publisher, process status, duplicate Start/Stop, errors, forced
shutdown, capture resource ownership, the empty recognition hook, and the
existing mandatory click-through behavior. A live Electron smoke check also
verified actual 1920×1080 DXcam capture, external test-event HUD delivery,
Start/Stop/Start, editor focus during status updates, and combo/HUD regressions.
The same checks passed against the unpacked Windows build using an external
Python interpreter, including resource paths and shutdown cleanup.
