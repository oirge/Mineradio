"""Cloud Android emulator: install, SAF import, native service and cold restore."""
import json
import math
import struct
import shutil
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
ANDROID_VERSION = json.loads((ROOT / 'mobile/package.json').read_text(encoding='utf-8'))['version']
LYRIC_TEXT = '[00:00.00]手机内嵌歌词 Native line one\n[01:00.00]手机内嵌歌词 Native line two\n[14:59.00]手机内嵌歌词 Native final line\n'

# The native job owns its fixture so it can run independently of browser rendering.
with wave.open(str(OUT / 'Mobile-Blue.wav'), 'wb') as stream:
    # Different tones in L/R make the native stereo matrix observable. The
    # 8kHz fixture also exercises real decoder resampling to the 48kHz sink.
    stream.setparams((2, 2, 8000, 0, 'NONE', 'not compressed'))
    second = b''.join(struct.pack('<hh',
        int(3000 * math.sin(2 * math.pi * 220 * i / 8000)),
        int(3000 * math.sin(2 * math.pi * 440 * i / 8000))) for i in range(8000))
    stream.writeframes(second * 900)

def syncsafe(value):
    return bytes((value >> shift) & 0x7f for shift in (21, 14, 7, 0))

# Store real ID3v2.4 USLT lyrics after the WAV audio payload. This requires
# nonzero native byte offsets and cannot pass by reading the start of the file.
lyric_body = b'\x03eng\x00' + LYRIC_TEXT.encode('utf-8')
lyric_frame = b'USLT' + syncsafe(len(lyric_body)) + b'\x00\x00' + lyric_body
gain_body = b'\x03REPLAYGAIN_TRACK_GAIN\x00-6.0206 dB'
gain_frame = b'TXXX' + syncsafe(len(gain_body)) + b'\x00\x00' + gain_body
peak_body = b'\x03REPLAYGAIN_TRACK_PEAK\x000.09156'
peak_frame = b'TXXX' + syncsafe(len(peak_body)) + b'\x00\x00' + peak_body
tag_frames = lyric_frame + gain_frame + peak_frame
lyric_tag = b'ID3\x04\x00\x00' + syncsafe(len(tag_frames)) + tag_frames
with (OUT / 'Mobile-Blue.wav').open('r+b') as stream:
    stream.seek(0, 2)
    stream.write(b'id3 ' + struct.pack('<I', len(lyric_tag)) + lyric_tag + (b'\x00' if len(lyric_tag) % 2 else b''))
    riff_end = stream.tell()
    stream.seek(4)
    stream.write(struct.pack('<I', riff_end - 8))
shutil.copyfile(OUT / 'Mobile-Blue.wav', OUT / 'Background-Green.wav')

def adb(*args):
    return subprocess.check_output(['adb', *args], text=True, encoding='utf-8', errors='replace', timeout=30).strip()

background_states = []

def native_state(label):
    output = adb('shell', 'dumpsys', 'activity', 'service', APP + '/.PlaybackService')
    match = re.search(r'MINERADIO_PLAYBACK (\{[^\n]+\})', output)
    value = json.loads(match.group(1)) if match else {}
    if not match:
        with (OUT / 'android-native-missing-state.txt').open('a', encoding='utf-8') as diagnostic:
            diagnostic.write(label + '\n' + output + '\n')
    background_states.append({'phase': label, 'state': value})
    (OUT / 'android-background.json').write_text(json.dumps(background_states, ensure_ascii=False, indent=2), encoding='utf-8')
    return value

def wait_native(label, predicate, timeout=35):
    deadline = time.monotonic() + timeout
    value = {}
    while time.monotonic() < deadline:
        value = native_state(label)
        if predicate(value): return value
        time.sleep(.75)
    raise AssertionError(label + ': ' + json.dumps(value, ensure_ascii=False))

def same_sink(before, after, require_progress=True, same_track=True):
    assert after.get('backend') == 'native' and after.get('engine') == 'pcm', after
    assert before['audioSessionId'] > 0 and after['audioSessionId'] == before['audioSessionId'], 'Lifecycle must retain the same AudioTrack session'
    assert after['sinkCreations'] == before['sinkCreations'], 'Lifecycle must not recreate the audio output'
    assert after['outputFrames'] >= before['outputFrames'] and after['playbackHeadFrames'] >= before['playbackHeadFrames'], 'The sink frame counters must not reset when the UI changes'
    if same_track:
        assert after['trackGeneration'] == before['trackGeneration'], 'Lifecycle must not reload or seek the current track'
    if require_progress:
        assert after['outputFrames'] > before['outputFrames'] and after['playbackHeadFrames'] > before['playbackHeadFrames'], 'The real AudioTrack output and playback head must advance'
    assert after['underruns'] == before['underruns'], 'No new AudioTrack underrun is allowed during a lifecycle transition'

def pcm_ratio(state):
    effects = state.get('effects', {})
    assert effects.get('inputRms', 0) > .015, 'Effect proof requires real nonzero decoded PCM'
    assert effects.get('processedFrames', 0) > 4800 and effects.get('invalidSamples', -1) == 0, effects
    return effects['outputRms'] / effects['inputRms']

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
adb('push', str(OUT / 'Background-Green.wav'), '/sdcard/Download/Background-Green.wav')
adb('shell', 'am', 'broadcast', '-a', 'android.intent.action.MEDIA_SCANNER_SCAN_FILE', '-d', 'file:///sdcard/Download/Mobile-Blue.wav')
adb('shell', 'am', 'broadcast', '-a', 'android.intent.action.MEDIA_SCANNER_SCAN_FILE', '-d', 'file:///sdcard/Download/Background-Green.wav')
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
    try:
        page.wait_for_function('''() => {
            let mesh = stageLyrics.current;
            if (!mesh?.visible) {
                mesh = stageLyrics.rows.find(row => row.kind === 'context' && row.lineIdx === stageLyrics.currentIdx
                    && row.state !== 'out' && row.alpha > .75)?.mesh;
            }
            if (!mesh?.visible || !stageLyrics.group?.visible) return false;
            const data = mesh.userData.row || mesh.userData.lyric;
            const material = data?.textMat;
            const opacity = material?.uniforms?.uOpacity?.value ?? material?.opacity ?? 0;
            const style = getComputedStyle(document.getElementById('canvas-container'));
            return opacity > .75 && Number(style.opacity) > .9 && style.visibility !== 'hidden';
        }''', timeout=30000)
    finally:
        diagnostic = page.evaluate('''() => ({ text: stageLyrics.currentText, index: stageLyrics.currentIdx,
            displayMode: fx.lyricDisplayMode, groupVisible: stageLyrics.group?.visible,
            bodyClass: document.body.className,
            meshVisible: stageLyrics.current?.visible,
            materialOpacity: stageLyrics.current?.userData.lyric?.textMat?.uniforms?.uOpacity?.value,
            meshWorld: stageLyrics.current?.getWorldPosition(new THREE.Vector3()).toArray(),
            meshScreen: stageLyrics.current?.getWorldPosition(new THREE.Vector3()).project(camera).toArray(),
            cameraPosition: camera.position.toArray(), cameraFov: camera.fov,
            rendererInfo: typeof renderer !== 'undefined' ? renderer.info.render : null,
            rows: stageLyrics.rows.map(row => ({index: row.lineIdx, kind: row.kind, alpha: row.alpha,
                state: row.state, visible: row.mesh.visible})),
            canvasOpacity: getComputedStyle(document.getElementById('canvas-container')).opacity })''')
        (OUT / 'android-main-lyrics.json').write_text(json.dumps(diagnostic, ensure_ascii=False, indent=2), encoding='utf-8')
        page.screenshot(path=str(OUT / 'android-player.png'))
        # Android's physical composition can differ from CDP's WebView capture for WebGL.
        (OUT / 'android-player-screen.png').write_bytes(subprocess.check_output(['adb', 'exec-out', 'screencap', '-p'], timeout=15))
    completed('native integer byte ranges and real embedded ID3 lyrics reach the main lyric stage')
    assert 'PlaybackService' in adb('shell', 'dumpsys', 'activity', 'services', APP)
    assert 'Mineradio' in adb('shell', 'dumpsys', 'media_session')
    completed('foreground playback service and media notification')
    assert page.evaluate('MineradioNativePlayback.mode === "single-native" && audio._mineradioNative && !(audio instanceof HTMLAudioElement)'), 'Android foreground playback must use the native proxy rather than an Activity audio element'
    native = wait_native('foreground-single-engine', lambda state: state.get('playing') and state.get('engine') == 'pcm' and state.get('audioSessionId', 0) > 0)
    assert native['sinkCreations'] == 1, 'A single persistent AudioTrack sink must own music playback'
    dsp_primitives = page.evaluate('''async () => await Capacitor.registerPlugin('MineradioLibrary').verifyAudioDsp()''')
    (OUT / 'android-native-dsp.json').write_text(json.dumps(dsp_primitives, ensure_ascii=False, indent=2), encoding='utf-8')
    primitive_checks = {check['name']: check for check in dsp_primitives.get('checks', [])}
    for primitive in ['neutralFloatBits', 'stereoWidthZero', 'eq250Hz', 'replayGainHalf',
                      'linkedLimiterFinite', 'boundedAnalysisLengths', 'settingsRampReturnsNeutral', 'smoothLimiterBypass']:
        assert primitive_checks.get(primitive, {}).get('passed') is True, (primitive, dsp_primitives)
    assert dsp_primitives.get('passed') is True and dsp_primitives.get('sampleRate') == 48000 and dsp_primitives.get('fftSize') == 2048, dsp_primitives
    assert page.evaluate('''async () => {
        await ensureLocalReplayGainForSong(currentLocalSong);
        return Math.abs(currentLocalSong.localReplayGain?.trackGainDb + 6.0206) < .01;
    }'''), 'ReplayGain validation must use the fixture real embedded gain tag'
    saved_audio = page.evaluate('''() => ({chain: audioChainSettings, replay: replayGainSettings,
        volume: targetVolume, rate: playbackRateSetting})''')
    page.evaluate('''() => {
        audioChainSettings = normalizeAudioChainSettings({enabled: false}); commitAudioChainSettings();
        replayGainSettings = normalizeReplayGainSettings({enabled: false}); commitReplayGainSettings();
        setVolume(1, true); setPlaybackRate(1, {toast: false});
    }''')
    neutral = wait_native('native-dsp-neutral', lambda state: state.get('effects', {}).get('width') == 1
        and abs(state.get('effects', {}).get('replayGain', 0) - 1) < .002
        and .99 < pcm_ratio(state) < 1.01)
    assert neutral['effects']['inputSideRms'] > .015, 'Stereo fixture must carry a measurable side signal'
    page.evaluate('''() => {
        audioChainSettings = normalizeAudioChainSettings({enabled: true, autoPreamp: false,
            limiterEnabled: false, spatialEnabled: true, widthRatio: 0}); commitAudioChainSettings();
    }''')
    mono = wait_native('native-dsp-mono-width', lambda state: state.get('effects', {}).get('width', 1) < .001
        and state.get('effects', {}).get('inputSideRms', 0) > .015
        and state.get('effects', {}).get('outputSideRms', 1) < .00001)
    assert .4 < pcm_ratio(mono) < .9, 'Width zero must combine the real stereo PCM into mono'
    page.evaluate('''() => {
        audioChainSettings = normalizeAudioChainSettings({enabled: true, autoPreamp: false,
            limiterEnabled: false, gains: [0,0,0,-12,0,0,0,0,0,0]}); commitAudioChainSettings();
    }''')
    equalized = wait_native('native-dsp-eq', lambda state: len(state.get('effects', {}).get('gains', [])) == 10
        and abs(state['effects']['gains'][3] + 12) < .01 and .1 < pcm_ratio(state) < .85)
    page.evaluate('''() => {
        audioChainSettings = normalizeAudioChainSettings({enabled: false}); commitAudioChainSettings();
        replayGainSettings = normalizeReplayGainSettings({enabled: true, mode: 'track', preampDb: 0, clipGuard: true});
        commitReplayGainSettings();
    }''')
    balanced = wait_native('native-dsp-replaygain', lambda state: abs(state.get('effects', {}).get('replayGain', 1) - .5) < .005
        and .47 < pcm_ratio(state) < .53)
    page.evaluate('''() => {
        replayGainSettings = normalizeReplayGainSettings({enabled: false}); commitReplayGainSettings();
        audioChainSettings = normalizeAudioChainSettings({enabled: true, autoPreamp: false,
            preampDb: 12, limiterEnabled: true, limiterThresholdDb: -12}); commitAudioChainSettings();
    }''')
    limited = wait_native('native-dsp-limiter', lambda state: state.get('effects', {}).get('ratio') == 20
        and abs(state.get('effects', {}).get('thresholdDb', 0) + 12) < .01
        and state.get('effects', {}).get('outputPeak', 1) < .3
        and 1 < pcm_ratio(state) < 3.7)
    assert limited['effects']['outputPeak'] < limited['effects']['inputPeak'] * limited['effects']['preampLinear'] * .9, 'The limiter must modify actual over-threshold samples'
    analysed = page.evaluate('''async () => {
        const state = await Capacitor.registerPlugin('MineradioLibrary').getPlaybackState();
        return state.analysis;
    }''')
    assert analysed['sampleFrames'] > 2048 and len(analysed['frequency']) == 1024 and len(analysed['timeDomain']) == 2048, analysed
    assert max(analysed['frequency']) > 10 and any(value != 128 for value in analysed['timeDomain']), 'Folia and the main stage must receive real native spectrum and waveform samples'
    page.evaluate('''(saved) => {
        audioChainSettings = normalizeAudioChainSettings(saved.chain); commitAudioChainSettings();
        replayGainSettings = normalizeReplayGainSettings(saved.replay); commitReplayGainSettings();
        setVolume(saved.volume, true); setPlaybackRate(1.5, {toast: false});
    }''', saved_audio)
    sped_up = wait_native('native-speed-start', lambda state: state.get('playing') and abs(state.get('rate', 0) - 1.5) < .01)
    time.sleep(2)
    sped_after = native_state('native-speed-end')
    elapsed = (sped_after['snapshotAt'] - sped_up['snapshotAt']) / 1000
    assert elapsed > 1, 'Playback speed proof requires distinct native snapshots spanning at least one second'
    print('Native speed:', json.dumps({'elapsed': elapsed, 'positionDelta': sped_after['position'] - sped_up['position'],
        'ratio': (sped_after['position'] - sped_up['position']) / elapsed}), flush=True)
    assert 1.25 < (sped_after['position'] - sped_up['position']) / elapsed < 1.75, 'Native playback speed must advance the real media clock at 1.5x'
    same_sink(sped_up, sped_after)
    page.evaluate('(rate) => setPlaybackRate(rate, {toast: false})', saved_audio['rate'])
    wait_native('native-speed-restored', lambda state: state.get('playing') and abs(state.get('rate', 0) - saved_audio['rate']) < .01)
    completed('single native PCM engine applies stereo width, ten-band EQ, embedded ReplayGain, limiting, real analysis and playback speed')
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
            // Slow cloud rendering may advance past the first sentence before Folia opens.
            const position = MineradioFoliaHost.getState().position;
            let current = null;
            for (const candidate of lyricsLines) {
                if (!candidate.fallback && candidate.t <= position) current = candidate;
            }
            if (!current) return false;
            const line = doc.querySelector(`[data-overlap-fit-line="${current.t}"]`);
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
            fittedLines: [...document.getElementById('folia-frame').contentDocument.querySelectorAll('[data-overlap-fit-line]')].map(line => ({
                key: line.getAttribute('data-overlap-fit-line'), opacity: getComputedStyle(line).opacity,
                wordOpacity: line.querySelector('.inline-block') && getComputedStyle(line.querySelector('.inline-block')).opacity,
                bounds: line.getBoundingClientRect().toJSON() })),
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
    foreground = wait_native('before-home', lambda state: state.get('playing') and state.get('engine') == 'pcm')
    adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
    native = wait_native('home', lambda state: state.get('nativeActive') and state.get('playing') and state.get('audioSessionId', 0) > 0)
    same_sink(foreground, native, require_progress=False)
    assert page.evaluate('audio._mineradioNative && MineradioNativePlayback.mode === "single-native"'), 'The foreground UI must remain a proxy for the same native engine'
    adb('shell', 'input', 'keyevent', 'KEYCODE_SLEEP')
    power = adb('shell', 'dumpsys', 'power')
    (OUT / 'android-screen-off-power.txt').write_text(power, encoding='utf-8')
    assert re.search(r'mWakefulness=(Asleep|Dozing)', power), 'The emulator display must really be asleep'
    sleep_position = native['position']
    time.sleep(20)
    native = wait_native('screen-off', lambda state: state.get('playing') and state.get('position', 0) > sleep_position + 15)
    same_sink(foreground, native)
    adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP')
    adb('shell', 'wm', 'dismiss-keyguard')
    start()
    page.wait_for_function('(before) => audio && !audio.paused && audio.currentTime > before + 2', arg=start_position, timeout=20000)
    page.wait_for_function('audioCtx.state === "running" && MineradioNativePlayback.mode === "single-native" && audio._mineradioNative', timeout=20000)
    resumed_foreground = native_state('foreground-return')
    same_sink(foreground, resumed_foreground)
    for transition in range(3):
        before = native_state('rapid-before-' + str(transition))
        adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
        time.sleep(.5)
        start()
        page.wait_for_function('audio && !audio.paused && audio._mineradioNative', timeout=20000)
        after = native_state('rapid-return-' + str(transition))
        same_sink(before, after)
    completed('Home, screen off and repeated UI returns keep one AudioTrack session without reloads or new underruns')
    folia.get_by_test_id('local-mobile-return').click()
    page.wait_for_function('!document.body.classList.contains("folia-interface-active")')

    # Import a second real SAF file so an absent WebView cannot be responsible for queue advance.
    page.locator('#upload-btn').click()
    tap_document('Background-Green.wav')
    page.wait_for_function('localLibrarySongs.length === 2 && playQueue.length === 2 && audio && !audio.paused', timeout=45000)
    page.wait_for_function('isFinite(audio.duration) && audio.duration > 800', timeout=30000)
    before_crossfade = wait_native('crossfade-before', lambda state: state.get('playing')
        and state.get('audioSessionId', 0) > 0 and isinstance(state.get('index'), int))
    page.evaluate('''() => {
        setGaplessCrossfadeSeconds(3, {toast: false});
        audio.currentTime = audio.duration - 5;
    }''')
    near_crossfade = wait_native('crossfade-near-end', lambda state: state.get('playing') and not state.get('preparing')
        and state.get('duration', 0) > 800 and state.get('position', 0) > state['duration'] - 6)
    # ADB can return after the three-second overlap has finished. The engine
    # retains a bounded witness captured while both decoded streams were mixed
    # and their successfully submitted overlap reached the real playback head.
    overlapping = wait_native('crossfade-overlap', lambda state: state.get('crossfadeWitness', {}).get('active') is True
        and state['crossfadeWitness'].get('count', 0) > before_crossfade.get('crossfadeCount', 0)
        and state['crossfadeWitness'].get('overlapFrames', 0) > 4800
        and state['crossfadeWitness'].get('playbackHeadFrames', -1) >= state['crossfadeWitness'].get('submittedFrames', 1))
    witness = overlapping['crossfadeWitness']
    assert witness['audioSessionId'] == near_crossfade['audioSessionId'] and witness['sinkCreations'] == 1, witness
    crossed = wait_native('crossfade-complete', lambda state: state.get('playing') and not state.get('crossfadeActive')
        and state.get('index') == (before_crossfade['index'] + 1) % 2
        and state.get('crossfadeCount', 0) > before_crossfade.get('crossfadeCount', 0)
        and state.get('overlapFrames', 0) > before_crossfade.get('overlapFrames', 0) + 48000)
    same_sink(near_crossfade, crossed, same_track=False)
    assert crossed['trackGeneration'] == witness['trackGeneration'] and crossed['crossfadeCount'] == witness['count'], witness
    assert crossed['playbackHeadFrames'] >= witness['submittedFrames'], 'The completed crossfade must retain the consumed overlap proof'
    page.wait_for_function('(uri) => audio && !audio.paused && playQueue[currentIdx]?.localFile?.fullPath === uri', arg=crossed['uri'], timeout=30000)
    page.evaluate('setGaplessCrossfadeSeconds(0, {toast: false})')
    completed('native crossfade mixes decoded tracks in the same AudioTrack sink')
    page.evaluate('audio.currentTime = audio.duration - 20')
    page.wait_for_function('audio.currentTime > audio.duration - 22')
    before_remove = wait_native('before-task-removed', lambda state: state.get('playing') and not state.get('preparing')
        and state.get('position', 0) > state.get('duration', 0) - 22 and state.get('duration', 0) > 800)
    tasks = adb('shell', 'dumpsys', 'activity', 'activities')
    (OUT / 'android-tasks-before-remove.txt').write_text(tasks, encoding='utf-8')
    task = re.search(r'Task\{[^\n]*#(\d+)[^\n]*' + re.escape(APP), tasks)
    assert task, 'Could not identify Mineradio task for removal'
    # Android 15 am stack remove delegates to removeTask, the Recents dismissal operation.
    adb('shell', 'am', 'stack', 'remove', task.group(1))
    native = wait_native('task-removed', lambda state: state.get('nativeActive') and state.get('playing'))
    same_sink(before_remove, native, require_progress=False)
    expected_index = native['index']
    assert native['position'] > native['duration'] - 25, 'Removing the Activity must keep the near-end native playback position'
    after = adb('shell', 'dumpsys', 'activity', 'activities')
    (OUT / 'android-tasks-after-remove.txt').write_text(after, encoding='utf-8')
    assert not re.search(r'Task\{[^\n]*#' + task.group(1) + r'\b[^\n]*' + re.escape(APP), after), 'Mineradio task must actually be removed'
    advanced = wait_native('auto-next-without-webview', lambda state: state.get('playing') and state.get('index') == (expected_index + 1) % 2 and 1 < state.get('position', 0) < 10)
    same_sink(before_remove, advanced, same_track=False)
    completed('removing the recent task keeps native playback alive and automatically advances its queue')

    adb('shell', 'input', 'keyevent', 'KEYCODE_MEDIA_PAUSE')
    paused = wait_native('media-pause', lambda state: state.get('nativeActive') and not state.get('playing') and not state.get('preparing'))
    assert paused['index'] == advanced['index'] and 1 < paused['position'] < 15, 'Automatic advance must play the next track from its beginning'
    time.sleep(2)
    assert abs(native_state('media-pause-hold').get('position', 0) - paused['position']) < .5
    adb('shell', 'input', 'keyevent', 'KEYCODE_MEDIA_PLAY')
    wait_native('media-play', lambda state: state.get('playing') and state.get('index') == paused['index'] and state.get('position', 0) > paused['position'] + 1)
    previous_index = paused['index']
    adb('shell', 'input', 'keyevent', 'KEYCODE_MEDIA_NEXT')
    resumed = wait_native('media-next', lambda state: state.get('playing') and state.get('index') != previous_index and 1 < state.get('position', 0) < 10)
    start()
    browser = p.chromium.connect_over_cdp('http://127.0.0.1:9222', no_defaults=True)
    page = next(page for context in browser.contexts for page in context.pages if 'localhost' in page.url)
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.wait_for_load_state('domcontentloaded', timeout=60000)
    page.wait_for_function('(state) => typeof audio !== "undefined" && audio && !audio.paused && audio._mineradioNative && MineradioNativePlayback.mode === "single-native" && playQueue[currentIdx].localFile.fullPath === state.uri && audio.currentTime >= state.position - 1', arg=resumed, timeout=45000)
    same_sink(resumed, native_state('playing-ui-recreated'))
    adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
    wait_native('second-home', lambda state: state.get('nativeActive') and state.get('playing'))
    adb('shell', 'input', 'keyevent', 'KEYCODE_MEDIA_PAUSE')
    paused = wait_native('paused-before-ui', lambda state: state.get('nativeActive') and not state.get('playing') and not state.get('preparing'))
    adb('shell', 'cmd', 'statusbar', 'expand-notifications')
    (OUT / 'android-background-notification.png').write_bytes(subprocess.check_output(['adb', 'exec-out', 'screencap', '-p'], timeout=15))
    adb('shell', 'cmd', 'statusbar', 'collapse')
    start()
    browser = p.chromium.connect_over_cdp('http://127.0.0.1:9222', no_defaults=True)
    page = next(page for context in browser.contexts for page in context.pages if 'localhost' in page.url)
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.wait_for_load_state('domcontentloaded', timeout=60000)
    page.wait_for_function('typeof audio !== "undefined" && audio && audio.src && audio.paused && audio._mineradioNative && MineradioNativePlayback.mode === "single-native"', timeout=45000)
    page.wait_for_function('(uri) => playQueue[currentIdx] && playQueue[currentIdx].localFile.fullPath === uri', arg=paused['uri'], timeout=30000)
    page.wait_for_function('(position) => audio.paused && Math.abs(audio.currentTime - position) < 2', arg=paused['position'], timeout=30000)
    same_sink(paused, native_state('paused-ui-return'), require_progress=False)
    page.locator('#mobile-nav [data-mobile-view=player]').click()
    page.locator('#play-btn').click()
    page.wait_for_function('audio && !audio.paused && audioCtx.state === "running"', timeout=30000)
    completed('media controls work without an Activity and playing or paused playback restores to the correct song and position')

    page.evaluate('setAutoPlaybackMode("off", {silent: true, startNow: false})')
    adb('shell', 'am', 'force-stop', APP)
    time.sleep(1)
    start()
    # Force stop closes the CDP target; reconnect to the relaunched WebView.
    browser = p.chromium.connect_over_cdp('http://127.0.0.1:9222', no_defaults=True)
    page = next(page for context in browser.contexts for page in context.pages if 'localhost' in page.url)
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.wait_for_load_state('domcontentloaded', timeout=60000)
    page.wait_for_function('typeof localLibrarySongs !== "undefined" && localLibrarySongs.length === 2', timeout=30000)
    page.wait_for_function('customLyricMapHydrated && customLyricPrefsHydrated', timeout=30000)
    page.evaluate('async () => await MineradioNativePlayback.ready')
    assert page.evaluate('autoPlaybackMode === "off" && (!audio || audio.paused)'), 'Cold restore with automatic playback disabled must wait for an explicit play command'
    assert not page.locator('#custom-lyric-modal').is_visible(), 'Cold restore must not open the custom lyrics editor'
    page.locator('#mobile-nav [data-mobile-view=player]').click()
    page.locator('#play-btn').click()
    page.wait_for_function('audio && !audio.paused && audio.currentTime > 0.5', timeout=30000)
    cold_native = wait_native('cold-native-play', lambda state: state.get('playing') and state.get('engine') == 'pcm' and state.get('audioSessionId', 0) > 0)
    assert cold_native['sinkCreations'] == 1, 'Cold manual playback must create one native sink'
    page.wait_for_function('lyricsLines.some(line => !line.fallback && line.text.includes("手机内嵌歌词"))', timeout=30000)
    completed('cold restart restores persisted URI grants and music library')
    page.screenshot(path=str(OUT / 'android-restored.png'))
    (OUT / 'android-restored-screen.png').write_bytes(subprocess.check_output(['adb', 'exec-out', 'screencap', '-p'], timeout=15))

# The release has debugging disabled; install the exact signed download and inspect its real UI.
adb('shell', 'am', 'force-stop', APP)
adb('uninstall', APP)
subprocess.check_call(['adb', 'install', str(ROOT / ('release/Mineradio-Android-' + ANDROID_VERSION + '.apk'))])
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
