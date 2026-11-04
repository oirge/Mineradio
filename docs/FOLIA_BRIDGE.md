## Video export extension (v2.6.7)

- getVideoExportState, startVideoExport({width,height,startMode:'from-start'|'current',transitionBehavior:'continue'|'save',visuals}), stopVideoExport and cancelVideoExport return {supported,status,progress,elapsed,transitionBehavior,fileName?,error?}. The videoExport event publishes job changes independently of the panel lifecycle.
- The default continue policy records one file across track changes and seeks, replacing display-only track/lyrics/analysis data. save ends the recording before a transition. A completed queue with no next playback is saved automatically. Pausing audio pauses recording. startMode chooses the recording start; continue can then follow subsequent playback.
- Supported sizes: 1280x720, 1920x1080, 720x1280, 1080x1920 with a target of 30 fps. Actual frame rate depends on hardware and effect complexity. MP4 is preferred and WebM is the capability fallback. Recording is real time. Speaker volume/mute do not affect the exported audio; EQ, ReplayGain and playback speed do.
- Desktop privileges remain in the trusted main frame. A separate hidden /vendor/folia/index.html?videoExport=<job-id> receives snapshots and a restricted display-only preload, paints original Folia effects, and never owns an audio element. Complete compositor frame subscriptions include DOM and GPU lyric layers. One pending acknowledged frame, one latest frame and bounded chunk writes avoid retaining the full video in memory.
- mineradio-video-export-options-v1 persists only {transitionBehavior}. It participates in desktop UI state and machine backup, and does not change visual presets.

# Mineradio ↔ Folia bridge v1

The isolated Folia local player runs in the host-owned `/vendor/folia/index.html` iframe, using `src/mineradio/local-entry.tsx`, not the upstream App/bootstrap. Mineradio owns audio, library, playlists and persistence. No Folia audio element may play. Messages are accepted only from the exact iframe window and host origin.

The embedded surface has three local views: `lyrics`, `records` (the floating Polaroid hex wall), and `posters` (the original Lattice poster wall). All three consume the same host state, playhead and commands. Their view switch never creates another audio output or imports the full Folia application, online provider catalog, or playback store. The lyric surface exposes 14 original renderers and the 12 settings panels present upstream, plus local image assets and five local background modes.

```js
// Folia → parent
{ channel: 'mineradio-folia', version: 1, type: 'request', id: 'unique-string', method, params: {} }
// Parent → Folia
{ channel: 'mineradio-folia', version: 1, type: 'response', id, ok: true, result }
{ channel: 'mineradio-folia', version: 1, type: 'response', id, ok: false, error: { code, message } }
{ channel: 'mineradio-folia', version: 1, type: 'event', event, data }
```

All times are **seconds**. Track IDs are opaque stable Mineradio IDs. Read results contain projected data, never live song objects or audio Blobs.

## Data

- `Track`: `{id,title,artist,album,duration,cover,liked,filePath,format}`. `filePath` is only an already indexed local song path. `cover` is an image URL or empty string.
- `Playlist`: `{id,name,count,cover,readOnly}`. Built-ins: `library` (all tracks), `special-liked` (favorites). User lists use opaque `local-playlist:*` IDs.
- `State`: `{currentTrack,currentIndex,position,duration,playing,playbackRate,volume,muted,playMode,queueRevision,libraryRevision,lyricsRevision,interface}`. `volume` is 0–1; `playbackRate` drives local playhead interpolation without becoming a second playback clock. Native `playMode` is `loop` (ordered repeat all), `shuffle` (shuffled queue), or `single` (repeat one). `interface` is `folia` or `mineradio`.
- Playback preferences in State: `sleepTimer:{mode,dueAt,fading}`, `replayGain:{enabled,mode,preampDb,clipGuard}`, `gapless:{enabled,crossfadeSeconds}`. `dueAt` is an absolute epoch time in milliseconds; the UI updates its remaining-minute label only while the shortcut panel is open. Settings are copied snapshots, and their discrete changes join the local state signature.
- `Lyrics`: `{trackId,lines:[{time,endTime,text,translation,words:[{time,duration,text}]}]}`. Lines without genuine lyrics are omitted. Words may be empty.
- `Analysis`: `{trackId,revision,source:'cache'|'live',until?,beats,drums,vocal}`. Beat events use Folia's original `BeatFxEvent` contract. Drums carry typed `times/strengths/kinds`; the optional 50 Hz vocal-band envelope carries `db/top/onsets/from`. These are estimates from the host's existing beat/band analysis, not separated stems. `until` limits partial-cache coverage; use live FFT outside it. No large arrays travel in State.
- A page is `{items,total,offset,limit}`. `limit` defaults to 100 and is clamped to 1–1000.

## Methods

| Method | Params | Result |
| --- | --- | --- |
| `getState` | `{}` | State |
| `setPlaybackRate` | `{rate}` (0.5–2) | State; applies the host setter to both existing decks and saves the preference |
| `setSleepTimer` | `{mode:'off'|'track'|'15'|'30'|'60'}` | State; reuses the host timer and fade-to-pause behavior |
| `setReplayGain` | `{enabled?,mode?:'track'|'album',preampDb?,clipGuard?}` | State; validates the whole edit, commits through host normalization, saves and recalculates current gain |
| `setGapless` | `{enabled?,crossfadeSeconds?}` | State; validates and commits through the existing host normalization (0–10 s in 0.5 s steps) |
| `listTracks` | `{offset?,limit?,query?,playlistId?}` | Track page; default playlist `library` |
| `listPlaylists` | `{}` | Playlist[] |
| `getQueue` | `{offset?,limit?,query?}` | Track page plus `currentIndex,revision` |
| `getLyrics` | `{}` | Lyrics for current track |
| `getAnalysis` | `{}` | Current Analysis; reads existing cache only, never starts an analysis job or changes playback/cinema preferences |
| `play` | `{id,playlistId?}` | State; use playlist as queue when supplied |
| `playQueue` | `{index}` | State |
| `togglePlay`, `pause`, `resume`, `next`, `previous` | `{}` | State |
| `seek` | `{seconds}` | State |
| `setVolume` | `{volume}` | State |
| `setMuted` | `{muted}` | State; preserves previous audible volume |
| `setPlayMode` | `{mode:'loop'|'shuffle'|'single'}` | State |
| `shuffleQueue` | `{}` | State; one-shot shuffle through the host, preserving loaded media, position and playback mode |
| `getAudioOptions` | `{}` | EQ frequencies, built-in presets and limits, plus a refreshed device list |
| `setAudioChain` | `{enabled?,autoPreamp?,limiterEnabled?,spatialEnabled?,preampDb?,limiterThresholdDb?,widthRatio?,preset?,band?:{index,gain}}` | State; validates the complete edit before normalizing and committing through the host |
| `setOutputDevice` | `{deviceId}` | State; checks host support and known/saved IDs, then uses the existing sink selector and fallback |
| `setQueue` | `{trackIds,currentIndex?}` | State; edits queue without restarting current audio |
| `addToQueue` | `{id}` | State; atomically append an indexed local track, deduplicating by its stable ID, without starting or restarting audio |
| `toggleLike` | `{id}` | `{id,liked}` |
| `createPlaylist` | `{name}` | Playlist |
| `renamePlaylist` | `{id,name}` | `{ok:true}` |
| `deletePlaylist` | `{id}` | `{ok:true}` |
| `addToPlaylist`, `removeFromPlaylist` | `{playlistId,trackIds}` | `{ok:true,count}` |
| `setPlaylistTracks` | `{playlistId,trackIds}` | `{ok:true,count}`; replace ordered membership and deduplicate, supports user lists and `special-liked` |
| `importFolder`, `importFiles` | `{}` | `{ok:true}`; opens the host file picker |
| `switchInterface` | `{mode:'mineradio'|'folia'}` | State |

## Events and lifecycle

State also exposes copied `audioChain` settings (including a derived preset ID) and `outputDevice` preference/runtime snapshots. `getAudioOptions` refreshes devices only on demand; it never creates audio output or requests microphone permission. Device errors, saved-but-deferred selections and temporary system-default fallback remain host-owned.

The local command palette queries at most 20 tracks per page and ignores late results. The same isolated action registry drives both configurable playback buttons and commands; it does not import the upstream provider registry. The two distinct button choices live in `mineradio-folia-local-controls-v1`, included in the host persistence and full-backup whitelists. Subtitle row/content/background/visibility preferences join the existing visual key and preset export; playback controls remain outside visual presets.

- `state`: light State every 200 ms while Folia is active; no entire library or queue.
- `libraryChanged`: `{revision}` after library, favorites or playlists change. Refetch relevant catalog pages and playlists.
- `tracksChanged`: `{updates:[{track,searchableChanged}]}` for batched local metadata or cover changes. Patch matching visible tracks without refetching the whole catalog; a nonempty search must recheck membership when `searchableChanged` is true. This event does not increment `libraryRevision`.
- `queueChanged`: `{revision}` after queue structure changes. Refetch queue pages.
- `lyrics`: full current Lyrics after lyric source or translation changes; never all library lyrics.
- `audio`: `{frequency:Uint8Array,sampleRate,fftSize,trackId,position,playing}`. Raw Web Audio frequency bytes (0–255), approximately 30 Hz while playing and Folia active, slower while paused. Frequency length is `fftSize / 2`; the unused time-domain data is not sent. Folia also accepts a legacy `number[]` frequency payload. Reject frames owned by another track; use the existing analyser, no new output graph.
- `analysis`: full current Analysis only on a track/cache revision change. Late asynchronous disk responses must match both the current track and read ticket. Folia checks track ownership and revision again. The local player advances the original beat clock and MotionValues from its existing RAF; `state.outputLatency` and playback rate compensate the heard time once. Pause/visibility stops the same clock and seek repositions without replaying old beats.
- `visibility`: `{active:boolean}`. Suspend Folia rendering while inactive.

Initial synchronization: install the listener, call `getState`, `listPlaylists`, first `listTracks` page, `getQueue`, and `getLyrics`. Keep the iframe mounted when switching back so settings and navigation survive. Neither interface switch rebuilds the audio engine or changes playback. Host suspend/resume applies to visual loops only; desktop lyrics and audio remain live.

`setQueue` always preserves the loaded current track object and its audio position. If `trackIds` omitted that current track, it is retained at the beginning of the resulting queue; read `getQueue` for the actual result. `currentIndex` applies only when no media is loaded. This preserves Mineradio's media/lyrics ownership invariant while editing the queue. Explicit `play` or `playQueue` changes tracks.

`addToQueue` preserves queue order, the current track and its playback position. Repeating it for an existing entry does not duplicate that entry; appending to an empty queue does not auto-play. The Polaroid `+` action uses this atomic method instead of fetching the full queue and replacing it with a potentially stale `setQueue` request.

Both walls use the shared local catalog adapter to page through `listTracks` and project `Track` into Folia's display-only `SongResult`: `id` stays unchanged, `sourceRef` is `{kind:'local',mediaId:id}`, and `localRef.songId` is the host ID. Only `durationMs` is converted to milliseconds for original card labels. Playback still sends `play {id,playlistId}` for the complete collection; browsing/searching a wall does not replace the queue with its visible tiles. Card transforms, Lattice camera/lyrics, images and settings are local UI work and require no new bridge-side audio service.

The view choice, renderer tuning, rhythm-response toggle and named `presets` live in `mineradio-folia-local-visuals-v1`; Lattice appearance lives in `mineradio-folia-local-lattice-v1`. Presets snapshot visual parameters, excluding view routing, playback, the preset collection and image leases. Resetting the current appearance preserves presets. Imported visual images use the separate shared `mineradio-folia-visual-assets-v1` IndexedDB cache. These are visual preferences/assets, not Folia library, account, synchronization, or audio state.

The iframe URL is `/vendor/folia/index.html?host=mineradio&surface=local-player-v3`. Current cover data URLs are converted to bounded host-owned image Blob URLs to avoid copying full cover bytes with every 200 ms state update. Catalog pages retain existing thumbnail URLs. These are image leases only, never audio output or media-file copies.
