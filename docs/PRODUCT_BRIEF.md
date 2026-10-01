# Product Brief

Build a local Windows executable that shows a Tekken 8 style combo overlay while a separate editor window controls the notation.

## Current Scope

- Desktop app packaged with Electron.
- Transparent always-on-top overlay window.
- Editor window for typing combo notation and inserting inputs from palettes.
- T8-style CSS-rendered direction arrows, attack buttons, separators, and property chips.
- Regular movement and HOLD movement palettes visible at the same time.
- Property tokens for Tornado, Heat Burst, Heat Dash, Heat Engager, Wall Break, Wall Blast, Floor Break, Balcony Break, Dash, and Sprint.

## Overlay Limitation

The overlay is a normal transparent Windows top-level window. It is expected to work over desktop, borderless windowed games, and many windowed capture setups. It is not kernel-level or graphics-hook injection and may not appear over exclusive fullscreen games.
