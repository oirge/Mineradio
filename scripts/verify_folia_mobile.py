"""Cloud touch checks for the embedded Folia surface and shared host playback."""
import re
from playwright.sync_api import expect


def verify_folia_mobile(page, checks, out):
    page.set_viewport_size({'width': 390, 'height': 844})
    page.evaluate('MineradioMobile.openView("player")')
    page.wait_for_function('audio && !audio.paused')
    source = page.evaluate('audio.src')
    position = page.evaluate('audio.currentTime')
    page.locator('#mobile-folia-switch').tap()
    folia = page.frame_locator('#folia-frame')
    expect(folia.get_by_test_id('local-mobile-nav')).to_be_visible(timeout=30000)
    assert page.evaluate('audio.src') == source
    assert page.evaluate('audio.currentTime') >= position - .5
    page.screenshot(path=str(out / 'folia-lyrics.png'))

    def inside(locator):
        box = locator.bounding_box()
        size = page.viewport_size
        assert box and box['width'] > 0 and box['height'] > 0, box
        assert box['x'] >= -1 and box['y'] >= -1 and box['x'] + box['width'] <= size['width'] + 1 and box['y'] + box['height'] <= size['height'] + 1, (box, size)
        return box

    for testid in ['local-toggle-play', 'local-next', 'local-previous', 'local-mobile-return']:
        box = inside(folia.get_by_test_id(testid))
        assert box['width'] >= 44 and box['height'] >= 44, (testid, box)
    folia.get_by_test_id('local-toggle-play').tap()
    page.wait_for_function('audio.paused')
    seek = folia.get_by_test_id('local-seek').bounding_box()
    page.touchscreen.tap(seek['x'] + seek['width'] * .4, seek['y'] + seek['height'] / 2)
    page.wait_for_function('audio.currentTime > 30 && audio.currentTime < 43')
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
    expect(folia.get_by_test_id('local-visualizer')).to_contain_text(re.compile('Mobile music test|Local lyrics continue|Touch playback works'), timeout=30000)
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
