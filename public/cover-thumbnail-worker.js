'use strict';

// Decode, resize and encode on one worker; the caller keeps the existing result/promise caches.
self.onmessage = async function (event) {
  var job = event.data, bitmap = null;
  try {
    var blob = job.source;
    if (typeof blob === 'string') {
      var response = await fetch(blob, { credentials: 'same-origin' });
      if (!response.ok) throw new Error('COVER_FETCH_FAILED');
      blob = await response.blob();
    }
    bitmap = await createImageBitmap(blob);
    var scale = Math.min(1, job.maxSide / Math.max(bitmap.width, bitmap.height));
    var canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
    var context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('COVER_CANVAS_UNAVAILABLE');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = job.smoothing;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    var encoded = await canvas.convertToBlob({ type: 'image/webp', quality: job.quality });
    if (encoded.type !== 'image/webp') encoded = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.86 });
    self.postMessage({ id: job.id, value: new FileReaderSync().readAsDataURL(encoded) });
  } catch (_error) {
    self.postMessage({ id: job.id, fallback: true });
  } finally {
    if (bitmap) bitmap.close();
  }
};
