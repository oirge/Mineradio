"""Exercise local command search, customizable controls, subtitles and host audio settings."""
import argparse
import json
from pathlib import Path
import wave
from playwright.sync_api import sync_playwright, expect
from ui_browser import launch_browser, capture_screenshot

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/ui-language/folia-command-tools'
OUT.mkdir(parents=True, exist_ok=True)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:3018')
args = parser.parse_args()
files = []
for index in range(1, 24):
    file = OUT / f'Command-{index:02}.wav'
    with wave.open(str(file), 'wb') as stream:
        stream.setparams((1, 2, 8000, 0, 'NONE', 'not compressed'))
        stream.writeframes(b'\0\0' * 8000 * 30)
    files.append(str(file))
lyric = OUT / 'Command-01.lrc'
lyric.write_text('[00:00.00]Hello world\n[00:00.00]你好世界\n[00:10.00]Follow the music\n[00:10.00]跟随音乐', encoding='utf-8')
files.append(str(lyric))

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
        page.wait_for_function('localLibrarySongs.length === 23 && audio && audio.src')
        page.evaluate("audio.pause(); audio.currentTime = 4; window.__toolsAudio = audio; window.__toolsContext = audioCtx; setUiLanguage('zh-CN')")
        page.locator('#folia-floating-switch').click()
        child = page.frame_locator('#folia-frame')
        child.get_by_test_id('local-open-library').click(timeout=60000)
        library = child.get_by_test_id('local-library')
        library.get_by_role('button', name='新建歌单', exact=True).click()
        library.get_by_label('歌单名称', exact=True).fill('Road')
        library.get_by_role('button', name='创建', exact=True).click()
        page.wait_for_function("readLocalPlaylists().some(item => item.name === 'Road')")
        playlist_id = page.evaluate("readLocalPlaylists().find(item => item.name === 'Road').id")
        child.get_by_test_id('local-open-commands').click()
        palette = child.get_by_test_id('local-command-palette')
        expect(palette.locator('[data-result-kind="track"]')).to_have_count(20)
        palette.get_by_role('button', name='下一页', exact=True).click()
        expect(palette.locator('[data-result-kind="track"]')).to_have_count(3)
        palette.get_by_role('button', name='上一页', exact=True).click()
        expect(palette.locator('[data-result-kind="track"]')).to_have_count(20)
        child.get_by_test_id('local-command-search').fill('均衡器')
        expect(palette.locator('[data-result-key="audio"]')).to_be_visible()
        child.get_by_test_id('local-command-search').press('Enter')
        audio_panel = child.get_by_test_id('local-audio-settings')
        expect(audio_panel).to_be_visible()
        done('bounded song pagination and Chinese command search execute with the keyboard')

        child.get_by_test_id('local-audio-enabled').check()
        child.get_by_test_id('local-audio-preset-rock').click()
        child.get_by_test_id('local-audio-band-0').press('End')
        child.get_by_test_id('local-audio-preampDb').press('End')
        child.get_by_test_id('local-audio-spatialEnabled').check()
        child.get_by_test_id('local-audio-widthRatio').press('Home')
        page.wait_for_function('audioChainSettings.enabled && audioChainSettings.gains[0] === 12 && audioChainSettings.preampDb === 12 && audioChainSettings.spatialEnabled && audioChainSettings.widthRatio === 0')
        assert page.evaluate('audio === __toolsAudio && audioCtx === __toolsContext && audio.paused && audio.currentTime === 4')
        page.evaluate('audioChainSettings.preampDb = -3; commitAudioChainSettings()')
        expect(child.get_by_test_id('local-audio-preampDb')).to_have_value('-3')
        child.get_by_test_id('local-output-refresh').click()
        expect(child.get_by_test_id('local-output-device')).to_have_value('')
        expect(child.get_by_test_id('local-output-status')).not_to_be_empty()
        capture_screenshot(page, path=str(OUT / 'audio-zh.png'))
        done('EQ edits persist, host edits flow back, output devices refresh and the host audio graph is retained')

        child.get_by_test_id('local-open-subtitles').click()
        subtitle_panel = child.get_by_test_id('local-subtitle-settings')
        child.get_by_test_id('local-subtitle-rows').select_option('3')
        subtitle_panel.get_by_label('字幕第 2 行', exact=True).select_option('romanization')
        subtitle_panel.get_by_label('字幕第 3 行', exact=True).select_option('translation')
        child.get_by_test_id('local-secondary-subtitle').select_option('both')
        child.get_by_test_id('local-subtitle-background').uncheck()
        child.get_by_test_id('local-subtitle-hidden').check()
        iframe = page.frame(url=lambda url: '/vendor/folia/' in url)
        saved = iframe.evaluate("JSON.parse(localStorage.getItem('mineradio-folia-local-visuals-v1')).state")
        assert saved['subtitleLayout'] == 'current+romanization+translation'
        assert saved['subtitleContentMode'] == 'both' and saved['subtitleHidden'] and not saved['subtitleBackground']
        subtitle_panel.get_by_role('button', name='关闭', exact=True).click()
        done('subtitle rows, romanization, translation, visibility and background share persistent visual settings')

        child.get_by_test_id('local-seek').hover()
        child.get_by_test_id('local-play-mode').click(button='right')
        menu = child.get_by_test_id('local-slot-menu-0')
        menu.locator('[data-action="audio"]').click()
        child.locator('[data-slot-action="audio"]').click()
        expect(audio_panel).to_be_visible()
        audio_panel.get_by_role('button', name='关闭', exact=True).click()
        liked_before = page.evaluate('isSongLiked(playQueue[currentIdx])')
        like = child.get_by_test_id('local-like')
        like.hover()
        page.mouse.down()
        menu = child.get_by_test_id('local-slot-menu-1')
        try:
            # Keep the pointer pressed until the browser runs the long-press timer.
            expect(menu).to_be_visible()
        finally:
            page.mouse.up()
        assert page.evaluate('isSongLiked(playQueue[currentIdx])') == liked_before
        menu.locator('[data-action="addPlaylist"]').click()
        child.locator('[data-slot-action="addPlaylist"]').click()
        add_panel = child.get_by_test_id('local-add-playlist')
        add_panel.get_by_label('加入歌单', exact=True).select_option(playlist_id)
        page.wait_for_function('id => localPlaylistSongs(id).length === 1', arg=playlist_id)
        add_panel.get_by_role('button', name='关闭', exact=True).click()
        child.get_by_test_id('local-seek').hover()
        child.locator('[data-slot-action="addPlaylist"]').click(button='right')
        child.get_by_test_id('local-slot-menu-1').locator('[data-action="shuffle"]').click()
        before = page.evaluate('({id: playQueue[currentIdx].localKey, time: audio.currentTime, mode: playMode, count: playQueue.length})')
        child.locator('[data-slot-action="shuffle"]').click()
        assert page.evaluate('({id: playQueue[currentIdx].localKey, time: audio.currentTime, mode: playMode, count: playQueue.length})') == before
        done('right-click and long-press customize saved actions; playlist add and shuffle preserve playback')

        child.get_by_test_id('local-view-records').click()
        child.locator('[data-ponder="player-bar"]').hover()
        slot = child.locator('[data-slot-action="shuffle"]')
        slot.click(button='right')
        menu = child.get_by_test_id('local-slot-menu-1')
        menu.locator('[data-action="subtitles"]').hover()
        expect(menu).to_be_visible()
        menu.locator('[data-action="subtitles"]').click()
        child.locator('[data-ponder="player-bar"]').hover()
        child.locator('[data-slot-action="subtitles"]').click()
        expect(subtitle_panel).to_be_visible()
        page.evaluate("setUiLanguage('en')")
        expect(subtitle_panel.get_by_text('Subtitle settings', exact=True)).to_be_visible()
        capture_screenshot(page, path=str(OUT / 'record-tools-en.png'))
        subtitle_panel.get_by_role('button', name='Close', exact=True).click()
        done('record-wall controls share shortcuts and their menu stays clickable outside the animated capsule')

        page.evaluate("document.body.classList.add('desktop-shell')")
        page.mouse.move(720, 5)
        titlebar = page.locator('#folia-titlebar-controls')
        titlebar.get_by_test_id('local-open-commands').click()
        expect(palette).to_be_visible()
        child.get_by_test_id('local-command-search').fill('Road')
        palette.locator(f'[data-result-key="{playlist_id}"]').click()
        expect(palette.locator('[data-result-kind="track"]')).to_have_count(1)
        child.get_by_test_id('local-command-search').press('Escape')
        expect(palette).to_have_count(0)
        expect(titlebar.get_by_test_id('local-open-commands')).to_be_focused()
        page.keyboard.press('Control+k')
        expect(palette).to_be_visible()
        child.get_by_test_id('local-command-search').fill('Command-23')
        expect(palette.locator('[data-result-kind="track"]')).to_have_count(1)
        child.get_by_test_id('local-command-search').press('Enter')
        page.wait_for_function("playQueue[currentIdx].name === 'Command-23'")
        assert page.evaluate('audio === __toolsAudio && audioCtx === __toolsContext')
        done('titlebar portals restore focus; Ctrl+K, playlist scopes and direct song playback work across documents')

        backup = page.evaluate('collectMineradioBackupPayload()')
        controls = json.loads(backup['config']['player']['mineradio-folia-local-controls-v1'])
        assert controls['state']['slots'] == ['audio', 'subtitles']
        iframe.goto(iframe.url, wait_until='networkidle')
        child.locator('[data-ponder="player-bar"]').hover()
        expect(child.locator('[data-slot-action="audio"]')).to_be_visible()
        expect(child.locator('[data-slot-action="subtitles"]')).to_be_visible()
        restored = iframe.evaluate("JSON.parse(localStorage.getItem('mineradio-folia-local-visuals-v1')).state")
        assert restored['subtitleContentMode'] == 'both' and restored['subtitleHidden']
        assert page.evaluate('audio === __toolsAudio && audioCtx === __toolsContext')
        done('shortcut layouts enter real desktop backups and reload with subtitle preferences intact')
    finally:
        (OUT / 'acceptance.json').write_text(json.dumps({'checks': checks, 'errors': errors}, ensure_ascii=False, indent=2), encoding='utf-8')
        if len(checks) < 7:
            capture_screenshot(page, path=str(OUT / 'failure.png'))
        browser.close()
