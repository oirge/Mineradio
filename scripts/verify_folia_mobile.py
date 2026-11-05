"""Cloud touch checks for the embedded Folia surface and shared host playback."""
import json
import re
from playwright.sync_api import expect


def verify_folia_mobile(page, checks, out):
    page.set_viewport_size({'width': 390, 'height': 844})
    page.evaluate('MineradioMobile.openView("player")')
    page.locator('#play-btn').tap()
    page.wait_for_function('audio && !audio.paused')
    source = page.evaluate('audio.src')
    position = page.evaluate('audio.currentTime')
    page.locator('#mobile-folia-switch').tap()
    folia = page.frame_locator('#folia-frame')
    expect(folia.get_by_test_id('local-mobile-nav')).to_be_visible(timeout=30000)
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

    def touch_seek(fraction):
        slider = folia.get_by_test_id('local-seek')
        box = slider.bounding_box()
        current = slider.evaluate('(input) => Number(input.value) / Number(input.max)')
        start = box['x'] + 8 + (box['width'] - 16) * current
        target = box['x'] + 8 + (box['width'] - 16) * fraction
        y = box['y'] + box['height'] / 2
        session = page.context.new_cdp_session(page)
        try:
            session.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': start, 'y': y}]})
            for step in range(1, 7):
                session.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': start + (target - start) * step / 6, 'y': y}]})
            session.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        finally:
            session.detach()

    for testid in ['local-toggle-play', 'local-next', 'local-previous', 'local-mobile-return']:
        box = inside(folia.get_by_test_id(testid))
        assert box['width'] >= 44 and box['height'] >= 44, (testid, box)
    folia.get_by_test_id('local-toggle-play').tap()
    page.wait_for_function('audio.paused')
    touch_seek(.4)
    page.wait_for_function('audio.currentTime > audio.duration * .37 && audio.currentTime < audio.duration * .43')
    folia.get_by_test_id('local-toggle-play').tap()
    page.wait_for_function('!audio.paused')
    original = page.evaluate('currentIdx')
    folia.get_by_test_id('local-next').tap()
    page.wait_for_function('(before) => currentIdx !== before', arg=original)
    folia.get_by_test_id('local-previous').tap()
    page.wait_for_function('(before) => currentIdx === before', arg=original)
    checks.append('Folia switch preserves host audio; touch pause, seek and track navigation')

    folia.get_by_test_id('local-open-library').tap()
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

    folia.get_by_test_id('local-open-settings').tap()
    inside(folia.get_by_test_id('local-visual-settings'))
    folia.get_by_test_id('local-visualizer-mode').select_option('classic')
    folia.get_by_test_id('local-theme').select_option('light')
    page.screenshot(path=str(out / 'folia-settings-light.png'))
    folia.get_by_test_id('local-theme').select_option('dark')
    folia.get_by_test_id('local-visual-settings').get_by_role('button', name='关闭', exact=True).tap()
    # Track switches restore bookmarks. Seek into a known lyric before checking the renderer.
    folia.get_by_test_id('local-toggle-play').tap()
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
    folia.get_by_test_id('local-toggle-play').tap()
    page.wait_for_function('!audio.paused')
    folia.get_by_test_id('local-open-playback').tap()
    inside(folia.get_by_test_id('local-playback-settings'))
    folia.get_by_test_id('local-rate-1.25').tap()
    page.wait_for_function('audio.playbackRate === 1.25')
    folia.get_by_test_id('local-rate-1').tap()
    folia.get_by_test_id('local-playback-settings').locator('.local-panel-title').get_by_role('button', name='关闭', exact=True).tap()
    folia.get_by_test_id('local-mobile-more-toggle').tap()
    folia.get_by_test_id('local-open-audio').tap()
    inside(folia.get_by_role('dialog'))
    page.screenshot(path=str(out / 'folia-audio.png'))
    assert page.evaluate('document.getElementById("folia-frame").contentWindow.MineradioFoliaMobileBack()')
    expect(folia.get_by_role('dialog')).to_have_count(0)
    checks.append('Folia library search, playlist creation, visual themes, playback settings and audio tools')

    # Pause the real source while testing layouts so the fixture cannot end mid-assertion.
    folia.get_by_test_id('local-toggle-play').tap()
    page.wait_for_function('audio.paused')
    for width, height in [(320, 568), (360, 800), (430, 932), (768, 1024), (844, 390), (1024, 600)]:
        page.set_viewport_size({'width': width, 'height': height})
        for view, surface in [('lyrics', 'local-visualizer'), ('records', 'local-record-wall'), ('posters', 'local-poster-wall')]:
            folia.get_by_test_id('local-view-' + view).tap()
            expect(folia.get_by_test_id(surface)).to_be_visible(timeout=30000)
            inside(folia.get_by_test_id(surface))
            if view == 'lyrics':
                lyrics_inside_stage()
            inside(folia.get_by_test_id('local-mobile-nav'))
            inside(folia.get_by_test_id('local-controls'))
            for testid in ['local-toggle-play', 'local-next', 'local-previous']:
                inside(folia.get_by_test_id(testid))
            if width in [430, 844]:
                page.screenshot(path=str(out / f'folia-{view}-{width}x{height}.png'))
        folia.get_by_test_id('local-open-settings').tap()
        inside(folia.get_by_test_id('local-visual-settings'))
        folia.get_by_test_id('local-visual-settings').get_by_role('button', name='关闭', exact=True).tap()
        folia.get_by_test_id('local-open-library').tap()
        inside(folia.get_by_test_id('local-library'))
        folia.get_by_test_id('local-library').get_by_role('button', name='关闭', exact=True).tap()
    checks.append('Folia lyrics, floating records and poster wall at all six phone/tablet sizes')
    folia.get_by_test_id('local-view-lyrics').tap()
    folia.get_by_test_id('local-toggle-play').tap()
    page.wait_for_function('!audio.paused')
    source = page.evaluate('audio.src')
    folia.get_by_test_id('local-mobile-return').tap()
    expect(page.locator('#mobile-nav')).to_be_visible()
    assert page.evaluate('audio.src') == source
    page.wait_for_function('!audio.paused')
    checks.append('Folia returns to Mineradio without restarting playback')
