# Patches applied to bundled third-party programs

## windowtolayer

**Program**: windowtolayer — a GPL-3.0 program bundled with the Folia Linux package to
implement desktop wallpaper mode (`wlr-layer-shell` bottom layer).
**Upstream**: https://gitlab.freedesktop.org/mstoeckl/windowtolayer
**Base revision**: `618a482d791e90f4977d643c206417f6aee73936`
**License**: GPL-3.0 (the program's `COPYING` is shipped as `resources/windowtolayer-COPYING`)

Applied by `packaging/linux/build-windowtolayer.mjs`: it initializes or reuses the cached source
workspace, fetches the pinned revision, and `git apply`s the patches listed in its `PATCHES` array,
in order. To refresh after an upstream rework, bump `PINNED_REV` in that file, re-apply the fixes
by hand, regenerate each patch with
`git diff <file>`, and update the base revision here.

### `windowtolayer-popup-resilience.patch` (popup/menu resilience fix)

Upstream treats any request-handling error as fatal, so unsupported requests (e.g. popups,
context menus) make windowtolayer exit and break the wrapped client's Wayland connection.
The patch logs and skips such messages instead of exiting.

### `windowtolayer-single-layer-window.patch` (only the main window becomes the wallpaper)

Upstream converts *every* `xdg_toplevel` the wrapped client creates into a
`zwlr_layer_surface_v1`, and filters the compositor's `xdg_wm_base` global out entirely. Folia
wraps its whole process, so the remote control window, detached devtools and GTK dialogs all
turned into full-size bottom-layer surfaces stacked on top of the wallpaper.

The patch binds the compositor's real `xdg_wm_base` for windowtolayer's own use and gives the
layer surface to a single window at a time:

- the first toplevel created claims the layer-surface slot and is translated as before; the
  slot is released when that toplevel is destroyed, so a client rebuilding its main window
  gets the wallpaper back (see `recreateMainWindowWithTransparencyMode` in
  `electron/main.cjs`);
- every other toplevel is forwarded to `xdg_wm_base` unchanged, so it behaves like a normal
  window (`xdg_surface`, `xdg_toplevel`, `zxdg_toplevel_decoration_v1` and popups are passed
  through; `xdg_toplevel::set_parent` pointing at the layer window is forwarded with a null
  parent, since a layer surface has no `xdg_toplevel` to parent to);
- `xdg_wm_base::ping` on windowtolayer's own object is answered by the proxy;
- if the compositor has no `xdg_wm_base` new enough for what the client bound, the forwarding
  is refused and the message is skipped by the resilience patch above.

Verified on Hyprland with a three-window GTK4 client: one layer surface, the other windows
listed as ordinary `hyprctl clients`, popups on them working, and no protocol errors.

### License / source compliance

The distributed binary is built from the upstream source at the base revision plus these
patches. Together they are the "complete corresponding source" required by GPL-3.0; the
upstream URL, base revision, and patch logic are all published here.
