"""One Chromium/WebGL backend for local and Windows CI acceptance."""
import json
import os
import time


def launch_browser(playwright):
    browser = playwright.chromium.launch(headless=True, channel='chromium', timeout=30000, args=[
        '--mute-audio', '--autoplay-policy=no-user-gesture-required',
        '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
    ])
    if os.environ.get('MINERADIO_UI_DIAGNOSTICS'):
        gpu = browser.new_browser_cdp_session().send('SystemInfo.getInfo')['gpu']
        print('Browser GPU devices:', json.dumps(gpu['devices']), flush=True)
    return browser


def capture_screenshot(page, **options):
    # Complete finite CSS transitions and cancel infinite CSS animations for a stable capture.
    # WebGL remains active; screenshot errors still fail the acceptance step.
    started = time.monotonic()
    page.screenshot(animations='disabled', caret='hide', **options)
    if os.environ.get('MINERADIO_UI_DIAGNOSTICS'):
        print(f'Screenshot {options.get("path")}: {time.monotonic() - started:.2f}s', flush=True)
