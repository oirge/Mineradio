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

        result = {"passed": passed, "pageErrors": errors, "consoleErrors": console_errors,
                  "audioAudit": assert_single_audio(), "moduleCount": len(scope["modules"])}
        (OUTPUT / "wall-acceptance.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    finally:
        (OUTPUT / "wall-errors.json").write_text(json.dumps({"errors": errors, "consoleErrors": console_errors, "passed": passed}, ensure_ascii=False, indent=2), encoding="utf-8")
        if not page.is_closed():
            page.screenshot(path=str(OUTPUT / "wall-last-state.png"))
        browser.close()
