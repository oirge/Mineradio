"""Verify the built local-only Folia player against Mineradio's real host/audio."""
import json
import math
import os
import re
import struct
import wave
import shutil
from pathlib import Path
from urllib.parse import urljoin
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "verification" / "folia"
OUTPUT.mkdir(parents=True, exist_ok=True)
FILES = []
for index, name in enumerate(["Folia-Blue", "Folia-Amber"]):
    path = OUTPUT / f"{name}.wav"
    with wave.open(str(path), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(16000)
        one_second = b"".join(struct.pack("<h", int(180 * math.sin(2 * math.pi * (220 + index * 110) * sample / 16000))) for sample in range(16000))
        audio.writeframes(one_second * 300)
    lyric = OUTPUT / f"{name}.lrc"
    lyric.write_text("[00:00.00]测试歌曲开始\n[00:05.00]两个界面共享同一条时间轴\n[00:15.00]切换之后继续播放\n[00:35.00]这是本地歌词\n[01:10.00]测试即将结束\n", encoding="utf-8")
    FILES.extend([str(path), str(lyric)])


WALL_FILES = []
for index in range(18):
    track_path = OUTPUT / f"Folia-Wall-{index + 1:02d}.wav"
    with wave.open(str(OUTPUT / "Folia-Blue.wav"), "rb") as source, wave.open(str(track_path), "wb") as target:
        target.setparams(source.getparams())
        target.writeframes(source.readframes(60 * source.getframerate()))
    lyric_path = track_path.with_suffix(".lrc")
    shutil.copyfile(OUTPUT / "Folia-Blue.lrc", lyric_path)
    WALL_FILES.extend([str(track_path), str(lyric_path)])


def set_range(locator, value):
    """Drive the rendered range's native input events; Playwright fill excludes ranges."""
    locator.evaluate("""(element, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, String(value));
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }""", value)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--mute-audio", "--autoplay-policy=no-user-gesture-required", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    context = browser.new_context(viewport={"width": 1440, "height": 900}, locale="zh-CN")
    context.add_init_script("""
      {
        // Audit every frame, including its initial about:blank document before navigation.
        // Count detached Audio instances too: a DOM-only assertion misses a second engine.
        window.__localAudioAudit = { audioElements: 0, audioConstructors: 0, audioContexts: 0 };
        const createElement = document.createElement;
        document.createElement = function(name, ...args) {
          if (String(name).toLowerCase() === 'audio') window.__localAudioAudit.audioElements++;
          return Reflect.apply(createElement, this, [name, ...args]);
        };
        for (const name of ['Audio', 'AudioContext', 'webkitAudioContext', 'OfflineAudioContext']) {
          if (typeof window[name] !== 'function') continue;
          const key = name === 'Audio' ? 'audioConstructors' : 'audioContexts';
          window[name] = new Proxy(window[name], {
            construct(target, args, newTarget) {
              window.__localAudioAudit[key]++;
              return Reflect.construct(target, args, newTarget);
            }
          });
        }
      }
      try { localStorage.setItem('mineradio-visual-guide-seen-v2', '1'); } catch {}
    """)
    page = context.new_page()
    errors, console_errors, passed, visual_modes, background_modes = [], [], [], [], []
    child = None
    scope = {}
    page.on("pageerror", lambda error: errors.append(error.stack or str(error)))
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.route("**/api/lyric-translate", lambda route: route.fulfill(status=200, json={"translations": []}))

    def checkpoint(name):
        assert not errors, f"{name}: page errors: {errors}"
        assert not console_errors, f"{name}: console errors: {console_errors}"
        if child:
            expect(child.get_by_test_id("local-error")).to_have_count(0)
        passed.append(name)
        print(f"PASS: {name}", flush=True)

    def assert_single_audio():
        assert page.evaluate("audio === window.__foliaTestAudio"), "The host audio instance changed"
        assert child.locator("audio").count() == 0, "Local Folia created an audio element"
        audit = child.evaluate("window.__localAudioAudit")
        assert audit is not None, "The child audio audit did not initialize"
        assert not any(audit.values()), f"A second playback engine was constructed: {audit}"
        return audit

    try:
        page.goto(os.environ.get("FOLIA_TEST_URL", "http://127.0.0.1:3018"), wait_until="networkidle")
        page.wait_for_function("typeof MineradioFoliaHost === 'object'")
        assert page.locator("#folia-frame").count() == 0, "Folia must load lazily"
        page.locator("#file-input").set_input_files(FILES)
        page.wait_for_function("localLibrarySongs.length === 2 && audio && !audio.paused", timeout=30000)
        page.evaluate("window.__foliaTestAudio = audio")
        page.screenshot(path=str(OUTPUT / "mineradio-before.png"))
        page.locator("#folia-floating-switch").click()
        page.frame_locator("#folia-frame").get_by_test_id("local-player").wait_for(timeout=90000)
        child = next(frame for frame in page.frames if "/vendor/folia/" in frame.url)
        expect(child.get_by_test_id("local-player")).to_have_attribute("data-active", "true")
        expect(child.get_by_test_id("local-current-track")).to_contain_text("Folia-")
        assert not page.evaluate("audio.paused"), "Opening the surface interrupted playback"
        assert_single_audio()

        response = context.request.get(urljoin(page.url, "/vendor/folia/local-player-build.json"))
        assert response.ok, "The isolated build manifest is missing"
        assert response.headers.get('cache-control') == 'no-cache'
        entry_response = context.request.get(child.url)
        assert entry_response.headers.get('cache-control') == 'no-cache'
        scope = response.json()
        assert scope.get("surface") == "folia-local-player"
        assert scope.get("entry") == "src/mineradio/local-entry.tsx"
        forbidden_files = {"src/App.tsx", "src/bootstrap.tsx", "src/components/modal/SettingsModal.tsx", "src/stores/usePlaybackStore.ts", "src/mineradio/playback.ts", "src/services/db.ts", "src/services/appDatabase.ts"}
        forbidden = [name for name in scope["modules"] if name in forbidden_files or name.startswith(("src/components/remote/", "src/components/obs/", "src/mods/", "src/services/onlineMusic/"))]
        forbidden += [name for name in scope["modules"] if name.startswith("src/components/app/") and not name.startswith("src/components/app/lattice/")]
        assert not forbidden, f"The local build includes full application modules: {forbidden}"
        assert child.locator("#app-splash").count() == 0
        for label in ("在线音乐", "在线账户", "登录网易云", "Navidrome", "主题公园", "Theme Park", "OBS"):
            assert child.get_by_role("button", name=label, exact=True).count() == 0, f"Unrelated action remains: {label}"
        checkpoint("isolated-local-entry-and-shared-audio")

        child.get_by_test_id("local-open-library").click()
        expect(child.get_by_test_id("local-track-row")).to_have_count(2)
        child.get_by_test_id("local-search").fill("Folia-Blue")
        expect(child.get_by_test_id("local-track-row")).to_have_count(1)
        expect(child.get_by_test_id("local-track-row")).to_contain_text("Folia-Blue")
        child.get_by_test_id("local-search").fill("不存在的曲目")
        expect(child.get_by_test_id("local-track-row")).to_have_count(0)
        child.get_by_test_id("local-search").fill("")
        expect(child.get_by_test_id("local-track-row")).to_have_count(2)
        child.get_by_test_id("local-track-row").filter(has_text="Folia-Blue").locator("button[data-track-id]").click()
        page.wait_for_function("MineradioFoliaHost.getState().currentTrack.title === 'Folia-Blue' && !audio.paused")
        expect(child.get_by_test_id("local-current-track")).to_contain_text("Folia-Blue")
        page.screenshot(path=str(OUTPUT / "folia-local-library.png"))
        child.get_by_test_id("local-queue-tab").click()
        expect(child.get_by_test_id("local-track-row")).to_have_count(2)
        child.get_by_test_id("local-search").fill("Amber")
        expect(child.get_by_test_id("local-track-row")).to_have_count(1)
        child.get_by_test_id("local-track-row").locator("button[data-track-id]").click()
        page.wait_for_function("MineradioFoliaHost.getState().currentTrack.title === 'Folia-Amber'")
        assert page.evaluate("playQueue.length") == 2, "A filtered queue page replaced the full queue"
        child.get_by_test_id("local-search").fill("")
        child.get_by_test_id("local-open-library").click()
        child.get_by_test_id("local-previous").click()
        page.wait_for_function("MineradioFoliaHost.getState().currentTrack.title === 'Folia-Blue'")
        checkpoint("library-search-selection-and-filtered-queue")

        child.get_by_test_id("local-toggle-play").click()
        page.wait_for_function("audio.paused")
        paused_at = page.evaluate("audio.currentTime")
        page.wait_for_timeout(350)
        assert abs(page.evaluate("audio.currentTime") - paused_at) < 0.1
        set_range(child.get_by_test_id("local-seek"), 35)
        page.wait_for_function("Math.abs(audio.currentTime - 35) < 0.1")
        child.get_by_text("这是本地歌词", exact=True).first.wait_for(timeout=10000)
        progress = child.get_by_test_id("local-seek")
        progress.focus()
        progress.press("ArrowRight")
        page.wait_for_function("audio.currentTime > 35 && audio.currentTime < 35.2")
        child.get_by_test_id("local-toggle-play").click()
        page.wait_for_function("!audio.paused")
        child.get_by_test_id("local-next").click()
        page.wait_for_function("MineradioFoliaHost.getState().currentTrack.title === 'Folia-Amber' && !audio.paused")
        child.get_by_test_id("local-previous").click()
        page.wait_for_function("MineradioFoliaHost.getState().currentTrack.title === 'Folia-Blue' && !audio.paused")
        child.get_by_test_id("local-like").click()
        page.wait_for_function("MineradioFoliaHost.getState().currentTrack.liked")
        expect(child.get_by_test_id("local-like")).to_have_class(re.compile(r"is-liked"))
        set_range(child.get_by_test_id("local-volume"), 0.37)
        page.wait_for_function("Math.abs(targetVolume - 0.37) < 0.01")
        checkpoint("local-controls-pause-seek-lyrics-next-previous-favorite-volume")

        # Exercise production protocol CRUD after validating the actual visible controls.
        def command(method, params=None):
            return child.evaluate("""([method, params]) => new Promise((resolve, reject) => {
              const id = 'verify-' + crypto.randomUUID();
              const timer = setTimeout(() => { removeEventListener('message', receive); reject(new Error(method + ' timed out')); }, 10000);
              function receive(event) {
                const message = event.data;
                if (event.source !== parent || event.origin !== location.origin || message?.channel !== 'mineradio-folia' || message.type !== 'response' || message.id !== id) return;
                clearTimeout(timer); removeEventListener('message', receive);
                if (message.ok) resolve(message.result); else reject(new Error(message.error?.message || method));
              }
              addEventListener('message', receive);
              parent.postMessage({ channel: 'mineradio-folia', version: 1, type: 'request', id, method, params }, location.origin);
            })""", [method, params or {}])

        tracks = command("listTracks")["items"]
        playlist = command("createPlaylist", {"name": "Folia 验收歌单"})
        command("addToPlaylist", {"playlistId": playlist["id"], "trackIds": [track["id"] for track in tracks]})
        command("renamePlaylist", {"id": playlist["id"], "name": "Folia 双向同步"})
        playlist_state = page.evaluate("id => readLocalPlaylists().find(list => list.id === id)", playlist["id"])
        assert playlist_state["name"] == "Folia 双向同步" and len(playlist_state["songRefs"]) == 2
        command("setPlaylistTracks", {"playlistId": playlist["id"], "trackIds": [tracks[1]["id"]]})
        assert command("listTracks", {"playlistId": playlist["id"]})["total"] == 1
        command("removeFromPlaylist", {"playlistId": playlist["id"], "trackIds": [tracks[1]["id"]]})
        assert command("listTracks", {"playlistId": playlist["id"]})["total"] == 0
        command("addToPlaylist", {"playlistId": playlist["id"], "trackIds": [tracks[0]["id"]]})
        assert command("listTracks", {"playlistId": "special-liked"})["total"] == 1
        command("setMuted", {"muted": True})
        assert command("getState")["muted"]
        command("setMuted", {"muted": False})
        assert abs(command("getState")["volume"] - 0.37) < 0.01
        command("setPlayMode", {"mode": "single"})
        expect(child.get_by_test_id("local-play-mode")).to_have_attribute("aria-label", "单曲循环")
        command("setPlayMode", {"mode": "loop"})
        command("pause")
        before_queue = command("getState")
        command("setQueue", {"trackIds": [track["id"] for track in reversed(tracks)]})
        after_queue = command("getState")
        assert after_queue["currentTrack"]["id"] == before_queue["currentTrack"]["id"]
        assert abs(after_queue["position"] - before_queue["position"]) < 0.1
        assert_single_audio()
        checkpoint("host-playlist-crud-favorite-mute-mode-queue-preserves-transport")

        # Hold an active lyric while every built-in renderer and local background mounts.
        command("seek", {"seconds": 35})
        child.get_by_test_id("local-open-settings").click()
        selector = child.get_by_test_id("local-visualizer-mode")
        modes = selector.locator("option").evaluate_all("options => options.map(option => option.value)")
        expected_modes = {"classic", "partita", "monet", "cadenza", "cappella", "claddagh", "diorama", "fume", "lumiere", "pendolo", "sonnet", "still", "tempera", "tilt"}
        assert set(modes) == expected_modes, f"Missing or unrelated visualizer modes: {modes}"
        for mode in ["classic", "partita", "monet"] + [mode for mode in modes if mode not in ("classic", "partita", "monet")]:
            selector.select_option(mode)
            expect(child.get_by_test_id("local-visualizer")).to_have_attribute("data-mode", mode)
            child.get_by_test_id("local-visualizer").locator(":scope > *").first.wait_for(state="attached")
            page.wait_for_timeout(650)
            tuning = child.get_by_test_id("local-effect-tuning")
            if mode not in ("still", "cadenza"):
                expect(tuning).to_have_count(1)
                tuning.locator("summary").click()
                tuning.locator("input, button, select").first.wait_for(state="attached")
                page.wait_for_timeout(200)
            assert not errors and not console_errors, f"Visualizer {mode} failed: {errors + console_errors}"
            page.screenshot(path=str(OUTPUT / f"local-visualizer-{mode}.png"))
            visual_modes.append(mode)
        # Real image upload through the original Monet settings, followed by an iframe reload.
        selector.select_option("monet")
        tuning = child.get_by_test_id("local-effect-tuning")
        tuning.locator("summary").click()
        tuning.locator('input[type="file"]').set_input_files(str(OUTPUT / "mineradio-before.png"))
        expect(tuning).to_contain_text("mineradio-before.png")
        child.wait_for_function("JSON.parse(localStorage.getItem('mineradio-folia-local-visuals-v1')).state.tunings.monet.portraitSource === 'custom'")
        child.goto(child.url, wait_until="networkidle")
        child.get_by_test_id("local-open-settings").click()
        tuning = child.get_by_test_id("local-effect-tuning")
        tuning.locator("summary").click()
        expect(tuning).to_contain_text("mineradio-before.png")
        assert_single_audio()
        checkpoint("monet-image-upload-and-persistent-asset-restore")
        selector = child.get_by_test_id("local-visualizer-mode")
        selector.select_option("classic")
        background = child.get_by_test_id("local-background-mode")
        backgrounds = background.locator("option").evaluate_all("options => options.map(option => option.value)")
        assert "url" not in backgrounds and not any(mode.startswith("mod:") for mode in backgrounds)
        for mode in backgrounds:
            background.select_option(mode)
            page.wait_for_timeout(450)
            assert not errors and not console_errors, f"Background {mode} failed: {errors + console_errors}"
            background_modes.append(mode)
        background.select_option("latent")
        child.get_by_test_id("local-theme").select_option("light")
        page.screenshot(path=str(OUTPUT / "folia-local-daylight.png"))
        child.get_by_test_id("local-theme").select_option("dark")
        child.get_by_test_id("local-open-settings").click()
        page.screenshot(path=str(OUTPUT / "folia-local-player.png"))
        assert_single_audio()
        checkpoint("all-14-folia-visualizers-local-backgrounds-and-themes")

        # A larger real local library exercises the original virtualized walls.
        page.locator("#file-input").set_input_files(FILES + WALL_FILES)
        page.wait_for_function("localLibrarySongs.length === 20", timeout=45000)
        page.evaluate("""() => {
          localLibrarySongs.forEach((song, index) => {
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 384;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = `hsl(${index * 41}, 45%, 24%)`; ctx.fillRect(0, 0, 384, 384);
            ctx.fillStyle = `hsl(${index * 41 + 55}, 65%, 63%)`;
            ctx.beginPath(); ctx.arc(190, 150, 105 + index % 4 * 10, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffffff'; ctx.font = 'bold 38px sans-serif'; ctx.fillText('FOLIA', 28, 305);
            ctx.font = '20px sans-serif'; ctx.fillText('LOCAL RECORD ' + (index + 1), 30, 342);
            song.customCover = canvas.toDataURL('image/png'); song.artist = 'Local Session'; song.album = 'Folia Collection';
          });
          localLibrarySongs = [...localLibrarySongs];
        }""")
        command("play", {"id": tracks[0]["id"], "playlistId": "library"})
        command("pause")
        command("seek", {"seconds": 35})
        before_walls = command("getState")
        child.get_by_test_id("local-view-records").click()
        viewport = child.get_by_test_id("local-record-viewport")
        viewport.wait_for(timeout=20000)
        child.locator("[data-record-id]").first.wait_for()
        page.wait_for_timeout(1000)
        page.screenshot(path=str(OUTPUT / "folia-record-wall.png"))
        viewport_handle = viewport.element_handle()
        command("toggleLike", {"id": tracks[0]["id"]})
        page.wait_for_timeout(700)
        assert viewport.evaluate("(node, original) => node === original", viewport_handle), "Favorite refresh remounted the record wall"
        original_focus = child.locator('[data-record-id][data-focused="true"]').get_attribute("data-record-id")
        viewport.focus()
        viewport.press("ArrowRight")
        child.wait_for_function("id => document.querySelector('[data-record-id][data-focused=true]')?.dataset.recordId !== id", arg=original_focus)
        box = viewport.bounding_box()
        page.mouse.move(box["x"] + box["width"] * .55, box["y"] + box["height"] * .6)
        page.mouse.down()
        page.mouse.move(box["x"] + box["width"] * .35, box["y"] + box["height"] * .45, steps=12)
        page.mouse.up()
        page.wait_for_timeout(500)
        assert not command("getState")["playing"]
        assert abs(command("getState")["position"] - before_walls["position"]) < .1
        assert_single_audio()
        child.get_by_test_id("local-view-posters").click()
        child.get_by_test_id("local-poster-wall").wait_for()
        child.locator(".lattice-poster").first.wait_for()
        page.wait_for_timeout(1800)
        child.get_by_test_id("local-poster-now-playing").click()
        page.wait_for_timeout(900)
        expect(child.locator(".lattice-poster.is-expanded")).to_have_count(1)
        expanded = child.locator(".lattice-poster.is-expanded")
        expanded.hover()
        transport = expanded.locator(".lattice-transport-button")
        transport.click()
        page.wait_for_function("!audio.paused")
        transport.click()
        page.wait_for_function("audio.paused")
        set_range(expanded.locator('input[type="range"]'), 25)
        page.wait_for_function("Math.abs(audio.currentTime - 25) < .2")
        expanded_id = expanded.get_attribute("data-instance-id")
        command("toggleLike", {"id": tracks[0]["id"]})
        page.wait_for_timeout(700)
        expect(child.locator(".lattice-poster.is-expanded")).to_have_attribute("data-instance-id", expanded_id)
        page.screenshot(path=str(OUTPUT / "folia-poster-wall.png"))
        child.locator('.lattice-tools button').last.click()
        lights = child.locator('.lattice-tools-lights-toggle')
        expect(lights).to_have_attribute('aria-checked', 'true')
        lights.click()
        expect(child.get_by_test_id('local-poster-wall')).to_have_class(re.compile('is-lights-out'))
        child.goto(child.url, wait_until="networkidle")
        expect(child.get_by_test_id('local-player')).to_have_attribute('data-view', 'posters')
        expect(child.get_by_test_id('local-poster-wall')).to_have_class(re.compile('is-lights-out'))
        assert command("getState")["currentTrack"]["id"] == tracks[0]["id"]
        checkpoint("poster-controls-seek-favorite-and-wall-preferences-restore")
        assert_single_audio()
        child.get_by_test_id("local-open-library").click()
        expect(child.get_by_test_id("local-library")).to_be_visible()
        child.get_by_test_id("local-view-lyrics").click()
        expect(child.get_by_test_id("local-visualizer")).to_be_visible()
        checkpoint("original-record-and-poster-walls-with-shared-transport")

        command("seek", {"seconds": 15})
        command("resume")
        handle = page.locator("#folia-frame").element_handle()
        page.locator("#folia-floating-switch").click()
        page.wait_for_function("!isFoliaInterfaceActive() && audio === window.__foliaTestAudio && !audio.paused")
        expect(child.get_by_test_id("local-player")).to_have_attribute("data-active", "false")
        child.get_by_test_id("local-visualizer").locator(":scope > *").first.wait_for(state="detached")
        switched_at = page.evaluate("audio.currentTime")
        page.wait_for_timeout(350)
        assert page.evaluate("audio.currentTime") > switched_at, "Host playback stopped while Folia was hidden"
        page.locator("#folia-floating-switch").click()
        assert page.locator("#folia-frame").evaluate("(element, original) => element === original", handle)
        expect(child.get_by_test_id("local-player")).to_have_attribute("data-active", "true")
        page.wait_for_function("audio === window.__foliaTestAudio && !audio.paused")
        child.wait_for_function("Math.abs(Number(document.querySelector('[data-testid=local-seek]').value) - parent.audio.currentTime) < 0.6")
        assert_single_audio()
        command("deletePlaylist", {"id": playlist["id"]})
        assert not any(item["id"] == playlist["id"] for item in command("listPlaylists"))
        checkpoint("switch-back-preserves-audio-iframe-and-clock")

        # Small follow-up after the main acceptance: exercise UI mode cycling and real remount recovery.
        mode_button = child.get_by_test_id("local-play-mode")
        expect(mode_button).to_have_attribute("aria-label", "列表循环")
        for mode, label in [("shuffle", "随机播放"), ("single", "单曲循环"), ("loop", "列表循环")]:
            mode_button.click()
            page.wait_for_function("mode => MineradioFoliaHost.getState().playMode === mode", arg=mode)
            expect(mode_button).to_have_attribute("aria-label", label)
        mode_button.click()
        page.wait_for_function("MineradioFoliaHost.getState().playMode === 'shuffle'")
        child.get_by_test_id("local-open-settings").click()
        child.get_by_test_id("local-visualizer-mode").select_option("partita")
        child.get_by_test_id("local-background-mode").select_option("common")
        child.get_by_test_id("local-theme").select_option("light")
        set_range(child.get_by_role("slider", name="歌词字号", exact=True), 1.25)
        child.locator(".local-toggle-setting input[type=checkbox]").uncheck()
        child.wait_for_function("""() => {
          const value = JSON.parse(localStorage.getItem('mineradio-folia-local-visuals-v1'))?.state;
          return value?.mode === 'partita' && value.background.mode === 'common'
            && value.daylight && value.lyricsFontScale === 1.25 && value.translation === false;
        }""")
        before_reload = page.evaluate("MineradioFoliaHost.getState()")
        child.goto(child.url, wait_until="networkidle")
        expect(child.get_by_test_id("local-player")).to_have_attribute("data-active", "true")
        expect(child.get_by_test_id("local-visualizer")).to_have_attribute("data-mode", "partita")
        expect(child.get_by_test_id("local-play-mode")).to_have_attribute("aria-label", "随机播放")
        child.get_by_test_id("local-open-settings").click()
        expect(child.get_by_test_id("local-visualizer-mode")).to_have_value("partita")
        expect(child.get_by_test_id("local-background-mode")).to_have_value("common")
        expect(child.get_by_test_id("local-theme")).to_have_value("light")
        expect(child.get_by_role("slider", name="歌词字号", exact=True)).to_have_value("1.25")
        expect(child.locator(".local-toggle-setting input[type=checkbox]")).not_to_be_checked()
        after_reload = page.evaluate("MineradioFoliaHost.getState()")
        assert after_reload["currentTrack"]["id"] == before_reload["currentTrack"]["id"]
        assert after_reload["playing"] and after_reload["position"] >= before_reload["position"]
        assert_single_audio()
        child.get_by_test_id("local-visual-settings").get_by_role("button", name="恢复默认", exact=True).click()
        expect(child.get_by_test_id("local-visualizer-mode")).to_have_value("classic")
        expect(child.get_by_test_id("local-background-mode")).to_have_value("latent")
        expect(child.get_by_test_id("local-theme")).to_have_value("dark")
        expect(child.get_by_role("slider", name="歌词字号", exact=True)).to_have_value("1")
        expect(child.locator(".local-toggle-setting input[type=checkbox]")).to_be_checked()
        child.get_by_test_id("local-open-settings").click()
        child.get_by_test_id("local-play-mode").click()
        expect(child.get_by_test_id("local-play-mode")).to_have_attribute("aria-label", "单曲循环")
        child.get_by_test_id("local-play-mode").click()
        expect(child.get_by_test_id("local-play-mode")).to_have_attribute("aria-label", "列表循环")
        checkpoint("play-mode-cycle-and-visual-settings-persist-across-child-reload")
        result = {
            "passed": passed, "visualizerModes": visual_modes, "backgroundModes": background_modes,
            "pageErrors": errors, "consoleErrors": console_errors, "audioAudit": assert_single_audio(),
            "buildScope": {"surface": scope["surface"], "entry": scope["entry"], "moduleCount": len(scope["modules"])},
            "finalState": page.evaluate("MineradioFoliaHost.getState()"),
        }
        (OUTPUT / "acceptance.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print("PASS: isolated local Folia player, all visualizers, one host audio engine, zero page/console errors.", flush=True)
    finally:
        (OUTPUT / "browser-errors.json").write_text(json.dumps({"errors": errors, "consoleErrors": console_errors, "passed": passed}, ensure_ascii=False, indent=2), encoding="utf-8")
        if not page.is_closed():
            page.screenshot(path=str(OUTPUT / "last-state.png"))
        browser.close()
