# Mineradio Local Player

[中文](./README.md) · English

This is a locally modified version of Mineradio music player, converted to pure local playback use.

Original project: [XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio)

## Main Changes

- Removed login, online music portal, update prompts, and unnecessary guides.
- Support for importing local music folders.
- Support for importing individual local music files.
- Automatic music folder monitoring: new files are indexed, deleted files are pruned, tag and cover edits refresh on their own, no restart required.
- Support for MP3 / MP2 / FLAC / M4A / M4B / WAV / OGG / OGA / AAC / Opus / WebM / WebA / AIFF / APE / DSD(.dsf) playback.
- Support for `.lrc` / `.txt` / `.srt` / `.vtt` / `.ass` / `.yrc` lyrics files with matching names.
- Support for MP3 / FLAC / OGG / OPUS / WAV / APE / DSF embedded lyrics tags, including timestamped LRC lyrics.
- Support for automatic lyrics translation recognition and display.
- Support for cover images in the same directory and embedded audio covers.
- Removed local rhythm analysis.
- Mini player optimization with improved animations.

## Usage

```bash
npm install
npm start
```

Build Windows installer:

```bash
npm run build:win
```

Build artifacts are located in `dist/`.

## Features

### Audio Format Support
- ✅ MP3 (MPEG Audio Layer 3)
- ✅ MP2 (MPEG Audio Layer 2)
- ✅ FLAC (Free Lossless Audio Codec)
- ✅ M4A (MPEG-4 Audio, including AAC and ALAC)
- ✅ M4B (MPEG-4 audiobook audio)
- ✅ WAV (Waveform Audio File Format)
- ✅ OGG (Ogg Vorbis)
- ✅ OGA (Ogg audio)
- ✅ AAC (Advanced Audio Coding)
- ✅ Opus (Ogg Opus)
- ✅ WebM audio
- ✅ WebA (WebM audio)
- ✅ AIFF / AIFC (Audio Interchange File Format)
- ✅ APE (Monkey's Audio lossless)
- ✅ DSD (.dsf, DSD Stream File)

### Lyrics Features
- Matching LRC/TXT/SRT/WebVTT/ASS/YRC lyrics files
- Matching JPG/JPEG/JPE/JFIF/PNG/WebP/AVIF/GIF/BMP/SVG cover files
- MP3 / FLAC / OGG / OPUS / WAV / APE / DSF embedded lyrics tags
- Automatic lyrics translation recognition
- Desktop lyrics display
- Dual-line lyrics support

### Player Features
- Mini player (pinnable, draggable)
- Desktop lyrics window
- Local music library management
- Automatic music folder monitoring with a bottom-right synced-track indicator
- Playlist management
- Shuffle/repeat playback

## Changelog

See the [Releases](https://github.com/oirge/Mineradio/releases) page for the full history.

### Latest release v1.7.22 (2026-09-02)

- A real audio effect chain in a fixed order: `Preset → EQ → Preamp → Limiter → Spatial → Output`, permanently wired into the audio graph so toggling it never clicks
- 8 presets: Normal / Rock / Pop / Classical / Jazz / Bass Boost / Vocal / Custom; dragging any band lands on Custom, and returning the curve to a preset shape is recognised again automatically
- 10-band graphic EQ from `31 Hz` to `16 kHz` — shelving filters at both ends, peaking in between, ±12 dB per band in 0.5 dB steps
- Automatic preamp headroom derived from the largest boost, plus an end-of-chain limiter (threshold -12 to 0 dB) that catches transient overshoot
- Stereo width uses a true mid/side matrix: width 1 reproduces the original channels sample for sample, 0 collapses to mono, 2 widens
- Effect profiles export and import as `xxx.eq.json`, carrying the curve, preamp, limiter and spatial settings
- New volume normalization (ReplayGain): existing loudness tags are read and applied so tracks from different albums and sources play at the same level
- Track and Album reference modes, a ±12 dB Preamp, and a peak-based clipping guard
- Reads `REPLAYGAIN_*`, ID3v2 `TXXX` / `RVA2` and Opus `R128_*` tags from FLAC / OGG / OPUS / MP3 / WAV / APE / M4A / DSF
- No library rescan required: newly scanned tracks pick the tags up in passing, older ones fill in once on first play and are cached
- The effect chain and normalization both run on their own nodes, so the volume slider, fades and visualizer levels are untouched
- Automatic music folder monitoring: new tracks are indexed, deleted tracks are pruned, edited tags and covers refresh on their own — no restart needed
- Syncing never interrupts playback: the library is mutated in place, and the currently playing track stays put even if its file is gone
- New bottom-right sync indicator: `已同步 12,431 首歌曲`
- Added tag, cover, embedded lyrics and duration parsing for OGG / OGA / OPUS / WAV / APE / DSD(.dsf)
- APE and DSD now play directly: the desktop side wraps them as a virtual WAV stream, so Range requests and seeking keep working
- The local library moved to SQLite with file-fingerprint and path indexes, and the old 16000-track cap is gone
- Full Node regression suite: `630/630` passing

## Notice

This repository is a locally modified music player version, focused on personal local music library playback. It does not provide online music search, login, premium music sources, or music content distribution.

Please ensure that the music files you import and play are from legal sources.

## License

This project follows the original project license, see [LICENSE](./LICENSE) for details.
