"""Verify startup ordering, saved interface and real audio in fresh cloud browser contexts."""
import argparse
import io
import json
from pathlib import Path
import time
import wave

from playwright.sync_api import expect, sync_playwright
from ui_browser import launch_browser


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'artifacts' / 'ui-language' / 'startup-report.json'
TAIL_SCRIPT_DELAY_SECONDS = 0.3

# Append observation after app.js evaluates. The production scheduler and restore
# implementation remain intact; the wrapper returns the original Promise.
PROBE = r"""
;(() => {
  const probe = window.__startupProbe = {
    attachedAt: performance.now(), restores: [], scheduleRequests: [], domContentAt: null,
    firstFrameAfterDomAt: null, paint: []
  };
  const schedule = scheduleSavedLocalMusicFolderRestore;
  scheduleSavedLocalMusicFolderRestore = function (...args) {
    probe.scheduleRequests.push({at: performance.now(), delay: args[0] ?? null});
    return Reflect.apply(schedule, this, args);
  };
  const restore = restoreSavedLocalMusicFolder;
  restoreSavedLocalMusicFolder = function (...args) {
    const entry = {at: performance.now(), settled: false};
    probe.restores.push(entry);
    try {
      const result = Reflect.apply(restore, this, args);
      Promise.resolve(result).then(value => {
        entry.settled = true; entry.doneAt = performance.now(); entry.result = value;
      }, error => {
        entry.settled = true; entry.doneAt = performance.now(); entry.error = String(error);
      });
      return result;
    } catch (error) {
      entry.settled = true; entry.error = String(error); throw error;
    }
  };
  document.addEventListener('DOMContentLoaded', () => {
    probe.domContentAt = performance.now();
    requestAnimationFrame(() => { probe.firstFrameAfterDomAt = performance.now(); });
  });
  if (typeof PerformanceObserver === 'function') {
    try {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) probe.paint.push({name: entry.name, at: entry.startTime});
      }).observe({type: 'paint', buffered: true});
    } catch (_) {}
  }
})();
"""

# The constructor audit also runs in the child, so detached audio objects would
# be detected. Only the host's saved interface is configured.
INITIALIZE = r"""
(() => {
  window.__startupAudioAudit = {Audio: 0, AudioContext: 0, webkitAudioContext: 0, OfflineAudioContext: 0};
  for (const name of Object.keys(window.__startupAudioAudit)) {
    if (typeof window[name] !== 'function') continue;
    window[name] = new Proxy(window[name], {
      construct(target, args, newTarget) {
        window.__startupAudioAudit[name]++;
        return Reflect.construct(target, args, newTarget);
      }
    });
  }
  if (window !== window.top) return;
  localStorage.setItem('mineradio-visual-guide-seen-v2', '1');
  localStorage.setItem('mineradio-ui-language-v1', 'zh-CN');
})();
"""


def audio_fixture():
    """Use a real decodable WAV without touching any user's music or settings."""
    payload = io.BytesIO()
    with wave.open(payload, 'wb') as stream:
        stream.setparams((1, 2, 8000, 0, 'NONE', 'not compressed'))
        stream.writeframes(b'\0\0' * 8000 * 60)
    return {'name': 'Startup-fixture.wav', 'mimeType': 'audio/wav', 'buffer': payload.getvalue()}


def read_startup(page):
    return page.evaluate("""() => ({
      probe: window.__startupProbe, marks: appPerfMarks,
      navigation: performance.getEntriesByType('navigation').map(entry => ({
        domContentLoadedEventStart: entry.domContentLoadedEventStart,
        domContentLoadedEventEnd: entry.domContentLoadedEventEnd, loadEventEnd: entry.loadEventEnd
      })),
      interface: MineradioFoliaHost.getState().interface,
      bodyClasses: document.body.className, restoreStarted: localLibraryRestoreStarted,
      restoreScheduled: localLibraryRestoreScheduled
    })""")


def folia_ready(page):
    page.wait_for_function("document.getElementById('folia-interface')?.classList.contains('folia-ready')")
    child = page.frame(url=lambda url: '/vendor/folia/' in url)
    assert child is not None, 'Ready Folia frame is missing'
    expect(child.get_by_test_id('local-player')).to_have_attribute('data-active', 'true')
    expect(child.get_by_test_id('local-error')).to_have_count(0)
    return child


def click_switch(page):
    # Reveal the real auto-hiding chrome through its ordinary pointer path.
    page.mouse.move(640, 10)
    page.wait_for_function("!isFoliaInterfaceActive() || !document.body.classList.contains('folia-chrome-hidden')")
    page.locator('#folia-floating-switch').click()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:3018')
    args = parser.parse_args()
    report = {'checks': [], 'scenarios': [], 'errors': [], 'passed': False,
              'tailScriptDelayMs': int(TAIL_SCRIPT_DELAY_SECONDS * 1000)}
    with sync_playwright() as playwright:
        browser = launch_browser(playwright)
        try:
            for mode in ['mineradio', 'folia']:
                scenario = {'mode': mode, 'checks': []}
                report['scenarios'].append(scenario)
                context = browser.new_context(viewport={'width': 1280, 'height': 800}, locale='zh-CN')
                context.add_init_script(INITIALIZE)
                if mode == 'folia':
                    context.add_init_script("if (window === window.top) localStorage.setItem('mineradio-player-interface-v1', 'folia');")
                page = context.new_page()
                page.set_default_timeout(30000)
                page.on('pageerror', lambda error, current=mode: report['errors'].append({'mode': current, 'message': str(error)}))
                page.route('**/api/lyric-translate', lambda route: route.fulfill(status=200, json={'translations': []}))

                def instrument_app(route):
                    response = route.fetch()
                    source = response.body().decode('utf-8')
                    route.fulfill(response=response, body=source + PROBE)

                def delay_tail(route):
                    # Real parser-blocking network delay reveals restoration that
                    # starts before the remaining host dependencies and DCL.
                    time.sleep(TAIL_SCRIPT_DELAY_SECONDS)
                    route.continue_()

                page.route('**/app.js', instrument_app)
                page.route('**/folia-host.js', delay_tail)

                def checked(name):
                    assert not report['errors'], report['errors']
                    scenario['checks'].append(name)
                    report['checks'].append(f'{mode}: {name}')
                    print(f'PASS: {mode}: {name}', flush=True)

                try:
                    started = time.monotonic()
                    page.goto(args.url, wait_until='domcontentloaded')
                    page.wait_for_function("window.__startupProbe?.restores.length === 1 && __startupProbe.restores[0].settled && typeof MineradioFoliaHost === 'object'")
                    startup = read_startup(page)
                    scenario['startup'] = startup
                    scenario['startupObservedWallMs'] = round((time.monotonic() - started) * 1000, 2)
                    probe = startup['probe']
                    marks = {entry['name']: entry['value'] for entry in startup['marks']}
                    assert {'script-start', 'dom-content-loaded', 'home-revealed'} <= marks.keys(), marks
                    restored_at = probe['restores'][0]['at']
                    assert restored_at >= max(marks['dom-content-loaded'], marks['home-revealed']) - 1, startup
                    assert restored_at >= probe['domContentAt'], startup
                    assert len(probe['scheduleRequests']) == 1, startup
                    request = probe['scheduleRequests'][0]
                    assert request['delay'] is None, startup
                    frame_at = probe['firstFrameAfterDomAt']
                    painted = frame_at is not None and restored_at >= frame_at
                    fallback = restored_at >= request['at'] + 119
                    assert painted or fallback, startup
                    scenario['restoreScheduling'] = 'after-frame' if painted else 'bounded-fallback'
                    assert not probe['restores'][0].get('error'), startup
                    assert startup['restoreStarted'] and not startup['restoreScheduled'], startup
                    checked('restore waits for dependencies and DOMContentLoaded, then uses a frame or bounded fallback')

                    if mode == 'mineradio':
                        expect(page.locator('#empty-home')).to_be_visible()
                        expect(page.locator('#empty-home .home-local-action').first).to_be_visible()
                        assert page.locator('#folia-frame').count() == 0, 'Default startup must keep Folia lazy'
                        assert not page.evaluate('isFoliaInterfaceActive()')
                    else:
                        folia_ready(page)
                        expect(page.locator('#folia-interface')).to_be_visible()
                        assert page.evaluate('isFoliaInterfaceActive()')
                    checked('saved interface displays its real initial player')

                    page.locator('#file-input').set_input_files(audio_fixture())
                    page.wait_for_function("localLibrarySongs.length === 1 && playQueue.length === 1 && audio && !audio.paused && !playToggleBusy && Number.isFinite(audio.duration) && audio.duration > 0")
                    page.evaluate("window.__startupEngine = {audio, audioCtx, queue: playQueue};")
                    scenario['audio'] = page.evaluate('({duration: audio.duration, position: audio.currentTime, paused: audio.paused})')
                    assert scenario['audio']['duration'] == 60, scenario['audio']
                    checked('native file-input import starts the real WAV playback engine')

                    if mode == 'mineradio':
                        click_switch(page)
                    child = folia_ready(page)
                    expect(child.get_by_test_id('local-current-track')).to_contain_text('Startup-fixture')
                    page.mouse.move(640, 780)
                    child.wait_for_function("!document.body.classList.contains('mineradio-bar-hidden')")
                    child.get_by_test_id('local-toggle-play').click()
                    page.wait_for_function('audio.paused && !playToggleBusy')
                    child.get_by_test_id('local-toggle-play').click()
                    page.wait_for_function('!audio.paused && !playToggleBusy')
                    child_audio = child.evaluate('window.__startupAudioAudit')
                    assert child_audio is not None and not any(child_audio.values()), child_audio
                    assert child.locator('audio').count() == 0
                    checked('Folia pause and resume control the unique host audio')

                    click_switch(page)
                    page.wait_for_function('!isFoliaInterfaceActive()')
                    page.mouse.move(640, 780)
                    page.locator('#play-btn').click()
                    page.wait_for_function('audio.paused && !playToggleBusy')
                    page.locator('#play-btn').click()
                    page.wait_for_function('!audio.paused && !playToggleBusy')
                    click_switch(page)
                    folia_ready(page)
                    stable = page.evaluate("""() => ({
                      sameAudio: audio === __startupEngine.audio,
                      sameContext: audioCtx === __startupEngine.audioCtx,
                      sameQueue: playQueue === __startupEngine.queue,
                      playing: !audio.paused, restores: __startupProbe.restores.length,
                      scheduled: localLibraryRestoreScheduled
                    })""")
                    scenario['afterSwitches'] = stable
                    assert all(stable[key] for key in ['sameAudio', 'sameContext', 'sameQueue', 'playing']), stable
                    assert stable['restores'] == 1 and not stable['scheduled'], stable
                    checked('both interfaces round-trip without restarting restoration or replacing audio')
                except Exception as error:
                    scenario['failure'] = str(error)
                    try:
                        scenario['failureState'] = read_startup(page)
                    except Exception as state_error:
                        scenario['failureStateError'] = str(state_error)
                    raise
                finally:
                    context.close()
            report['passed'] = True
        finally:
            OUTPUT.parent.mkdir(parents=True, exist_ok=True)
            OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
            print(json.dumps(report, ensure_ascii=True, indent=2), flush=True)
            browser.close()


if __name__ == '__main__':
    main()
