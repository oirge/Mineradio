import json
from pathlib import Path

from playwright.sync_api import sync_playwright


OUTPUT = Path(__file__).resolve().parents[1] / "artifacts" / "ui-language"
OUTPUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 960})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto("http://127.0.0.1:3268")
    page.wait_for_load_state("networkidle")
    page.wait_for_function("typeof setUiLanguage === 'function' && document.getElementById('fx-panel-tabs')")
    page.evaluate("applyDiyMode(true, {save:false}); toggleFxPanel(true);")
    page.wait_for_timeout(650)
    page.locator('#fx-language-switch [data-ui-language="en"]').click()
    page.wait_for_timeout(300)
    page.screenshot(path=str(OUTPUT / "english-presets.png"))
    report = page.evaluate("""() => {
      const roots = uiLanguageRoots();
      const residual = [];
      for (const root of roots) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          const parent = node.parentElement;
          if (parent.closest('[data-i18n-skip], [data-ui-language="zh-CN"]')) continue;
          if (/\\p{Script=Han}/u.test(node.nodeValue)) {
            residual.push({id:parent.id, tag:parent.tagName, text:node.nodeValue.trim()});
          }
        }
        for (const element of root.querySelectorAll('[title], [aria-label], [placeholder]')) {
          if (element.closest('[data-i18n-skip]')) continue;
          for (const attr of ['title', 'aria-label', 'placeholder']) {
            const value = element.getAttribute(attr);
            if (value && /\\p{Script=Han}/u.test(value)) {
              residual.push({id:element.id, attr, text:value});
            }
          }
        }
      }
      return {
        language:uiLanguage,
        saved:localStorage.getItem(UI_LANGUAGE_STORE_KEY),
        residual,
        tabs:[...document.querySelectorAll('#fx-panel-tabs button')].map(b=>b.textContent)
      };
    }""")
    print(json.dumps({"initial": report, "errors": errors}, ensure_ascii=False, indent=2))
    for tab in ["appearance", "lyrics", "motion", "mini", "advanced"]:
        page.locator(f'#fx-panel-tabs [data-fx-tab="{tab}"]').click()
        page.wait_for_timeout(150)
        page.screenshot(path=str(OUTPUT / f"english-{tab}.png"))
    page.locator("#hotkey-settings-btn").click()
    page.wait_for_timeout(250)
    page.screenshot(path=str(OUTPUT / "english-hotkeys.png"))
    page.evaluate("closeHotkeySettings()")
    page.locator('#fx-language-switch [data-ui-language="zh-CN"]').click()
    page.wait_for_timeout(150)
    page.screenshot(path=str(OUTPUT / "chinese-advanced.png"))
    page.locator('#fx-language-switch [data-ui-language="en"]').click()
    page.reload()
    page.wait_for_load_state("networkidle")
    page.wait_for_function("document.getElementById('fx-panel-tabs')")
    assert page.evaluate("uiLanguage") == "en", "Language preference did not survive reload"
    print(json.dumps({"reloadLanguage": page.evaluate("uiLanguage"), "errors": errors}, ensure_ascii=False))
    browser.close()
