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
- Support for `.lrc` / `.txt` / `.srt` / `.vtt` / `.ass` / `.yrc` / `.krc` / `.qrc` / `.ttml` lyrics files with matching names.
- Word-by-word lyrics from YRC, KRC (including `krc1` encrypted binaries), QRC (including the XML container) and TTML.
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
- Matching LRC/TXT/SRT/WebVTT/ASS/YRC/KRC/QRC/TTML lyrics files
- Word-by-word lyrics: YRC (NetEase), KRC (Kugou, plaintext and `krc1` encrypted binary), QRC (QQ Music, XML container and bare body), TTML (the Apple Music family)
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
- Whole-machine backup: export a `mineradio.backup` (library index / playlists / favourites / listening stats / theme / effects / player settings / music folders) and import it on another computer, where paths are rebuilt automatically; audio files and cover caches are excluded

## Changelog

See the [Releases](https://github.com/oirge/Mineradio/releases) page for the full history.

### Latest release v1.8.3 (2026-09-05)

- **Fixed the process-level root cause behind black screens and stuttering.** They were two faces of one bug: on startup the player unconditionally forced its way past Chromium's own GPU blocklist — and that list is exactly where the driver combinations that render everything black live. The GPU process would crash, fall back to software rendering, crash again, and that repeated churn is the stutter you could see
- **New three-tier GPU ladder that degrades on its own:** standard (**byte-for-byte identical** to before, so nothing changes on a healthy machine) → compatible (stops specifying anything about the GPU and respects Chromium's blocklist) → software rendering. **Two consecutive GPU crashes are required before dropping a tier** — a single crash is usually a momentary driver hiccup, and relaunching the app over one of those is more annoying than the black screen
- **After an app upgrade or a driver change it automatically returns to the standard tier for one retry**, so you are never pinned to software rendering forever — that is itself a form of stuttering
- **Manual escape hatch for a black screen: `MINERADIO_GPU_MODE=default|compatible|software`.** Run `set MINERADIO_GPU_MODE=software` before launching to get the UI back. It takes precedence over everything, is **never written to the config**, and once you have pinned a tier this way the automatic degradation stays out of the way
- **The main window finally has paint-failure recovery.** Previously only the mini player handled renderer crashes and load failures; when the main renderer died, the transparent frameless window was simply black forever. Load failures, renderer crashes and a throwing first load now all retry automatically: **only one retry in flight at a time**, with a growing delay, and it **stops after 3 attempts** and just logs — endlessly reloading a page that will not load only turns "black screen" into "black screen at full load"
- Recovery reloads the page instead of rebuilding the window, **so window position and always-on-top are left untouched**
- **New startup fallback: if the window has not appeared after 6 seconds, show it anyway.** The "ready to show" event is not guaranteed to fire for a frameless transparent window on Windows, and the window is created hidden — no event means "I double-clicked the icon and nothing happened"
- **After waking from sleep, unlocking the screen or changing displays, the main window is forced to repaint.** A transparent window's drawing surface can be lost at those moments, and a repaint is far cheaper than a reload — **it does not interrupt playback**
- When the renderer hangs, it is only logged and **not reloaded** — a reload would lose playback state, and that trade-off is deliberate
- **No UI change**, and no setting was added for the tiers: someone staring at a black screen cannot click into the settings panel, so recovery has to be fully automatic
- Full Node regression suite: `913/913` passing (42 new cases)
- Known limits: degradation only triggers when a GPU process actually crashes. **Some drivers render everything black without ever crashing the GPU process**; those still need `MINERADIO_GPU_MODE` set by hand

<details>
<summary>v1.8.2 — Multi-format lyrics: KRC / QRC / TTML all read</summary>

- Lyrics support grows from LRC / YRC / SRT / VTT / ASS into **multi-format word-by-word lyrics**: **KRC** (Kugou), **QRC** (QQ Music) and **TTML** (the Apple Music family) are now read directly into the existing lyric-line structure, so word highlighting, desktop lyrics, dual-line layout and translations all keep working unchanged
- **KRC** is read both as plaintext and as a `krc1` **encrypted binary**: the encrypted form is XOR-restored with the format's published constant and then inflated using `DecompressionStream`, which both Chromium and Node ship — no new dependency. Word times are offsets relative to the line start and are converted to absolute time on read
- **QRC** accepts both carriers: the `<Lyric_1 LyricType="1" LyricContent="…"/>` XML container (entities such as `&#10;` are expanded) and a bare text body. When an exporter omits the timing tag on the last word, the remaining text is carried to the end of the line — coarse timing beats losing words
- **TTML** takes `<p begin= end=>` as the line and the innermost `<span begin= end=>` as words, so a wrapping full-line span never duplicates the text; `ttm:role="x-translation"` / `x-roman` spans stay out of the main text; times accept both `hh:mm:ss.fff` clocks and `12.5s` / `500ms` offsets
- **Routing is driven by format features, not file extensions**: TTML and the QRC container are recognised by their tags, so square brackets in the text are never mistaken for LRC timestamps. KRC / QRC / YRC all share the `[start,duration]` line head and can only be told apart by their word delimiters (`<offset,dur,0>text` / `text(start,dur)` / `(start,dur,0)text`), so KRC and QRC must be tried before YRC — otherwise YRC swallows them as lines with no word timing
- A duration written in the line head is now honoured as-is instead of being clipped by the old LRC 12-second ceiling
- `.krc` / `.qrc` / `.ttml` were added to all four extension lists: front-end lyric matching, desktop library scanning and MIME, the local-file proxy MIME, and both import `accept` attributes. `.krc` is served as `application/octet-stream` so an encrypted binary is not mangled as text before decoding
- **No UI change**: `public/index.html` only gained three extensions in each of two `accept` attributes, and `public/app.css` was not touched
- Known limits: **encrypted QRC network payloads (triple-DES + zlib) are not decrypted this round.** A `.qrc` on disk is usually already plaintext XML or a bare body, and both of those read directly
- Full Node regression suite: `871/871` passing (new `tests/multi-format-lyrics.test.js`, 7 cases)

</details>

<details>
<summary>v1.8.1 — Whole-machine backup: export mineradio.backup, move to a new computer in one go</summary>

- New **"backup" section** on the settings panel's "Advanced" page, with two buttons: export and import. Export writes a `mineradio.backup` file; import reads it back and overwrites the local data
- **The backup holds what you built up**: the library index (paths, duration, format, album and artist, date added), every playlist, favourites, listening history and play statistics, plus the theme, lyrics layout, effect chain and effect archives, the 16 player settings covering volume / quality / gapless / crossfade / hotkeys / auto-hide, and the music folder paths
- **Three things are deliberately left out: audio files, cover caches and temporary files.** Not a single byte of audio goes in, regenerable covers and beat maps stay out, and so do the library snapshot / queue snapshot / resume positions that would point at old paths on another machine — a library of tens of thousands of tracks still backs up to a few MB, small enough for a cloud drive or a USB stick
- **Moving to a new computer is the intended use, so track identity is stored as "folder + relative path", never an absolute path**: there is no hard-coded drive letter anywhere in the file. On import the full paths are rebuilt against the music folder on the new machine, so playlists and favourites still resolve after `D:\Music` becomes `E:\NewDrive\Music`
- **Import looks for the backup's music folder first and asks you to pick a new one if it is missing**; cancelling that step abandons the whole import and leaves local data untouched
- **Import overwrites, so it takes two clicks**: the first click only warns that importing will overwrite local playlists / favourites / settings and restart, and a second click within 12 seconds actually starts it. The app restarts when it finishes and rescans the library against the new paths. No new dialogs were added
- Backup files use the `.backup` extension on their own read/write channel, separate from the `.json`-only effect-archive and plugin imports; the version field is validated before anything is written, unknown files are rejected outright, and imports are capped at 64 MB
- The only UI addition is one collapsible section in the settings panel (two button rows plus two hint rows); `public/app.css` was not touched
- Known limits: per-track custom covers, custom beat maps and custom lyrics count as "cover cache" and are excluded by request this round
- Full Node regression suite: `864/864` passing

</details>

<details>
<summary>v1.7.29 — Sync indicator moved below the search box, colours follow theme plugins</summary>

- The music-folder auto-sync indicator ("已同步 xx 首歌曲" / "synced xx tracks") moved from the bottom-right corner to **below the search box**: with nothing else under the search box it sits directly beneath it, and as soon as search results appear it slides below the result list instead of covering it — no existing layout is pushed around
- The indicator now **follows theme plugins**: background, border, shadow and text all read theme tokens first (the same family as the search box), falling back to the player's own glass material when no theme is installed, so it looks like the same material as the adjacent search box. Text stays readable on light themes; only the small accent dot keeps a semantic colour
- The top search bar only peeks out when the pointer is near the top, so the indicator holds it open for the few seconds it is visible and releases it on fade-out. A search bar you opened yourself is never taken over or closed for you, and it stays open while the input has focus, results or the import hint are showing, or the pointer is still up top
- No new UI elements; `public/index.html` was not touched
- Fixed a library-pruning defect that could leave deleted tracks in the library forever: a full scan drops rows it did not see this pass, but "this pass" was marked with a millisecond timestamp, so two scans landing in the same clock tick made stale rows look like they had been seen. The per-root scan stamp is now strictly increasing
- Full Node regression suite: `846/846` passing

</details>

<details>
<summary>v1.7.28 — Gapless playback and a 0~10 second crossfade</summary>

- New "gapless playback" toggle (on by default): the next track is decoded ahead of time during automatic advance and takes over the instant the previous one ends, so there is no audible gap between adjacent tracks
- New "crossfade" slider: `0 ~ 10` seconds in `0.5` second steps. Above zero the outgoing and incoming tracks overlap along an equal-power curve, so the midpoint does not dip in loudness
- With crossfade at `0` the original playback logic is preserved. Manual track changes, previous, next, shuffle and autoplay are all unaffected — only automatic advance and single-track repeat may adopt the prefetched deck
- No pops, no double playback and no sudden silence across state changes: two permanently wired `<audio>` decks only ever have their gain adjusted, never their connections. A crossfade commits and advances the queue only once the next track is genuinely audible, and if the start is rejected everything rolls back and the current track keeps playing
- The only UI addition is one collapsible section under the volume block on the settings panel's "Advanced" page (one toggle plus one slider); the stylesheet was not touched
- Full Node regression suite: `834/834` passing

</details>

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
