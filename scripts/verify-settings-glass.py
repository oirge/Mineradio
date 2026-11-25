"""Inspect the real settings surfaces, refraction layers and controls in isolated CI Chromium."""
import argparse
import base64
import json
from pathlib import Path
import re
import wave

from playwright.sync_api import expect, sync_playwright
from ui_browser import capture_screenshot, launch_browser

# This acceptance uses the same isolated server and screenshot backend as the existing UI suites.
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/ui-language/settings-glass'
OUT.mkdir(parents=True, exist_ok=True)
SCREENSHOT_TIMEOUT_MS = 30_000
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:3018')
args = parser.parse_args()
report = {'checks': [], 'surfaces': {}, 'errors': [], 'limits': [
    'The regular upstream SettingsModal is not mounted by the local player adapter; '
    'the live Folia visual, playback and audio settings are exercised instead.',
    'Screenshots cover isolated Chromium; native Electron desktop transparency is not exercised.',
]}


def completed(message):
    assert not report['errors'], report['errors']
    report['checks'].append(message)
    print('PASS:', message, flush=True)


def capture_surface(surface, key):
    capture_screenshot(surface, path=str(OUT / f'{key}.png'), timeout=SCREENSHOT_TIMEOUT_MS)


def inspect_shell(shell, key, row_selector):
    """Check actual rendered glass and geometry, while keeping screenshot evidence for visual review."""
    expect(shell).to_be_visible()
    expect(shell).to_have_attribute('data-settings-glass-ready', 'true')
    measurements = shell.evaluate(r"""(el, rowSelector) => {
        const css = getComputedStyle(el), rect = el.getBoundingClientRect();
        const before = getComputedStyle(el, '::before'), after = getComputedStyle(el, '::after');
        const refraction = css.getPropertyValue('--settings-refraction').trim();
        const match = refraction.match(/#([^)'"\s]+)/);
        const filter = match ? document.getElementById(match[1]) : null;
        const title = el.querySelector('.fx-title,.local-panel-title strong,h2');
        const rows = [...el.querySelectorAll(rowSelector)].filter(row => row.getClientRects().length);
        return {
            width: rect.width, height: rect.height, x: rect.x, y: rect.y,
            viewportWidth: innerWidth, viewportHeight: innerHeight,
            clientWidth: el.clientWidth, scrollWidth: el.scrollWidth,
            radius: css.borderTopLeftRadius, background: css.backdropFilter === 'none' ? before.backgroundColor : css.backgroundColor,
            textColor: css.color, titleColor: title ? getComputedStyle(title).color : null,
            backdrop: css.backdropFilter, refraction,
            beforeBackdrop: before.backdropFilter, afterBackdrop: after.backdropFilter,
            beforeZIndex: before.zIndex, afterZIndex: after.zIndex,
            afterPointerEvents: after.pointerEvents, afterMask: after.maskImage,
            filterExists: !!filter,
            displacementCount: filter?.querySelectorAll('feDisplacementMap').length || 0,
            map: filter?.querySelector('feImage')?.getAttribute('href')?.slice(0, 80) || '',
            rows: rows.slice(0, 30).map(row => ({className: row.className,
                backdrop: getComputedStyle(row).backdropFilter})),
        };
    }""", row_selector)
    report['surfaces'][key] = measurements
    assert measurements['scrollWidth'] <= measurements['clientWidth'] + 2, (key, measurements)
    assert measurements['x'] >= -2 and measurements['x'] + measurements['width'] <= measurements['viewportWidth'] + 2, (key, measurements)
    assert float(re.match(r'[\d.]+', measurements['radius']).group()) >= 16, (key, measurements)
    if key.startswith('folia-'):
        assert measurements['backdrop'] == 'none' and 'blur(' in measurements['beforeBackdrop'], (key, measurements)
        assert int(measurements['afterZIndex']) < int(measurements['beforeZIndex']) < 0, (key, measurements)
    else:
        assert 'blur(' in measurements['backdrop'] and int(measurements['afterZIndex']) < 0, (key, measurements)
    assert 'url(' in measurements['afterBackdrop'] and measurements['filterExists'], (key, measurements)
    assert measurements['displacementCount'] >= 1, (key, measurements)
    assert measurements['afterPointerEvents'] == 'none', (key, measurements)
    assert measurements['afterMask'] != 'none', (key, measurements)
    assert all(row['backdrop'] == 'none' for row in measurements['rows']), (key, measurements['rows'])


def compare_rim(page, first, second, radius):
    """Compare real screenshot pixels in Chromium without an additional image library."""
    return page.evaluate("""async ({first, second, radius}) => {
        const read = async data => {
            const image = new Image(); image.src = 'data:image/png;base64,' + data; await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
            const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
            return {width: image.width, height: image.height, data: ctx.getImageData(0, 0, image.width, image.height).data};
        };
        const a = await read(first), b = await read(second);
        if (a.width !== b.width || a.height !== b.height) throw Error('Glass capture dimensions changed');
        let rimChanged = 0, centerChanged = 0, rimColored = 0, rimPixels = 0;
        for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) {
            const qx = Math.abs(x + .5 - a.width / 2) - a.width / 2 + radius;
            const qy = Math.abs(y + .5 - a.height / 2) - a.height / 2 + radius;
            const inset = radius - Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - Math.min(Math.max(qx, qy), 0);
            const i = (y * a.width + x) * 4;
            const changed = Math.max(...[0, 1, 2].map(c => Math.abs(a.data[i+c] - b.data[i+c]))) > 2;
            if (inset >= 2 && inset <= 8) {
                rimPixels++; if (changed) rimChanged++;
                const rgb = [a.data[i], a.data[i+1], a.data[i+2]];
                if (Math.max(...rgb) - Math.min(...rgb) > 12) rimColored++;
            }
            if (inset >= 14 && changed) centerChanged++;
        }
        return {rimChanged, centerChanged, rimColored, rimPixels};
    }""", {'first': base64.b64encode(first).decode(), 'second': base64.b64encode(second).decode(), 'radius': radius})


def verify_subtitle_rim(page, child):
    child.get_by_test_id('local-open-subtitles').click()
    shell = child.get_by_test_id('local-subtitle-settings')
    inspect_shell(shell, 'folia-subtitles', '.local-setting')
    frame = page.frame(url=lambda url: '/vendor/folia/' in url)
    neutral = frame.add_style_tag(content="""
        .local-player { background: #555 !important; }
        .local-visualizer { visibility: hidden !important; }
        .settings-glass-shell { --settings-base: #181818; --settings-ink: #eee; --settings-accent: #eee;
            --local-text: #eee; --local-muted: #aaa; --local-accent: #eee; --local-bg: #181818; --local-raised: #222; }
    """)
    try:
        visible = shell.screenshot(path=str(OUT / 'folia-subtitles-clean-rim.png'),
                                   animations='disabled', timeout=SCREENSHOT_TIMEOUT_MS)
        hidden = frame.add_style_tag(content="""
            .settings-glass-shell :is(strong, span, input, select, .local-tool-hint, .local-tool-action) { visibility: hidden !important; }
        """)
        try:
            no_content = shell.screenshot(animations='disabled', timeout=SCREENSHOT_TIMEOUT_MS)
        finally:
            hidden.evaluate('(el) => el.remove()')
        radius = shell.evaluate('el => parseFloat(getComputedStyle(el).borderTopLeftRadius)')
        content = compare_rim(page, visible, no_content, radius)
        report['surfaces']['folia-subtitles']['contentPixelComparison'] = content
        assert content['rimPixels'] > 1000 and content['centerChanged'] > 100, content
        assert content['rimChanged'] == 0 and content['rimColored'] == 0, content

        pattern = frame.add_style_tag(content="""
            .local-player { background: repeating-linear-gradient(35deg, #171717 0 24px, #c1d1df 26px 46px, #8e8071 50px 70px) !important; }
        """)
        try:
            refracted = shell.screenshot(path=str(OUT / 'folia-subtitles-pattern-refraction.png'),
                                         animations='disabled', timeout=SCREENSHOT_TIMEOUT_MS)
            plain = frame.add_style_tag(content=".settings-glass-shell::after { backdrop-filter: none !important; }")
            try:
                unfiltered = shell.screenshot(animations='disabled', timeout=SCREENSHOT_TIMEOUT_MS)
            finally:
                plain.evaluate('(el) => el.remove()')
            refraction = compare_rim(page, refracted, unfiltered, radius)
            report['surfaces']['folia-subtitles']['refractionPixelComparison'] = refraction
            assert refraction['rimChanged'] > 50 and refraction['centerChanged'] == 0, refraction
        finally:
            pattern.evaluate('(el) => el.remove()')
        toggle = child.get_by_test_id('local-subtitle-background')
        checked = toggle.is_checked()
        toggle.set_checked(not checked)
        expect(toggle).to_be_checked(checked=not checked)
        toggle.set_checked(checked)
        cdp = page.context.new_cdp_session(page)
        try:
            cdp.send('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-transparency', 'value': 'reduce'}]})
            reduced = shell.evaluate("""el => ({
                requested: matchMedia('(prefers-reduced-transparency: reduce)').matches,
                body: getComputedStyle(el, '::before').backdropFilter,
                rim: getComputedStyle(el, '::after').backdropFilter,
                background: getComputedStyle(el).backgroundColor,
            })""")
            report['surfaces']['folia-subtitles']['reducedTransparency'] = reduced
            assert reduced['requested'] and reduced['body'] == reduced['rim'] == 'none', reduced
            assert reduced['background'] == 'rgb(24, 24, 24)', reduced
        finally:
            cdp.send('Emulation.setEmulatedMedia', {'features': []})
            cdp.detach()
    finally:
        neutral.evaluate('(el) => el.remove()')
        shell.get_by_role('button', name='关闭', exact=True).click()
    completed('Subtitle rim has no content ghosts or colored seams on gray; patterned backdrop still refracts only at the rim')


with sync_playwright() as playwright:
    browser = launch_browser(playwright)
    page = browser.new_page(viewport={'width': 1440, 'height': 960}, locale='zh-CN')
    page.set_default_timeout(15000)
    page.add_init_script("localStorage.setItem('mineradio-visual-guide-seen-v2', '1')")
    page.on('pageerror', lambda error: report['errors'].append(str(error)))
    page.route('**/api/lyric-translate', lambda route: route.fulfill(status=200, json={'translations': []}))
    try:
        page.goto(args.url, wait_until='networkidle')
        page.wait_for_function("typeof applyDiyMode === 'function' && document.getElementById('fx-panel-tabs')")
        page.evaluate("applyDiyMode(true, {save:false}); toggleFxPanel(true)")
        console = page.locator('#fx-panel')
        console.hover()
        inspect_shell(console, 'mineradio-dark', '.fx-slider,.lyric-color-row,.fx-fold,.preset-card')
        capture_surface(console, 'mineradio-dark')
        for tab in ['appearance', 'lyrics', 'motion', 'mini', 'advanced']:
            page.locator(f'#fx-panel-tabs [data-fx-tab="{tab}"]').click()
            expect(console).to_have_attribute('data-active-tab', tab)
            inspect_shell(console, f'mineradio-{tab}', '.fx-slider,.lyric-color-row,.fx-fold')
        fold = console.locator('#fx-playbackrate-fold')
        expect(fold).to_be_visible()
        fold.locator('[data-playback-rate="1.5"]').click()
        expect(fold.locator('[data-playback-rate="1.5"]')).to_have_attribute('aria-pressed', 'true')
        page.wait_for_function('playbackRateSetting === 1.5')
        fold.locator('[data-playback-rate="1"]').click()
        completed('All six Mineradio tabs fit; segmented playback control remains clickable')

        # A patterned real custom backdrop makes edge refraction assessable in the evidence.
        page.evaluate("""() => {
            const canvas = document.createElement('canvas'); canvas.width = 1440; canvas.height = 960;
            const ctx = canvas.getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, 1440, 960);
            gradient.addColorStop(0, '#d8e4ed'); gradient.addColorStop(1, '#7194a9');
            ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1440, 960);
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 9;
            for (let x = -960; x < 1440; x += 150) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 960, 960); ctx.stroke();
            }
            setCustomBackgroundImage(canvas.toDataURL('image/png'), true);
            setCustomBackgroundColor('#cedce6', true);
            setFxPanelTab('appearance');
        }""")
        console.hover()
        inspect_shell(console, 'mineradio-bright-backdrop', '.fx-slider,.lyric-color-row')
        capture_surface(console, 'mineradio-bright-backdrop')
        page.evaluate("setFxPanelTab('advanced')")
        page.locator('#hotkey-settings-btn').click()
        modal = page.locator('#hotkey-modal .modal')
        inspect_shell(modal, 'mineradio-hotkeys', '.modal-btn')
        assert report['surfaces']['mineradio-hotkeys']['refraction'] != report['surfaces']['mineradio-dark']['refraction']
        capture_surface(modal, 'mineradio-hotkeys')
        page.evaluate('closeHotkeySettings()')
        completed('Console and hotkey dialog expose independent masked SVG refraction above a bright image')

        page.set_viewport_size({'width': 390, 'height': 844})
        page.evaluate('toggleFxPanel(true); setFxPanelTab("appearance")')
        console.hover()
        inspect_shell(console, 'mineradio-narrow', '.fx-slider,.lyric-color-row')
        capture_surface(console, 'mineradio-narrow')
        page.set_viewport_size({'width': 1440, 'height': 960})
        page.evaluate('toggleFxPanel(false); setCustomBackgroundImage("", true); setCustomBackgroundColor("#101216", true)')
        completed('Mineradio settings retain a usable panel width on a 390px viewport')

        audio_file = OUT / 'Glass-Acceptance.wav'
        with wave.open(str(audio_file), 'wb') as stream:
            stream.setparams((1, 2, 8000, 0, 'NONE', 'not compressed'))
            stream.writeframes(b'\0\0' * 8000 * 30)
        page.locator('#file-input').set_input_files(str(audio_file))
        page.wait_for_function('localLibrarySongs.length === 1 && audio && audio.src')
        page.evaluate('audio.pause(); setUiLanguage("zh-CN")')
        page.locator('#folia-floating-switch').click()
        child = page.frame_locator('#folia-frame')
        child.get_by_test_id('local-open-settings').click(timeout=60000)
        visual = child.get_by_test_id('local-visual-settings')
        inspect_shell(visual, 'folia-dark', '.local-setting')
        capture_surface(visual, 'folia-dark')
        rhythm = child.get_by_test_id('local-rhythm')
        was_checked = rhythm.is_checked()
        rhythm.set_checked(not was_checked)
        expect(rhythm).to_be_checked(checked=not was_checked)
        rhythm.set_checked(was_checked)
        range_input = visual.get_by_role('slider', name='歌词字号', exact=True)
        previous_value = range_input.input_value()
        range_input.press('End')
        expect(range_input).to_have_value('1.6')
        range_input.press('Home')
        for _ in range(round((float(previous_value) - .6) / .05)):
            range_input.press('ArrowRight')
        expect(range_input).to_have_value(previous_value)
        child.get_by_test_id('local-visualizer-mode').select_option('classic')
        tuning = child.get_by_test_id('local-effect-tuning')
        tuning.locator('summary').click()
        expect(tuning).to_have_attribute('open', '')
        tuning.locator('summary').click()
        expect(tuning).not_to_have_attribute('open', '')
        completed('Folia switches, lyric size slider and effect disclosure keep native input behavior')

        child.get_by_test_id('local-theme').select_option('light')
        inspect_shell(visual, 'folia-light', '.local-setting')
        assert report['surfaces']['folia-light']['background'] != report['surfaces']['folia-dark']['background']
        assert report['surfaces']['folia-light']['textColor'] != report['surfaces']['folia-dark']['textColor']
        capture_surface(visual, 'folia-light')
        page.set_viewport_size({'width': 390, 'height': 844})
        inspect_shell(visual, 'folia-narrow-light', '.local-setting')
        capture_surface(visual, 'folia-narrow-light')
        child.get_by_test_id('local-theme').select_option('dark')
        inspect_shell(visual, 'folia-narrow-dark', '.local-setting')
        capture_surface(visual, 'folia-narrow-dark')
        page.set_viewport_size({'width': 1440, 'height': 960})
        visual.locator('.local-panel-title button[aria-label="关闭"]').click()
        expect(visual).to_have_count(0)
        child.get_by_test_id('local-open-playback').click()
        playback = child.get_by_test_id('local-playback-settings')
        inspect_shell(playback, 'folia-playback', '.local-setting')
        assert report['surfaces']['folia-playback']['refraction'] != report['surfaces']['folia-dark']['refraction']
        capture_surface(playback, 'folia-playback')
        playback.locator('.local-panel-title button[aria-label="关闭"]').click()
        child.get_by_test_id('local-open-commands').click()
        child.get_by_test_id('local-command-search').fill('均衡器')
        child.get_by_test_id('local-command-search').press('Enter')
        audio_panel = child.get_by_test_id('local-audio-settings')
        inspect_shell(audio_panel, 'folia-audio', '.local-setting')
        capture_surface(audio_panel, 'folia-audio')
        audio_panel.get_by_role('button', name='关闭', exact=True).click()
        completed('Folia glass changes with the real theme, fits narrow screens and reaches playback and audio settings')

        verify_subtitle_rim(page, child)

        page.emulate_media(reduced_motion='reduce')
        child.get_by_test_id('local-open-settings').click()
        inspect_shell(visual, 'folia-reduced-motion', '.local-setting')
        report['surfaces']['folia-reduced-motion']['transitionDuration'] = visual.evaluate('el => getComputedStyle(el).transitionDuration')
        assert all(float(value.strip().rstrip('s')) <= .01 for value in report['surfaces']['folia-reduced-motion']['transitionDuration'].split(','))
        visual.locator('.local-panel-title button[aria-label="关闭"]').click()
        page.mouse.move(1380, 15)
        page.locator('#folia-floating-switch').click()
        page.evaluate('toggleFxPanel(true)')
        console.hover()
        inspect_shell(console, 'mineradio-reduced-motion', '.fx-slider,.lyric-color-row')
        report['surfaces']['mineradio-reduced-motion']['transitionDuration'] = console.evaluate('el => getComputedStyle(el).transitionDuration')
        assert all(float(value.strip().rstrip('s')) <= .01 for value in report['surfaces']['mineradio-reduced-motion']['transitionDuration'].split(','))
        completed('Reduced motion preserves the glass and disables shell transitions')
    finally:
        (OUT / 'acceptance.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        browser.close()
