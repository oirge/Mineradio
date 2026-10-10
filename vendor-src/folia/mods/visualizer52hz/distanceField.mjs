// mods/visualizer52hz/distanceField.mjs
// Exact Euclidean distance transform (Felzenszwalb & Huttenlocher, "Distance
// Transforms of Sampled Functions") over a glyph mask. Every cell gets its
// distance, in cells, to the nearest inked cell, so a ring drawn at a fixed
// distance traces the outline of the whole line of text, offset outward.
// Linear in the cell count: ~5 ms for a 480x270 grid.

const INF = 1e20;

// One dimension of the squared-distance transform, in place on `f` (length n).
const transform1d = (f, n, d, v, z) => {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q += 1) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k -= 1;
      s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k += 1;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q += 1) {
    while (z[k + 1] < q) k += 1;
    const dq = q - v[k];
    d[q] = dq * dq + f[v[k]];
  }
  for (let q = 0; q < n; q += 1) f[q] = d[q];
};

/**
 * `alpha` is the mask's alpha channel (0..255, row-major, width x height).
 * Returns a Float32Array of distances in cells; inked cells (alpha >= 128) are 0.
 */
export const computeDistanceField = (alpha, width, height) => {
  const grid = new Float64Array(width * height);
  for (let i = 0; i < grid.length; i += 1) grid[i] = alpha[i] >= 128 ? 0 : INF;

  const size = Math.max(width, height);
  const f = new Float64Array(size);
  const d = new Float64Array(size);
  const v = new Int32Array(size);
  const z = new Float64Array(size + 1);

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) f[y] = grid[y * width + x];
    transform1d(f, height, d, v, z);
    for (let y = 0; y < height; y += 1) grid[y * width + x] = f[y];
  }
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) f[x] = grid[row + x];
    transform1d(f, width, d, v, z);
    for (let x = 0; x < width; x += 1) grid[row + x] = f[x];
  }

  const out = new Float32Array(width * height);
  for (let i = 0; i < out.length; i += 1) out[i] = Math.sqrt(grid[i]);
  return out;
};
