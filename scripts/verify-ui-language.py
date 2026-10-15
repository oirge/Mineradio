"""Run UI-language regression checks against a local Mineradio server."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--url", default="http://127.0.0.1:3268")
parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "artifacts" / "ui-language")
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
report = {"checks": [], "audits": {}, "errors": []}

def audit(page, label):
    residual = page.evaluate(r"""() => {
      const residual = [];
      for (const root of uiLanguageRoots()) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode, parent = node.parentElement;
          if (parent.closest('[data-i18n-skip], [data-ui-language="zh-CN"]')) continue;
          if (/\p{Script=Han}/u.test(node.nodeValue))
            residual.push({id:parent.id, text:node.nodeValue.trim()});
        }
        for (const el of root.querySelectorAll('[title], [aria-label], [placeholder]')) {
          if (el.closest('[data-i18n-skip]')) continue;
          for (const attr of ['title', 'aria-label', 'placeholder']) {
            const text = el.getAttribute(attr);
            if (text && /\p{Script=Han}/u.test(text)) residual.push({id:el.id, attr, text});
          }
        }
      }
      return residual;
    }""")
    report["audits"][label] = residual
    assert not residual, f"Untranslated UI in {label}: {residual}"

def switch(page, language, click=False):
    if click:
        page.locator(f'#fx-language-switch [data-ui-language="{language}"]').click()
    else:
        page.evaluate("language => setUiLanguage(language)", language)
    expect(page.locator("html")).to_have_attribute("lang", "en-US" if language == "en" else "zh-CN")
    page.wait_for_timeout(80)  # Flush translation observers and pending focus callbacks.

def screenshot(page, name):
    page.screenshot(path=str(args.output / f"{name}.png"))

def check_status_layout(page):
    overlaps = page.evaluate("""() => {
      const problems = [];
      for (const row of document.querySelectorAll('#fx-panel .lyric-color-row:has(>strong)')) {
        if (!row.getClientRects().length) continue;
        const label = row.firstElementChild;
        if (label.tagName !== 'SPAN') continue;
        const range = document.createRange();
        range.selectNodeContents(label);
        const text = range.getBoundingClientRect(), value = row.querySelector('strong').getBoundingClientRect();
        if (text.right > value.left + 1 && text.left < value.right - 1 &&
            text.bottom > value.top + 1 && text.top < value.bottom - 1) problems.push(label.textContent);
      }
      return problems;
    }""")
    assert not overlaps, f"Settings labels overlap values: {overlaps}"

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 960})
    page.on("pageerror", lambda error: report["errors"].append(str(error)))
    try:
        page.goto(args.url)
        page.wait_for_load_state("networkidle")
        page.wait_for_function("typeof setUiLanguage === 'function' && document.getElementById('fx-panel-tabs')")
        page.evaluate("applyDiyMode(true, {save:false}); toggleFxPanel(true)")
        switch(page, "en", click=True)
        expect(page.locator('#fx-panel-tabs [data-fx-tab="lyrics"]')).to_have_text("Lyrics")
        for tab in ["presets", "appearance", "lyrics", "motion", "mini", "advanced"]:
            page.locator(f'#fx-panel-tabs [data-fx-tab="{tab}"]').click()
            page.wait_for_timeout(150)
            audit(page, tab)
            assert page.locator("#fx-panel").evaluate("el => el.scrollWidth <= el.clientWidth + 1"), tab
            check_status_layout(page)
            screenshot(page, f"english-{tab}")
        report["checks"].append("Six English tabs: labels, attributes, and panel width")
        page.locator("#hotkey-settings-btn").click()
        expect(page.locator("#hotkey-modal")).to_be_visible()
        audit(page, "hotkeys")
        screenshot(page, "english-hotkeys")
        page.evaluate("closeHotkeySettings()")
        expect(page.locator("#hotkey-modal")).to_be_hidden()

        page.evaluate("""() => {
          fx.lyricGlowLinked = false;
          updateLyricGlowControls();
          updateCustomLyricControls();
          updateCustomBackgroundControls();
        }""")
        expect(page.locator("#lyric-glow-link-btn")).to_have_text("Independent")
        expect(page.locator("#lyric-glow-link-btn")).to_have_attribute("title", "Click to match glow to the highlight color")
        expect(page.locator("#bg-color-value")).to_have_text("Cover Gradient")
        expect(page.locator("#lyric-source-custom")).to_have_attribute("title", "Add custom lyrics")
        audit(page, "dynamic-controls")
        switch(page, "zh-CN", click=True)
        expect(page.locator("#lyric-glow-link-btn")).to_have_text("独立")
        expect(page.locator("#bg-color-value")).to_have_text("封面渐变")
        screenshot(page, "chinese-advanced")
        switch(page, "en", click=True)
        report["checks"].append("Dynamic background, glow, and lyric-source states round-trip")

        page.evaluate("""() => {
          currentLocalSong = {localKey:'i18n-test', name:'高级', artist:'歌词', album:'默认',
            localLyricCandidates:[{name:'主题', relativePath:'Lyrics/主题'}, {relativePath:'Lyrics/unnamed'}]};
          currentIdx = -1;
          openCustomLyricModal();
        }""")
        expect(page.locator("#custom-lyric-modal")).to_be_visible()
        lyrics = page.locator("#custom-lyric-input")
        lyrics.fill("[00:01.00] 歌词\n[00:02.00] Lyrics")
        for language, fallback in [("zh-CN", "歌词文件"), ("en", "Lyric File")]:
            switch(page, language)
            expect(page.locator("#custom-lyric-title")).to_have_text("高级")
            expect(page.locator("#custom-lyric-track-meta")).to_have_text("歌词 · 默认")
            expect(lyrics).to_have_value("[00:01.00] 歌词\n[00:02.00] Lyrics")
            expect(page.locator("#local-lyric-pick-row button").nth(0)).to_have_text("主题")
            expect(page.locator("#local-lyric-pick-row button").nth(1)).to_have_text(fallback)
        page.evaluate("setCustomLyricStatusParts('正在读取 ', '默认', '', '')")
        expect(page.locator("#custom-lyric-status")).to_have_text("Loading 默认")
        switch(page, "zh-CN")
        expect(page.locator("#custom-lyric-status")).to_have_text("正在读取 默认")
        switch(page, "en")
        page.evaluate("setCustomLyricStatus('已保存 2 行，并切换为自定义歌词', 'good')")
        expect(page.locator("#custom-lyric-status")).to_have_text("Saved 2 lines and switched to custom lyrics")
        switch(page, "zh-CN")
        expect(page.locator("#custom-lyric-status")).to_have_text("已保存 2 行，并切换为自定义歌词")
        switch(page, "en")
        audit(page, "custom-lyrics")
        screenshot(page, "english-custom-lyrics")
        lyrics.fill("")
        page.locator('#custom-lyric-modal [onclick="saveCustomLyricForCurrent()"]').click()
        expect(page.locator("#custom-lyric-status")).to_have_text("Enter lyric text")
        page.evaluate("currentLocalSong.name = ''; openCustomLyricModal()")
        expect(page.locator("#custom-lyric-title")).to_have_text("Current Song")
        switch(page, "zh-CN")
        expect(page.locator("#custom-lyric-title")).to_have_text("当前歌曲")
        page.evaluate("closeCustomLyricModal()")
        expect(page.locator("#custom-lyric-modal")).to_be_hidden()
        switch(page, "en")
        report["checks"].append("Lyric draft, metadata, filenames, unnamed fallbacks, status, and validation")

        page.evaluate("toggleFxPanel(true)")
        page.locator('#fx-panel-tabs [data-fx-tab="presets"]').click()
        page.evaluate("""() => {
          userFxArchives = [{name:'默认', snapshot:null, savedAt:0}];
          userFxArchivesHydrated = true;
          userFxArchiveEditing = -1;
          renderUserFxArchives({force:true});
          renameUserFxArchive(0);
        }""")
        draft = page.locator("#user-archive-input-0")
        draft.fill("My Draft 歌词")
        draft.evaluate("el => el.setSelectionRange(3, 8, 'backward')")
        switch(page, "zh-CN")
        expect(draft).to_be_focused()
        expect(draft).to_have_value("My Draft 歌词")
        assert draft.evaluate("el => [el.selectionStart, el.selectionEnd, el.selectionDirection]") == [3, 8, "backward"]
        switch(page, "en", click=True)
        expect(draft).to_have_value("My Draft 歌词")
        assert draft.evaluate("el => [el.selectionStart, el.selectionEnd]") == [3, 8]
        assert page.evaluate("userFxArchives[0].name") == "默认", "Language switch committed a draft"
        page.evaluate("cancelUserFxArchiveRename()")
        expect(page.locator(".user-archive-name")).to_have_text("默认")
        expect(page.locator(".user-archive-name")).to_have_attribute("title", "默认")
        report["checks"].append("Archive rename preserves draft, caret, focused input, and original name")

        page.evaluate("""() => {
          window.originalPluginList = MineradioPlugins.list;
          MineradioPlugins.list = () => [{id:'Lyrics', name:'主题', author:'默认', version:'1.0', enabled:true}];
          openPluginManager();
        }""")
        for language, disable in [("en", "Disable"), ("zh-CN", "禁用"), ("en", "Disable")]:
            switch(page, language)
            expect(page.locator(".plugin-item-title")).to_have_text("主题v1.0")
            expect(page.locator(".plugin-item-meta")).to_have_text("Lyrics · 默认")
            expect(page.locator(".plugin-item-actions button").first).to_have_text(disable)
        audit(page, "plugin-metadata")
        screenshot(page, "english-plugins")
        page.evaluate("MineradioPlugins.list = window.originalPluginList; closePluginManager()")
        expect(page.locator("#plugin-modal")).to_be_hidden()
        report["checks"].append("Plugin metadata stays original while actions change language")

        page.evaluate("toggleFxPanel(true)")
        page.set_viewport_size({"width": 1280, "height": 720})
        for tab in ["appearance", "lyrics", "motion", "mini", "advanced"]:
            page.locator(f'#fx-panel-tabs [data-fx-tab="{tab}"]').click()
            assert page.locator("#fx-panel").evaluate("el => el.scrollWidth <= el.clientWidth + 1"), tab
            check_status_layout(page)
        screenshot(page, "english-advanced-720p")
        page.reload()
        page.wait_for_load_state("networkidle")
        page.wait_for_function("document.getElementById('fx-panel-tabs')")
        assert page.evaluate("uiLanguage") == "en"
        assert page.evaluate("localStorage.getItem(UI_LANGUAGE_STORE_KEY)") == "en"
        audit(page, "reload")
        assert not report["errors"], report["errors"]
        report["checks"].append("720p panel layout, reload persistence, and zero browser exceptions")
        report["passed"] = True
    except Exception as error:
        report["passed"] = False
        report["failure"] = str(error)
        screenshot(page, "failure")
        raise
    finally:
        (args.output / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps(report, ensure_ascii=True, indent=2))
        browser.close()
