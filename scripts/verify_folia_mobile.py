"""Cloud touch checks for the embedded Folia surface and shared host playback."""
import json
import re
from playwright.sync_api import expect, TimeoutError as PlaywrightTimeoutError


def verify_folia_mobile(page, checks, out):
    page.set_viewport_size({'width': 390, 'height': 844})
    page.evaluate('MineradioMobile.openView("player")')
    page.locator('#play-btn').tap()
    page.wait_for_function('audio && !audio.paused')
    source = page.evaluate('audio.src')
    position = page.evaluate('audio.currentTime')
    page.locator('#mobile-folia-switch').tap()
    folia = page.frame_locator('#folia-frame')
    folia.get_by_test_id('local-mobile-nav').wait_for(state='attached', timeout=30000)
    page.evaluate('''() => {
        const doc = document.getElementById('folia-frame').contentDocument, view = doc.defaultView;
        if (view.__mineradioMobileTapTrace) return;
        const trace = view.__mineradioMobileTapTrace = {events: []};
        const capture = event => {
            const target = event.target, control = target?.closest?.('[data-testid]');
            const evidence = {type: event.type, at: view.performance.now(), hostAt: performance.now(),
                bodyHidden: doc.body.classList.contains('mineradio-mobile-chrome-hidden'),
                pointerType: event.pointerType || null, isTrusted: event.isTrusted,
                target: {tag: target?.tagName || null, testid: target?.getAttribute?.('data-testid') || null,
                    classes: target?.getAttribute?.('class') || null, controlTestid: control?.getAttribute('data-testid') || null}};
            const animation = view.__mineradioChromeAnimationTrace;
            if (event.type === 'pointerdown' && animation?.active) evidence.animation = animation.read();
            trace.events.push(evidence);
        };
        // Window capture precedes the document's wake-only handler. Observe without altering events.
        for (const type of ['pointerdown', 'pointerup', 'click']) view.addEventListener(type, capture, true);
    }''')

    def clear_touch_events():
        page.evaluate('''() => { document.getElementById('folia-frame').contentWindow
            .__mineradioMobileTapTrace.events.length = 0; }''')

    def wake_controls():
        # A person first touches the stage when idle chrome has disappeared.
        # Do not tap through visible controls while adapting older interaction checks.
        for attempt in range(3):
            hidden = page.evaluate('''() => document.getElementById('folia-frame').contentDocument.body
                .classList.contains('mineradio-mobile-chrome-hidden')''')
            if hidden:
                box = folia.get_by_test_id('local-player').bounding_box()
                assert box and box['width'] > 0 and box['height'] > 0, box
                clear_touch_events()
                page.touchscreen.tap(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
            try:
                page.wait_for_function('''() => {
                    const doc = document.getElementById('folia-frame').contentDocument;
                    const selectors = ['.local-mobile-header', '.local-mobile-nav', '.local-controls', '.local-current-track'];
                    return !doc.body.classList.contains('mineradio-mobile-chrome-hidden') && selectors.every(selector => {
                        const element = doc.querySelector(selector);
                        if (!element) return false;
                        const style = doc.defaultView.getComputedStyle(element);
                        // Open panels and short landscape layouts intentionally omit some surfaces.
                        return style.display === 'none' || (style.visibility === 'visible' && Number(style.opacity) > .9);
                    });
                }''', timeout=2000, polling=50)
                expect(folia.get_by_test_id('local-mobile-nav')).to_be_visible()
                return
            except PlaywrightTimeoutError:
                # Idle may expire between the first read and the fade check.
                if attempt == 2 or not page.evaluate('''() => document.getElementById('folia-frame').contentDocument.body
                    .classList.contains('mineradio-mobile-chrome-hidden')'''):
                    raise

    def control_probe(testid):
        return page.evaluate('''(testid) => {
            const frame = document.getElementById('folia-frame'), doc = frame.contentDocument;
            const target = doc.querySelector(`[data-testid="${testid}"]`);
            const describe = element => {
                if (!element) return null;
                const style = element.ownerDocument.defaultView.getComputedStyle(element);
                return {tag: element.tagName, testid: element.getAttribute('data-testid'),
                    disabled: element.matches(':disabled'), ariaDisabled: element.getAttribute('aria-disabled'),
                    classes: element.getAttribute('class'), bounds: element.getBoundingClientRect().toJSON(),
                    style: {display: style.display, visibility: style.visibility, opacity: Number(style.opacity),
                        pointerEvents: style.pointerEvents, position: style.position, zIndex: style.zIndex,
                        transform: style.transform, transition: style.transition, top: style.top, bottom: style.bottom}};
            };
            const bounds = target?.getBoundingClientRect(), frameBounds = frame.getBoundingClientRect();
            const point = bounds && {x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2};
            const frameHit = point && doc.elementFromPoint(point.x, point.y);
            const hostHit = point && document.elementFromPoint(frameBounds.left + point.x, frameBounds.top + point.y);
            const ancestors = [];
            for (let element = target?.parentElement; element && ancestors.length < 8; element = element.parentElement) {
                ancestors.push(describe(element));
            }
            const hidden = doc.body.classList.contains('mineradio-mobile-chrome-hidden');
            const surfaces = [...doc.querySelectorAll('.local-mobile-header,.local-mobile-nav,.local-controls,.local-current-track')].map(describe);
            const targetState = describe(target);
            const visible = !!(targetState && targetState.bounds.width > 0 && targetState.bounds.height > 0 &&
                [targetState, ...ancestors].filter(Boolean).every(element =>
                    element.style.display !== 'none' && element.style.visibility === 'visible' && element.style.opacity > 0));
            const disabled = !!(targetState?.disabled || [targetState, ...ancestors].filter(Boolean).some(element =>
                element.ariaDisabled?.trim().toLowerCase() === 'true'));
            const pointerBlocked = targetState?.style.pointerEvents === 'none' ||
                [targetState, ...ancestors].filter(Boolean).some(element =>
                    element.style.display === 'none' || element.style.visibility === 'hidden');
            const fading = surfaces.some(element => element.style.display !== 'none' && element.style.opacity <= .9);
            const hitTarget = !!(target && frameHit && (target === frameHit || target.contains(frameHit)) && hostHit === frame);
            return {at: performance.now(), testid, hidden, bodyClass: doc.body.className,
                events: doc.defaultView.__mineradioMobileTapTrace.events.slice(),
                rootClass: doc.documentElement.className, hostBodyClass: document.body.className,
                viewport: {width: doc.documentElement.clientWidth, height: doc.documentElement.clientHeight},
                frameBounds: frameBounds.toJSON(), target: targetState, ancestors, surfaces,
                point, frameHit: describe(frameHit), hostHit: describe(hostHit), hitTarget, visible, disabled, pointerBlocked, fading,
                stage: describe(doc.querySelector('[data-testid=local-visualizer]')),
                panel: doc.querySelector('[data-testid=local-player]')?.getAttribute('data-panel')};
        }''', testid)

    tap_number = 0

    def tap_control(testid):
        nonlocal tap_number
        tap_number += 1
        evidence = out / f'folia-tap-{tap_number:02}-{testid}.json'
        trace = []

        def record(phase, error=None):
            try:
                snapshot = control_probe(testid)
            except Exception as diagnostic_error:
                snapshot = {'diagnosticError': str(diagnostic_error)}
            trace.append({'phase': phase, 'state': snapshot, 'error': str(error) if error else None})
            return snapshot

        def save():
            evidence.write_text(json.dumps({'testid': testid, 'attempts': trace}, ensure_ascii=False, indent=2), encoding='utf-8')

        def pointer_downs(snapshot):
            return [event for event in snapshot.get('events', []) if event.get('type') == 'pointerdown']

        def wake_only(snapshot):
            downs = pointer_downs(snapshot)
            return len(downs) == 1 and downs[0].get('isTrusted') is True and downs[0].get('bodyHidden') is True

        for attempt in range(3):
            try:
                wake_controls()
            except Exception as error:
                record(f'wake-failed-{attempt + 1}', error)
                save()
                raise
            before = record(f'before-{attempt + 1}')
            save()
            if before.get('fading'):
                try:
                    wake_controls()
                except Exception as error:
                    record(f'settle-failed-{attempt + 1}', error)
                    save()
                    raise
                before = record(f'settled-before-{attempt + 1}')
                save()
            if before.get('hidden'):
                save()
                if attempt < 2: continue
                raise AssertionError(f'{testid}: mobile chrome expired again before touch; see {evidence.name}')
            # An opaque, available control covered by another element is a real
            # hit-testing failure, not evidence for retrying an idle transition.
            if before.get('diagnosticError') or not before.get('target') or not before.get('visible') or before.get('disabled') \
                    or before.get('pointerBlocked') or before.get('fading') or not before.get('hitTarget'):
                save()
                raise AssertionError(f'{testid}: visible control is unavailable or intercepted; see {evidence.name}')
            try:
                # The probe checks availability and actual browser hit testing before a real touch.
                # Avoid waiting for animation frames while the phone's idle deadline continues.
                point, frame_bounds = before['point'], before['frameBounds']
                clear_touch_events()
                page.touchscreen.tap(frame_bounds['left'] + point['x'], frame_bounds['top'] + point['y'])
                after = record(f'completed-{attempt + 1}')
                save()
                if wake_only(after):
                    if attempt == 2:
                        raise AssertionError(f'{testid}: three trusted touches only woke idle chrome; see {evidence.name}')
                    continue
                downs = pointer_downs(after)
                if len(downs) != 1 or downs[0].get('isTrusted') is not True:
                    raise AssertionError(f'{testid}: real touch lacked one trusted pointerdown; see {evidence.name}')
                return
            except PlaywrightTimeoutError as error:
                after = record(f'timeout-{attempt + 1}', error)
                save()
                if any(event.get('bodyHidden') is not True for event in pointer_downs(after)):
                    raise
                if attempt == 2 or not (after.get('hidden') or wake_only(after)):
                    raise
                # A fresh real stage touch is allowed only after confirmed idle hiding.
        raise AssertionError(f'{testid}: touch did not complete; see {evidence.name}')

    wake_controls()
    assert page.evaluate('audio.src') == source
    assert page.evaluate('audio.currentTime') >= position - .5

    def inside(locator):
        box = locator.bounding_box()
        size = page.viewport_size
        assert box and box['width'] > 0 and box['height'] > 0, box
        assert box['x'] >= -1 and box['y'] >= -1 and box['x'] + box['width'] <= size['width'] + 1 and box['y'] + box['height'] <= size['height'] + 1, (box, size)
        return box

    def lyrics_inside_stage():
        condition = '''() => {
            const doc = document.getElementById('folia-frame').contentDocument;
            const stage = doc.querySelector('[data-testid=local-visualizer]');
            const line = stage?.querySelector('[data-overlap-fit-line="0"]');
            const words = line && [...line.querySelectorAll('.inline-block.whitespace-nowrap')];
            if (!words?.length) return false;
            const area = stage.getBoundingClientRect();
            return words.every(word => {
                const box = word.getBoundingClientRect();
                return Number(doc.defaultView.getComputedStyle(word).opacity) > .9
                    && box.left >= area.left - 1 && box.right <= area.right + 1
                    && box.top >= area.top - 1 && box.bottom <= area.bottom + 1;
            });
        }'''
        try:
            page.wait_for_function(condition)
        except Exception:
            print('Folia mobile bounds:', page.evaluate('''() => {
                const doc = document.getElementById('folia-frame').contentDocument;
                const stage = doc.querySelector('[data-testid=local-visualizer]');
                return { width: innerWidth, height: innerHeight, stage: stage?.getBoundingClientRect().toJSON(),
                    words: [...(stage?.querySelectorAll('.inline-block.whitespace-nowrap') || [])].map(word => ({
                        text: word.textContent, box: word.getBoundingClientRect().toJSON(), opacity: doc.defaultView.getComputedStyle(word).opacity })) };
            }'''), flush=True)
            page.screenshot(path=str(out / 'folia-bounds-error.png'))
            raise

    def touch_slider(testid, fraction, hold=False, cancel=False):
        wake_controls()
        slider = folia.get_by_test_id(testid)
        box = slider.bounding_box()
        assert box and box['width'] > 16, box
        current = slider.evaluate('(input) => (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min))')
        start = box['x'] + 8 + (box['width'] - 16) * current
        target = box['x'] + 8 + (box['width'] - 16) * fraction
        y = box['y'] + box['height'] / 2
        session = page.context.new_cdp_session(page)
        try:
            session.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': start, 'y': y}]})
            for step in range(1, 7):
                session.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': start + (target - start) * step / 6, 'y': y}]})
            if hold:
                page.wait_for_timeout(2800)
                assert not page.evaluate('''() => document.getElementById('folia-frame').contentDocument.body
                    .classList.contains('mineradio-mobile-chrome-hidden')'''), 'A held touch slider must keep the mobile controls visible'
                expect(folia.get_by_test_id('local-controls')).to_be_visible()
            session.send('Input.dispatchTouchEvent', {'type': 'touchCancel' if cancel else 'touchEnd', 'touchPoints': []})
        finally:
            session.detach()

    def touch_seek(fraction):
        touch_slider('local-seek', fraction)

    def wait_for_idle_chrome():
        page.wait_for_function('''() => {
            const doc = document.getElementById('folia-frame').contentDocument;
            const selectors = ['.local-mobile-header', '.local-mobile-nav', '.local-controls', '.local-current-track'];
            return doc.body.classList.contains('mineradio-mobile-chrome-hidden') && selectors.every(selector => {
                const element = doc.querySelector(selector);
                if (!element) return false;
                const style = doc.defaultView.getComputedStyle(element);
                return style.visibility === 'hidden' && style.pointerEvents === 'none';
            });
        }''')

    def start_animation_trace(label, capture_baseline=False):
        return page.evaluate('''({label, captureBaseline}) => {
            const frame = document.getElementById('folia-frame'), doc = frame.contentDocument, view = doc.defaultView;
            const previous = view.__mineradioChromeAnimationTrace;
            if (previous) view.clearInterval(previous.timer);
            const selectors = ['.local-mobile-header', '.local-mobile-nav', '.local-controls', '.local-current-track'];
            let baseline = null;
            if (captureBaseline) {
                const stage = doc.querySelector('[data-testid=local-visualizer]'), box = stage?.getBoundingClientRect();
                const frameBox = frame.getBoundingClientRect(), volume = doc.querySelector('[data-testid=local-volume]');
                const hidden = doc.body.classList.contains('mineradio-mobile-chrome-hidden');
                const surfaces = selectors.map(selector => {
                    const element = doc.querySelector(selector), style = element && view.getComputedStyle(element);
                    return {selector, display: style?.display, visibility: style?.visibility,
                        opacity: style ? Number(style.opacity) : null};
                });
                const point = box && {x: box.left + box.width / 2, y: box.top + box.height / 2};
                const frameHit = point && doc.elementFromPoint(point.x, point.y);
                const hostHit = point && document.elementFromPoint(frameBox.left + point.x, frameBox.top + point.y);
                const hostBox = box && {x: frameBox.left + box.left, y: frameBox.top + box.top,
                    width: box.width, height: box.height};
                const inside = hostBox && hostBox.width > 0 && hostBox.height > 0 && hostBox.x >= -1 && hostBox.y >= -1
                    && hostBox.x + hostBox.width <= innerWidth + 1 && hostBox.y + hostBox.height <= innerHeight + 1;
                const hit = !!(stage && frameHit && (frameHit === stage || stage.contains(frameHit)) && hostHit === frame);
                if (hidden || !inside || !hit || !volume || !surfaces.every(surface => surface.display !== 'none'
                    && surface.visibility === 'visible' && surface.opacity > .9)) {
                    throw new Error('Invalid visible chrome animation baseline: ' + JSON.stringify({hidden, inside, hit, hostBox, surfaces}));
                }
                baseline = {visibleGeometry: box.toJSON(), visibleStage: hostBox,
                    fullGeometry: {x: 0, y: 0, width: doc.documentElement.clientWidth, height: doc.documentElement.clientHeight},
                    frameBounds: frameBox.toJSON(), savedVolume: Number(volume.value),
                    audio: {source: audio.src, index: currentIdx, paused: audio.paused, position: audio.currentTime}};
            }
            const trace = view.__mineradioChromeAnimationTrace = {label, active: true, samples: []};
            trace.read = () => {
                const stage = doc.querySelector('[data-testid=local-visualizer]'), box = stage?.getBoundingClientRect();
                return {at: view.performance.now(), hidden: doc.body.classList.contains('mineradio-mobile-chrome-hidden'),
                    stage: box && {x: box.x, y: box.y, width: box.width, height: box.height,
                        centerX: box.x + box.width / 2, centerY: box.y + box.height / 2},
                    surfaces: selectors.map(selector => {
                        const element = doc.querySelector(selector), style = element && view.getComputedStyle(element);
                        return {selector, display: style?.display, visibility: style?.visibility,
                            opacity: style ? Number(style.opacity) : null};
                    })};
            };
            const sample = () => { if (trace.samples.length < 2000) trace.samples.push(trace.read()); };
            sample();
            trace.timer = view.setInterval(sample, 16);
            return baseline;
        }''', {'label': label, 'captureBaseline': capture_baseline})

    def stop_animation_trace():
        return page.evaluate('''() => {
            const view = document.getElementById('folia-frame').contentWindow, trace = view.__mineradioChromeAnimationTrace;
            if (!trace?.active) return null;
            view.clearInterval(trace.timer);
            trace.samples.push(trace.read());
            trace.active = false;
            return {label: trace.label, samples: trace.samples, events: view.__mineradioMobileTapTrace.events.slice()};
        }''')

    def wait_for_stage_rest():
        # Wait for the actual outer-stage motion, without changing the animation or its duration.
        page.wait_for_function('''() => {
            const stage = document.getElementById('folia-frame').contentDocument.querySelector('[data-testid=local-visualizer]');
            return stage && stage.getAnimations().every(animation => animation.id !== 'mineradio-mobile-chrome-stage'
                || animation.playState !== 'running');
        }''', timeout=2000, polling=16)

    def wait_for_stage_geometry(expected, hidden):
        page.wait_for_function('''({expected, hidden}) => {
            const doc = document.getElementById('folia-frame').contentDocument;
            const stage = doc.querySelector('[data-testid=local-visualizer]'), box = stage?.getBoundingClientRect();
            if (!box || doc.body.classList.contains('mineradio-mobile-chrome-hidden') !== hidden) return false;
            return ['x', 'y', 'width', 'height'].every(key => Math.abs(box[key] - expected[key]) < 1)
                && stage.getAnimations().every(animation => animation.id !== 'mineradio-mobile-chrome-stage'
                    || animation.playState !== 'running');
        }''', arg={'expected': expected, 'hidden': hidden}, timeout=2000, polling=16)

    def assert_animation_progress(trace, first_center, last_center, hidden):
        samples = [sample for sample in trace['samples'] if sample['hidden'] is hidden]
        low, high = sorted([first_center, last_center])
        assert any(sample['stage'] and low + 1 < sample['stage']['centerY'] < high - 1 for sample in samples), \
            f"{trace['label']}: stage position jumped without an observed intermediate center"
        for selector in ['.local-mobile-header', '.local-mobile-nav', '.local-controls', '.local-current-track']:
            assert any(surface['selector'] == selector and surface['visibility'] == 'visible'
                and surface['opacity'] is not None and .02 < surface['opacity'] < .98
                for sample in samples for surface in sample['surfaces']), \
                f"{trace['label']}: {selector} jumped without a visible intermediate opacity"

    def try_animation_reversal(visible_geometry, visible_center, hidden_center, frame_box, traces):
        # Prebuild the driver, then make one real gesture. Input latency can miss a 440ms animation.
        session = page.context.new_cdp_session(page)
        assert frame_box, 'Folia frame must be available for the real reversal touch'
        point = {'x': frame_box['x'] + frame_box['width'] / 2, 'y': frame_box['y'] + frame_box['height'] / 2}
        start_animation_trace('hide-reversed-by-touch')
        trigger_observed = True
        try:
            try:
                page.wait_for_function('''({first, last}) => {
                    const trace = document.getElementById('folia-frame').contentWindow.__mineradioChromeAnimationTrace;
                    const sample = trace.samples.at(-1);
                    const progress = sample?.stage && (sample.stage.centerY - first) / (last - first);
                    return sample?.hidden && progress > .15 && progress < .85;
                }''', arg={'first': visible_center, 'last': hidden_center}, timeout=5000, polling=16)
            except PlaywrightTimeoutError:
                trigger_observed = False
                # No claim of interruption when the driver did not observe its input window.
                wait_for_idle_chrome()
            clear_touch_events()
            session.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [point]})
            session.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
            wait_for_stage_geometry(visible_geometry, False)
            trace = stop_animation_trace()
            traces.append(trace)
            downs = [event for event in trace['events'] if event['type'] == 'pointerdown']
            assert len(downs) == 1 and downs[0]['isTrusted'] and downs[0]['bodyHidden'], \
                'The reversal gesture must be one real touch while chrome is idle-hidden'
            event = downs[0]
            center = (event.get('animation', {}).get('stage') or {}).get('centerY')
            progress = (center - visible_center) / (hidden_center - visible_center) if center is not None else None
            verified = progress is not None and .15 < progress < .85
            trace['interruption'] = {'triggerObserved': trigger_observed, 'verified': verified,
                'progressAtTrustedPointerdown': progress,
                'reason': 'trusted touch arrived during motion' if verified else 'trusted touch arrived outside the middle of the animation'}
            if verified:
                samples = [sample for sample in trace['samples'] if not sample['hidden'] and sample['at'] >= event['at'] and sample['stage']]
                low, high = sorted([visible_center, center])
                assert any(low + 1 < sample['stage']['centerY'] < high - 1 for sample in samples), \
                    'The interrupted stage must animate from its current center back to the visible center'
                assert all(low - 1 <= sample['stage']['centerY'] <= high + 1 for sample in samples), \
                    'The reversed stage must not jump beyond its current and restored centers'
            return trace
        finally:
            session.detach()

    for testid in ['local-toggle-play', 'local-next', 'local-previous', 'local-mobile-return']:
        wake_controls()
        box = inside(folia.get_by_test_id(testid))
        assert box['width'] >= 44 and box['height'] >= 44, (testid, box)
    tap_control('local-toggle-play')
    page.wait_for_function('audio.paused')
    touch_seek(.4)
    page.wait_for_function('audio.currentTime > audio.duration * .37 && audio.currentTime < audio.duration * .43')
    tap_control('local-toggle-play')
    page.wait_for_function('!audio.paused')
    original = page.evaluate('currentIdx')
    tap_control('local-next')
    page.wait_for_function('(before) => currentIdx !== before', arg=original)
    tap_control('local-previous')
    page.wait_for_function('(before) => currentIdx === before', arg=original)
    checks.append('Folia switch preserves host audio; touch pause, seek and track navigation')

    tap_control('local-open-library')
    inside(folia.get_by_test_id('local-library'))
    folia.get_by_test_id('local-search').fill('Blue')
    expect(folia.get_by_test_id('local-track-row')).to_have_count(1)
    expect(folia.get_by_test_id('local-track-row')).to_contain_text('Blue')
    folia.get_by_test_id('local-search').fill('')
    folia.get_by_role('button', name='新建歌单', exact=True).tap()
    folia.get_by_role('textbox', name='歌单名称', exact=True).fill('Folia 手机歌单')
    folia.get_by_role('button', name='创建', exact=True).tap()
    expect(folia.get_by_test_id('local-collection')).to_contain_text('Folia 手机歌单')
    folia.get_by_test_id('local-collection').select_option('library')
    expect(folia.get_by_test_id('local-track-row')).to_have_count(2)
    page.wait_for_timeout(2800)
    expect(folia.get_by_test_id('local-library')).to_be_visible()
    page.screenshot(path=str(out / 'folia-library.png'))
    folia.get_by_test_id('local-library').get_by_role('button', name='关闭', exact=True).tap()

    tap_control('local-open-settings')
    inside(folia.get_by_test_id('local-visual-settings'))
    folia.get_by_test_id('local-visualizer-mode').select_option('classic')
    folia.get_by_test_id('local-theme').select_option('light')
    page.screenshot(path=str(out / 'folia-settings-light.png'))
    folia.get_by_test_id('local-theme').select_option('dark')
    folia.get_by_test_id('local-visual-settings').get_by_role('button', name='关闭', exact=True).tap()
    # Track switches restore bookmarks. Seek into a known lyric before checking the renderer.
    tap_control('local-toggle-play')
    page.wait_for_function('audio.paused')
    try:
        touch_seek(7 / page.evaluate('audio.duration'))
        page.wait_for_function('audio.currentTime > 5 && audio.currentTime < 10')
        expect(folia.get_by_test_id('local-player')).to_have_attribute('data-active', 'true')
        expect(folia.get_by_test_id('local-visualizer')).to_contain_text(re.compile('Mobile music test|Local lyrics continue|Touch playback works'), timeout=30000)
        page.wait_for_function('''() => {
            const doc = document.getElementById('folia-frame').contentDocument;
            const line = doc.querySelector('[data-overlap-fit-line="0"]');
            const word = line?.querySelector('.inline-block');
            const visible = line && word && Number(doc.defaultView.getComputedStyle(line).opacity) > .9
                && Number(doc.defaultView.getComputedStyle(word).opacity) > .9;
            if (!visible) { window.__mobileLyricVisibleAt = 0; return false; }
            window.__mobileLyricVisibleAt ||= performance.now();
            return performance.now() - window.__mobileLyricVisibleAt > 500;
        }''')
        lyrics_inside_stage()
    finally:
        diagnostic = page.evaluate('''() => {
            const doc = document.getElementById('folia-frame').contentDocument;
            return { state: MineradioFoliaHost.getState(), lyrics: lyricsLines,
                frameHidden: doc.hidden, player: doc.querySelector('[data-testid=local-player]')?.outerHTML.slice(0, 1800),
                renderer: doc.querySelector('[data-testid=local-visualizer]')?.innerHTML.slice(0, 2400),
                errors: [...doc.querySelectorAll('[role=alert]')].map(node => node.textContent) };
        }''')
        (out / 'folia-lyrics-state.json').write_text(json.dumps(diagnostic, ensure_ascii=False, indent=2), encoding='utf-8')
        print('Folia lyric state:', json.dumps(diagnostic, ensure_ascii=False), flush=True)
        page.screenshot(path=str(out / 'folia-lyrics.png'))

    # Exercise real touch lifetime and CSS hit testing while the known lyric is paused.
    wake_controls()
    wait_for_stage_rest()
    animation_traces = []
    try:
        baseline = start_animation_trace('idle-hide', capture_baseline=True)
        visible_stage, visible_geometry = baseline['visibleStage'], baseline['visibleGeometry']
        full_geometry, saved_volume, before_idle = baseline['fullGeometry'], baseline['savedVolume'], baseline['audio']
        wait_for_idle_chrome()
        wait_for_stage_geometry(full_geometry, True)
        hidden_stage = inside(folia.get_by_test_id('local-visualizer'))
        assert hidden_stage['height'] > visible_stage['height'] + 100, (visible_stage, hidden_stage)
        visible_center = visible_geometry['y'] + visible_geometry['height'] / 2
        hidden_center = full_geometry['y'] + full_geometry['height'] / 2
        hidden_trace = stop_animation_trace()
        animation_traces.append(hidden_trace)
        assert_animation_progress(hidden_trace, visible_center, hidden_center, True)
        assert all(surface['opacity'] <= .01 and surface['visibility'] == 'hidden'
            for surface in hidden_trace['samples'][-1]['surfaces']), 'All four idle surfaces must finish fully hidden'
        page.screenshot(path=str(out / 'folia-controls-hidden.png'))
        start_animation_trace('touch-wake')
        wake_controls()
        wait_for_stage_geometry(visible_geometry, False)
        restored_trace = stop_animation_trace()
        animation_traces.append(restored_trace)
        assert_animation_progress(restored_trace, hidden_center, visible_center, False)
        assert page.evaluate('audio.src') == before_idle['source']
        assert page.evaluate('currentIdx') == before_idle['index']
        assert page.evaluate('audio.paused') is before_idle['paused']
        assert abs(page.evaluate('audio.currentTime') - before_idle['position']) < .5, 'The wake tap must not seek through newly revealed controls'
        expect(folia.get_by_test_id('local-controls')).to_be_visible()
        page.screenshot(path=str(out / 'folia-controls-restored.png'))
        try_animation_reversal(visible_geometry, visible_center, hidden_center, baseline['frameBounds'], animation_traces)
        assert page.evaluate('audio.src') == before_idle['source']
        assert page.evaluate('currentIdx') == before_idle['index']
        assert page.evaluate('audio.paused') is before_idle['paused']
        assert abs(page.evaluate('audio.currentTime') - before_idle['position']) < .5, 'The reversal touch must only restore chrome'
    finally:
        unfinished = stop_animation_trace()
        if unfinished:
            animation_traces.append(unfinished)
        (out / 'folia-chrome-animation.json').write_text(json.dumps(animation_traces, ensure_ascii=False, indent=2), encoding='utf-8')
    touch_slider('local-seek', 7 / page.evaluate('audio.duration'), hold=True)
    wait_for_idle_chrome()
    touch_slider('local-volume', saved_volume, hold=True, cancel=True)
    wait_for_idle_chrome()
    tap_control('local-mobile-more-toggle')
    expect(folia.locator('.local-mobile-more')).to_be_visible()
    page.wait_for_timeout(2800)
    expect(folia.locator('.local-mobile-more')).to_be_visible()
    assert not page.evaluate('''() => document.getElementById('folia-frame').contentDocument.body
        .classList.contains('mineradio-mobile-chrome-hidden')'''), 'The open mobile More menu must keep navigation visible'
    tap_control('local-mobile-more-toggle')
    wait_for_idle_chrome()
    tap_control('local-open-settings')
    page.wait_for_timeout(2800)
    expect(folia.get_by_test_id('local-visual-settings')).to_be_visible()
    expect(folia.get_by_test_id('local-mobile-nav')).to_be_visible()
    folia.get_by_test_id('local-visual-settings').get_by_role('button', name='关闭', exact=True).tap()
    wait_for_idle_chrome()
    wake_controls()
    checks.append('Folia mobile chrome hides on idle, wakes without tap-through, holds during touch sliders and stays available for menus and settings')

    tap_control('local-toggle-play')
    page.wait_for_function('!audio.paused')
    tap_control('local-open-playback')
    inside(folia.get_by_test_id('local-playback-settings'))
    folia.get_by_test_id('local-rate-1.25').tap()
    page.wait_for_function('audio.playbackRate === 1.25')
    folia.get_by_test_id('local-rate-1').tap()
    folia.get_by_test_id('local-playback-settings').locator('.local-panel-title').get_by_role('button', name='关闭', exact=True).tap()
    tap_control('local-mobile-more-toggle')
    folia.get_by_test_id('local-open-audio').tap()
    inside(folia.get_by_role('dialog'))
    page.screenshot(path=str(out / 'folia-audio.png'))
    assert page.evaluate('document.getElementById("folia-frame").contentWindow.MineradioFoliaMobileBack()')
    expect(folia.get_by_role('dialog')).to_have_count(0)
    checks.append('Folia library search, playlist creation, visual themes, playback settings and audio tools')

    # Touch seeking is checked above; freeze a known lyric for the geometry sweep.
    tap_control('local-toggle-play')
    page.wait_for_function('audio.paused')
    page.evaluate('audio.currentTime = 7')
    page.wait_for_function('audio.currentTime > 5 && audio.currentTime < 10')
    for width, height in [(320, 568), (360, 800), (430, 932), (768, 1024), (844, 390), (1024, 600)]:
        page.set_viewport_size({'width': width, 'height': height})
        for view, surface in [('lyrics', 'local-visualizer'), ('records', 'local-record-wall'), ('posters', 'local-poster-wall')]:
            tap_control('local-view-' + view)
            expect(folia.get_by_test_id(surface)).to_be_visible(timeout=30000)
            inside(folia.get_by_test_id(surface))
            if view == 'lyrics':
                lyrics_inside_stage()
            wake_controls()
            inside(folia.get_by_test_id('local-mobile-nav'))
            inside(folia.get_by_test_id('local-controls'))
            for testid in ['local-toggle-play', 'local-next', 'local-previous']:
                inside(folia.get_by_test_id(testid))
            if width in [430, 844]:
                page.screenshot(path=str(out / f'folia-{view}-{width}x{height}.png'))
        tap_control('local-open-settings')
        inside(folia.get_by_test_id('local-visual-settings'))
        folia.get_by_test_id('local-visual-settings').get_by_role('button', name='关闭', exact=True).tap()
        tap_control('local-open-library')
        inside(folia.get_by_test_id('local-library'))
        folia.get_by_test_id('local-library').get_by_role('button', name='关闭', exact=True).tap()
    checks.append('Folia lyrics, floating records and poster wall at all six phone/tablet sizes')
    tap_control('local-view-lyrics')
    tap_control('local-toggle-play')
    page.wait_for_function('!audio.paused')
    source = page.evaluate('audio.src')
    tap_control('local-mobile-return')
    expect(page.locator('#mobile-nav')).to_be_visible()
    assert page.evaluate('audio.src') == source
    page.wait_for_function('!audio.paused')
    checks.append('Folia returns to Mineradio without restarting playback')
