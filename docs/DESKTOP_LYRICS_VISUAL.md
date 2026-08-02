# Desktop Lyrics Visual Baseline

Last saved: 2026-07-31

## Approved Effect

- The approved desktop lyrics effect keeps the lyric fill color true to the in-app lyric color. Do not tint the glyph interior gray, yellow, green, or black for contrast.
- White-background readability is handled by a neutral outside feather only:
  - `.lyric-viewport` uses `filter: drop-shadow(0 1px 2.4px rgba(4,6,12,.58)) drop-shadow(0 0 4.8px rgba(4,6,12,.30))`.
  - `.line` uses a very light white stroke: `-webkit-text-stroke:.18px rgba(255,255,255,.72)`.
  - `.line` text glow stays color-based and subtle: `text-shadow:0 0 1px rgba(255,255,255,.34), ... var(--lyric-shadow-soft), ... var(--lyric-shadow-glow)`.
- The dark/black background result must remain crisp: white lyric core, restrained glow, no gray fog covering the text.
- Highlight-follow may show a soft lyric-progress gold/cyan transition, but the non-highlighted glyph interior must not become dirty or split into gray/yellow bands.

## Interaction Baseline

- Locked desktop lyrics must not block operations behind the lyric window. In locked state, the Electron overlay should be mouse-through.
- Unlock/lock is handled by the main process middle-mouse poller using `GetAsyncKeyState(4)` and the lyric hot bounds. This lets middle-click work even when the overlay is click-through.
- Renderer hover logic must not call pointer capture while locked. Locked hover may show the delayed hint, but it must keep `setPointerCapture(false)`.
- Unlocked state may capture pointer for dragging and the close button only.
- Unlocked hover exposes compact `− / current percentage / +` controls and wheel resizing that request the main renderer to persist `desktopLyricsSize`; the overlay must not become a second settings source. The shared supported range is `0.20–1.55`.
- Wheel resizing is active only while unlocked, not dragging, and the pointer is inside the visible lyric or its compact hint toolbar. It must not consume wheel input over the transparent stage.
- Dragging, hover capture, and the main-process middle-click hot bounds use the visible lyric scroller clipped to `.lyric-viewport`. Padding follows the rendered font size (`0.22×` horizontally and `0.13×` vertically, clamped to `2–16px` and `1–10px` before rounding), so the `0.20` size floor at about `12px` keeps only about `3px × 2px` per-side padding. Do not fall back to the padded `.stage` rectangle or include the fixed-size hint toolbar in the main-process hot bounds.
- Keep the interaction hint immediately above the rendered lyric so moving from the glyphs to the controls does not cross a large invisible capture area.

## Do Not Regress

- Do not restore `mix-blend-mode`, `difference`, `multiply`, `.line::before`, or `.line::after` contrast layers for lyric readability.
- Do not use dark pseudo text layers or heavy dark strokes that turn the glyph interior gray.
- Do not reintroduce magnet/snap behavior for dragging unless the user explicitly asks.
- Do not make the locked lyric window intercept background clicks in order to support middle-click; keep middle-click in the main-process poller.
- Verify both white and black backgrounds after changes. White should be readable without color pollution; black should stay clear and bright.
