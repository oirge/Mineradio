# Mineradio Local Player

[中文](./README.md) · English

This is a locally modified version of Mineradio, rebuilt as a local-only music player.

Original project: [XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio)

## Main Changes

- Removed login, online music entry points, update notices, and unnecessary guides.
- Supports importing a local music folder.
- Supports importing individual local music files.
- Supports MP3 / FLAC playback.
- Supports matching `.lrc` / `.txt` lyric files.
- Supports embedded `LYRICS` tags in FLAC files, including time-synchronized LRC lyrics.
- Supports cover images in the same directory and embedded audio artwork.
- Removed the local rhythm analysis feature.

## Usage

```bash
npm install
npm start
```

Build the Windows installer:

```bash
npm run build:win
```

Build artifacts are written to `dist/`.

## Notes

This repository is a locally modified player intended mainly for personal music libraries. It does not provide online music search, login, paid music sources, or music content distribution.

Please make sure that the music files you import and play are obtained and used legally.

## License

This project follows the original project license. See [LICENSE](./LICENSE).
