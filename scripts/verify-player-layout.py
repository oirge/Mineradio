"""Check both player surfaces at desktop widths and fractional display scaling in CI."""
import argparse
import json
import math
from pathlib import Path
import struct
import wave
from playwright.sync_api import sync_playwright
from ui_browser import launch_browser, capture_screenshot

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/ui-language/player-layout'
OUT.mkdir(parents=True, exist_ok=True)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', required=True)
args = parser.parse_args()
audio_file = OUT / 'Layout.wav'
with wave.open(str(audio_file), 'wb') as stream:
    stream.setparams((1, 2, 8000, 0, 'NONE', 'not compressed'))
    second = b''.join(struct.pack('<h', int(300 * math.sin(2 * math.pi * 220 * i / 8000))) for i in range(8000))
    stream.writeframes(second * 120)
lyric_file = audio_file.with_suffix('.ttml')
lyric_file.write_text('''<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><body><div>
<p begin="0s" end="120s">月光轻轻把梦带走<span ttm:role="x-translation">Moonlight gently takes the dream away</span></p>
</div></body></tt>''', encoding='utf-8')
report, errors, violations = [], [], []

GEOMETRY = """selector => {
  const box = element => { const r = element.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}; };
  const bar = document.querySelector(selector);
  const visible = element => {
    if (!element.getClientRects().length) return false;
    for (let node = element; node && node !== bar.parentElement; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < .01) return false;
    }
    return true;
  };
  const subtitle = document.querySelector('[data-subtitle-track="translation"]');
  return {viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},bar:box(bar),
    subtitle:subtitle ? box(subtitle) : null,
    controls:[...bar.querySelectorAll('button,input,[role="button"]')].filter(visible).map(e=>({name:e.id || e.getAttribute('data-testid') || e.getAttribute('aria-label'),...box(e)}))};
}"""

with sync_playwright() as playwright:
    browser = launch_browser(playwright)
    context = browser.new_context(viewport={'width': 1110, 'height': 780}, device_scale_factor=1.25, locale='zh-CN')
    page = context.new_page()
    page.set_default_timeout(45000)
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.add_init_script("""localStorage.setItem('mineradio-visual-guide-seen-v2','1');
      localStorage.setItem('mineradio-folia-local-visuals-v1', JSON.stringify({state:{mode:'hanabi',view:'lyrics',subtitleHidden:false,translation:true,subtitleContentMode:'translation',subtitleLayout:'translation'},version:0}));""")
    try:
        page.goto(args.url, wait_until='domcontentloaded')
        page.locator('#file-input').set_input_files([str(audio_file), str(lyric_file)])
        page.wait_for_function('localLibrarySongs.length === 1 && audio && audio.src && lyricsLines.length > 0')
        page.evaluate("audio.pause(); audio.currentTime=3; controlsAutoHide=false; document.documentElement.classList.add('desktop-shell-root'); document.body.classList.add('desktop-shell'); applyDiyMode(true,{toast:false})")
        for width, height in [(1110,780),(920,720),(760,650),(1440,900)]:
            page.set_viewport_size({'width':width,'height':height})
            page.evaluate("MineradioFoliaHost.setInterface('mineradio'); revealBottomControls(60000)")
            page.mouse.move(width / 2, height - 55)
            page.wait_for_timeout(650)
            capture_screenshot(page, path=str(OUT / f'mineradio-{width}.png'))
            main = page.evaluate(GEOMETRY, '#bottom-bar')
            report.append({'surface':'mineradio','width':width,**main})
            bar = main['bar']
            if bar['x'] < -1 or bar['right'] > width + 1 or abs(bar['x'] + bar['width']/2 - width/2) > 1:
                violations.append(f'Mineradio {width}: bar is outside or off-center: {bar}')
            for control in main['controls']:
                if control['x'] < bar['x'] - 1 or control['right'] > bar['right'] + 1:
                    violations.append(f'Mineradio {width}: {control["name"]} overflows the bar')
            page.evaluate("MineradioFoliaHost.setInterface('folia')")
            child = page.frame_locator('#folia-frame')
            child.get_by_test_id('local-controls').wait_for(state='visible')
            child.locator('[data-subtitle-track="translation"]').wait_for(state='visible')
            child.get_by_test_id('local-controls').hover()
            child.get_by_test_id('local-toggle-play').hover()
            page.wait_for_timeout(800)
            capture_screenshot(page, path=str(OUT / f'folia-{width}.png'))
            child_frame = page.locator('#folia-frame').element_handle().content_frame()
            folia = child_frame.evaluate(GEOMETRY, '.local-controls')
            report.append({'surface':'folia','width':width,**folia})
            if folia['bar']['x'] < -1 or folia['bar']['right'] > width + 1:
                violations.append(f'Folia {width}: bar overflows viewport')
            if folia['subtitle']['bottom'] > folia['bar']['y'] - 8:
                violations.append(f'Folia {width}: translation overlaps the controls: {folia["subtitle"]}')
            if width == 1110:
                page.mouse.move(width / 2, height / 2)
                page.wait_for_timeout(3300)
                collapsed = child_frame.evaluate(GEOMETRY, '.local-controls')
                report.append({'surface':'folia-idle','width':width,**collapsed})
                if collapsed['bar']['height'] >= folia['bar']['height'] - 20:
                    violations.append('Folia idle: transport did not collapse')
                if collapsed['subtitle']['bottom'] > collapsed['bar']['y'] - 8:
                    violations.append('Folia idle: subtitle overlaps the remaining progress row')
                capture_screenshot(page, path=str(OUT / 'folia-idle.png'))
    finally:
        (OUT / 'report.json').write_text(json.dumps({'samples':report,'pageErrors':errors,'violations':violations}, ensure_ascii=False, indent=2),encoding='utf-8')
        browser.close()
assert not errors, errors
assert not violations, violations
print(f'PASS: both surfaces remain inside the viewport and translations clear the bar ({len(report)} samples)', flush=True)
