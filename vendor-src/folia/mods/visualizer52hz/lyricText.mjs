// mods/visualizer52hz/lyricText.mjs
// The lyric text layer. A line appears whole but dim; each character then
// lights up at its own time (word timings when the lyric has them): it brightens
// into a glowing copy with a small swell. Lines fade in and out as a whole.
//
// Every glyph is a container of two sprites, the dim base and the lit copy, so
// lighting is only an alpha change — no redraw per frame. Progress follows the
// song clock; the whole-line fades also follow the wall clock so they finish
// while playback is paused.

import { renderGlyphCanvas } from './lineLayout.mjs';
import { buildCharTimings } from './charTimings.mjs';

const LINE_FADE_SEC = 0.45;
const DIM_ALPHA = 0.3;
const LIGHT_MIN_SEC = 0.12;
const LIGHT_MAX_SEC = 0.45;
const SWELL = 0.12;

const easeOutCubic = (t) => 1 - (1 - t) ** 3;

const fadeProgress = (time, songStart, wallStart) => Math.min(1, Math.max(
  0,
  (time - songStart) / LINE_FADE_SEC,
  (performance.now() - wallStart) / 1000 / LINE_FADE_SEC,
));

const makeSprite = (PIXI, canvas, side, dpr) => {
  const texture = new PIXI.Texture({ source: new PIXI.CanvasSource({ resource: canvas, resolution: dpr }) });
  const sprite = new PIXI.Sprite(texture);
  sprite.anchor.set(0.5);
  sprite.width = side;
  sprite.height = side;
  return sprite;
};

export const createLyricText = (PIXI, layer) => {
  let current = null;   // { container, glyphs, lineIndex, shownAt, shownAtWall }
  const fading = [];    // { container, hiddenAt, hiddenAtWall }

  const destroyContainer = (container) => {
    container.destroy({ children: true, texture: true, textureSource: true });
  };

  const build = (line, lineIndex, layout, theme, dpr, shownAt, shownAtWall) => {
    const timings = buildCharTimings(line);
    const container = new PIXI.Container();
    container.alpha = 0;
    const glyphs = layout.glyphs.map((glyph) => {
      const holder = new PIXI.Container();
      holder.position.set(glyph.x, glyph.y);
      holder.rotation = glyph.rotation;
      holder.scale.set(glyph.scale);
      const base = renderGlyphCanvas(glyph, layout, dpr, theme.primaryColor, null);
      const lit = renderGlyphCanvas(glyph, layout, dpr, theme.primaryColor, theme.accentColor);
      const baseSprite = makeSprite(PIXI, base.canvas, base.side, dpr);
      const litSprite = makeSprite(PIXI, lit.canvas, lit.side, dpr);
      baseSprite.alpha = DIM_ALPHA;
      litSprite.alpha = 0;
      holder.addChild(baseSprite, litSprite);
      container.addChild(holder);
      return { holder, litSprite, glyph, timing: timings[glyph.charIndex] };
    });
    layer.addChild(container);
    return { container, glyphs, lineIndex, shownAt, shownAtWall };
  };

  return {
    get lineIndex() {
      return current?.lineIndex ?? -1;
    },

    /** Replaces the shown line (fading the old one out) at song time `time`. */
    show(line, lineIndex, layout, theme, dpr, time) {
      this.hide(time);
      current = build(line, lineIndex, layout, theme, dpr, time, performance.now());
    },

    hide(time) {
      if (!current) return;
      fading.push({ container: current.container, hiddenAt: time, hiddenAtWall: performance.now() });
      current = null;
    },

    /** Redraws the shown line with a new layout/theme (resize), keeping its fade state. */
    rebuild(line, layout, theme, dpr) {
      fading.splice(0).forEach(({ container }) => destroyContainer(container));
      if (!current) return;
      const { lineIndex, shownAt, shownAtWall } = current;
      destroyContainer(current.container);
      current = build(line, lineIndex, layout, theme, dpr, shownAt, shownAtWall);
    },

    /** After a seek: drop fading lines and fade the shown one in again. */
    restart(time) {
      fading.splice(0).forEach(({ container }) => destroyContainer(container));
      if (current) {
        current.shownAt = time;
        current.shownAtWall = performance.now();
      }
    },

    /** Applies fades and lighting for song time `time`; true while a fade is running. */
    update(time, staticMode) {
      let running = false;
      if (current) {
        const appear = staticMode ? 1 : fadeProgress(time, current.shownAt, current.shownAtWall);
        current.container.alpha = appear;
        running = appear < 1;
        current.glyphs.forEach(({ holder, litSprite, glyph, timing }) => {
          let progress = 1;
          if (!staticMode && timing) {
            const duration = Math.min(LIGHT_MAX_SEC, Math.max(LIGHT_MIN_SEC, timing.end - timing.start));
            progress = Math.min(1, Math.max(0, (time - timing.start) / duration));
          }
          litSprite.alpha = easeOutCubic(progress);
          const swell = progress > 0 && progress < 1 ? SWELL * Math.sin(Math.PI * progress) : 0;
          holder.scale.set(glyph.scale * (1 + swell));
        });
      }
      for (let i = fading.length - 1; i >= 0; i -= 1) {
        const entry = fading[i];
        const progress = fadeProgress(time, entry.hiddenAt, entry.hiddenAtWall);
        if (progress >= 1) {
          destroyContainer(entry.container);
          fading.splice(i, 1);
        } else {
          entry.container.alpha = Math.min(entry.container.alpha, 1 - progress);
          running = true;
        }
      }
      return running;
    },

    destroy() {
      fading.splice(0).forEach(({ container }) => destroyContainer(container));
      if (current) destroyContainer(current.container);
      current = null;
    },
  };
};
