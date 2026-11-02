"""Accept the synchronized visual preferences against the real embedded player and host."""
import argparse
import json
import math
from pathlib import Path
import struct
import wave
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/ui-language/upstream-visuals'
OUT.mkdir(parents=True, exist_ok=True)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:3018')
args = parser.parse_args()
files = []
ttml = '''<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><body><div>
<p begin="0s" end="12s"><span begin="0s" end="12s">Main lyric</span>
<span ttm:role="x-translation">主句翻译</span><span ttm:role="x-roman">Main roman</span>
<span ttm:role="x-bg" begin="1s" end="11s"><span begin="1s" end="11s">Harmony voice</span></span></p>
</div></body></tt>'''
for name in ['Visual-A', 'Visual-B']:
    audio = OUT / (name + '.wav')
    with wave.open(str(audio), 'wb') as stream:
        stream.setparams((1, 2, 8000, 0, 'NONE', 'not compressed'))
        second = b''.join(struct.pack('<h', int(120 * math.sin(2 * math.pi * 220 * t / 8000))) for t in range(8000))
        stream.writeframes(second * 16)
    lyric = audio.with_suffix('.ttml')
    lyric.write_text(ttml, encoding='utf-8')
    files.extend([str(audio), str(lyric)])

def set_range(locator, value):
    locator.evaluate('''(element, value) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, String(value));
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }''', value)

with sync_playwright() as p:
    print('Starting synchronized visual acceptance:', args.url, flush=True)
    browser = p.chromium.launch(headless=True, channel='chromium', timeout=30000, args=['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width': 1440, 'height': 900}, locale='zh-CN')
    page.set_default_timeout(30000)
    page.add_init_script("localStorage.setItem('mineradio-visual-guide-seen-v2','1')")
    errors, passed = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.route('**/api/lyric-translate', lambda route: route.fulfill(status=200, json={'translations': []}))

    def done(name):
        assert not errors, errors
        passed.append(name)
        print('PASS:', name, flush=True)

    try:
        page.goto(args.url, wait_until='domcontentloaded')
        print('Importing local TTML fixtures', flush=True)
        page.locator('#file-input').set_input_files(files)
        page.wait_for_function('localLibrarySongs.length === 2 && audio && !audio.paused')
        page.evaluate('audio.pause(); audio.currentTime = 3')
        page.wait_for_function('lyricsLines[0]?.backgroundVocals?.length === 1')
        rich = page.evaluate('lyricsLines[0]')
        assert rich['text'] == 'Main lyric' and rich['translation'] == '主句翻译'
        assert rich['backgroundVocals'][0]['text'] == 'Harmony voice'
        done('TTML main, translation, romanization and harmony remain separate')
        page.locator('#folia-floating-switch').click()
        frame = page.frame_locator('#folia-frame')
        frame.get_by_test_id('local-player').wait_for(timeout=90000)
        child = next(frame for frame in page.frames if '/vendor/folia/' in frame.url)
        child.get_by_test_id('local-open-settings').click()
        stage = child.get_by_test_id('local-visualizer')
        mode = child.get_by_test_id('local-visualizer-mode')
        mode.select_option('classic')
        rows = child.get_by_test_id('local-subtitle-rows')
        rows.select_option('1')
        expect(stage.locator('[data-subtitle-track]')).to_have_count(1)
        rows.select_option('2')
        expect(stage.locator('[data-subtitle-track]')).to_have_count(2)
        rows.select_option('3')
        expect(stage.locator('[data-subtitle-track]')).to_have_count(3)
        child.get_by_label('字幕第 3 行', exact=True).select_option('next')
        expect(stage.locator('[data-subtitle-track]')).to_have_count(2)
        done('one, two and three subtitle rows update with real TTML tracks')

        pool = child.locator('.local-random-pool')
        pool.locator('..').locator('summary').click()
        for box in pool.locator('input').all():
            name = box.locator('..').inner_text().strip()
            if name not in ['流光', '云阶']:
                box.uncheck()
        expect(pool.locator('input:checked')).to_have_count(2)
        child.get_by_test_id('local-random-mode').check()
        mode.select_option('classic')
        child.get_by_test_id('local-reroll').click()
        expect(mode).to_have_value('partita')
        child.get_by_test_id('local-reroll').click()
        expect(mode).to_have_value('classic')
        child.get_by_test_id('local-open-settings').click()
        page.mouse.move(720, 880)
        child.get_by_test_id('local-next').click()
        expect(stage).to_have_attribute('data-mode', 'partita')
        page.evaluate('audio.pause(); audio.currentTime = 3')
        done('custom random pool, reroll and next-song selection never repeat')

        child.get_by_test_id('local-view-posters').click()
        child.get_by_test_id('local-poster-wall').wait_for(timeout=30000)
        expect(child.locator('.lattice-lyrics.is-ready')).to_contain_text('Harmony voice', timeout=20000)
        done('Lattice renders TTML harmony on the current song tile')
        child.get_by_test_id('local-view-lyrics').click()
        child.get_by_test_id('local-open-settings').click()
        child.get_by_test_id('local-harmony').uncheck()
        expect(stage).not_to_contain_text('Harmony voice')
        child.get_by_test_id('local-harmony').check()
        preview = child.get_by_test_id('local-live-preview')
        preview.scroll_into_view_if_needed()
        assert preview.locator('..').bounding_box()['height'] > 200, 'Live preview must not shrink inside the settings panel'
        for value in ['hanabi', 'nebbia', 'machi']:
            mode.select_option(value)
            preview.scroll_into_view_if_needed()
            expect(preview.locator('canvas').first).to_be_attached(timeout=30000)
            expect(child.get_by_test_id('local-error')).to_have_count(0)
            expect(child.get_by_test_id('local-recovery')).to_have_count(0)
            page.wait_for_timeout(700)
            page.screenshot(path=str(OUT / f'preview-{value}.png'))
        background_tab = child.get_by_role('button', name='背景预览', exact=True)
        background_tab.scroll_into_view_if_needed()
        background_tab.click()
        expect(preview).to_have_attribute('data-surface', 'background')
        child.get_by_test_id('local-background-mode').select_option('sora')
        preview.scroll_into_view_if_needed()
        page.screenshot(path=str(OUT / 'preview.png'))
        done('new lyric effects and background share an active live preview')

        with child.expect_navigation(wait_until='domcontentloaded'):
            child.evaluate('location.reload()')
        page.frame_locator('#folia-frame').get_by_test_id('local-player').wait_for(timeout=30000)
        child = next(frame for frame in page.frames if '/vendor/folia/' in frame.url)
        saved = child.evaluate("JSON.parse(localStorage.getItem('mineradio-folia-local-visuals-v1')).state")
        assert saved['randomMode'] and set(saved['randomPool']) == {'classic', 'partita'}
        assert saved['subtitleLayout'] == 'current+translation+next' and saved['harmony']
        done('random pool and subtitle preferences persist through frame reload')

        page.mouse.move(1380, 15)
        page.locator('#folia-floating-switch').click()
        for index in [9, 10, 11, 12]:
            page.evaluate('(index) => setPreset(index)', index)
            page.wait_for_timeout(400)
            assert page.evaluate('fx.preset') == index
        page.screenshot(path=str(OUT / 'new-particle-preset.png'))
        done('four particle presets apply through the production renderer')
        page.evaluate('openWallpaperEngineLibrary()')
        page.locator('.wallpaper-engine-visual-controls summary').click()
        for name, value in [('opacity', 0.65), ('position-x', 23), ('position-y', -14), ('scale', 1.31)]:
            set_range(page.locator('#wallpaper-engine-' + name), value)
        visual = page.evaluate('wallpaperEngineVisualSettings()')
        assert visual == {'opacity': 0.65, 'positionX': 0.23, 'positionY': -0.14, 'scale': 1.31}
        page.get_by_role('button', name='重置画面', exact=True).click()
        assert page.evaluate('wallpaperEngineVisualSettings().scale') == 1.08
        done('WE opacity, position, scale and reset update saved settings')
    finally:
        (OUT / 'acceptance.json').write_text(json.dumps({'passed': passed, 'pageErrors': errors}, ensure_ascii=False, indent=2), encoding='utf-8')
        if not page.is_closed():
            page.screenshot(path=str(OUT / 'last-state.png'))
        browser.close()
