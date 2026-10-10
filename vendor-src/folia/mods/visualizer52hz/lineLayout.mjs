// mods/visualizer52hz/lineLayout.mjs
// Lays one lyric line out glyph by glyph: centered rows, each character nudged,
// tilted and resized a little at random (seeded by the text, so the scatter is
// the same on every redraw). The same glyph list drives the display sprites
// and the coarse glyph mask the distance field is built from, which keeps the
// rings aligned with the letters.

import { computeDistanceField } from './distanceField.mjs';
import { between, createRandom, hashString } from './random.mjs';

const MAX_ROWS = 3;
// Rings start this far (in font sizes) outside the glyphs instead of touching them.
const RING_GAP = 0.55;
const LINE_HEIGHT = 1.34;
const WIDE_CHAR = /[\u1100-\u11ff\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\ufe30-\ufe4f\uff00-\uffef]/u;
const SPACE = /\s/u;

const fontOf = (font, size) => `${font.weight} ${size}px ${font.family}`;

/*
 * Break tokens over Array.from(text): a wide (CJK) character is its own token,
 * other runs break between words, and a space stays attached to the word before
 * it. Each entry keeps its index into the character array.
 */
const tokenize = (chars) => {
  const tokens = [];
  let current = [];
  const flush = () => {
    if (current.length) tokens.push(current);
    current = [];
  };
  chars.forEach((char, index) => {
    if (WIDE_CHAR.test(char)) {
      flush();
      tokens.push([{ char, index }]);
    } else {
      current.push({ char, index });
      if (SPACE.test(char)) flush();
    }
  });
  flush();
  return tokens;
};

const rowWidth = (row) => {
  let end = row.length;
  while (end > 0 && SPACE.test(row[end - 1].char)) end -= 1;
  return row.slice(0, end).reduce((sum, entry) => sum + entry.width, 0);
};

const wrap = (tokens, maxWidth) => {
  const rows = [];
  let row = [];
  tokens.forEach((token) => {
    const next = row.concat(token);
    if (row.length && rowWidth(next) > maxWidth) {
      rows.push(row);
      row = token.filter((entry, i) => !(i === 0 && SPACE.test(entry.char)));
    } else {
      row = next;
    }
  });
  if (row.length) rows.push(row);
  return rows;
};

/**
 * Glyphs for `text` inside a width x height stage: `{ char, charIndex, x, y,
 * rotation, scale }`, positions in CSS px at the glyph center. `font` is
 * `{ family, weight }`, resolved from the theme by the caller.
 */
export const layoutLine = (text, font, width, height, fontScale) => {
  const ctx = document.createElement('canvas').getContext('2d');
  const chars = Array.from(text);
  let size = Math.min(width * 0.058, height * 0.1) * fontScale;
  let rows = [];
  for (let attempt = 0; attempt < 6; attempt += 1) {
    ctx.font = fontOf(font, size);
    const tokens = tokenize(chars).map((token) => token.map((entry) => ({
      ...entry,
      width: ctx.measureText(entry.char).width,
    })));
    rows = wrap(tokens, width * 0.8);
    if (rows.length <= MAX_ROWS) break;
    size *= 0.88;
  }

  const random = createRandom(hashString(text));
  const step = size * LINE_HEIGHT;
  const top = height / 2 - (step * (rows.length - 1)) / 2;
  const glyphs = [];
  rows.forEach((row, rowIndex) => {
    // Wide characters scatter one by one and are spread a little so tilted
    // neighbours do not collide. Latin letters scatter as whole words, with only
    // a trace of per-letter jitter, so words stay readable.
    let end = row.length;
    while (end > 0 && SPACE.test(row[end - 1].char)) end -= 1;
    const entries = row.slice(0, end).map((entry, i, list) => {
      const wide = WIDE_CHAR.test(entry.char);
      const nextWide = i + 1 < list.length && WIDE_CHAR.test(list[i + 1].char);
      const gap = i + 1 < list.length ? size * (wide || nextWide ? 0.06 : 0.02) : 0;
      return { ...entry, wide, advance: entry.width + gap };
    });
    const total = entries.reduce((sum, entry) => sum + entry.advance, 0);
    let cursor = width / 2 - total / 2 + between(random, -0.04, 0.04) * size;
    const rowY = top + step * rowIndex;
    let word = null;
    entries.forEach((entry) => {
      if (SPACE.test(entry.char) || entry.wide) word = null;
      if (!SPACE.test(entry.char)) {
        if (!entry.wide && !word) {
          word = { dy: between(random, -0.1, 0.1), rotation: between(random, -0.05, 0.05), scale: between(random, 0.94, 1.06) };
        }
        const jitter = entry.wide ? 1 : 0.2;
        glyphs.push({
          char: entry.char,
          charIndex: entry.index,
          x: cursor + entry.width / 2 + between(random, -0.035, 0.035) * size * jitter,
          y: rowY + ((word?.dy ?? 0) + between(random, -0.11, 0.11) * jitter) * size,
          rotation: (word?.rotation ?? 0) + between(random, -0.075, 0.075) * jitter,
          scale: (word?.scale ?? 1) * between(random, 1 - 0.07 * jitter, 1 + 0.07 * jitter),
        });
      }
      cursor += entry.advance;
    });
  });
  return { glyphs, size, font: fontOf(font, size) };
};

const drawGlyph = (ctx, glyph, stroke) => {
  ctx.save();
  ctx.translate(glyph.x, glyph.y);
  ctx.rotate(glyph.rotation);
  ctx.scale(glyph.scale, glyph.scale);
  ctx.fillText(glyph.char, 0, 0);
  if (stroke) ctx.strokeText(glyph.char, 0, 0);
  ctx.restore();
};

/**
 * One glyph on its own canvas (square, `side` CSS px, glyph centered), for a
 * display sprite anchored at its center. `glow` adds a colored halo.
 */
export const renderGlyphCanvas = (glyph, layout, dpr, color, glow) => {
  const side = Math.ceil(layout.size * 2);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(side * dpr));
  canvas.height = canvas.width;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.font = layout.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = layout.size * 0.45;
  }
  ctx.fillText(glyph.char, side / 2, side / 2);
  return { canvas, side };
};

/**
 * The line's distance field on a gridWidth x gridHeight grid (`cell` CSS px
 * per cell). The mask is stroked by about one cell so thin strokes survive
 * the downscale. Distances are measured from RING_GAP outside the glyphs, so
 * the band next to the text reads negative and emits nothing.
 */
export const buildLineField = (layout, cell, gridWidth, gridHeight) => {
  const canvas = document.createElement('canvas');
  canvas.width = gridWidth;
  canvas.height = gridHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.scale(1 / cell, 1 / cell);
  ctx.font = layout.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = cell * 1.2;
  ctx.lineJoin = 'round';
  layout.glyphs.forEach((glyph) => drawGlyph(ctx, glyph, true));
  const { data } = ctx.getImageData(0, 0, gridWidth, gridHeight);
  const alpha = new Uint8Array(gridWidth * gridHeight);
  for (let i = 0; i < alpha.length; i += 1) alpha[i] = data[i * 4 + 3];
  const field = computeDistanceField(alpha, gridWidth, gridHeight);
  const gap = (layout.size * RING_GAP) / cell;
  for (let i = 0; i < field.length; i += 1) field[i] -= gap;
  return field;
};
