"""Verify the built embedded Folia with the real Mineradio host and isolated preferences."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:3268')
args = parser.parse_args()
output = Path(__file__).resolve().parents[1] / 'artifacts' / 'ui-language'
output.mkdir(parents=True, exist_ok=True)
report = {'checks': [], 'audits': {}, 'errors': []}

def audit(frame, label):
    print('Audit: ' + label, flush=True)
    residual = frame.evaluate(r"""() => {
      const residual = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode, el = node.parentElement;
        if (!el || el.closest('script,style,option[value="zh-CN"]')) continue;
        if (!el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') continue;
        if (/\p{Script=Han}/u.test(node.nodeValue)) residual.push({text:node.nodeValue.trim(), tag:el.tagName});
      }
      for (const el of document.querySelectorAll('[title],[aria-label],[placeholder]')) {
        if (!el.getClientRects().length) continue;
        for (const attr of ['title','aria-label','placeholder']) {
          const text = el.getAttribute(attr);
          if (text && /\p{Script=Han}/u.test(text)) residual.push({attr,text});
        }
      }
      return residual;
    }""")
    report['audits'][label] = residual
    assert not residual, f'{label}: {residual}'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width':1440,'height':960}, locale='zh-CN')
    page.add_init_script("""localStorage.setItem('folia_app_language','zh-CN');
      localStorage.setItem('i18nextLng','zh-CN');
      if (!localStorage.getItem('mineradio-ui-language-v1')) localStorage.setItem('mineradio-ui-language-v1','en');""")
    page.on('pageerror', lambda e: report['errors'].append({'message':str(e), 'stack':e.stack, 'after':list(report['audits'])[-1:]}))
    try:
        page.goto(args.url)
        page.wait_for_load_state('networkidle')
        page.evaluate("MineradioFoliaHost.setInterface('folia')")
        page.locator('#folia-frame').wait_for()
        frame = page.frame(url=lambda url: '/vendor/folia/' in url)
        assert frame
        expect(frame.get_by_test_id('local-player')).to_have_attribute('data-active','true', timeout=30000)
        expect(frame.get_by_test_id('local-view-lyrics')).to_have_text('Lyric player')
        assert frame.evaluate('document.documentElement.lang') == 'en'
        assert frame.title() == 'Folia Local Player · Mineradio'
        audit(frame, 'initial-english-overrides-legacy-chinese')
        for view in ['lyrics','records','posters']:
            frame.get_by_test_id(f'local-view-{view}').click()
            expect(frame.get_by_test_id('local-player')).to_have_attribute('data-view',view)
            page.wait_for_timeout(500)
            audit(frame, view)
            page.screenshot(path=str(output / f'folia-english-{view}.png'))
        report['checks'].append('English startup overrides old Folia Chinese preference; three views audited')
        frame.get_by_test_id('local-view-lyrics').click()
        frame.get_by_test_id('local-open-library').click()
        audit(frame,'library')
        frame.get_by_test_id('local-open-settings').click()
        expect(frame.get_by_test_id('local-visual-settings')).to_be_visible()
        language = frame.get_by_test_id('local-ui-language')
        for lang, label in [('zh-CN','歌词播放'),('en','Lyric player')]:
            language.select_option(lang)
            expect(frame.get_by_test_id('local-view-lyrics')).to_have_text(label)
            page.wait_for_function('language => uiLanguage === language', arg=lang)
            assert page.evaluate('localStorage.getItem(UI_LANGUAGE_STORE_KEY)') == lang
        page.evaluate("setUiLanguage('zh-CN')")
        expect(language).to_have_value('zh-CN')
        page.evaluate("setUiLanguage('en')")
        expect(language).to_have_value('en')
        report['checks'].append('Folia and main settings synchronize language in both directions')

        modes = frame.get_by_test_id('local-visualizer-mode').locator('option').evaluate_all('(els) => els.map(e=>e.value)')
        for mode in modes:
            frame.get_by_test_id('local-visualizer-mode').select_option(mode)
            details = frame.get_by_test_id('local-effect-tuning')
            if details.count():
                details.locator('summary').click()
            page.wait_for_timeout(450)
            audit(frame, f'effect-{mode}')
        backgrounds = frame.get_by_test_id('local-background-mode').locator('option').evaluate_all('(els) => els.map(e=>e.value)')
        for background in backgrounds:
            frame.get_by_test_id('local-background-mode').select_option(background)
            details = frame.get_by_test_id('local-background-tuning')
            if details.count():
                details.locator('summary').click()
            page.wait_for_timeout(350)
            audit(frame, f'background-{background}')
        frame.get_by_test_id('local-theme').select_option('light')
        audit(frame, 'daylight-settings')
        page.screenshot(path=str(output / 'folia-english-settings.png'))
        report['checks'].append(f'{len(modes)} lyric effects and {len(backgrounds)} background settings audited')

        page.evaluate("""() => {
          localLibrarySongs = [{type:'local', localKey:'i18n-metadata', name:'默认', artist:'歌词', album:'高级', duration:180, localPath:'C:/Music/中文.flac'}];
          playQueue = []; currentIdx = -1; currentLocalSong = localLibrarySongs[0];
          localLibraryReady = true;
        }""")
        frame.get_by_test_id('local-open-library').click()
        expect(frame.locator('.local-track-list')).to_contain_text('默认',timeout=15000)
        page.evaluate("setUiLanguage('zh-CN')")
        expect(frame.get_by_test_id('local-view-lyrics')).to_have_text('歌词播放')
        page.evaluate("setUiLanguage('en')")
        expect(frame.locator('.local-track-list')).to_contain_text('默认')
        expect(frame.locator('.local-track-list')).to_contain_text('歌词')
        assert page.evaluate('localLibrarySongs[0].name') == '默认'
        report['checks'].append('Chinese song/artist metadata survives round-trip without translation')
        page.reload()
        page.wait_for_load_state('networkidle')
        page.locator('#folia-frame').wait_for()
        frame = page.frame(url=lambda url: '/vendor/folia/' in url)
        expect(frame.get_by_test_id('local-view-lyrics')).to_have_text('Lyric player',timeout=30000)
        assert page.evaluate('uiLanguage') == 'en'
        audit(frame,'reload')
        assert not report['errors'], report['errors']
        report['checks'].append('Language survives reload; zero browser exceptions')
        report['passed'] = True
    except Exception as error:
        report.update(passed=False, failure=str(error))
        page.screenshot(path=str(output / 'folia-failure.png'))
        raise
    finally:
        (output / 'folia-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps(report,ensure_ascii=True,indent=2))
        browser.close()
