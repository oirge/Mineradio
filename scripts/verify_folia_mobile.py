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

    def wake_controls():
        # A person first touches the stage when idle chrome has disappeared.
        # Do not tap through visible controls while adapting older interaction checks.
        for attempt in range(3):
            hidden = page.evaluate('''() => document.getElementById('folia-frame').contentDocument.body
                .classList.contains('mineradio-mobile-chrome-hidden')''')
            if hidden:
                box = folia.get_by_test_id('local-player').bounding_box()
                assert box and box['width'] > 0 and box['height'] > 0, box
                page.touchscreen.tap(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
            try:
                page.wait_for_function('''() => {
                    const doc = document.getElementById('folia-frame').contentDocument;
                    const nav = doc.querySelector('.local-mobile-nav');
                    return !doc.body.classList.contains('mineradio-mobile-chrome-hidden') && nav
                        && doc.defaultView.getComputedStyle(nav).visibility !== 'hidden'
                        && Number(doc.defaultView.getComputedStyle(nav).opacity) > .9;
                }''', timeout=2000)
                expect(folia.get_by_test_id('local-mobile-nav')).to_be_visible()
                return
            except PlaywrightTimeoutError:
                # Idle may expire between the first read and the fade check.
                if attempt == 2 or not page.evaluate('''() => document.getElementById('folia-frame').contentDocument.body
                    .classList.contains('mineradio-mobile-chrome-hidden')'''):
                    raise

    def tap_control(testid):
        wake_controls()
        folia.get_by_test_id(testid).tap()

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
    visible_stage = inside(folia.get_by_test_id('local-visualizer'))
    saved_volume = folia.get_by_test_id('local-volume').evaluate('(input) => Number(input.value)')
    before_idle = page.evaluate('({source: audio.src, index: currentIdx, paused: audio.paused, position: audio.currentTime})')
    wait_for_idle_chrome()
    hidden_stage = inside(folia.get_by_test_id('local-visualizer'))
    assert hidden_stage['height'] > visible_stage['height'] + 100, (visible_stage, hidden_stage)
    page.screenshot(path=str(out / 'folia-controls-hidden.png'))
    wake_controls()
    assert page.evaluate('audio.src') == before_idle['source']
    assert page.evaluate('currentIdx') == before_idle['index']
    assert page.evaluate('audio.paused') is before_idle['paused']
    assert abs(page.evaluate('audio.currentTime') - before_idle['position']) < .5, 'The wake tap must not seek through newly revealed controls'
    expect(folia.get_by_test_id('local-controls')).to_be_visible()
    page.screenshot(path=str(out / 'folia-controls-restored.png'))
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
