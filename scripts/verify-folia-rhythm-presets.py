"""Focused browser acceptance for host analysis, named visual presets and rapid random-pool edits."""
import argparse
import json
import math
from pathlib import Path
import struct
import wave
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/ui-language/folia-rhythm-presets'
OUT.mkdir(parents=True, exist_ok=True)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:3018')
args = parser.parse_args()
files = []
for name in ['Beat-A', 'Beat-B']:
    audio_file = OUT / f'{name}.wav'
    with wave.open(str(audio_file), 'wb') as stream:
        stream.setparams((1, 2, 8000, 0, 'NONE', 'not compressed'))
        second = b''.join(struct.pack('<h', int((10000 if i % 4000 < 500 else 200) * math.sin(2 * math.pi * 100 * i / 8000))) for i in range(8000))
        stream.writeframes(second * 30)
    lyric = audio_file.with_suffix('.lrc')
    lyric.write_text('[00:00.00]Listen to the beat\n[00:15.00]Let the music flow', encoding='utf-8')
    files.extend([str(audio_file), str(lyric)])

with sync_playwright() as p:
    # Match the original visual acceptance suite instead of inheriting the runner's virtual GPU.
    browser = p.chromium.launch(headless=True, channel='chromium', args=['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'])
    page = browser.new_page(viewport={'width': 1440, 'height': 900}, locale='zh-CN')
    page.set_default_timeout(15000)
    page.add_init_script("""localStorage.setItem('mineradio-visual-guide-seen-v2', '1');
        window.__analysis = null; window.__audioFrames = 0; window.__audioMax = 0;
        addEventListener('message', event => {
            if (event.source !== parent || event.origin !== location.origin || event.data?.channel !== 'mineradio-folia') return;
            if (event.data.event === 'analysis') window.__analysis = event.data.data;
            if (event.data.event === 'audio') {
                window.__audioFrames++; window.__audioMax = Math.max(window.__audioMax, ...event.data.data.frequency);
            }
        });""")
    errors, checks = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.route('**/api/lyric-translate', lambda route: route.fulfill(status=200, json={'translations': []}))
    def done(name):
        assert not errors, errors
        checks.append(name)
        print('PASS:', name, flush=True)
    try:
        page.goto(args.url, wait_until='networkidle')
        page.locator('#file-input').set_input_files(files)
        page.wait_for_function('localLibrarySongs.length === 2 && audio && !audio.paused')
        page.evaluate("audio.pause(); setUiLanguage('zh-CN'); MineradioFoliaHost.setInterface('folia')")
        child = page.frame_locator('#folia-frame')
        child.get_by_test_id('local-open-settings').click(timeout=60000)
        frame = next(item for item in page.frames if '/vendor/folia/' in item.url)
        settings = child.get_by_test_id('local-visual-settings')
        pool = child.locator('.local-random-pool')
        pool.locator('..').locator('summary').click()
        # Ordinary clicks exercise the real React handlers. No forced events or direct store patching.
        for box in pool.locator('input').all():
            if box.get_attribute('data-mode') != 'classic':
                box.uncheck()
        expect(pool.locator('input:checked')).to_have_count(1)
        expect(pool.locator('[data-mode="classic"]')).to_be_disabled()
        pool.locator('[data-mode="partita"]').check()
        expect(pool.locator('[data-mode="classic"]')).to_be_enabled()
        child.get_by_test_id('local-random-mode').check()
        done('continuous pool clicks preserve choices and protect the last checked style')

        presets = child.get_by_test_id('local-visual-presets')
        presets.locator('summary').click()
        name = presets.get_by_label('预设名称', exact=True)
        name.fill('雨夜')
        child.get_by_test_id('local-background-mode').select_option('sora')
        child.get_by_test_id('local-rhythm').uncheck()
        presets.get_by_role('button', name='保存为新预设', exact=True).click()
        settings.get_by_role('button', name='恢复默认', exact=True).click()
        expect(presets.locator('option')).to_have_count(2)
        presets.get_by_role('button', name='应用', exact=True).click()
        expect(child.get_by_test_id('local-background-mode')).to_have_value('sora')
        expect(child.get_by_test_id('local-random-mode')).to_be_checked()
        expect(child.get_by_test_id('local-rhythm')).not_to_be_checked()
        assert set(frame.evaluate("JSON.parse(localStorage.getItem('mineradio-folia-local-visuals-v1')).state.randomPool")) == {'classic', 'partita'}
        child.get_by_test_id('local-background-mode').select_option('latent')
        presets.get_by_role('button', name='覆盖', exact=True).click()
        name.fill('Night')
        presets.get_by_role('button', name='重命名', exact=True).click()
        expect(presets.locator('option').last).to_have_text('Night')
        done('named presets save, apply, overwrite and rename; reset retains the collection')

        with frame.expect_navigation(wait_until='domcontentloaded'):
            frame.evaluate('location.reload()')
        child.get_by_test_id('local-open-settings').click()
        frame = next(item for item in page.frames if '/vendor/folia/' in item.url)
        presets = child.get_by_test_id('local-visual-presets')
        presets.locator('summary').click()
        presets.get_by_label('选择预设', exact=True).select_option(label='Night')
        presets.get_by_role('button', name='应用', exact=True).click()
        expect(child.get_by_test_id('local-background-mode')).to_have_value('latent')
        page.screenshot(path=str(OUT / 'presets.png'))
        presets.get_by_role('button', name='删除', exact=True).click()
        expect(presets.locator('option')).to_have_count(1)
        done('preset collection persists through reload and deletion removes the selected entry')

        child.get_by_test_id('local-random-mode').uncheck()
        child.get_by_test_id('local-rhythm').check()
        page.evaluate("""() => {
            window.__originalAudio = audio; window.__originalAudioCtx = audioCtx;
            const song = playQueue[currentIdx];
            beatMapCache['local:' + song.localKey] = { analyzedAt: 123, cameraBeats: [{time: 0.5, combo: 'downbeat', strength: 1}, {time: 1}],
                pulseBeats: [{time: 0.5, strength: 1}], vocalBand: buildLocalVocalBandEnvelope(new Float32Array(200).fill(0.1), 100) };
        }""")
        frame.wait_for_function("window.__analysis?.source === 'cache' && window.__analysis.vocal?.db.length === 100")
        assert frame.evaluate('window.__analysis.drums.times[0]') == 0.5
        page.evaluate('audio.currentTime = 0; audio.play()')
        frame.wait_for_function('window.__audioFrames > 3 && window.__audioMax > 0')
        assert frame.locator('audio').count() == 0
        assert page.evaluate('audio === window.__originalAudio && audioCtx === window.__originalAudioCtx')
        done('current-track cached beats and vocal band arrive alongside real FFT audio with one host output')
        page.evaluate('playQueueAt((currentIdx + 1) % playQueue.length)')
        frame.wait_for_function("window.__analysis?.source === 'live' && window.__analysis.trackId === parent.MineradioFoliaHost.getState().currentTrack.id")
        assert frame.evaluate('window.__analysis.vocal === null')
        page.evaluate('audio.pause()')
        done('switching to an uncached track clears old vocal data and restores live analysis')
    finally:
        (OUT / 'acceptance.json').write_text(json.dumps({'checks': checks, 'errors': errors}, ensure_ascii=False, indent=2), encoding='utf-8')
        if not page.is_closed():
            page.screenshot(path=str(OUT / 'last-state.png'), timeout=10000)
        browser.close()
