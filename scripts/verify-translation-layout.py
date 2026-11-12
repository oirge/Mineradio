"""Exercise translation focus restoration inside a real transparent Electron window in CI."""
import argparse
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import urllib.request
import wave
from playwright.sync_api import sync_playwright, expect
from ui_translation_fixture import DESKTOP_IPC

if os.environ.get('GITHUB_ACTIONS') != 'true' or os.name != 'nt':
    raise RuntimeError('Native layout acceptance is restricted to Windows GitHub Actions')
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/ui-language/translation-layout'
OUT.mkdir(parents=True, exist_ok=True)

# Hosted Windows starts at 1024x768 and clamps native windows to that desktop.
# Select a supported wider mode only on this disposable CI machine, without
# persisting the choice. Keep the actual BrowserWindow at the reported size.
def prepare_ci_display():
    import ctypes
    from ctypes import wintypes

    class DevMode(ctypes.Structure):
        _fields_ = [('device', wintypes.WCHAR * 32), ('spec', wintypes.WORD),
                    ('driver', wintypes.WORD), ('size', wintypes.WORD), ('extra', wintypes.WORD),
                    ('fields', wintypes.DWORD), ('display', ctypes.c_byte * 16),
                    ('color', ctypes.c_short), ('duplex', ctypes.c_short), ('yResolution', ctypes.c_short),
                    ('ttOption', ctypes.c_short), ('collate', ctypes.c_short), ('form', wintypes.WCHAR * 32),
                    ('logPixels', wintypes.WORD), ('bits', wintypes.DWORD), ('width', wintypes.DWORD),
                    ('height', wintypes.DWORD), ('flags', wintypes.DWORD), ('frequency', wintypes.DWORD),
                    ('icmMethod', wintypes.DWORD), ('icmIntent', wintypes.DWORD), ('media', wintypes.DWORD),
                    ('dither', wintypes.DWORD), ('reserved1', wintypes.DWORD), ('reserved2', wintypes.DWORD),
                    ('panWidth', wintypes.DWORD), ('panHeight', wintypes.DWORD)]

    assert ctypes.sizeof(DevMode) == 220
    user32 = ctypes.WinDLL('user32', use_last_error=True)
    user32.EnumDisplaySettingsW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, ctypes.POINTER(DevMode)]
    user32.EnumDisplaySettingsW.restype = wintypes.BOOL
    user32.ChangeDisplaySettingsW.argtypes = [ctypes.POINTER(DevMode), wintypes.DWORD]
    user32.ChangeDisplaySettingsW.restype = wintypes.LONG
    modes = []
    for index in range(1024):
        mode = DevMode(size=ctypes.sizeof(DevMode))
        if not user32.EnumDisplaySettingsW(None, index, ctypes.byref(mode)):
            break
        if mode.width >= 1600 and mode.height >= 900 and mode.bits == 32:
            modes.append(mode)
    assert modes, 'CI display has no supported wide desktop mode'
    chosen = min(modes, key=lambda mode: (mode.width * mode.height, -mode.frequency))
    result = user32.ChangeDisplaySettingsW(ctypes.byref(chosen), 0)
    (OUT / 'display.json').write_text(json.dumps({'width':chosen.width, 'height':chosen.height,
        'frequency':chosen.frequency, 'changeResult':result}, indent=2), encoding='utf-8')
    assert result == 0, f'CI display mode change failed: {result}'

prepare_ci_display()
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', required=True)
args = parser.parse_args()
audio_file = OUT / 'Focus-layout.wav'
with wave.open(str(audio_file), 'wb') as stream:
    stream.setparams((1, 2, 8000, 0, 'NONE', 'not compressed'))
    stream.writeframes(b'\0\0' * 8000 * 90)
lyric_file = audio_file.with_suffix('.lrc')
lyric_file.write_text('[00:00.00]Focus restoration must preserve the window\n[00:30.00]Keep the playback bar inside the window', encoding='utf-8')

METRICS = """() => {
  const shell=document.getElementById('desktop-window-shell'), bar=document.getElementById('bottom-bar');
  const r=bar.getBoundingClientRect(), title=document.getElementById('desktop-titlebar').getBoundingClientRect();
  const source=document.getElementById('translation-source-open').getBoundingClientRect();
  const panel=document.getElementById('fx-panel'), pr=panel.getBoundingClientRect(), ps=getComputedStyle(panel);
  return {width:innerWidth,height:innerHeight,dpr:devicePixelRatio,shellLeft:shell.scrollLeft,shellTop:shell.scrollTop,
    pageLeft:scrollX,pageTop:scrollY,overflow:getComputedStyle(shell).overflow,active:document.activeElement?.id,
    bar:{x:r.x,y:r.y,width:r.width,right:r.right,center:r.x+r.width/2},title:{x:title.x,right:title.right},source:{x:source.x,right:source.right},
    panel:{x:pr.x,right:pr.right,classes:panel.className,cssRight:ps.right,transform:ps.transform},
    sourceParent:document.getElementById('translation-source-open').parentElement.outerHTML.slice(0,250)};
}"""
samples, errors, violations = [], [], []
with tempfile.TemporaryDirectory(prefix='mineradio-native-layout-', ignore_cleanup_errors=True) as temporary:
    profile = Path(temporary).resolve()
    assert profile.parent == Path(tempfile.gettempdir()).resolve()
    assert profile.name.startswith('mineradio-native-layout-')
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    # Match the packaged runtime: development-only security warning code in
    # Electron 43 parses SVG fragment resource names as absolute URLs and throws.
    # No webPreferences or actual security protections are disabled here.
    env = dict(os.environ, MINERADIO_LAYOUT_PROFILE=str(profile), MINERADIO_LAYOUT_DEBUG_PORT=str(port),
               ELECTRON_DISABLE_SECURITY_WARNINGS='1')
    with (OUT / 'native.log').open('w', encoding='utf-8') as native_log:
        native = subprocess.Popen(['node', 'node_modules/electron/cli.js', 'scripts/translation-layout-electron.js'],
                                  cwd=ROOT, env=env, stdout=native_log, stderr=subprocess.STDOUT,
                                  creationflags=subprocess.CREATE_NO_WINDOW)
        try:
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            for attempt in range(180):
                if native.poll() is not None:
                    raise RuntimeError('Isolated native layout process exited before CDP became ready')
                try:
                    with opener.open(f'http://127.0.0.1:{port}/json/version', timeout=1):
                        break
                except OSError:
                    time.sleep(.2)
            else:
                raise TimeoutError('Native layout debugger did not become ready')
            with sync_playwright() as playwright:
                browser = playwright.chromium.connect_over_cdp(f'http://127.0.0.1:{port}')
                context = browser.contexts[0]
                page = context.pages[0] if context.pages else context.wait_for_event('page', timeout=15000)
                page.set_default_timeout(20000)
                page.on('pageerror', lambda error: errors.append(error.stack or str(error)))
                page.add_init_script(DESKTOP_IPC)
                page.route('**/api/lyric-translate', lambda route: route.fulfill(status=503, json={'ok':False,'retryable':False}))
                page.goto(args.url, wait_until='domcontentloaded')
                assert page.evaluate('[innerWidth,innerHeight]') == [1387,780], 'Native viewport must match the reported window'
                page.locator('#file-input').set_input_files([str(audio_file), str(lyric_file)])
                page.wait_for_function('localLibrarySongs.length===1 && audio && audio.src && MineradioTranslationSettings.getState().ready')
                page.evaluate("audio.pause(); controlsAutoHide=false; document.documentElement.classList.add('desktop-shell-root'); document.body.classList.add('desktop-shell'); applyDiyMode(true,{save:false}); revealBottomControls(60000)")
                for method in ['button', 'escape', 'backdrop']:
                    page.locator('#fx-fab').click()
                    page.locator('#fx-panel-tabs [data-fx-tab="lyrics"]').click()
                    page.locator('#translation-source-open').click()
                    expect(page.locator('#translation-source-modal')).to_have_attribute('aria-hidden', 'false')
                    page.locator('#translation-source-endpoint').fill('https://translation-layout.example/v1')
                    page.locator('#translation-source-model').fill('layout-fixture')
                    page.locator('#translation-source-save').click()
                    expect(page.locator('#translation-source-status')).to_contain_text('已保存')
                    # The actual panel can retract while the modal is open; retain its connected offscreen trigger.
                    page.evaluate("toggleFxPanel(false); document.getElementById('fx-panel').classList.remove('peek')")
                    page.wait_for_timeout(700)
                    page.screenshot(path=str(OUT / f'{method}-before.png'))
                    before = page.evaluate(METRICS)
                    (OUT / f'{method}-before.json').write_text(json.dumps(before,indent=2),encoding='utf-8')
                    page.wait_for_function("document.getElementById('translation-source-open').getBoundingClientRect().x > innerWidth")
                    before = page.evaluate(METRICS)
                    assert before['source']['x'] > before['width'], 'Restore target must actually be offscreen'
                    if method == 'button': page.locator('#translation-source-close').click()
                    elif method == 'escape': page.locator('#translation-source-endpoint').press('Escape')
                    else: page.locator('#translation-source-modal').click(position={'x':5,'y':5})
                    expect(page.locator('#translation-source-modal')).to_have_attribute('aria-hidden', 'true')
                    page.wait_for_timeout(600)
                    page.screenshot(path=str(OUT / f'{method}-after.png'))
                    after = page.evaluate(METRICS)
                    samples.append({'method':method,'before':before,'after':after})
                    if any(abs(after[key]) > 1 for key in ['shellLeft','shellTop','pageLeft','pageTop']):
                        violations.append(f'{method}: restoring focus scrolled the player shell')
                    if abs(after['bar']['center'] - after['width']/2) > 1 or after['bar']['x'] < -1 or after['bar']['right'] > after['width']+1:
                        violations.append(f'{method}: playback bar left its centered viewport bounds')
                    # Allow all baseline failure methods to be captured, without hiding their recorded violations.
                    page.evaluate("document.getElementById('desktop-window-shell').scrollTo(0,0); window.scrollTo(0,0)")
                browser.close()
        finally:
            (OUT / 'report.json').write_text(json.dumps({'samples':samples,'pageErrors':errors,'violations':violations,
                'runtime':'native-windows-electron','ipc':'sanitized-settings-fixture'},ensure_ascii=False,indent=2),encoding='utf-8')
            try:
                native.wait(timeout=15)
            except subprocess.TimeoutExpired:
                subprocess.run(['taskkill','/PID',str(native.pid),'/T','/F'],capture_output=True,creationflags=subprocess.CREATE_NO_WINDOW)
                native.wait(timeout=10)
assert not errors, errors
assert not violations, violations
print(f'PASS: native shell remains unscrolled and controls centered after all {len(samples)} close methods', flush=True)
