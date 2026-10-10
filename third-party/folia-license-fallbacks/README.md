# Folia bundled dependency license fallbacks

These files preserve original notices omitted from specific npm archives. They are used only when that exact package name and version is actually present in Folia's output chunks and has no license/notice file in its installed archive. Builds never fetch license text from the network.

`manifest.json` records the package version, declared license, immutable upstream source, published package integrity, retrieval date, and SHA-256 of each normalized LF license file. The collector rejects a mismatched declared license or changed fallback text. A dependency upgrade does not automatically inherit an older version's fallback; it must contain its own license or receive a separately verified entry.

- `@pixi/colord@2.9.6`: npm metadata names Git commit `5344fbf77b736f81cd33c21050021bc09bc9dd1d`; the upstream commit contains `LICENSE.md` and a `package.json` with version `2.9.6`. The npm tarball contains neither a LICENSE nor a NOTICE file. The retained text is the full original MIT license with Vlad Shilov's copyright.
- `@react-three/fiber@9.8.1`: npm metadata names Git commit `53ec672ac4a7189711766b87ece18889abbb32d4`; the upstream commit contains `LICENSE`, and `packages/fiber/package.json` identifies `@react-three/fiber@9.8.1` under MIT. The published tarball's SHA-512 matches npm metadata and its 40 files contain no LICENSE or NOTICE. The retained text is the full original MIT license with the 2019–2025 Poimandres copyright.

Keep this directory with `scripts/folia-licenses.cjs` when distributing the reproducible build source. The aggregate notices are emitted as `public/vendor/folia/THIRD-PARTY-LICENSES.txt` in the application package.
