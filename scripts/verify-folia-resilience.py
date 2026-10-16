"""Exercise Folia runtime recovery, retry, and explicit diagnostic export in Chromium."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:3268')
args = parser.parse_args()
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'artifacts' / 'ui-language'
OUTPUT.mkdir(parents=True, exist_ok=True)
report = {'checks': [], 'errors': []}

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(accept_downloads=True, viewport={'width': 1440, 'height': 900})
    context.add_init_script("""
      localStorage.setItem('mineradio-ui-language-v1', 'en');
      localStorage.setItem('folia_app_language', 'zh-CN');
      localStorage.setItem('i18nextLng', 'zh-CN');
    """)
    page = context.new_page()
    page.on('pageerror', lambda error: report['errors'].append(str(error)))
    try:
        page.goto(args.url, wait_until='networkidle')
        page.wait_for_function("typeof MineradioFoliaHost === 'object'")
        page.evaluate("MineradioFoliaHost.setInterface('folia')")
        frame_element = page.locator('#folia-frame')
        frame_element.wait_for()
        frame = page.frame(url=lambda url: '/vendor/folia/' in url)
        assert frame is not None
        player = frame.get_by_test_id('local-player')
        expect(player).to_have_attribute('data-active', 'true', timeout=30000)
        # The language selector lives inside the lazily mounted Effects panel.
        # Open it before asserting the host-provided language state.
        frame.get_by_test_id('local-open-settings').click()
        expect(frame.get_by_test_id('local-visual-settings')).to_be_visible()
        expect(frame.get_by_test_id('local-ui-language')).to_have_value('en')

        frame.evaluate("""() => window.dispatchEvent(new ErrorEvent('error', {
          message: 'verification visualizer failure',
          error: new Error('verification visualizer failure'),
        }))""")
        recovery = frame.get_by_test_id('local-recovery')
        expect(recovery).to_be_visible()
        expect(recovery).to_contain_text('This effect could not be displayed')
        errors = frame.evaluate("JSON.parse(localStorage.getItem('mineradio-folia-diagnostics-v1') || '[]')")
        assert errors and errors[-1]['message'] == 'verification visualizer failure', errors
        report['checks'].append('runtime errors are recorded locally and replaced by English recovery actions')
        page.screenshot(path=str(OUTPUT / 'folia-recovery.png'))

        with page.expect_download() as pending_download:
            recovery.get_by_role('button', name='Export diagnostics').click()
        download = pending_download.value
        diagnostics_path = OUTPUT / 'folia-diagnostics.json'
        download.save_as(str(diagnostics_path))
        exported = json.loads(diagnostics_path.read_text(encoding='utf-8'))
        assert exported['schema'] == 1
        assert exported['errors'][-1]['message'] == 'verification visualizer failure'
        report['checks'].append('diagnostic export contains the bounded local error record')

        recovery.get_by_role('button', name='Retry').click()
        expect(frame.get_by_test_id('local-recovery')).to_have_count(0)
        expect(player).to_have_attribute('data-view', 'lyrics')
        report['checks'].append('retry restores the Folia renderer without changing its active view')

        recovery_return = frame.get_by_test_id('local-recovery')
        frame.evaluate("""() => window.dispatchEvent(new ErrorEvent('error', {
          message: 'return-action verification',
          error: new Error('return-action verification'),
        }))""")
        expect(recovery_return).to_be_visible()
        recovery_return.get_by_role('button', name='Back to Mineradio').click()
        page.wait_for_function("MineradioFoliaHost.getState().interface === 'mineradio'")
        report['checks'].append('recovery can return to Mineradio through the host bridge')
        assert not report['errors'], report['errors']
        report['passed'] = True
    except Exception as error:
        report.update(passed=False, failure=str(error))
        page.screenshot(path=str(OUTPUT / 'folia-recovery-failure.png'))
        raise
    finally:
        (OUTPUT / 'folia-resilience-report.json').write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps(report, ensure_ascii=True, indent=2))
        browser.close()
