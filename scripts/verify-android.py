"""Cloud Android emulator: install, SAF import, native service and cold restore."""
import json
import math
import struct
import wave
import atexit
import re
import subprocess
import time
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'output/playwright/mobile'
OUT.mkdir(parents=True, exist_ok=True)
APP = 'com.mineradio.oirge.mobile'

# The native job owns its fixture so it can run independently of browser rendering.
with wave.open(str(OUT / 'Mobile-Blue.wav'), 'wb') as stream:
    stream.setparams((1, 2, 8000, 0, 'NONE', 'not compressed'))
    second = b''.join(struct.pack('<h', int(3000 * math.sin(2 * math.pi * 220 * i / 8000))) for i in range(8000))
    stream.writeframes(second * 300)

def adb(*args):
    return subprocess.check_output(['adb', *args], text=True, encoding='utf-8', errors='replace', timeout=30).strip()

log_file = (OUT / 'android-logcat.txt').open('w', encoding='utf-8')
log_process = subprocess.Popen(['adb', 'logcat', '-v', 'brief'], stdout=log_file, stderr=subprocess.STDOUT)

def save_logs():
    if log_process.poll() is None:
        log_process.terminate()
        try: log_process.wait(timeout=5)
        except subprocess.TimeoutExpired: log_process.kill()
    log_file.close()

atexit.register(save_logs)

def start():
    print(adb('shell', 'am', 'start', '-n', APP + '/.MainActivity'), flush=True)
    for _ in range(40):
        try: pid = adb('shell', 'pidof', APP)
        except subprocess.CalledProcessError: pid = ''
        if pid:
            adb('forward', 'tcp:9222', 'localabstract:webview_devtools_remote_' + pid.split()[0])
            try:
                targets = json.load(urllib.request.urlopen('http://127.0.0.1:9222/json', timeout=2))
                if any('localhost' in item.get('url', '') for item in targets): return
            except Exception: pass
        time.sleep(1)
    (OUT / 'android-startup-logcat.txt').write_text(adb('logcat', '-d', '-t', '1500'), encoding='utf-8')
    raise AssertionError('Android WebView did not load; see android-startup-logcat.txt')

def tap_document(name):
    for _ in range(25):
        adb('shell', 'uiautomator', 'dump', '/sdcard/window.xml')
        tree = ET.fromstring(adb('shell', 'cat', '/sdcard/window.xml'))
        for node in tree.iter('node'):
            if node.get('text') == name or node.get('content-desc') == name:
                bounds = [int(v) for v in re.findall(r'\d+', node.get('bounds', ''))]
                adb('shell', 'input', 'tap', str((bounds[0]+bounds[2])//2), str((bounds[1]+bounds[3])//2))
                return
        # The picker normally opens Recents. Open Downloads if the document is elsewhere.
        for node in tree.iter('node'):
            if node.get('text') in ['Downloads', '下载']:
                bounds = [int(v) for v in re.findall(r'\d+', node.get('bounds', ''))]
                adb('shell', 'input', 'tap', str((bounds[0]+bounds[2])//2), str((bounds[1]+bounds[3])//2))
                break
        time.sleep(1)
    (OUT / 'android-picker.xml').write_text(adb('shell', 'cat', '/sdcard/window.xml'))
    raise AssertionError('Could not select test audio in the Android document picker')

subprocess.check_call(['adb', 'install', '-r', str(ROOT / 'mobile/android/app/build/outputs/apk/debug/app-debug.apk')])
adb('push', str(OUT / 'Mobile-Blue.wav'), '/sdcard/Download/Mobile-Blue.wav')
adb('shell', 'am', 'broadcast', '-a', 'android.intent.action.MEDIA_SCANNER_SCAN_FILE', '-d', 'file:///sdcard/Download/Mobile-Blue.wav')
start()
checks = []
errors = []

def completed(check):
    checks.append(check)
    (OUT / 'android-results.json').write_text(json.dumps({'checks': checks, 'errors': errors}, ensure_ascii=False, indent=2), encoding='utf-8')
    print('PASS:', check, flush=True)

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp('http://127.0.0.1:9222', no_defaults=True)
    page = next(page for context in browser.contexts for page in context.pages if 'localhost' in page.url)
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.wait_for_selector('#mobile-nav')
    finally:
        try:
            diagnostic = page.evaluate('''() => ({url: location.href, ready: document.readyState, title: document.title,
            bodyClass: document.body?.className, width: innerWidth, height: innerHeight,
            capacitor: typeof Capacitor, native: window.Capacitor?.isNativePlatform?.(),
            mobile: window.MineradioMobile, nav: document.getElementById('mobile-nav')?.outerHTML,
            scripts: [...document.scripts].map(script => script.src), text: document.body?.innerText.slice(0, 1600)})''')
        except Exception as error:
            diagnostic = {'diagnosticError': str(error)}
        diagnostic['errors'] = errors
        (OUT / 'android-startup-state.json').write_text(json.dumps(diagnostic, ensure_ascii=False, indent=2), encoding='utf-8')
        print('Android startup:', json.dumps(diagnostic, ensure_ascii=False), flush=True)
        try:
            (OUT / 'android-startup.png').write_bytes(subprocess.check_output(['adb', 'exec-out', 'screencap', '-p'], timeout=15))
        except Exception as error:
            print('Android screenshot unavailable:', error, flush=True)
    page.screenshot(path=str(OUT / 'android-home.png'))
    assert page.evaluate('Capacitor.isNativePlatform() && MineradioMobile.active')
    assert not errors, errors
    assert page.evaluate('typeof Capacitor.registerPlugin === "function" && typeof MineradioNativeImport === "function"')
    completed('Capacitor Core and native library plugin initialize without page errors')
    page.locator('.home-local-action').filter(has_text='本地文件').click()
    tap_document('Mobile-Blue.wav')
    page.wait_for_function('localLibrarySongs.length === 1 && audio && !audio.paused', timeout=45000)
    page.wait_for_function('audio.currentTime > 1', timeout=20000)
    assert page.evaluate('audio.src.includes("_capacitor_content_")'), page.evaluate('audio.src')
    completed('native SAF import and streamed WAV playback')
    page.screenshot(path=str(OUT / 'android-player.png'))
    assert 'PlaybackService' in adb('shell', 'dumpsys', 'activity', 'services', APP)
    assert 'Mineradio' in adb('shell', 'dumpsys', 'media_session')
    completed('foreground playback service and media notification')
    page.locator('#mobile-nav [data-mobile-view=settings]').click()
    page.locator('[aria-label="关闭设置"]').click()
    page.locator('#play-btn').click()
    page.wait_for_function('audio.paused')
    page.locator('#play-btn').click()
    page.wait_for_function('!audio.paused')
    page.locator('#mobile-folia-switch').click()
    folia = page.frame_locator('#folia-frame')
    folia.get_by_test_id('local-mobile-nav').wait_for()
    folia.get_by_test_id('local-open-library').click()
    folia.get_by_test_id('local-track-row').first.wait_for()
    adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
    folia.get_by_test_id('local-library').wait_for(state='hidden')
    folia.get_by_test_id('local-toggle-play').click()
    page.wait_for_function('audio.paused')
    folia.get_by_test_id('local-toggle-play').click()
    page.wait_for_function('!audio.paused')
    page.screenshot(path=str(OUT / 'android-folia.png'))
    completed('Folia touch library, playback and Android back handling')
    start_position = page.evaluate('audio.currentTime')
    adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
    time.sleep(5)
    start()
    page.wait_for_function('(before) => audio && !audio.paused && audio.currentTime > before + 2', arg=start_position, timeout=20000)
    completed('background playback progresses after Home')
    folia.get_by_test_id('local-mobile-return').click()
    page.wait_for_function('!document.body.classList.contains("folia-interface-active")')
    adb('shell', 'am', 'force-stop', APP)
    time.sleep(1)
    start()
    # Force stop closes the CDP target; reconnect to the relaunched WebView.
    browser = p.chromium.connect_over_cdp('http://127.0.0.1:9222', no_defaults=True)
    page = next(page for context in browser.contexts for page in context.pages if 'localhost' in page.url)
    page.wait_for_function('localLibrarySongs.length === 1', timeout=30000)
    page.locator('#mobile-nav [data-mobile-view=player]').click()
    page.locator('#play-btn').click()
    page.wait_for_function('audio && !audio.paused && audio.currentTime > 0.5', timeout=30000)
    completed('cold restart restores persisted URI grants and music library')
    page.screenshot(path=str(OUT / 'android-restored.png'))

# The release has debugging disabled; install the exact signed download and inspect its real UI.
adb('shell', 'am', 'force-stop', APP)
adb('uninstall', APP)
subprocess.check_call(['adb', 'install', str(ROOT / 'release/Mineradio-Android-1.0.0.apk')])
launch = adb('shell', 'am', 'start', '-W', '-n', APP + '/.MainActivity')
assert 'Status: ok' in launch, launch
for attempt in range(20):
    adb('shell', 'uiautomator', 'dump', '/sdcard/release-window.xml')
    layout = adb('shell', 'cat', '/sdcard/release-window.xml')
    if '本地文件' in layout: break
    time.sleep(1)
else:
    (OUT / 'android-release-window.xml').write_text(layout, encoding='utf-8')
    raise AssertionError('The signed release did not show the offline import UI')
(OUT / 'android-release.png').write_bytes(subprocess.check_output(['adb', 'exec-out', 'screencap', '-p']))
completed('exact signed release installs and opens its offline import UI')

save_logs()
(OUT / 'android-results.json').write_text(json.dumps({'checks': checks, 'errors': errors}, ensure_ascii=False, indent=2), encoding='utf-8')
assert not errors, errors
print(json.dumps(checks))
