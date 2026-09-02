# Mineradio Local Player

[中文](./README.md) · English

This is a locally modified version of Mineradio music player, converted to pure local playback use.

Original project: [XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio)

## Main Changes

- Removed login, online music portal, update prompts, and unnecessary guides.
- Support for importing local music folders.
- Support for importing individual local music files.
- Support for MP3 / MP2 / FLAC / M4A / M4B / WAV / OGG / OGA / AAC / Opus / WebM / WebA / AIFF / APE / DSD(.dsf) playback.
- Support for `.lrc` / `.txt` lyrics files with matching names.
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
- Playlist management
- Shuffle/repeat playback

## Notice

This repository is a locally modified music player version, focused on personal local music library playback. It does not provide online music search, login, premium music sources, or music content distribution.

Please ensure that the music files you import and play are from legal sources.

## License

This project follows the original project license, see [LICENSE](./LICENSE) for details.
