"""Verify custom translation settings through both desktop UI entries with sanitized IPC stubs."""
import argparse
import json
from pathlib import Path
import wave

from playwright.sync_api import sync_playwright, expect
from ui_browser import launch_browser, capture_screenshot

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/ui-language/translation-source'
OUT.mkdir(parents=True, exist_ok=True)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:3018')
args = parser.parse_args()

# Native settings/connection behavior is covered by Node tests. This fixture
# exposes only public state and counters; it never returns a stored key to UI.
from ui_translation_fixture import DESKTOP_IPC

audio_file = OUT / 'Translation-UI.wav'
with wave.open(str(audio_file), 'wb') as stream:
    stream.setparams((1, 2, 8000, 0, 'NONE', 'not compressed'))
    stream.writeframes(b'\0\0' * 8000 * 30)
lyric = audio_file.with_suffix('.lrc')
lyric.write_text('[00:00.00]A local lyric for settings verification\n[00:10.00]Keep one audio engine', encoding='utf-8')

with sync_playwright() as playwright:
    browser = launch_browser(playwright)
    page = browser.new_page(viewport={'width': 1440, 'height': 900}, locale='zh-CN')
    page.set_default_timeout(15000)
    page.add_init_script(DESKTOP_IPC)
    errors, checks, translation_requests = [], [], []
    page.on('pageerror', lambda error: errors.append(str(error)))

    def intercept_translation(route):
        # No upstream traffic or real credentials are needed by this UI acceptance.
        translation_requests.append({'hasSession': bool(route.request.headers.get('x-mineradio-session'))})
        route.fulfill(status=503, json={'ok': False, 'code': 'UI_VERIFICATION_NO_UPSTREAM',
                                     'message': 'UI fixture has no upstream service.', 'retryable': False})

    page.route('**/api/lyric-translate', intercept_translation)

    def done(message):
        assert not errors, errors
        checks.append(message)
        print('PASS:', message, flush=True)

    def open_mineradio():
        # The host's existing outside-click behavior can retract DIY while the
        # source dialog is used. Reopen it through its real button before the tab.
        if not page.locator('#fx-panel').evaluate("el => el.classList.contains('show') || el.classList.contains('peek')"):
            page.locator('#fx-fab').click()
        page.locator('#fx-panel-tabs [data-fx-tab="lyrics"]').click()
        entry = page.locator('#fx-lyric-fold button[onclick="openTranslationSourceSettings()"]')
        if not entry.is_visible():
            page.locator('#fx-lyric-fold .fx-fold-head').click()
        entry.click()
        expect(page.locator('#translation-source-modal')).to_have_attribute('aria-hidden', 'false')
        expect(page.locator('#translation-source-endpoint')).to_be_focused()

    def close_with_keyboard():
        page.locator('#translation-source-endpoint').press('Escape')
        expect(page.locator('#translation-source-modal')).to_have_attribute('aria-hidden', 'true')
        expect(page.locator('#translation-source-key')).to_have_value('')

    def assert_private():
        assert page.evaluate("!Object.hasOwn(MineradioTranslationSettings.getState(), 'apiKey')")
        assert page.evaluate("!Object.values(localStorage).some(value => String(value).includes('ui-only-key-fixture'))")

    try:
        page.goto(args.url, wait_until='networkidle')
        page.wait_for_function("typeof setUiLanguage === 'function' && document.getElementById('fx-panel-tabs') && MineradioTranslationSettings.getState().ready")
        page.evaluate("applyDiyMode(true, {save:false}); toggleFxPanel(true); setUiLanguage('zh-CN')")
        open_mineradio()
        expect(page.locator('#translation-source-endpoint')).to_have_value('')
        expect(page.locator('#translation-source-model')).to_have_value('')
        expect(page.locator('#translation-source-key')).to_have_value('')
        assert page.evaluate('isCustomTranslationReady()')
        assert translation_requests == []
        done('default translation is ready while custom endpoint, model and key remain empty and no lyrics are requested')

        page.locator('#translation-source-endpoint').fill('https://translation-ui.example/v1')
        page.locator('#translation-source-save').click()
        expect(page.locator('#translation-source-status')).to_have_class('translation-source-note error')
        page.locator('#translation-source-endpoint').fill('https://translation-ui.example/v1')
        page.locator('#translation-source-model').fill('ui-model')
        page.locator('#translation-source-key').fill('ui-only-key-fixture')
        page.locator('#translation-source-save').click()
        expect(page.locator('#translation-source-key')).to_have_value('')
        page.wait_for_function('isCustomTranslationReady() && MineradioTranslationSettings.getState().hasApiKey')
        expect(page.locator('#translation-source-summary')).to_contain_text('ui-model')
        assert_private()
        done('validation errors remain visible; saving enables the source and clears the password field without leaking a key')

        close_with_keyboard()
        open_mineradio()
        expect(page.locator('#translation-source-endpoint')).to_have_value('https://translation-ui.example/v1')
        expect(page.locator('#translation-source-key')).to_have_value('')
        expect(page.locator('#translation-source-key')).to_have_attribute('placeholder', '已保存；留空保留原密钥')
        page.locator('#translation-source-test').click()
        expect(page.locator('#translation-source-status')).to_have_text('连接成功，翻译源可用。')
        assert page.evaluate('__translationUiCalls.tests === 1 && __translationUiCalls.suppliedKeys === 1')
        assert page.evaluate('MineradioTranslationSettings.getState().hasApiKey')
        assert_private()
        done('reopening shows public saved values; save-and-test preserves an existing key when the input stays empty')

        page.locator('#translation-source-clear-key').click()
        expect(page.locator('#translation-source-status')).to_have_text('已清除保存的密钥。')
        page.wait_for_function('!MineradioTranslationSettings.getState().hasApiKey')
        assert page.evaluate('__translationUiCalls.clears === 1')
        page.locator('#translation-source-enabled').uncheck()
        page.locator('#translation-source-save').click()
        page.wait_for_function('isCustomTranslationReady() && !MineradioTranslationSettings.getState().enabled')
        assert_private()
        done('clear-key removes the custom credential; disabling the custom service restores default translation')

        page.evaluate("setUiLanguage('en')")
        expect(page.locator('#translation-source-title')).to_have_text('Custom translation source')
        expect(page.locator('#translation-source-test')).to_have_text('Save and test')
        page.locator('#translation-source-save').focus()
        page.keyboard.press('Tab')
        expect(page.locator('#translation-source-close')).to_be_focused()
        page.keyboard.press('Shift+Tab')
        expect(page.locator('#translation-source-save')).to_be_focused()
        page.locator('#translation-source-key').fill('ui-only-key-fixture')
        page.keyboard.press('Escape')
        expect(page.locator('#translation-source-modal')).to_have_attribute('aria-hidden', 'true')
        expect(page.locator('#translation-source-key')).to_have_value('')
        done('live English labels, both Tab boundaries and Escape closing preserve modal focus and clear typed credentials')

        page.locator('#file-input').set_input_files([str(audio_file), str(lyric)])
        page.wait_for_function('localLibrarySongs.length === 1 && audio && audio.src')
        page.evaluate("audio.pause(); window.__translationAudio = audio; window.__translationAudioContext = audioCtx; toggleFxPanel(false); setUiLanguage('zh-CN')")
        page.locator('#folia-floating-switch').click()
        child = page.frame_locator('#folia-frame')
        child.get_by_test_id('local-open-subtitles').click(timeout=60000)
        subtitle = child.get_by_test_id('local-subtitle-settings')
        expect(child.get_by_test_id('local-translation-source')).to_have_text('自定义翻译源')
        child.get_by_test_id('local-translation-source').click()
        expect(subtitle).to_have_count(0)
        expect(page.locator('#translation-source-modal')).to_have_attribute('aria-hidden', 'false')
        expect(page.locator('#translation-source-endpoint')).to_be_focused()
        page.locator('#translation-source-save').focus()
        page.keyboard.press('Tab')
        expect(page.locator('#translation-source-close')).to_be_focused()
        capture_screenshot(page, path=str(OUT / 'folia-source-zh.png'))
        page.keyboard.press('Escape')
        expect(page.locator('#translation-source-modal')).to_have_attribute('aria-hidden', 'true')
        assert page.evaluate('audio === __translationAudio && audioCtx === __translationAudioContext && audio.paused')
        done('Folia subtitles open the same host dialog and release their keyboard trap without replacing the audio engine')

        page.evaluate("setUiLanguage('en')")
        child.get_by_test_id('local-open-commands').click()
        child.get_by_test_id('local-command-search').fill('custom translation')
        result = child.locator('[data-result-kind="action"][data-result-key="translationSource"]')
        expect(result).to_be_visible()
        expect(result).to_contain_text('Custom translation source')
        result.click()
        expect(child.get_by_test_id('local-command-palette')).to_have_count(0)
        expect(page.locator('#translation-source-modal')).to_have_attribute('aria-hidden', 'false')
        expect(page.locator('#translation-source-title')).to_have_text('Custom translation source')
        capture_screenshot(page, path=str(OUT / 'folia-source-en.png'))
        close_with_keyboard()
        assert_private()
        done('English Folia command search reaches the host source settings and closes with the keyboard')
    finally:
        report = {'checks': checks, 'errors': errors, 'translationRequests': translation_requests,
                  'limitations': ['Settings IPC and connection checks use sanitized browser stubs; native encryption and real upstream connections are verified separately.']}
        (OUT / 'acceptance.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        if len(checks) < 7:
            capture_screenshot(page, path=str(OUT / 'failure.png'))
        browser.close()
