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
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'output/playwright/mobile'
OUT.mkdir(parents=True, exist_ok=True)
APP = 'com.mineradio.oirge.mobile'
LYRIC_TEXT = '[00:00.00]手机内嵌歌词 Native line one\n[01:00.00]手机内嵌歌词 Native line two\n[04:59.00]手机内嵌歌词 Native final line\n'

# The native job owns its fixture so it can run independently of browser rendering.
with wave.open(str(OUT / 'Mobile-Blue.wav'), 'wb') as stream:
    stream.setparams((1, 2, 8000, 0, 'NONE', 'not compressed'))
    second = b''.join(struct.pack('<h', int(3000 * math.sin(2 * math.pi * 220 * i / 8000))) for i in range(8000))
    stream.writeframes(second * 300)

def syncsafe(value):
    return bytes((value >> shift) & 0x7f for shift in (21, 14, 7, 0))

# Store real ID3v2.4 USLT lyrics after the WAV audio payload. This requires
# nonzero native byte offsets and cannot pass by reading the start of the file.
lyric_body = b'\x03eng\x00' + LYRIC_TEXT.encode('utf-8')
lyric_frame = b'USLT' + syncsafe(len(lyric_body)) + b'\x00\x00' + lyric_body
lyric_tag = b'ID3\x04\x00\x00' + syncsafe(len(lyric_frame)) + lyric_frame
with (OUT / 'Mobile-Blue.wav').open('r+b') as stream:
    stream.seek(0, 2)
    stream.write(b'id3 ' + struct.pack('<I', len(lyric_tag)) + lyric_tag + (b'\x00' if len(lyric_tag) % 2 else b''))
    riff_end = stream.tell()
    stream.seek(4)
    stream.write(struct.pack('<I', riff_end - 8))

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

launcher_dialogs = []

def dismiss_launcher_anr(tree):
    # The cloud Pixel image can show its launcher's ANR above DocumentsUI.
    # Match only that exact system dialog; Mineradio failures must remain visible.
    if not any(node.get('resource-id') == 'android:id/alertTitle'
               and node.get('package') == 'android'
               and node.get('text') == "Pixel Launcher isn't responding"
               for node in tree.iter('node')):
        return False
    evidence = 'android-launcher-anr-' + str(len(launcher_dialogs) + 1)
    (OUT / (evidence + '.xml')).write_text(ET.tostring(tree, encoding='unicode'), encoding='utf-8')
    try:
        (OUT / (evidence + '.png')).write_bytes(subprocess.check_output(['adb', 'exec-out', 'screencap', '-p'], timeout=15))
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        print('Launcher dialog screenshot unavailable:', str(error), flush=True)
    if len(launcher_dialogs) >= 2:
        raise AssertionError('Pixel Launcher ANR recurred more than twice; see saved system dialog evidence')
    for node in tree.iter('node'):
        if node.get('resource-id') == 'android:id/aerr_close' and node.get('package') == 'android':
            bounds = [int(v) for v in re.findall(r'\d+', node.get('bounds', ''))]
            assert len(bounds) == 4, 'Pixel Launcher Close app button has no bounds'
            adb('shell', 'input', 'tap', str((bounds[0]+bounds[2])//2), str((bounds[1]+bounds[3])//2))
            launcher_dialogs.append(evidence)
            print('Closed unrelated Pixel Launcher ANR; evidence:', evidence, flush=True)
            return True
    raise AssertionError('Pixel Launcher ANR has no Close app button; see ' + evidence)

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
        try:
            dump = adb('shell', 'uiautomator', 'dump', '/sdcard/window.xml')
            if 'UI hierchary dumped to:' not in dump and 'UI hierarchy dumped to:' not in dump:
                raise ValueError('The document picker accessibility tree is not ready')
            tree = ET.fromstring(adb('shell', 'cat', '/sdcard/window.xml'))
        except (ValueError, ET.ParseError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
            print('Waiting for Android document picker:', str(error), flush=True)
            time.sleep(1)
            continue
        if dismiss_launcher_anr(tree):
            time.sleep(1)
            continue
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
        else:
            # Recents does not expose Downloads until its navigation drawer opens.
            for node in tree.iter('node'):
                if node.get('content-desc') == 'Show roots':
                    bounds = [int(v) for v in re.findall(r'\d+', node.get('bounds', ''))]
                    adb('shell', 'input', 'tap', str((bounds[0]+bounds[2])//2), str((bounds[1]+bounds[3])//2))
                    break
        time.sleep(1)
    try:
        (OUT / 'android-picker.xml').write_text(adb('shell', 'cat', '/sdcard/window.xml'))
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        pass
    raise AssertionError('Could not select test audio in the Android document picker')

subprocess.check_call(['adb', 'install', '-r', str(ROOT / 'mobile/android/app/build/outputs/apk/debug/app-debug.apk')])
adb('push', str(OUT / 'Mobile-Blue.wav'), '/sdcard/Download/Mobile-Blue.wav')
adb('shell', 'am', 'broadcast', '-a', 'android.intent.action.MEDIA_SCANNER_SCAN_FILE', '-d', 'file:///sdcard/Download/Mobile-Blue.wav')
start()
checks = []
errors = []

def completed(check):
    checks.append(check)
    (OUT / 'android-results.json').write_text(json.dumps({'checks': checks, 'errors': errors, 'systemDialogs': launcher_dialogs}, ensure_ascii=False, indent=2), encoding='utf-8')
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
    assert page.evaluate('''async () => {
        const file = localLibrarySongs[0].localFile;
        const result = await MineradioNativeLibraryApi.readLocalFileRange(file.fullPath, 8, 12);
        return result.byteLength === 4 && new TextDecoder().decode(base64ChunksToBytes(result.base64Chunks, result.byteLength)) === 'WAVE';
    }'''), 'Native range reads must honor integer start/end offsets'
    page.wait_for_function('lyricsLines.some(line => !line.fallback && line.text.includes("手机内嵌歌词"))', timeout=30000)
    page.wait_for_function('stageLyrics && stageLyrics.current && stageLyrics.current.userData.lyric', timeout=30000)
    completed('native integer byte ranges and real embedded ID3 lyrics reach the main lyric stage')
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
    folia.get_by_test_id('local-open-settings').click()
    folia.get_by_test_id('local-visualizer-mode').select_option('classic')
    folia.get_by_test_id('local-visual-settings').get_by_role('button', name='关闭', exact=True).click()
    try:
        expect(folia.get_by_test_id('local-visualizer')).to_contain_text('手机内嵌歌词', timeout=45000)
        page.wait_for_function('''() => {
            const doc = document.getElementById('folia-frame').contentDocument;
            const line = doc.querySelector('[data-overlap-fit-line="0"]');
            const word = line?.querySelector('.inline-block');
            if (!line || !word) return false;
            const rect = line.getBoundingClientRect(), stage = doc.querySelector('[data-testid=local-visualizer]').getBoundingClientRect();
            return Number(doc.defaultView.getComputedStyle(line).opacity) > .9
                && Number(doc.defaultView.getComputedStyle(word).opacity) > .9
                && rect.width > 0 && rect.height > 0
                && rect.left >= stage.left - 1 && rect.right <= stage.right + 1
                && rect.top >= stage.top - 1 && rect.bottom <= stage.bottom + 1;
        }''', timeout=30000)
        completed('Folia renders native embedded lyrics with visible fitted animated text')
    finally:
        diagnostic = page.evaluate('''() => ({ lyrics: lyricsLines, state: MineradioFoliaHost.getState(),
            renderer: document.getElementById('folia-frame').contentDocument.querySelector('[data-testid=local-visualizer]')?.innerHTML.slice(0, 4000) })''')
        (OUT / 'android-embedded-lyrics.json').write_text(json.dumps(diagnostic, ensure_ascii=False, indent=2), encoding='utf-8')
        page.screenshot(path=str(OUT / 'android-embedded-folia.png'))
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
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.wait_for_load_state('domcontentloaded', timeout=60000)
    page.wait_for_function('typeof localLibrarySongs !== "undefined" && localLibrarySongs.length === 1', timeout=30000)
    page.wait_for_function('customLyricMapHydrated && customLyricPrefsHydrated', timeout=30000)
    assert not page.locator('#custom-lyric-modal').is_visible(), 'Cold restore must not open the custom lyrics editor'
    page.locator('#mobile-nav [data-mobile-view=player]').click()
    page.locator('#play-btn').click()
    page.wait_for_function('audio && !audio.paused && audio.currentTime > 0.5', timeout=30000)
    page.wait_for_function('lyricsLines.some(line => !line.fallback && line.text.includes("手机内嵌歌词"))', timeout=30000)
    completed('cold restart restores persisted URI grants and music library')
    page.screenshot(path=str(OUT / 'android-restored.png'))

# The release has debugging disabled; install the exact signed download and inspect its real UI.
adb('shell', 'am', 'force-stop', APP)
adb('uninstall', APP)
subprocess.check_call(['adb', 'install', str(ROOT / 'release/Mineradio-Android-1.0.1.apk')])
launch = adb('shell', 'am', 'start', '-W', '-n', APP + '/.MainActivity')
assert 'Status: ok' in launch, launch
layout = ''
for attempt in range(20):
    try:
        dump = adb('shell', 'uiautomator', 'dump', '/sdcard/release-window.xml')
        if 'UI hierchary dumped to:' not in dump and 'UI hierarchy dumped to:' not in dump:
            time.sleep(1)
            continue
        layout = adb('shell', 'cat', '/sdcard/release-window.xml')
        tree = ET.fromstring(layout)
    except (ET.ParseError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        time.sleep(1)
        continue
    if dismiss_launcher_anr(tree):
        time.sleep(1)
        continue
    if '本地文件' in layout: break
    time.sleep(1)
else:
    (OUT / 'android-release-window.xml').write_text(layout, encoding='utf-8')
    raise AssertionError('The signed release did not show the offline import UI')
(OUT / 'android-release.png').write_bytes(subprocess.check_output(['adb', 'exec-out', 'screencap', '-p']))
completed('exact signed release installs and opens its offline import UI')

save_logs()
(OUT / 'android-results.json').write_text(json.dumps({'checks': checks, 'errors': errors, 'systemDialogs': launcher_dialogs}, ensure_ascii=False, indent=2), encoding='utf-8')
assert not errors, errors
print(json.dumps(checks))
