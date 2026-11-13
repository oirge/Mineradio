"""Check real browser queue visibility gates and complete local-search narrowing with 10,000 songs."""
import argparse
import io
import json
from pathlib import Path
import wave

from playwright.sync_api import expect, sync_playwright
from ui_browser import launch_browser, capture_screenshot

# This script uses a fresh nonpersistent browser context and an in-memory audio fixture.
# It does not operate the installed player, and the main WebGL loop is suspended during DOM checks.
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'artifacts' / 'ui-language' / 'performance-report.json'
COUNT = 10000
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:3018')
args = parser.parse_args()
report = {'checks': [], 'errors': [], 'queueSize': COUNT, 'metrics': {}, 'passed': False}


def audio_fixture():
    """Create one valid minute of muted PCM; all synthetic songs share this real imported file."""
    payload = io.BytesIO()
    with wave.open(payload, 'wb') as stream:
        stream.setparams((1, 2, 8000, 0, 'NONE', 'not compressed'))
        stream.writeframes(b'\0\0' * 8000 * 60)
    return {'name': 'Performance-fixture.wav', 'mimeType': 'audio/wav', 'buffer': payload.getvalue()}


def checked(name, metrics=None):
    assert not report['errors'], report['errors']
    report['checks'].append(name)
    if metrics is not None:
        report['metrics'][name] = metrics
    print('PASS:', name, flush=True)


def settle_queue(page):
    """Wait for the real named RAF task instead of forcing its callback or replacing scheduling."""
    page.wait_for_function('queuePanelPendingRender.raf === 0')
    # A frame-pressure callback may have handed work to the production 70/140 ms timeout.
    # Let that timeout finish as well before collecting another phase's operation counts.
    delay = page.evaluate("typeof runtimeFramePressureUiDelay === 'function' ? runtimeFramePressureUiDelay(0) : 0")
    page.wait_for_timeout(max(170, delay + 30))
    page.wait_for_function('queuePanelPendingRender.raf === 0')
    page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => resolve()))')


def begin_probe(page):
    page.evaluate('__performanceProbe.begin()')


def read_probe(page):
    return page.evaluate('__performanceProbe.read()')


def close_main_panel(page):
    page.evaluate("""() => {
      setPlaylistPanelPinned(false, true);
      togglePlaylistPanel(false);
      setPeek(document.getElementById('playlist-panel'), false, 'pl');
    }""")
    page.wait_for_function('!isMainPlaylistPanelVisibleForRender()')


with sync_playwright() as playwright:
    browser = launch_browser(playwright)
    context = browser.new_context(viewport={'width': 1280, 'height': 800}, locale='zh-CN')
    context.add_init_script("localStorage.setItem('mineradio-visual-guide-seen-v2', '1')")
    page = context.new_page()
    page.set_default_timeout(30000)
    page.on('pageerror', lambda error: report['errors'].append(str(error)))
    # The fixture contains no lyrics; prevent incidental requests to a configured external source.
    page.route('**/api/lyric-translate', lambda route: route.fulfill(status=200, json={'translations': []}))
    try:
        page.goto(args.url, wait_until='networkidle')
        page.wait_for_function("typeof safeRenderQueuePanel === 'function' && typeof searchLocalSongs === 'function'")
        page.locator('#file-input').set_input_files(audio_fixture())
        page.wait_for_function('localLibrarySongs.length === 1 && !playToggleBusy && audio && audio.src && Number.isFinite(audio.duration) && audio.duration > 0')
        page.evaluate("""count => {
          audio.pause();
          playing = false;
          suspendMainRenderLoop('performance-dom-probe');
          startLocalLibraryBackgroundProcessing([], {});
          cancelLocalSearchIndexWarmup();
          clearLocalLibraryPassiveQueue();
          const imported = cloneSong(localLibrarySongs[0]);
          const songs = Array.from({length: count}, (_, index) => Object.assign({}, imported, {
            id: 'performance-' + index,
            localKey: 'performance-' + index,
            name: 'Performance Track ' + String(index).padStart(5, '0'),
            localPath: 'Performance Track ' + String(index).padStart(5, '0') + '.wav',
            artist: 'Performance Artist', album: 'Performance Album',
            localMetadataLoaded: true, localCoverLoaded: true, localCoverLightScanned: true,
            localLyricLoaded: true, localLyricLightScanned: true, localLyricText: ''
          }));
          window.__performanceSongs = songs;
          localLibrarySongs = songs;
          playQueue = songs;
          currentIdx = 0;
          localLibraryReady = true;
          localLibraryPlaylistSelection = 'library';
          markQueueContentChanged();
          invalidateLocalPlaylistSongLookup();
          queuePanelLastDomSignature = '';
          playlistPanelLastDomSignature = '';
          miniQueueLastDomSignature = '';
          queuePanelIncrementalState = null;
          miniQueueIncrementalState = null;
          queuePanelDirty = true;
          setPlaylistPanelPinned(true, true);
          switchPlaylistTab('queue');
          safeRenderQueuePanel('performance-initial', {immediate: true, animate: false});
        }""", COUNT)
        settle_queue(page)
        expect(page.locator('#queue-list .queue-item')).to_have_count(COUNT)
        page.evaluate("""() => {
          const probe = {snapshotCalls: 0, snapshotItems: 0, writes: {main: 0, mini: 0, playlist: 0}, observers: []};
          const originalRows = queueVisibleRows;
          // Count calls while delegating unchanged to the production renderer.
          queueVisibleRows = function(...args) {
            probe.snapshotCalls++;
            probe.snapshotItems += args[0] || 0;
            return originalRows.apply(this, args);
          };
          for (const [key, id] of [['main', 'queue-list'], ['mini', 'mini-queue-list'], ['playlist', 'pl-list']]) {
            const observer = new MutationObserver(records => { probe.writes[key] += records.length; });
            observer.observe(document.getElementById(id), {childList: true, subtree: true, characterData: true});
            probe.observers.push([key, observer]);
          }
          probe.begin = () => {
            for (const [, observer] of probe.observers) observer.takeRecords();
            probe.snapshotCalls = 0;
            probe.snapshotItems = 0;
            probe.writes = {main: 0, mini: 0, playlist: 0};
            probe.audio = audio;
            probe.audioContext = audioCtx;
            probe.time = audio.currentTime;
            probe.queue = playQueue;
          };
          probe.read = () => {
            for (const [key, observer] of probe.observers) probe.writes[key] += observer.takeRecords().length;
            return {
              snapshotCalls: probe.snapshotCalls, snapshotItems: probe.snapshotItems, writes: {...probe.writes},
              queueDirty: queuePanelDirty, playlistDirty: playlistPanelDirty,
              sameAudio: audio === probe.audio, sameAudioContext: audioCtx === probe.audioContext,
              sameQueue: playQueue === probe.queue, audioPaused: audio.paused,
              audioPositionUnchanged: Math.abs(audio.currentTime - probe.time) < 0.01
            };
          };
          window.__performanceProbe = probe;
        }""")
        checked('real imported audio and 10,000-song queue fixture')

        for tab, button in [('library', '#tab-library'), ('playlists', '#tab-pl')]:
            page.locator(button).click()
            page.wait_for_function('(tab) => queueViewTab === tab && !isQueuePaneVisibleForRender()', arg=tab)
            settle_queue(page)
            begin_probe(page)
            page.evaluate("""() => {
              for (let index = 0; index < 36; index++) {
                safeRenderQueuePanel('performance-hidden-' + index, {
                  immediate: index % 3 === 0, deferWhenHidden: index % 4 !== 0, animate: false
                });
              }
            }""")
            settle_queue(page)
            metrics = read_probe(page)
            assert metrics['snapshotCalls'] == 0, metrics
            assert metrics['writes']['main'] == 0 and metrics['writes']['mini'] == 0, metrics
            assert metrics['queueDirty'], metrics
            assert all(metrics[key] for key in ['sameAudio', 'sameAudioContext', 'sameQueue', 'audioPaused', 'audioPositionUnchanged']), metrics
            checked(f'{tab} tab defers 36 hidden queue refreshes', metrics)

        page.evaluate("""() => {
          __performanceSongs[9999].name = 'Performance Queue Deferred 9999';
          markQueueContentChanged();
          safeRenderQueuePanel('performance-deferred-name');
        }""")
        begin_probe(page)
        page.locator('#tab-queue').click()
        page.wait_for_function("document.querySelector('[data-queue-index=\"9999\"] .qi-name')?.textContent === 'Performance Queue Deferred 9999' && !queuePanelDirty")
        settle_queue(page)
        metrics = read_probe(page)
        assert metrics['snapshotCalls'] >= 1 and metrics['writes']['main'] >= 1, metrics
        checked('return to queue flushes the deferred last row', metrics)

        close_main_panel(page)
        page.evaluate('revealBottomControls(2000)')
        page.locator('#mini-queue-btn').click()
        page.wait_for_function('miniQueueOpen && document.querySelectorAll("#mini-queue-list .mini-queue-item").length === 10000')
        settle_queue(page)
        begin_probe(page)
        page.evaluate("""() => {
          __performanceSongs[9999].name = 'Performance Mini Deferred 9999';
          markQueueContentChanged();
          safeRenderQueuePanel('performance-mini-only', {immediate: true, animate: false});
        }""")
        settle_queue(page)
        metrics = read_probe(page)
        assert metrics['snapshotCalls'] == 1 and metrics['snapshotItems'] == COUNT, metrics
        assert metrics['writes']['main'] == 0 and metrics['writes']['mini'] >= 1, metrics
        assert metrics['queueDirty'], metrics
        assert all(metrics[key] for key in ['sameAudio', 'sameAudioContext', 'sameQueue', 'audioPaused', 'audioPositionUnchanged']), metrics
        expect(page.locator('#mini-queue-list .mini-queue-item').last).to_contain_text('Performance Mini Deferred 9999')
        checked('mini queue updates alone while the main queue stays deferred', metrics)
        page.locator('#mini-queue-btn').click()
        page.wait_for_function('!miniQueueOpen')

        begin_probe(page)
        page.evaluate("""() => {
          __performanceSongs[9999].name = 'Performance Playlist Deferred 9999';
          markQueueContentChanged();
          for (let index = 0; index < 24; index++) renderLocalLibraryPlaylistPanel({animate: false});
          flushDeferredPlaylistPanel();
        }""")
        settle_queue(page)
        metrics = read_probe(page)
        assert metrics['writes']['playlist'] == 0 and metrics['playlistDirty'], metrics
        checked('hidden playlist defers 24 refreshes without DOM writes', metrics)
        page.evaluate('setPlaylistPanelPinned(true, true)')
        page.locator('#tab-pl').click()
        page.wait_for_function("document.querySelector('[data-local-library-index=\"9999\"] .pl-name')?.textContent === 'Performance Playlist Deferred 9999' && !playlistPanelDirty")
        expect(page.locator('#pl-list [data-local-library-index]')).to_have_count(COUNT)
        checked('return to playlist flushes deferred data through the real tab handler')

        page.locator('#tab-queue').click()
        last_queue = page.locator('#queue-list [data-queue-index="9999"] .qi-name')
        expect(last_queue).to_have_text('Performance Playlist Deferred 9999')
        last_queue.click()
        page.wait_for_function('currentIdx === 9999 && audio && audio.src && !audio.paused')
        page.evaluate("audio.pause(); playing = false; suspendMainRenderLoop('performance-dom-probe')")
        checked('deferred final queue row remains clickable and starts the real audio engine')

        page.locator('#tab-pl').click()
        last_library = page.locator('#pl-list [data-local-library-index="9999"] .pl-name')
        last_library.click()
        page.wait_for_function('currentIdx === 9999 && playQueue[currentIdx]?.localKey === "performance-9999" && audio && !audio.paused')
        page.evaluate("audio.pause(); playing = false; suspendMainRenderLoop('performance-dom-probe')")
        checked('deferred final playlist row remains clickable and enters the real queue')

        # Real input/Enter handlers must not narrow a truncated prior result set.
        page.evaluate("setPeek(document.getElementById('search-area'), true, 'search')")
        search = page.locator('#search-input')
        search.fill('Performance')
        search.press('Enter')
        page.wait_for_function('localSearchResultCache.normalizedQuery === simpleSearchNorm("Performance") && playlist.length === LOCAL_SEARCH_RESULT_LIMIT')
        broad = page.evaluate('({results: playlist.length, exhaustive: localSearchResultCache.exhaustive, limit: LOCAL_SEARCH_RESULT_LIMIT})')
        assert not broad['exhaustive'] and broad['results'] == broad['limit'], broad
        search.fill('Performance Playlist Deferred 9999')
        search.press('Enter')
        page.wait_for_function('playlist.length === 1 && playlist[0].localKey === "performance-9999"')
        expect(page.locator('#search-results .search-result-title')).to_contain_text('Performance Playlist Deferred 9999')
        checked('narrowing a truncated search finds the song beyond the original result limit', broad)

        # Resume the real renderer and exercise both shelf engines after the large-library DOM checks.
        close_main_panel(page)
        page.evaluate("""() => {
          setPeek(document.getElementById('search-area'), false, 'search');
          __performanceProbe.begin();
          window.__performanceStageStart = uniforms.uTime.value;
          setShelfMode('stage');
          resumeMainRenderLoop('performance-classic-stage');
        }""")
        page.wait_for_function("shelfEngineIsClassic() && shelfManager.getMode() === 'stage' && uniforms.uTime.value > __performanceStageStart + 0.5 && shelfManager.getCards().some(card => card.mesh.visible && card.mesh.material.opacity > 0.5)")
        stage = page.evaluate("""() => {
          const cards = shelfManager.getCards();
          return {cards: cards.length, visible: cards.filter(card => card.mesh.visible).length,
            finite: cards.every(card => [...card.mesh.position.toArray(), ...card.mesh.scale.toArray(),
              ...card.mesh.quaternion.toArray(), card.mesh.material.opacity].every(Number.isFinite))};
        }""")
        assert 0 < stage['visible'] <= stage['cards'] <= 13 and stage['finite'], stage
        capture_screenshot(page, path=str(OUTPUT.with_name('classic-stage.png')))
        metrics = read_probe(page)
        assert all(metrics[key] for key in ['sameAudio', 'sameAudioContext', 'sameQueue', 'audioPaused', 'audioPositionUnchanged']), metrics
        checked('classic stage renders a bounded 10,000-song card window without replacing audio', stage)
        page.evaluate("setShelfMode('side')")
        page.wait_for_function("!shelfEngineIsClassic() && shelfManager.getMode() === 'side'")
        checked('classic stage returns to the default side shelf without runtime errors')
        report['passed'] = True
    except Exception as error:
        report['failure'] = str(error)
        raise
    finally:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps(report, ensure_ascii=True, indent=2), flush=True)
        context.close()
        browser.close()
