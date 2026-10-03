# Training Assistant Foundation

The editor's **Developer assistant test** panel sends simulated events through
Electron main to the transparent overlay. The newest cue replaces the previous
one, expires after 4 seconds by default, and follows overlay opacity, scale,
position, and visibility settings. Combo notation updates retain an active cue
without extending its lifetime. These fixtures are requested test data, not a
verified frame-data database or live move recognition.

## JSON event contract

```json
{
  "type": "punish",
  "opponent": "Jin",
  "move": "d+2",
  "onBlock": -14,
  "response": { "character": "Bryan", "move": "f,b+2" },
  "durationMs": 4000
}
```

```json
{
  "type": "matchup_tip",
  "opponent": "King",
  "move": "string",
  "advice": "DUCK SECOND HIT"
}
```

```json
{
  "type": "throw_break",
  "opponent": "King",
  "breakInput": "1+2"
}
```

`durationMs` is optional (default 4000; integer range 250–10000). Text fields
must contain 1–160 characters and are trimmed. `onBlock` is an integer from
-99 to -1; `breakInput` is `1`, `2`, or `1+2`. Unknown types or malformed
payloads are rejected, and extra fields are discarded. HUD text uses
`textContent`, so incoming text is never interpreted as HTML.

## Integration points

- `src/assistant-events.cjs`: transport-independent event validation and model.
- `src/assistant-ipc.cjs`: `registerAssistantIpc(...)` returns
  `publishAssistantEvent(input)`, the reusable main-process receiver. It returns
  `{ ok: true }` after sending or `{ ok: false, error }` on rejection.
- Editor preload: `window.comboOverlay.sendAssistantEvent(event)` invokes
  `assistant:publish`. Only the editor window may publish renderer simulations.
- Overlay preload: `window.comboOverlay.onAssistantEvent(callback)` subscribes
  to `assistant:event` and returns an unsubscribe function.
- `src/assistant-hud.js`: simulation fixtures and temporary HUD rendering.

Phase 2 adds a Python capture sidecar and a loopback JSON transport that calls
the publisher returned by registration in `src/main.cjs`. Setup, the Python
test-event command, status controls, and transport details are documented in
[Python Sidecar (Phase 2)](./PYTHON_SIDECAR.md). Move recognition is not implemented.
Events are transient, are not persisted or replayed, and are rejected while the
overlay is unavailable or loading. Hidden-overlay cues still expire.

## Verification

Run `npm test` for contract and IPC boundary tests. Run `npm start`, use the
three developer buttons, and confirm the cue text, replacement, and expiry.
Change combo notation and overlay settings during a cue to check that the combo
overlay continues working and the cue keeps its original deadline.
