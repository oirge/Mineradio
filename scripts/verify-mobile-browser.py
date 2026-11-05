"""Cloud browser checks for navigation, real audio and responsive geometry."""
import json
import math
import struct
import time
import urllib.request
import wave
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from verify_folia_mobile import verify_folia_mobile

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'output/playwright/mobile'
OUT.mkdir(parents=True, exist_ok=True)
FILES = []
for index, name in enumerate(['Mobile-Blue', 'Mobile-Amber']):
    target = OUT / (name + '.wav')
    with wave.open(str(target), 'wb') as track:
        track.setnchannels(1)
        track.setsampwidth(2)
        track.setframerate(8000)
        second = b''.join(struct.pack('<h', int(180 * math.sin(2 * math.pi * (220 + index * 110) * n / 8000))) for n in range(8000))
        track.writeframes(second * 90)
    lyric = target.with_suffix('.lrc')
    lyric.write_text('[00:00.00]Mobile music test\n[00:10.00]Local lyrics continue\n[00:30.00]Touch playback works\n', encoding='utf-8')
    FILES.extend([str(target), str(lyric)])

for attempt in range(30):
    try:
        urllib.request.urlopen('http://127.0.0.1:3077', timeout=2).close()
        break
    except OSError:
        time.sleep(1)

checks = []
errors = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=1)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://127.0.0.1:3077')
    page.wait_for_load_state('networkidle', timeout=30000)
    expect(page.locator('#mobile-nav')).to_be_visible()
    page.screenshot(path=str(OUT / 'home.png'))

    def navigate(name):
        page.locator('#mobile-nav [data-mobile-view="' + name + '"]').tap()
        expect(page.locator('body')).to_have_attribute('data-mobile-view', name)

    def within_viewport(selector):
        box = page.locator(selector).bounding_box()
        assert box and box['width'] > 0 and box['height'] > 0, (selector, box)
        size = page.viewport_size
        assert box['x'] >= -1 and box['y'] >= -1 and box['x'] + box['width'] <= size['width'] + 1 and box['y'] + box['height'] <= size['height'] + 1, (selector, box, size)
        return box

    navigate('settings')
    within_viewport('#fx-panel')
    page.locator('#fx-panel-tabs [data-fx-tab=advanced]').tap()
    page.screenshot(path=str(OUT / 'settings.png'))
    page.locator('[aria-label="关闭设置"]').tap()
    expect(page.locator('body')).to_have_attribute('data-mobile-view', 'home')
    checks.append('settings open and close in simple mode')

    navigate('library')
    page.mouse.move(389, 1)
    page.wait_for_timeout(600)
    within_viewport('#playlist-panel')
    page.locator('#pl-pane-create-btn').tap()
    modal = page.locator('.modal-mask.show')
    expect(modal).to_be_visible()
    within_viewport('.modal-mask.show .modal')
    modal.locator('input').first.fill('手机测试歌单')
    modal.get_by_role('button', name='创建', exact=True).tap()
    expect(modal.locator('#collect-list')).to_contain_text('手机测试歌单')
    modal.get_by_role('button', name='关闭', exact=True).tap()
    expect(modal).to_have_count(0)
    checks.append('touch library remains open and creates a playlist')

    navigate('home')
    page.locator('#file-input').set_input_files(FILES)
    page.wait_for_function('localLibrarySongs.length === 2 && audio && !audio.paused', timeout=30000)
    page.wait_for_function('document.body.classList.contains("mobile-has-track")')
    navigate('player')
    page.screenshot(path=str(OUT / 'player.png'))
    within_viewport('#bottom-bar')
    for selector in ['#play-btn', '#next-btn', '#prev-btn', '#heart-btn', '#mobile-player-more']:
        box = within_viewport(selector)
        assert box['width'] >= 44 and box['height'] >= 44, (selector, box)
    page.locator('#play-btn').tap()
    page.wait_for_function('audio.paused')
    position = page.locator('#progress-bar').bounding_box()
    page.touchscreen.tap(position['x'] + position['width'] * .45, position['y'] + position['height'] / 2)
    page.wait_for_function('audio.currentTime > 35 && audio.currentTime < 48')
    page.locator('#play-btn').tap()
    page.wait_for_function('!audio.paused')
    original = page.evaluate('currentIdx')
    page.locator('#next-btn').tap()
    page.wait_for_function('(value) => currentIdx !== value', arg=original)
    page.locator('#prev-btn').tap()
    page.wait_for_function('(value) => currentIdx === value', arg=original)
    page.locator('#mobile-player-more').tap()
    expect(page.locator('#mobile-player-more')).to_have_attribute('aria-expanded', 'true')
    within_viewport('.control-cluster.modes')
    page.screenshot(path=str(OUT / 'player-expanded.png'))
    page.locator('#mobile-player-more').tap()
    checks.append('real WAV import, pause, seek, resume, next, previous and options')

    navigate('search')
    page.locator('#search-input').fill('Blue')
    expect(page.locator('#search-results')).to_contain_text('Blue')
    page.locator('#mobile-search-close').tap()
    checks.append('local search and dismiss')

    for width, height in [(320, 568), (360, 800), (430, 932), (768, 1024), (844, 390), (1024, 600)]:
        page.set_viewport_size({'width': width, 'height': height})
        page.wait_for_timeout(300)
        navigate('library')
        panel = within_viewport('#playlist-panel')
        bar = within_viewport('#bottom-bar')
        nav = within_viewport('#mobile-nav')
        assert panel['y'] + panel['height'] <= bar['y'] + 2, (width, panel, bar)
        assert bar['y'] + bar['height'] <= nav['y'] + 2, (width, bar, nav)
        for selector in ['#play-btn', '#next-btn', '#prev-btn']:
            within_viewport(selector)
        navigate('settings')
        within_viewport('#fx-panel')
        page.screenshot(path=str(OUT / f'layout-{width}x{height}.png'))
    checks.append('320, 360, 430, 768 portrait and 844, 1024 landscape')

    verify_folia_mobile(page, checks, OUT)

    page.set_viewport_size({'width': 1280, 'height': 800})
    expect(page.locator('#mobile-nav')).to_be_hidden()
    assert not page.evaluate('document.body.classList.contains("mobile-layout")')
    checks.append('large browser returns to desktop layout')
    assert not errors, errors
    browser.close()

(OUT / 'browser-results.json').write_text(json.dumps({'checks': checks, 'errors': errors}, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'checks': checks, 'errors': errors}, ensure_ascii=False))
