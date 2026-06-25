# Mineradio Security Rebuild Log - 2026-06-24

## Context

- The user ran a full Huorong scan and quarantined many infected files.
- Old installers and old packaged builds are not trusted anymore.
- `v1.1.0` is the clean-install security rebuild release. Build and publish only from the current trusted source tree, not from old packaged output.

## Current Source Boundary

- Active source repository: `E:\桌面\播放器软件\Mineradio\resources\app`
- Current code version: `1.1.0`
- Any generated `dist/` output must come from this current source tree and be scanned before upload.
- `.playwright-cli/`, `output/`, and `tmp/` are ignored and must not be pushed.
- Git-tracked executable/script residue check returned 0 tracked `.exe/.dll/.scr/.bat/.cmd/.ps1/.vbs/.jse/.wsf/.hta/.xlsm` files.

## Scan Notes

- Defender signature update completed before verification.
- Defender scan of current source via an English junction returned: `found no threats`.
- Huorong detections shown by the user were concentrated in `E:\桌面\播放器软件\工作区备份\2026-06-18-workspace-cleanup`, mostly old `node_modules`, old builder caches, and old packaged backup files.
- Those old backup files must not be used as restore sources.

## Update Fix Boundary

- Software update failures should stop in a clear error state.
- Fast patch failure must not automatically start a full installer download.
- Full installer download completion must not automatically open the installer.
- A verified already-downloaded installer may be reused to avoid repeat downloads.
- `v1.1.0` is intentionally not provided as an in-app local update from `v1.0.10`; users should download the new installer manually and do a clean install.

## Public Release Boundary

- `v1.0.10` and older installer assets should be treated as untrusted legacy artifacts and marked with quarantine warnings in GitHub release notes.
- Do not generate or upload `v1.0.10 -> v1.1.0` patch assets.
- Do not upload `latest.yml` for this release path if the goal is to avoid the old in-app update channel.
- Provide checksum information for the new installer so users can verify the clean build artifact.

## Before Any Installer Release

- Build from current Git-tracked source only.
- Do not reuse old `dist/`, old installers, old `node_modules`, or old backup packages.
- Run syntax checks and security scan on the new build output.
- Prefer code signing before public installer upload.
