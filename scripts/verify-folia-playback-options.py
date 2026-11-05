"""Exercise playback shortcuts, overlap controls and current-only wall badges with real clicks."""
import argparse
import json
import math
import re
from pathlib import Path
import struct
import wave
from playwright.sync_api import sync_playwright, expect
from ui_browser import launch_browser, capture_screenshot

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/ui-language/folia-playback-options'
OUT.mkdir(parents=True, exist_ok=True)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:3018')
args = parser.parse_args()
files = []
words = '穿过 安静 街道 仰望 明亮 星空 听见 远方 风声 跟随 音乐 继续 向前 寻找 温暖 灯光'.split()
for name in ['Options-A', 'Options-B', 'Options-C']:
    audio_file = OUT / f'{name}.wav'
    with wave.open(str(audio_file), 'wb') as stream:
        stream.setparams((1, 2, 8000, 0, 'NONE', 'not compressed'))
        second = b''.join(struct.pack('<h', int(3000 * math.sin(2 * math.pi * 220 * i / 8000))) for i in range(8000))
        stream.writeframes(second * 120)
    lyric = audio_file.with_suffix('.yrc')
    lyric.write_text('[0,120000]' + ''.join(f'({index * 7000},7000,0){word} ' for index, word in enumerate(words)), encoding='utf-8')
    files.extend([str(audio_file), str(lyric)])

with sync_playwright() as p:
    browser = launch_browser(p)
    page = browser.new_page(viewport={'width': 1440, 'height': 900}, locale='zh-CN')
    page.set_default_timeout(15000)
    page.add_init_script("localStorage.setItem('mineradio-visual-guide-seen-v2', '1')")
    errors, checks = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.route('**/api/lyric-translate', lambda route: route.fulfill(status=200, json={'translations': []}))
    def done(text):
        assert not errors, errors
        checks.append(text)
        print('PASS:', text, flush=True)
    try:
        page.goto(args.url, wait_until='networkidle')
        page.locator('#file-input').set_input_files(files)
        page.wait_for_function('localLibrarySongs.length === 3 && audio && audio.src')
        page.evaluate("audio.pause(); audio.currentTime = 20; window.__optionsAudio = audio; window.__optionsContext = audioCtx; window.__optionsQueue = playQueue; setUiLanguage('zh-CN')")
        page.locator('#folia-floating-switch').click()
        child = page.frame_locator('#folia-frame')
        child.get_by_test_id('local-open-playback').click(timeout=60000)
        panel = child.get_by_test_id('local-playback-settings')
        expect(panel).to_be_visible()
        child.get_by_test_id('local-rate-1.5').click()
        child.get_by_test_id('local-sleep-30').click()
        child.get_by_test_id('local-replaygain-enabled').check()
        child.get_by_test_id('local-replaygain-album').click()
        child.get_by_test_id('local-replaygain-preamp').press('End')
        child.get_by_test_id('local-replaygain-clipguard').uncheck()
        child.get_by_test_id('local-gapless-enabled').uncheck()
        child.get_by_test_id('local-crossfade').press('End')
        page.wait_for_function("audio.playbackRate === 1.5 && sleepTimerState.mode === '30' && replayGainSettings.enabled && replayGainSettings.mode === 'album' && replayGainSettings.preampDb === 12 && !replayGainSettings.clipGuard && !gaplessSettings.enabled && gaplessSettings.crossfadeSeconds === 10")
        assert page.evaluate("JSON.parse(localStorage.getItem(PLAYBACK_RATE_STORE_KEY)).rate === 1.5 && JSON.parse(localStorage.getItem(REPLAY_GAIN_STORE_KEY)).mode === 'album'")
        assert page.evaluate('audio === __optionsAudio && audioCtx === __optionsContext && playQueue === __optionsQueue && audio.paused')
        done('all four shortcut groups edit the existing host engine and persistent preferences')

        # Main-interface edits must flow back to a panel that is already open.
        page.evaluate("setPlaybackRate(0.75, {toast:false}); setSleepTimerMode('track', {toast:false}); replayGainSettings.enabled = false; commitReplayGainSettings(); gaplessSettings.enabled = true; setGaplessCrossfadeSeconds(2, {toast:false})")
        expect(child.get_by_test_id('local-rate-0.75')).to_have_attribute('aria-pressed', 'true')
        expect(child.get_by_test_id('local-sleep-track')).to_have_attribute('aria-pressed', 'true')
        expect(child.get_by_test_id('local-replaygain-enabled')).not_to_be_checked()
        expect(child.get_by_test_id('local-crossfade')).to_have_value('2')
        child.get_by_test_id('local-sleep-off').click()
        child.get_by_test_id('local-crossfade').press('Home')
        page.wait_for_function("sleepTimerState.mode === 'off' && sleepTimerState.dueAt === 0 && gaplessSettings.crossfadeSeconds === 0")
        capture_screenshot(page, path=str(OUT / 'playback-zh.png'))
        page.evaluate("setUiLanguage('en')")
        expect(panel.get_by_text('Playback settings', exact=True)).to_be_visible()
        expect(panel.get_by_text('Gapless playback', exact=True)).to_be_visible()
        panel.get_by_role('button', name='Close', exact=True).click()
        expect(panel).to_have_count(0)
        done('open controls follow host edits, timers cancel correctly and both languages render')

        for view in ['records', 'posters', 'lyrics']:
            child.get_by_test_id(f'local-view-{view}').click()
            child.get_by_test_id('local-open-playback').click()
            expect(panel).to_be_visible()
            panel.get_by_role('button', name='Close', exact=True).press('Escape')
            expect(panel).to_have_count(0)
        # Both normal and desktop titlebar portals retain the same entry point.
        page.evaluate("document.body.classList.add('desktop-shell')")
        # The desktop titlebar hides while idle; reaching the top edge reveals it.
        page.mouse.move(720, 3)
        expect(page.locator('body')).not_to_have_class(re.compile(r'folia-chrome-hidden'))
        page.get_by_test_id('local-open-playback').click()
        expect(panel).to_be_visible()
        panel.get_by_role('button', name='Close', exact=True).click()
        page.evaluate("document.body.classList.remove('desktop-shell'); setUiLanguage('zh-CN')")
        done('the shortcut entry works in all three views and in the desktop titlebar')

        child.get_by_test_id('local-open-settings').click()
        visual = child.get_by_test_id('local-visual-settings')
        mode = child.get_by_test_id('local-visualizer-mode')
        mode.select_option('classic')
        child.get_by_test_id('local-effect-tuning').locator('summary').click()
        classic = child.get_by_test_id('local-classic-avoid-overlap')
        expect(classic).not_to_be_checked()
        classic.check()
        iframe = page.frame(url=lambda url: '/vendor/folia/' in url)
        iframe.wait_for_function("parseFloat(document.querySelector('[data-overlap-fit-line]')?.style.rowGap) > 0")
        mode.select_option('partita')
        child.get_by_test_id('local-effect-tuning').locator('summary').click()
        partita = child.get_by_test_id('local-partita-avoid-overlap')
        expect(partita).not_to_be_checked()
        partita.check()
        expect(child.locator('[data-overlap-fit-row]').first).to_be_attached()
        # The setting is applied through the live registry, rather than only saved in storage.
        assert iframe.evaluate("document.querySelector('[data-overlap-fit-row]').style.marginBottom.includes('em')")
        page.set_viewport_size({'width': 1000, 'height': 650})
        expect(child.locator('[data-overlap-fit-line]').first).to_be_attached()
        page.set_viewport_size({'width': 1440, 'height': 900})
        visual.locator('.local-panel-title button[aria-label="关闭"]').click()
        done('both overlap switches default off and update real lyric spacing across resize')

        child.get_by_test_id('local-view-posters').click()
        wall = child.get_by_test_id('local-poster-wall')
        tools = wall.get_by_role('button', name='Lattice 工具', exact=True)
        tools.click()
        badge = child.get_by_test_id('local-lattice-current-badge')
        expect(badge).to_have_attribute('aria-checked', 'false')
        badge.click()
        expect(wall).to_have_class(re.compile(r'has-badge-current-only'))
        expect(wall.locator('.lattice-poster-badge.is-index.is-current').first).to_be_visible()
        for item in wall.locator('.lattice-poster-badge.is-index:not(.is-current)').all():
            expect(item).to_be_hidden()
        backup = page.evaluate('collectMineradioBackupPayload()')
        settings = backup['config']['player']
        assert json.loads(settings['mineradio-folia-local-lattice-v1'])['state']['latticeBadgeCurrentOnly'] is True
        tuning = json.loads(settings['mineradio-folia-local-visuals-v1'])['state']['tunings']
        assert tuning['classic']['avoidOverlap'] is True and tuning['partita']['avoidOverlap'] is True
        done('current-only wall numbers hide other badges and all visual switches enter real backups')

        iframe.goto(iframe.url, wait_until='networkidle')
        child.get_by_test_id('local-poster-wall').wait_for()
        expect(child.get_by_test_id('local-poster-wall')).to_have_class(re.compile(r'has-badge-current-only'))
        child.get_by_test_id('local-view-lyrics').click()
        child.get_by_test_id('local-open-settings').click()
        child.get_by_test_id('local-visualizer-mode').select_option('classic')
        expect(child.get_by_test_id('local-classic-avoid-overlap')).to_be_checked()
        visual.locator('.local-panel-title button[aria-label="关闭"]').click()
        child.get_by_test_id('local-open-playback').click()
        expect(child.get_by_test_id('local-rate-0.75')).to_have_attribute('aria-pressed', 'true')
        assert page.evaluate('audio === __optionsAudio && audioCtx === __optionsContext && playQueue === __optionsQueue')
        capture_screenshot(page, path=str(OUT / 'restored.png'))
        done('iframe reload restores preferences and keeps the host audio and queue objects')
    finally:
        (OUT / 'acceptance.json').write_text(json.dumps({'checks': checks, 'errors': errors}, ensure_ascii=False, indent=2), encoding='utf-8')
        browser.close()
