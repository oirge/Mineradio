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
- Word-by-word lyrics from YRC, KRC (including `krc1` encrypted binaries), QRC (including the XML container and encrypted payloads) and TTML.
- Encrypted QRC lyrics are read directly, both as the hex text the API returns and as raw binary ciphertext.
- When one track has several same-named lyrics files, the best one is picked by format priority — and you can pick a different one yourself, which is remembered.
- Automatic lyrics encoding detection: UTF-8 / UTF-16 / GB18030 / Big5 / Shift_JIS / EUC-KR / Windows-1252.
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
- Word-by-word lyrics: YRC (NetEase), KRC (Kugou, plaintext and `krc1` encrypted binary), QRC (QQ Music, XML container, bare body and encrypted payload), TTML (the Apple Music family)
- Encrypted QRC: both the hex text the API returns verbatim and raw binary ciphertext are accepted; detection looks at content, not the file extension, so renamed files still work
- Several same-named lyrics files are ranked by format: word-level timing (`.qrc` / `.krc` / `.ttml` / `.yrc`) > line-level `.lrc` > subtitles (`.ass` / `.srt` / `.vtt`) > `.txt`
- You can also pick the candidate yourself: the custom-lyrics dialog lists every match with its path and format, and your choice survives a re-import of the same files
- Automatic encoding detection: UTF-8 / UTF-16LE / UTF-16BE (with or without BOM) / GB18030 / Big5 / Shift_JIS / EUC-KR / Windows-1252, and valid UTF-8 is never second-guessed
- Timeline quirks handled: `[offset:±N]` global shift, `[mm:ss:cc]`, `[hh:mm:ss.fff]`, and fractions scaled by their actual digit count
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

### Latest release v1.9.0 (2026-09-05)

- **Both "Sonic Echo" presets used to look different from the original project — this release aligns them**: checked item by item against upstream [XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio) (commit `89c0d23`); five discrepancies were found and all five now follow upstream
- **Preset 7 ("ported from Ajin") finally gets a real eight-band spectrum and kick envelope**: upstream's audio monitor layer is now ported over (new file `public/sonic-audio-monitor.js`), splitting bands by hertz (32–58 / 58–118 / 118–260 / 260–720 / 720–1800 / 1800–4200 / 4200–9000 / 9000–16000 Hz) and tracking the kick across six candidate windows with an adaptive noise floor. Previously the eight bands were inferred from five coarse values, which is why the terrain's rise-and-fall distribution and the ripple timing were the most visibly wrong part
- Also fixed one stray amplification: the beat value fed to the terrain layer was multiplied by `1.35`, firing ripples earlier than the original. It is now passed through unscaled
- Seeking or switching tracks clears the beat detector's transient state, so a new song's first hit is no longer suppressed by the previous song's noise floor
- **Preset 7's terrain colours are more vivid now**: this repo's cover palette is legibility-adjusted for lyrics (lifted lightness, reduced saturation), so terrain following it came out a tier darker and greyer than the original. A second, high-saturation palette is now computed in parallel from the same cover scan purely for the terrain — **the lyric text colours are byte-for-byte unchanged**
- **Preset 8 ("original by CmzYa") now uses the raw cover colours** instead of the legibility-adjusted lyric ones. A second pass also picks colours by *coverage area* (sampled pixels are bucketed by colour, and the bucket's pixel count is its weight), so the primary is closer to the colour a person actually sees
- **Preset 8's grid resolution is pinned back to the original `project.json` value of `320` and no longer follows the quality tier** — the original's terrain density, ripple radii and meteor scale are all tuned for 320, so changing the grid count changes the proportions of the whole picture
- Preset 8 no longer reads the global theme tint; its colours follow the cover only, as in the original
- Full Node regression suite: `987/987` passing (new `tests/sonic-audio-monitor.test.js` with 12 cases and `tests/lyric-cover-palette-split.test.js` with 9)
- **Known boundary**: this release was verified item by item against upstream's source, not by comparing frames side by side with the original in a real window. If something still looks off, say which preset, which part of the picture, and whether the track is fast or slow

### v1.8.9 (2026-09-05)

- **The one visual preset this repo was still missing from the original project is now here**: the upstream fork [XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio) ships two "Sonic Echo" presets; v1.8.8 only brought over the three.js rewrite, and this release brings the other one
- **New 9th visual preset, "Sonic Echo · Wallpaper Engine"** (original by CmzYa): `public/vendor/sonic-workshop/` holds the build output of CmzYa's Wallpaper Engine piece, embedded as-is in a full-window iframe. The entire picture is rendered by the original — this repo only feeds it data
- Two "Sonic Echo" entries now sit side by side in the preset panel: preset 7 is labelled "ported from Ajin", preset 8 "original by CmzYa"
- The wallpaper layer cannot be clicked through (the layer and every element inside it are `pointer-events:none`, plus `inert` and `aria-hidden`), so mouse, keyboard focus and screen readers all land on the player instead. Picking this preset folds the cover particle layer away and leaves only the wallpaper
- It is fed live data from this app: a 512-band spectrum every 33 ms, track info and cover art every 250 ms, palette properties every 1000 ms — and immediately on a track or settings change
- Colours follow the current cover art (primary as the cool tone, secondary as the warm one, highlight as the ripples), falling back to the original's deep blue and warm orange when the cover yields nothing (v1.9.0 switched this to the raw cover colours)
- The quality tier picks the grid resolution (eco 224 / balanced 288 / high 320 / ultra 384); the default "high" is exactly the 320 in the original's `project.json` (v1.9.0 pinned it to 320 for every tier)
- All four vendored files are byte-identical to upstream commit `89c0d23`; copyright and attribution are in [NOTICE.md](NOTICE.md). The third-party bundle was audited — no network calls, no local storage writes, no `eval` — and that conclusion is now pinned by a regression test
- Full Node regression suite: `965/965` passing (new `tests/sonic-workshop-preset.test.js` with 26 cases)

<details>
<summary>v1.8.8 — Sonic Topography became a port</summary>

- **The "Sonic Topography" visual preset is now a port**: a field of pillars rises with eight spectrum bands, kicks fire blue ripples, snares and highs fire thin white ones, meteors occasionally fall and burst into a ripple plus a spray of trails, and floating blocks above pulse and tumble with the kick envelope
- The visual algorithm is ported from the community fork [XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio) (GPL-3.0); the original concept is CmzYa's Wallpaper Engine piece. Attribution and licensing are in [NOTICE.md](NOTICE.md)
- The same-named preset shipped in v1.8.7 was my own spectrum ring and did not match the original project, so it has been replaced wholesale
- Clicking (not dragging) on the canvas drops a ripple at the pointer; hold longer for a stronger one
- Full Node regression suite: `939/939` passing (new `tests/sonic-topography-preset.test.js` with 16 cases)

</details>

<details>
<summary>v1.8.7 — New Sonic Echo visual preset, no more black flash when leaving fullscreen</summary>

- **New 8th visual preset** (at the time a self-written spectrum ring; replaced by the port in v1.8.8)
- It sits second in the preset panel; picking anything else costs nothing extra, and entering or leaving it never flashes the previous session's spectrum
- **Leaving fullscreen no longer flashes black and stutters**: the cover is laid down before the native exit is called, reveal fires as soon as the viewport has settled, later duplicate resize signals may only pull the reveal earlier — never push it back — and a 320 ms hard ceiling backs it up
- The transition no longer puts a `filter` on the window shell that hosts the WebGL canvas (it forces the whole window to recomposite every frame)
- Full Node regression suite: `932/932` passing

</details>

<details>
<summary>v1.8.6 — Click the bottom-left thumbnail for song details</summary>

- **The now-playing thumbnail in the bottom-left corner is clickable**: it opens the song details. Previously only the track name beside it responded — the cover itself did nothing
- The cursor turns into a hand over the cover; the title and artist lines behave exactly as before (title opens song details, the artist line opens artist details)
- While nothing is playing the whole thumbnail still ignores clicks, unchanged
- Full Node regression suite: `916/916` passing (new `tests/now-playing-detail-click.test.js`, 4 cases)

</details>

<details>
<summary>v1.8.5 — Play statistics no longer under-count</summary>

- **Closing the window now settles the track you were on**: previously the song playing at exit was never counted, so it could never reach the play statistics
- **Edits made right before exit are no longer lost**: user state is written 120 ms late, and that write never ran on window close; it is now flushed at unload. Play statistics, custom cover art / lyrics / beat maps and effect presets were all affected
- **Files whose duration is not known yet (APE, DSF) are now timed**: listening time used to stay at 0, so only playing a track to the very end counted as a play
- **Listening while minimised is no longer under-counted**: the timer does not run while the window is minimised and only 4.2 s were credited on return; the whole gap is now credited. Seeking, stalls and pauses still do not count as listening
- The three accounting gates — finished / 45 s listened / half the track — are unchanged, and there is no UI change
- Full Node regression suite: `912/912` passing (new `tests/listen-stats-accounting.test.js`, 7 cases)

</details>

<details>
<summary>v1.8.4 Library maintenance: five checks that spell out what is missing</summary>

- **The library home page gains a third card section, "Library maintenance"**: duplicates / missing files / no cover art / no lyrics / tag problems. Each one opens as an ordinary playlist — back, play all, lazy loading all unchanged. All five belong to the same family as the smart categories: computed live from the current library, **never persisted, never written to SQLite**, so results follow the library instead of leaving a stale "last scan result" behind
- **Duplicate detection groups by normalised "title + artist" but deliberately does not strip `(Live)` / `(Remix)` suffixes** — stripping them would judge a live version and a studio version to be the same track, and under-reporting beats false alarms. After a title+artist collision it re-checks by file size or duration: identical size counts as a duplicate, and a duration differing by more than 2 seconds is dropped from the group — but **nothing is dropped while duration has not been read yet**
- **Missing files is the one check that must ask the disk**, so it runs only when you open that entry or press "Re-scan". The desktop shell gains a status-code-only channel: the main process confirms each path one by one and returns just "still there / gone / not inside an authorised music folder" — **not a single byte of file content**. "Not authorised" and "deleted" are recorded separately. The renderer asks in batches of 400, so a library of tens of thousands never freezes the UI
- **Every no-cover / no-lyrics / tag verdict is three-state: yes / no / not known yet.** The "not known yet" share is reported separately as "N to scan" — **never padded into the problem list, never quietly counted as fine**. No image beside the file plus a format that cannot carry embedded art is a verdict with zero disk reads; a `.lrc` that sits right there but reads back empty or fails to decrypt still counts as "no lyrics"
- **Tag problems check title / artist / album / duration for absence, plus the format of year and track number**; year and track number are only validated when they carry a value. **Right after a fresh import, while tags are still unread, everything is recorded as "to scan" rather than reported as broken**
- Card subtitles state the counts plainly ("12 tracks · 340 to scan · no embedded or folder cover art"); the missing-files card switches wording by scan state and offers neither "Play all" nor the card's ▶ — the files are gone, playing them would only error — showing "Re-scan" instead
- All four pure buckets are filled in a single pass and cached against a "library length + first/last key + asset epoch" signature, so a 20,000-track library is walked once; when background cover / lyric scanning reaches a verdict the numbers follow on their own
- **Zero UI churn: `public/index.html` and `public/app.css` were not touched**, the maintenance cards reuse the existing card, section-label and mini-button styles
- Known limits: missing-file detection depends on the desktop shell's disk channel, so **in plain browser mode that entry says "this environment does not support disk checks"**; how the five cards look in a real window was not verified visually this round
- Full Node regression suite: `905/905` passing (new `tests/library-maintenance.test.js`, 24 cases)

</details>

<details>
<summary>v1.8.3 — Encrypted QRC lyrics, and picking among same-named lyric files</summary>

- **Encrypted QRC lyrics can now be read**: both on-disk carriers are accepted — the hex text an API returns verbatim, and the raw binary ciphertext. Detection looks only at content features, so a renamed encrypted QRC is still recognised while existing plaintext QRC / LRC files are never mistaken for ciphertext
- The chain is 3DES but **not standard 3DES**: the DES port QQ Music uses carries several deviations from the spec (S-box typos, the PC-2 offset, little-endian 32-bit key words, 15 rounds plus a half round, no final swap of the halves), so it had to be transliterated from the in-the-wild implementation. Each block runs `D(K3) → E(K2) → D(K1)`, the result is a zlib stream, and the UTF-8 BOM is stripped after inflating. Inflating still uses `DecompressionStream`, which both Chromium and Node ship — **no new dependency**
- **When several lyric files share a track's name, the format now decides** instead of whichever file was enumerated first: word-by-word timing (`.qrc` / `.krc` / `.ttml` / `.yrc`) > line-based `.lrc` > subtitles (`.ass` / `.srt` / `.vtt`) > `.txt` > unknown extensions, with paths breaking ties, so the same batch of files imports identically every time
- **You can also pick by hand**: when a track has two or more lyric files, the custom-lyrics dialog gains a row of candidate buttons labelled with path and format. The choice is remembered, so **re-importing the same batch keeps the file you picked**; if that file later disappears it falls back to the top-priority match. Switching clears the old lyric cache state and propagates to the same track in the play queue and playlists
- **Lyric encoding is detected automatically**: UTF-8 / UTF-16LE / UTF-16BE with a BOM are decoded by BOM and the BOM is stripped; BOM-less UTF-16 is sniffed from byte distribution; anything that is neither UTF-16 nor valid UTF-8 is tried as `gb18030` → `big5` → `shift_jis` → `euc-kr` → `windows-1252`, keeping whichever produces the fewest garbage characters. **Valid UTF-8 is never re-guessed**, so existing UTF-8 lyrics are byte-for-byte unchanged
- **Several in-the-wild timestamp spellings are fixed**: the `[offset:+500]` global offset now applies per the LRC convention (positive is earlier, negative later, and a line pushed past zero clamps to 0 instead of going negative); `[mm:ss:cc]` (the old colon-as-decimal-point form) and `[hh:mm:ss.fff]` (with hours) are both accepted; fractional digits scale by their actual length, so `[00:01.1234]` is no longer read as ten times its value; and minutes widen to three digits, so audio longer than an hour is not truncated
- Fixed a defect that only triggered on specific filenames: a track named `constructor.mp3` (or `toString` / `valueOf` / `__proto__`) made the candidate lookup pull `Object` itself out as the candidate array and inject an empty candidate off `Object.length === 1`; lookups now check own properties first
- `.qrc` now serves as `application/octet-stream` instead of `application/xml; charset=utf-8` (in both the local-file proxy and desktop library), otherwise an encrypted binary is mangled as text before decoding
- Nearly no UI change: `public/index.html` only gained one candidate-button row inside the existing custom-lyrics dialog (reusing the existing `btn-row` class), and **`public/app.css` was not touched**
- Known limits: **no real encrypted QRC file was available to check against.** Correctness of the chain rests on a big-integer reference implementation compared round by round, six known-answer vectors and one full-chain ciphertext; how real files look in the window was not verified visually this round
- Full Node regression suite: `881/881` passing (new `tests/lyric-format-hardening.test.js`, 10 cases)

</details>

<details>
<summary>v1.8.2 — Multi-format lyrics: KRC / QRC / TTML all read, word timing unchanged</summary>

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
