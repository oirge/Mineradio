import type { SongResult } from '../types';
import type { VideoExportPreset } from '../types/videoExport';

// src/services/electronVideoExport.ts
// Low-level Electron/Chromium recording helpers used by the player export hook.
const EXPORT_FRAME_RATE = 60;
const EXPORT_AUDIO_BITS_PER_SECOND = 320_000;
const VIDEO_EXPORT_FILE_EXTENSIONS = ['mp4', 'webm'] as const;

/**
 * Creates a cropped/scaled video stream from a capture source using an offscreen Canvas.
 *
 * This solves the black-bar problem caused by Windows DWM decoration on frameless windows:
 * - The desktopCapturer source resolution (boundsPhys) rarely matches the preset exactly
 *   due to 1px DWM borders and half-pixel DPI scaling (e.g. dpr=1.5)
 * - Forcing the output via minWidth/maxWidth constraints causes Chromium to letterbox,
 *   adding black bars when source aspect ≠ output aspect
 *
 * Instead, we capture at the native source resolution, then use Canvas 2D to crop/scale
 * each frame to the exact preset size using "cover" mode (content fills the output,
 * edges are clipped if needed — no black bars).
 */
export const createCroppedVideoStream = (
    sourceStream: MediaStream,
    preset: VideoExportPreset,
): { stream: MediaStream; cleanup: () => void } => {
    const canvas = document.createElement('canvas');
    canvas.width = preset.width;
    canvas.height = preset.height;
    const ctx = canvas.getContext('2d', { alpha: false });

    if (!ctx) {
        throw new Error('[VideoExport] Failed to create 2D canvas context for video cropping');
    }

    // High-quality interpolation: used only in the abnormal cover-fallback path
    // (pure-crop path has scale=1.0, no interpolation needed).
    ctx.imageSmoothingQuality = 'high';

    const videoTrack = sourceStream.getVideoTracks()[0];
    if (!videoTrack) {
        throw new Error('[VideoExport] No video track in source stream for cropping');
    }

    // Create a video element to decode frames from the source track.
    // We must use video.videoWidth/videoHeight (available after loadedmetadata)
    // rather than track.getSettings() because they reflect the actual decoded
    // frame dimensions, which may differ from the track's nominal settings.
    const video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = new MediaStream([videoTrack]);

    let animFrameId: number | null = null;
    let isRunning = true;

    // Crop geometry — computed after metadata loads when videoWidth/videoHeight are available
    let drawW = 0;
    let drawH = 0;
    let offsetX = 0;
    let offsetY = 0;
    let geometryReady = false;

    // Start rendering after video metadata loads and we can read real frame size
    video.onloadedmetadata = () => {
        // Use actual decoded frame dimensions, NOT track settings
        const srcW = video.videoWidth || preset.width;
        const srcH = video.videoHeight || preset.height;

        // Pure crop mode: the snap strategy in main.cjs now ensures contentPhys >= preset + margin,
        // so the captured frame should be larger than the target on at least one dimension.
        // We simply extract a preset-sized region from the center of the source frame,
        // with symmetric integer cropping (no scaling, no resampling, pixel-perfect).
        if (srcW >= preset.width && srcH >= preset.height) {
            // Pure crop: both dimensions have enough pixels
            const cropW = srcW - preset.width;
            const cropH = srcH - preset.height;
            offsetX = Math.floor(cropW / 2);   // left/top gets fewer pixels on odd
            offsetY = Math.floor(cropH / 2);
            drawW = preset.width;               // exact target size
            drawH = preset.height;
            console.log(
                `[VideoExport] Canvas crop: source=${srcW}x${srcH} -> target=${preset.width}x${preset.height} ` +
                `mode=pure-crop offset=(${offsetX},${offsetY}) [L${offsetX}T${offsetY}R${cropW - offsetX}B${cropH - offsetY}]`,
            );
        } else {
            // Fallback: source is smaller than target on at least one dimension (abnormal).
            // This should never happen with the snap-overshoot strategy in main.cjs.
            // Use cover-fit with minimal upscale as last resort — mild distortion is acceptable
            // here because this path indicates a configuration or platform bug, not normal operation.
            console.warn(
                `[VideoExport] Canvas crop: source (${srcW}x${srcH}) < target (${preset.width}x${preset.height}), falling back to cover mode`,
            );
            const scaleX = preset.width / srcW;
            const scaleY = preset.height / srcH;
            const scale = Math.max(scaleX, scaleY);
            const srcDrawW = Math.round(preset.width / scale);
            const srcDrawH = Math.round(preset.height / scale);
            let sx = Math.floor((srcW - srcDrawW) / 2);
            let sy = Math.floor((srcH - srcDrawH) / 2);
            sx = Math.max(0, Math.min(sx, srcW - 1));
            sy = Math.max(0, Math.min(sy, srcH - 1));
            offsetX = sx;
            offsetY = sy;
            drawW = Math.min(srcDrawW, srcW - sx);  // Clamp to avoid out-of-bounds read (may cause slight stretch)
            drawH = Math.min(srcDrawH, srcH - sy);
            console.log(
                `[VideoExport] Canvas crop: source=${srcW}x${srcH} -> target=${preset.width}x${preset.height} ` +
                `mode=cover-fallback scale=${scale.toFixed(4)} srcRegion=(${offsetX},${offsetY},${drawW}x${drawH})`,
            );
        }

        geometryReady = true;
        renderFrame();
    };

    // Render loop: draw each video frame onto the canvas with cover cropping
    const renderFrame = () => {
        if (!isRunning) return;
        if (geometryReady && video.readyState >= video.HAVE_CURRENT_DATA) {
            // Clear and draw with cover fit using pre-computed geometry.
            // Use 9-parameter drawImage to sample a source region (sx,sy,sW,sH)
            // and stretch it to fill the entire canvas (0,0,presetW,presetH).
            ctx!.fillStyle = '#000';
            ctx!.fillRect(0, 0, preset.width, preset.height);
            ctx!.drawImage(video, offsetX, offsetY, drawW, drawH, 0, 0, preset.width, preset.height);
        }
        animFrameId = requestAnimationFrame(renderFrame);
    };

    // Create output stream from the canvas at the target frame rate
    const canvasStream = canvas.captureStream(EXPORT_FRAME_RATE);

    // Copy all audio tracks from source (passthrough)
    sourceStream.getAudioTracks().forEach(track => {
        canvasStream.addTrack(track);
    });

    const cleanup = () => {
        isRunning = false;
        if (animFrameId !== null) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }
        // Stop the original source tracks (e.g. desktop/window capture) so they
        // aren't left active after export. stopMediaStream on the cropped canvas
        // stream cannot reach these tracks — they only live on sourceStream.
        stopMediaStream(sourceStream);
        video.pause();
        video.srcObject = null;
        video.remove();
        canvas.remove();
    };

    return { stream: canvasStream, cleanup };
};

export type VideoExportFileExtension = typeof VIDEO_EXPORT_FILE_EXTENSIONS[number];

export type VideoExportFormat = {
    mimeType: string;
    extension: VideoExportFileExtension;
    displayName: string;
};

const getVideoBitsPerSecond = (preset: VideoExportPreset) => {
    const pixelCount = preset.width * preset.height;

    if (pixelCount >= 3_600_000) {
        return 50_000_000;
    }

    if (pixelCount >= 1_900_000) {
        return 28_000_000;
    }

    return 14_000_000;
};

export const wait = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

export const buildDefaultVideoExportFileName = (
    song: SongResult,
    preset: VideoExportPreset,
    extension: VideoExportFileExtension,
) => {
    const title = song.name?.trim() || 'folia-export';
    return `${title}-${preset.width}x${preset.height}.${extension}`;
};

export const getSupportedVideoExportFormat = (): VideoExportFormat | null => {
    const candidates: VideoExportFormat[] = [
        {
            mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
            extension: 'mp4',
            displayName: 'MP4 Video',
        },
        {
            mimeType: 'video/mp4;codecs=avc1,mp4a.40.2',
            extension: 'mp4',
            displayName: 'MP4 Video',
        },
        {
            mimeType: 'video/mp4',
            extension: 'mp4',
            displayName: 'MP4 Video',
        },
        {
            mimeType: 'video/webm;codecs=vp8,opus',
            extension: 'webm',
            displayName: 'WebM Video',
        },
        {
            mimeType: 'video/webm;codecs=vp9,opus',
            extension: 'webm',
            displayName: 'WebM Video',
        },
        {
            mimeType: 'video/webm',
            extension: 'webm',
            displayName: 'WebM Video',
        },
    ];

    return candidates.find(candidate => MediaRecorder.isTypeSupported(candidate.mimeType)) ?? null;
};

export const getVideoExportRecorderOptions = (preset: VideoExportPreset, format: VideoExportFormat): MediaRecorderOptions => ({
    mimeType: format.mimeType,
    audioBitsPerSecond: EXPORT_AUDIO_BITS_PER_SECOND,
    videoBitsPerSecond: getVideoBitsPerSecond(preset),
});

export const stopMediaStream = (stream: MediaStream | null) => {
    stream?.getTracks().forEach(track => track.stop());
};

// Forces the captured player document to stop painting cursor shapes during export.
export const installVideoExportCursorGuard = () => {
    const style = document.createElement('style');
    style.dataset.foliaVideoExportCursorGuard = 'true';
    style.textContent = 'html, body, body * { cursor: none !important; }';
    document.head.appendChild(style);

    return () => {
        style.remove();
    };
};

export const getAudioElementCaptureStream = (audioElement: HTMLAudioElement) => {
    const capturableAudio = audioElement as HTMLAudioElement & {
        captureStream?: () => MediaStream;
        mozCaptureStream?: () => MediaStream;
    };
    const stream = capturableAudio.captureStream?.() ?? capturableAudio.mozCaptureStream?.();

    if (!stream || stream.getAudioTracks().length === 0) {
        throw new Error('Current audio element cannot provide a recording track.');
    }

    return stream;
};

export const getMainWindowVideoCaptureStream = async (preset: VideoExportPreset) => {
    const source = await window.electron?.getMainWindowCaptureSource?.();
    if (!source) {
        throw new Error('Could not find the main player window capture source.');
    }

    // Capture at the native source resolution WITHOUT forcing minWidth/maxWidth constraints.
    // Forcing the output size causes Chromium to letterbox when the native source size
    // (which includes Windows DWM decoration on frameless windows) doesn't match the
    // preset exactly — resulting in black bars. Instead, we capture the raw source and
    // use Canvas post-processing (createCroppedVideoStream) to crop/scale to the exact
    // preset size with cover mode (no black bars, edges clipped if needed).
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
            mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: source.id,
                maxFrameRate: EXPORT_FRAME_RATE,
            },
        } as unknown as MediaTrackConstraints,
    });

    // Log the actual native capture resolution for diagnostics.
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
        const settings = videoTrack.getSettings();
        console.log(
            `[VideoExport] capture native stream -> ${settings.width}x${settings.height} ` +
            `(preset=${preset.width}x${preset.height}) ` +
            `${settings.width === preset.width && settings.height === preset.height ? 'NATIVE==PRESET' : 'NATIVE!=PRESET->canvas-crop'}`,
        );
    }

    return stream;
};
