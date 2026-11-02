"""Exercise preset files, attached images, playlist bindings and the real backup payload."""
import argparse
import base64
import json
from pathlib import Path
import wave
from playwright.sync_api import sync_playwright, expect
from ui_browser import launch_browser, capture_screenshot

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:3018')
args = parser.parse_args()
OUT = Path(__file__).resolve().parents[1] / 'artifacts/ui-language/folia-preset-portability'
OUT.mkdir(parents=True, exist_ok=True)
audio_file = OUT / 'Preset-A.wav'
with wave.open(str(audio_file), 'wb') as stream:
    stream.setparams((1, 2, 8000, 0, 'NONE', 'not compressed'))
    stream.writeframes(b'\0\0' * 8000 * 60)
image_data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII='
checks, errors = [], []

with sync_playwright() as p:
    browser = launch_browser(p)
    page = browser.new_page(viewport={'width': 1440, 'height': 960}, locale='zh-CN', accept_downloads=True)
    page.set_default_timeout(15000)
    page.add_init_script("localStorage.setItem('mineradio-visual-guide-seen-v2', '1')")
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.route('**/api/lyric-translate', lambda route: route.fulfill(status=200, json={'translations': []}))

    def done(text):
        assert not errors, errors
        checks.append(text)
        print('PASS:', text, flush=True)

    try:
        page.goto(args.url, wait_until='domcontentloaded')
        page.locator('#file-input').set_input_files(str(audio_file))
        page.wait_for_function('localLibrarySongs.length === 1 && audio && !audio.paused')
        page.evaluate("audio.pause(); window.__presetAudio = audio; setUiLanguage('zh-CN'); MineradioFoliaHost.setInterface('folia')")
        frame = page.frame_locator('#folia-frame')
        frame.get_by_test_id('local-open-library').click()
        library = frame.get_by_test_id('local-library')
        library.get_by_role('button', name='新建歌单', exact=True).click()
        library.get_by_label('歌单名称', exact=True).fill('Road')
        library.get_by_role('button', name='创建', exact=True).click()
        expect(library.get_by_test_id('local-collection').locator('option')).to_contain_text(['全部音乐', '特别喜欢', 'Road'])
        playlist_id = page.evaluate("readLocalPlaylists().find(item => item.name === 'Road').id")
        library.get_by_test_id('local-collection').select_option('library')
        library.get_by_role('button', name='文件信息', exact=True).click()
        library.get_by_label('加入歌单', exact=True).select_option(playlist_id)
        page.wait_for_function("id => localPlaylistSongs(id).length === 1", arg=playlist_id)
        frame.get_by_test_id('local-open-settings').click()
        settings = frame.get_by_test_id('local-visual-settings')
        presets = frame.get_by_test_id('local-visual-presets')
        presets.locator('summary').click()
        presets.get_by_label('预设名称', exact=True).fill('Rain')
        frame.get_by_test_id('local-visualizer-mode').select_option('partita')
        frame.get_by_test_id('local-background-mode').select_option('sora')
        presets.get_by_role('button', name='保存为新预设', exact=True).click()
        with page.expect_download() as download:
            presets.get_by_role('button', name='导出预设', exact=True).click()
        plain_file = OUT / 'parameters.mineradio-preset.json'
        download.value.save_as(plain_file)
        plain = json.loads(plain_file.read_text(encoding='utf-8'))
        assert plain['preset']['settings']['mode'] == 'partita' and 'assets' not in plain
        done('real preset export contains parameters without playback state or shared images')

        # Seed an image fixture in the real browser database; transfer uses the actual UI and IDB transaction.
        iframe = page.frame(url=lambda url: '/vendor/folia/' in url)
        iframe.evaluate("""data => new Promise((resolve, reject) => {
          const open = indexedDB.open('mineradio-folia-visual-assets-v1', 1);
          open.onsuccess = () => {
            const db = open.result, tx = db.transaction('assets', 'readwrite');
            tx.objectStore('assets').put({id:'fixture', name:'one.png', mimeType:'image/png',
              blob:new Blob([Uint8Array.from(atob(data), ch => ch.charCodeAt(0))], {type:'image/png'})}, 'monet_background_image');
            tx.oncomplete = () => {db.close(); resolve(true)}; tx.onabort = () => reject(tx.error);
          }; open.onerror = () => reject(open.error);
        })""", image_data)
        presets.get_by_label('导出时携带图片素材', exact=True).check()
        with page.expect_download() as download:
            presets.get_by_role('button', name='导出预设', exact=True).click()
        asset_file = OUT / 'images.mineradio-preset.json'
        download.value.save_as(asset_file)
        bundled = json.loads(asset_file.read_text(encoding='utf-8'))
        assert base64.b64decode(bundled['assets']['monet_background_image'][0]['data']) == base64.b64decode(image_data)
        frame.get_by_test_id('local-background-mode').select_option('latent')
        presets.get_by_test_id('local-import-preset').set_input_files(str(asset_file))
        expect(presets.get_by_role('status')).to_have_text('预设已导入，选择「应用」后生效')
        expect(presets.get_by_label('选择预设', exact=True).locator('option').last).to_have_text('Rain (2)')
        expect(frame.get_by_test_id('local-background-mode')).to_have_value('latent')
        presets.get_by_role('button', name='应用', exact=True).click()
        expect(frame.get_by_test_id('local-background-mode')).to_have_value('sora')
        done('image export/import preserves bytes, keeps duplicate presets and applies only on request')

        invalid = OUT / 'invalid.json'; invalid.write_text('{"format":"other"}', encoding='utf-8')
        presets.get_by_test_id('local-import-preset').set_input_files(str(invalid))
        expect(presets.get_by_role('status')).to_contain_text('预设文件无效')
        expect(presets.get_by_label('选择预设', exact=True).locator('option')).to_have_count(3)
        bindings = frame.get_by_test_id('local-playlist-presets')
        bindings.locator('summary').click()
        bindings.get_by_label('绑定的歌单', exact=True).select_option(playlist_id)
        bindings.get_by_label('歌单使用的预设', exact=True).select_option(label='Rain (2)')
        frame.get_by_test_id('local-background-mode').select_option('latent')
        settings.get_by_role('button', name='关闭', exact=True).click()
        frame.get_by_label('播放进度', exact=True).hover()
        frame.get_by_test_id('local-playlist-switcher').click()
        frame.locator(f'.local-playlist-option[data-playlist-id="{playlist_id}"]').click()
        frame.get_by_test_id('local-open-settings').click()
        expect(frame.get_by_test_id('local-background-mode')).to_have_value('sora')
        assert page.evaluate('audio === window.__presetAudio')
        page.evaluate('audio.pause()')
        done('a real custom playlist switch applies its binding and preserves the host audio object')

        backup = page.evaluate('collectMineradioBackupPayload()')
        backed = json.loads(backup['config']['player']['mineradio-folia-local-visuals-v1'])['state']
        assert len(backed['presets']) == 2 and playlist_id in backed['playlistPresets']
        iframe = page.frame(url=lambda url: '/vendor/folia/' in url)
        iframe.evaluate('location.reload()')
        frame.get_by_test_id('local-open-settings').click()
        bindings = frame.get_by_test_id('local-playlist-presets')
        bindings.locator('summary').click()
        bindings.get_by_label('绑定的歌单', exact=True).select_option(playlist_id)
        expect(bindings.get_by_label('歌单使用的预设', exact=True)).not_to_have_value('')
        presets = frame.get_by_test_id('local-visual-presets'); presets.locator('summary').click()
        presets.get_by_label('选择预设', exact=True).select_option(label='Rain (2)')
        presets.get_by_role('button', name='删除', exact=True).click()
        expect(bindings.get_by_label('歌单使用的预设', exact=True)).to_have_value('')
        capture_screenshot(page, path=str(OUT / 'portability.png'))
        done('the real backup contains Folia presets and bindings; reload preserves them and deletion unbinds')
    finally:
        (OUT / 'acceptance.json').write_text(json.dumps({'checks': checks, 'errors': errors}, ensure_ascii=False, indent=2), encoding='utf-8')
        browser.close()
