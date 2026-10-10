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
- `Lyrics`: `{trackId,lines:[{time,endTime,text,translation,words:[{time,duration,text}]}]}`. Lines without genuine lyrics are omitted. Words may be empty.
- A page is `{items,total,offset,limit}`. `limit` defaults to 100 and is clamped to 1–1000.

## Methods

| Method | Params | Result |
| --- | --- | --- |
| `getState` | `{}` | State |
| `listTracks` | `{offset?,limit?,query?,playlistId?}` | Track page; default playlist `library` |
| `listPlaylists` | `{}` | Playlist[] |
| `getQueue` | `{offset?,limit?,query?}` | Track page plus `currentIndex,revision` |
| `getLyrics` | `{}` | Lyrics for current track |
| `play` | `{id,playlistId?}` | State; use playlist as queue when supplied |
| `playQueue` | `{index}` | State |
| `togglePlay`, `pause`, `resume`, `next`, `previous` | `{}` | State |
| `seek` | `{seconds}` | State |
| `setVolume` | `{volume}` | State |
| `setMuted` | `{muted}` | State; preserves previous audible volume |
| `setPlayMode` | `{mode:'loop'|'shuffle'|'single'}` | State |
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

- `state`: light State every 200 ms while Folia is active; no entire library or queue.
- `libraryChanged`: `{revision}` after library, favorites or playlists change. Refetch relevant catalog pages and playlists.
- `queueChanged`: `{revision}` after queue structure changes. Refetch queue pages.
- `lyrics`: full current Lyrics after lyric source or translation changes; never all library lyrics.
- `audio`: `{frequency:number[],timeDomain:number[],sampleRate,fftSize}`. Raw Web Audio byte values (0–255), approximately 30 Hz while playing and Folia active, slower while paused. Frequency length is `fftSize / 2`, timeDomain length is `fftSize`. Use the existing analyser; no new output graph.
- `visibility`: `{active:boolean}`. Suspend Folia rendering while inactive.

Initial synchronization: install the listener, call `getState`, `listPlaylists`, first `listTracks` page, `getQueue`, and `getLyrics`. Keep the iframe mounted when switching back so settings and navigation survive. Neither interface switch rebuilds the audio engine or changes playback. Host suspend/resume applies to visual loops only; desktop lyrics and audio remain live.

`setQueue` always preserves the loaded current track object and its audio position. If `trackIds` omitted that current track, it is retained at the beginning of the resulting queue; read `getQueue` for the actual result. `currentIndex` applies only when no media is loaded. This preserves Mineradio's media/lyrics ownership invariant while editing the queue. Explicit `play` or `playQueue` changes tracks.

`addToQueue` preserves queue order, the current track and its playback position. Repeating it for an existing entry does not duplicate that entry; appending to an empty queue does not auto-play. The Polaroid `+` action uses this atomic method instead of fetching the full queue and replacing it with a potentially stale `setQueue` request.

Both walls use the shared local catalog adapter to page through `listTracks` and project `Track` into Folia's display-only `SongResult`: `id` stays unchanged, `sourceRef` is `{kind:'local',mediaId:id}`, and `localRef.songId` is the host ID. Only `durationMs` is converted to milliseconds for original card labels. Playback still sends `play {id,playlistId}` for the complete collection; browsing/searching a wall does not replace the queue with its visible tiles. Card transforms, Lattice camera/lyrics, images and settings are local UI work and require no new bridge-side audio service.

The view choice and renderer tuning live in `mineradio-folia-local-visuals-v1`; Lattice appearance lives in `mineradio-folia-local-lattice-v1`. Imported visual images use the separate `mineradio-folia-visual-assets-v1` IndexedDB cache. These are visual preferences/assets, not Folia library, account, synchronization, or audio state.

The iframe URL is `/vendor/folia/index.html?host=mineradio&surface=local-player-v3`. Current cover data URLs are converted to bounded host-owned image Blob URLs to avoid copying full cover bytes with every 200 ms state update. Catalog pages retain existing thumbnail URLs. These are image leases only, never audio output or media-file copies.
