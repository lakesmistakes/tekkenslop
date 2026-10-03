# Product Brief

Build a local Windows executable that shows a Tekken 8 style combo overlay while a separate editor window controls the notation.

## Current Scope

- Desktop app packaged with Electron.
- Transparent always-on-top overlay window.
- Display-only overlay that always lets mouse clicks pass through; interaction stays in the editor so the full-screen transparent window cannot block desktop input.
- Editor window for typing combo notation and inserting inputs from palettes.
- T8-style CSS-rendered direction arrows, attack buttons, separators, and property chips.
- Regular movement and HOLD movement palettes visible at the same time.
- Property tokens for Tornado, Heat Burst, Heat Dash, Heat Engager, Wall Break, Wall Blast, Floor Break, Balcony Break, Dash, and Sprint.
- Temporary punish, matchup tip, and throw break HUD cues, driven by validated assistant events and a developer simulation panel. See [Training Assistant Foundation](./ASSISTANT.md).
- Python sidecar with local DXcam/OpenCV capture, authenticated loopback event transport, and Start/Stop/status controls. Capture has no move recognition yet. See [Python Sidecar (Phase 2)](./PYTHON_SIDECAR.md).

## Overlay Limitation

The overlay is a normal transparent Windows top-level window. It is expected to work over desktop, borderless windowed games, and many windowed capture setups. It is not kernel-level or graphics-hook injection and may not appear over exclusive fullscreen games.
