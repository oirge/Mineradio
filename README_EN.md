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
- Automatic music folder monitoring with a theme-aware synced-track indicator below the search box
- Playlist management
- Shuffle/repeat playback
- Per-track listening stats (play count, completed plays, accumulated listen time, last-played time)
- Resume playback (each track remembers where you stopped) plus a "resume last playback" action
- Two-tier clearing of recently-played records (recent only, or counts and listen time as well)
- Customizable global hotkeys, including the mouse middle button and both side buttons
- Gapless playback plus a `0~10` second crossfade

## Changelog

See the [Releases](https://github.com/oirge/Mineradio/releases) page for the full history.

### Latest release v1.7.28 (2026-09-03)

- New "gapless playback" toggle (on by default): the next track is decoded ahead of time during automatic advance and takes over the instant the previous one ends, so there is no audible gap between adjacent tracks
- New "crossfade" slider: `0 ~ 10` seconds in `0.5` second steps. Above zero the outgoing and incoming tracks overlap along an equal-power curve, so the midpoint does not dip in loudness
- With crossfade at `0` the original playback logic is preserved. Manual track changes, previous, next, shuffle and autoplay are all unaffected — only automatic advance and single-track repeat may adopt the prefetched deck
- No pops, no double playback and no sudden silence across state changes: two permanently wired `<audio>` decks only ever have their gain adjusted, never their connections. A crossfade commits and advances the queue only once the next track is genuinely audible, and if the start is rejected everything rolls back and the current track keeps playing
- The only UI addition is one collapsible section under the volume block on the settings panel's "Advanced" page (one toggle plus one slider); the stylesheet was not touched
- Full Node regression suite: `834/834` passing

<details>
<summary>v1.7.27 — Listening stats, resume playback, mouse-button hotkeys</summary>

- Per-track listening stats: play count, completed plays, accumulated listen time and last-played time are kept per track. The "recently played / most played" lists show a summary under each row, and the song detail dialog has a full "playback stats" section
- Resume playback: each track remembers where you stopped and picks up there next time. A position is only remembered after 15 seconds of listening and only if at least 20 seconds remain, and it is cleared once the track finishes
- "Resume last playback": a button in the settings panel that can also be bound to a hotkey. It ignores the autoplay toggle — pressing it resumes the last track at the last position
- Clearing recently-played records is now two-tier: "clear recent only" keeps play counts and accumulated listen time, "clear everything" also zeroes counts, listen time and resume positions. Neither deletes local music files, and both also clear the stats mirror in the local SQLite library
- Global hotkeys accept the mouse middle button and both side buttons (combinable with `Ctrl` / `Alt` / `Shift` / `Win`); the left and right buttons stay reserved for normal clicking. Note that a system-level mouse hook only *listens*, it cannot swallow the event, so back/forward still act normally in other applications; in-app-only bindings are unaffected
- The mouse hook is loaded on demand: with no mouse binding the native module is never pulled into the process, and removing the last binding stops the hook immediately. It only reads button and modifier state — no input is recorded, stored or transmitted (see [PRIVACY.md](./PRIVACY.md))
- Full Node regression suite: `807/807` passing

</details>

<details>
<summary>v1.7.24 — Library became a top-level tab</summary>

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

</details>

## Notice

This repository is a locally modified music player version, focused on personal local music library playback. It does not provide online music search, login, premium music sources, or music content distribution.

Please ensure that the music files you import and play are from legal sources.

## License

This project follows the original project license, see [LICENSE](./LICENSE) for details.
