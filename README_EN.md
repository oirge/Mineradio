# Mineradio Local Player

[中文](./README.md) · English

This is a locally modified version of Mineradio music player, converted to pure local playback use.

Original project: [XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio)

## Main Changes

- Removed login, online music portal, update prompts, and unnecessary guides.
- Support for importing local music folders.
- Support for importing individual local music files.
- Smart library categories in their own tab: artist / album / album artist / genre / decade, plus recently added, recently played, most played and never played.
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
- Smart library categories in a dedicated tab (artist / album / album artist / genre / decade / recently added / recently played / most played / never played)
- Automatic music folder monitoring with a bottom-right synced-track indicator
- Playlist management
- Shuffle/repeat playback

## Changelog

See the [Releases](https://github.com/oirge/Mineradio/releases) page for the full history.

### Latest release v1.7.24 (2026-09-02)

- Library is now a top-level tab: the left panel's tab bar reads `当前队列 / 歌单 / 音乐库` (Queue / Playlists / Library), so smart categories are one click away instead of hidden behind a card
- Both tabs share one list and one selection, and switching repositions it: entering Library lands on the category home, returning to Playlists falls back to "All songs" — no cross-page bleed
- Sitting on an artist or a group and switching to Queue and back keeps you on that same level
- The Library tab's toolbar reads "音乐库智能分类" and hides "New playlist" (it only means something for standalone playlists); "Import" stays. The Playlists tab is unchanged: Liked → standalone playlists → all songs
- Smart library categories: five song views (`All songs / Recently added / Recently played / Most played / Never played`) and five group browsers (`Artist / Album / Album artist / Genre / Decade`)
- Three-level navigation — Library → group → songs — with a back button on the group and song levels and "play all" on the song level; any category can become the bottom-bar playback source
- Decades are bucketed by ten years (`1990s / 2000s / 2010s`), unparseable years fall into "unknown decade" and sort last; a missing album artist falls back to the artist
- Recently played / most played / never played are driven by local listening stats, ties broken by accumulated listen time and then last-played time
- Library-add timestamps, so "recently added" reflects real import order, capped at 200 tracks; editing tags or covers no longer makes a track look newly added, and a first full import is not stamped with one identical moment
- The whole library is indexed in a single pass, group cards reuse the panel's existing lazy-load budget, and no new CSS was added
- A real audio effect chain in a fixed order: `Preset → EQ → Preamp → Limiter → Spatial → Output`, permanently wired into the audio graph so toggling it never clicks
- 8 presets: Normal / Rock / Pop / Classical / Jazz / Bass Boost / Vocal / Custom; 10-band graphic EQ from `31 Hz` to `16 kHz`, ±12 dB per band in 0.5 dB steps
- Automatic preamp headroom derived from the largest boost, plus an end-of-chain limiter; stereo width uses a true mid/side matrix, width 1 reproduces the original channels sample for sample
- Effect profiles export and import as `xxx.eq.json`, carrying the curve, preamp, limiter and spatial settings
- Volume normalization (ReplayGain): existing loudness tags are read and applied, with Track/Album reference modes, a ±12 dB preamp and a clipping guard
- Automatic music folder monitoring: new tracks are indexed, deleted tracks are pruned, edited tags and covers refresh on their own — no restart needed, and syncing never interrupts playback
- Tag, cover, embedded lyrics and duration parsing for OGG / OGA / OPUS / WAV / APE / DSD(.dsf); APE and DSD play directly
- The local library moved to SQLite with file-fingerprint and path indexes, and the old 16000-track cap is gone
- Full Node regression suite: `655/655` passing

## Notice

This repository is a locally modified music player version, focused on personal local music library playback. It does not provide online music search, login, premium music sources, or music content distribution.

Please ensure that the music files you import and play are from legal sources.

## License

This project follows the original project license, see [LICENSE](./LICENSE) for details.
