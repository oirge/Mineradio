'use strict';

// Run with Node; the existing Electron development dependency supplies Chromium.
// node scripts/check-update-modal-layout.js [--electron=PATH] [--baseline] [--device-scale=1]
// --baseline reads HEAD's HTML/CSS without changing the working tree.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { execFileSync, spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const option = name => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const baseline = args.includes('--baseline');
const sizes = [[980, 550], [960, 540], [640, 360], [480, 270], [360, 300], [1280, 720], [1920, 1080]];

/** Launch isolated Electron workers without showing native windows or consoles. */
async function launchWorkers() {
  let executable = option('electron');
  if (!executable) {
    try { executable = require('electron'); } catch {
      throw new Error('Electron is not installed here. Pass --electron=<existing electron.exe> or install the project development dependencies.');
    }
  }
  const requestedScale = option('device-scale');
  const scales = requestedScale ? [Number(requestedScale)] : [1, 1.25, 1.5, 2];
  if (scales.some(scale => !Number.isFinite(scale) || scale <= 0)) throw new Error('Invalid --device-scale value.');
  let failed = false;
  for (const scale of scales) {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-update-layout-'));
    try {
      const env = { ...process.env };
      delete env.ELECTRON_RUN_AS_NODE;
      const workerArgs = [__filename, '--worker', `--device-scale=${scale}`, `--profile=${profile}`];
      if (baseline) workerArgs.push('--baseline');
      const code = await new Promise((resolve, reject) => {
        const child = spawn(executable, workerArgs, { env, windowsHide: true, stdio: 'inherit' });
        child.once('error', reject);
        child.once('exit', (status, signal) => resolve(signal ? 1 : (status ?? 1)));
      });
      failed ||= code !== 0;
    } finally {
      // This directory was created above and is never the user's application profile.
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 150 });
    }
  }
  process.exitCode = failed ? 1 : 0;
}

/** Extract a real top-level div and its nested markup without starting app.js. */
function extractDiv(html, id) {
  const start = html.indexOf(`<div id="${id}"`);
  if (start < 0) throw new Error(`Missing #${id} in public/index.html`);
  const tokens = /<\/?div\b[^>]*>/g;
  tokens.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = tokens.exec(html))) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (!depth) return html.slice(start, tokens.lastIndex).replace(/\s+onclick="[^"]*"/g, '');
  }
  throw new Error(`Unclosed #${id}`);
}

/** Read original bytes for a reproducible failing baseline or the edited source. */
function readSource(file) {
  return baseline
    ? execFileSync('git', ['-C', root, 'show', `HEAD:${file}`], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
    : fs.readFileSync(path.join(root, file), 'utf8');
}

/** Serve only the fixture, real styles, and bundled fonts on an ephemeral loopback port. */
function startFixtureServer() {
  const source = readSource('public/index.html');
  const markup = `<!doctype html><html lang="zh-CN" class="desktop-shell-root"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="stylesheet" href="/vendor/fonts.css"><link rel="stylesheet" href="/app.css">
    </head><body class="desktop-shell"><div id="desktop-window-shell">
    ${extractDiv(source, 'desktop-titlebar')}${extractDiv(source, 'update-modal')}
    </div></body></html>`;
  const styles = readSource('public/app.css');
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    let content;
    let type;
    if (pathname === '/') { content = markup; type = 'text/html; charset=utf-8'; }
    else if (pathname === '/app.css') { content = styles; type = 'text/css; charset=utf-8'; }
    else if (pathname === '/vendor/fonts.css') {
      content = fs.readFileSync(path.join(root, 'public/vendor/fonts.css')); type = 'text/css; charset=utf-8';
    } else if (/^\/vendor\/fonts\/[A-Za-z0-9._-]+\.woff2$/.test(pathname)) {
      const file = path.join(root, 'public', pathname.slice(1));
      if (fs.existsSync(file)) { content = fs.readFileSync(file); type = 'font/woff2'; }
    }
    response.writeHead(content === undefined ? 404 : 200, {
      'Content-Type': type || 'text/plain',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'self'; font-src 'self'; script-src 'none'",
    });
    response.end(content);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

/** Run inside the renderer against actual Chromium layout and hit testing. */
async function inspectLayout(testCase) {
  const failures = [];
  const scrollOffsetTolerance = 2;
  const expect = (condition, message) => { if (!condition) failures.push(message); };
  const get = selector => document.querySelector(selector);
  const rect = element => {
    const box = element.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom };
  };
  document.body.className = testCase.fullscreen ? 'desktop-shell desktop-fullscreen' : 'desktop-shell';
  get('#update-modal').classList.add('show');
  const panel = get('.modal.update-modal');
  panel.classList.toggle('error', testCase.content === 'long-error');
  get('#update-modal-version').textContent = testCase.content === 'long-error'
    ? 'v2026.10.05-preview.1234567890-super-long-release-version' : 'v2.2.5';
  get('#update-hero-main').textContent = '更新已就绪，修复窗口缩小时版本与操作按钮被裁切的问题。';
  get('#update-footnote').textContent = testCase.content === 'long-error'
    ? ('下载失败，请检查网络连接后重试。详细错误：ERR_CONNECTION_RESET_1234567890 '.repeat(12))
    : '下载完成后将自动安装更新。';
  get('#update-list').replaceChildren();
  const count = testCase.content === 'short' ? 4 : 32;
  for (let i = 0; i < count; i++) {
    const item = document.createElement('div');
    item.className = 'update-item';
    const dot = document.createElement('span');
    dot.className = 'update-item-dot';
    dot.dataset.index = String(i + 1).padStart(2, '0');
    const text = document.createElement('div');
    text.className = 'update-item-text';
    text.textContent = '翻译过的本地歌曲重启后不再重复翻译；修复播放切换与窗口适配，让长更新说明始终可以滚动阅读。'
      + (testCase.content === 'long-notes' ? ' https://example.invalid/' + 'unbroken-release-note-'.repeat(8) : '');
    item.append(dot, text);
    get('#update-list').append(item);
  }
  get('#update-route-hint').textContent = testCase.content === 'long-error'
    ? '自动测速失败，已回退到直连。错误详情：' + 'route-probe-timeout-'.repeat(8)
    : '自动测速，挑当前最快的线路下载。';
  await document.fonts.ready;
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const titlebar = get('#desktop-titlebar');
  const titlebarBottom = getComputedStyle(titlebar).display === 'none' ? 0 : rect(titlebar).bottom;
  const bounded = (element, label, hitTest = false) => {
    if (!element) { expect(false, `${label} missing`); return; }
    const bounds = rect(element);
    expect(bounds.width > 0 && bounds.height > 0, `${label} has no visible area`);
    expect(bounds.x >= -1 && bounds.right <= innerWidth + 1, `${label} outside viewport horizontally`);
    expect(bounds.y >= titlebarBottom - 1 && bounds.bottom <= innerHeight + 1,
      `${label} clipped vertically or covered by titlebar (${bounds.y.toFixed(1)}..${bounds.bottom.toFixed(1)}; available ${titlebarBottom}..${innerHeight})`);
    for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      const box = rect(parent);
      if (/(hidden|clip|auto|scroll)/.test(style.overflowY)) {
        expect(bounds.y >= box.y - 1 && bounds.bottom <= box.bottom + 1, `${label} clipped by ${parent.id || parent.className}`);
      }
      if (/(hidden|clip|auto|scroll)/.test(style.overflowX)) {
        expect(bounds.x >= box.x - 1 && bounds.right <= box.right + 1, `${label} clipped horizontally by ${parent.id || parent.className}`);
      }
    }
    if (hitTest && bounds.width && bounds.height) {
      const target = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      expect(target === element || element.contains(target), `${label} cannot be hit at its visible center`);
    }
  };
  const version = get('#update-modal-version');
  const actions = get('.update-actions');
  bounded(panel, 'dialog');
  bounded(version, 'version', true);
  for (const [selector, label] of [
    ['#update-check-btn', 'check button'], ['#update-primary-btn', 'update button'], ['#update-secondary-btn', 'cancel button'],
  ]) bounded(get(selector), label, true);
  expect(panel.scrollWidth <= panel.clientWidth + 1, 'dialog has horizontal overflow');
  const versionStyle = getComputedStyle(version);
  expect(versionStyle.whiteSpace === 'nowrap', 'version can wrap into the dialog header');
  expect(versionStyle.textOverflow === 'ellipsis', 'long version is not visibly truncated');
  expect(versionStyle.overflowX === 'hidden' || versionStyle.overflowX === 'clip', 'long version can escape its label');

  const body = get('.update-panel-body');
  const actionBefore = rect(actions);
  if (!body) expect(false, 'missing independently scrollable .update-panel-body');
  else {
    expect(body.tabIndex === 0 && body.getAttribute('aria-label') === '更新说明与下载线路', 'release notes region is not keyboard accessible/labeled');
    expect(/auto|scroll/.test(getComputedStyle(body).overflowY), 'release notes region does not allow scrolling');
    expect(body.clientHeight > 0, 'release notes region collapsed');
    expect(body.scrollWidth <= body.clientWidth + 1, 'release notes have horizontal overflow');
    body.scrollTo({ top: body.scrollHeight, behavior: 'instant' });
    const notesMaxScroll = body.scrollHeight - body.clientHeight;
    expect(Math.abs(body.scrollTop - notesMaxScroll) <= scrollOffsetTolerance,
      `release notes cannot reach their end (${body.scrollTop.toFixed(2)} / ${notesMaxScroll.toFixed(2)})`);
    if (testCase.content !== 'short') expect(body.scrollTop > 0, 'long release notes do not scroll');
    const lastRoute = get('#update-route-seg button:last-child');
    const routeBox = rect(lastRoute);
    const bodyBox = rect(body);
    expect(routeBox.bottom <= bodyBox.bottom + 1 && routeBox.bottom > bodyBox.y, 'last download route is unreachable at scroll end');
    const actionAfter = rect(actions);
    expect(Math.abs(actionAfter.y - actionBefore.y) < 1, 'action bar moves with release notes');
    expect(rect(version).y >= titlebarBottom - 1, 'version moves out of view while notes scroll');
    body.scrollTop = 0;
  }
  const footnote = get('#update-footnote');
  bounded(footnote, 'status/error text');
  if (testCase.content === 'long-error') {
    expect(footnote.scrollHeight > footnote.clientHeight, 'long error is not bounded to a scrollable area');
    expect(/auto|scroll/.test(getComputedStyle(footnote).overflowY), 'long error cannot be scrolled');
    footnote.scrollTo({ top: footnote.scrollHeight, behavior: 'instant' });
    expect(Math.abs(footnote.scrollTop - (footnote.scrollHeight - footnote.clientHeight)) <= scrollOffsetTolerance, 'long error cannot reach its end');
    expect(Math.abs(rect(actions).y - actionBefore.y) < 1, 'action bar moves while error is scrolled');
    footnote.scrollTop = 0;
  }
  return {
    case: testCase, viewport: [innerWidth, innerHeight], devicePixelRatio,
    dialog: rect(panel), version: rect(version), actions: rect(actions),
    body: body ? { height: body.clientHeight, scrollHeight: body.scrollHeight } : null,
    failures: [...new Set(failures)],
  };
}

/** Run layout assertions with temporary storage; never load the music application. */
async function runWorker() {
  const { app, BrowserWindow, session } = require('electron');
  const profile = option('profile');
  if (!profile) throw new Error('Run this script with Node so its temporary profile can be cleaned after Electron exits.');
  app.setPath('userData', profile);
  app.setPath('sessionData', path.join(profile, 'session'));
  app.commandLine.appendSwitch('force-device-scale-factor', option('device-scale') || '1');
  app.commandLine.appendSwitch('disable-background-networking');
  app.commandLine.appendSwitch('disable-component-update');
  await app.whenReady();
  const { server, origin } = await startFixtureServer();
  const isolatedSession = session.fromPartition(`layout-${process.pid}`);
  isolatedSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !details.url.startsWith(origin + '/') });
  });
  const window = new BrowserWindow({
    width: 980, height: 550, frame: false, show: false, useContentSize: true,
    webPreferences: {
      session: isolatedSession, nodeIntegration: false, contextIsolation: true, sandbox: true,
      backgroundThrottling: false, offscreen: true,
    },
  });
  let code = 1;
  try {
    await window.loadURL(origin + '/');
    const viewports = sizes.map(([width, height]) => ({ width, height, zoom: 1 }));
    // Realistic zoom stress: 1280x720 at 200% is a 640x360 CSS viewport.
    for (const zoom of [1.25, 1.5, 2]) viewports.push({ width: 1280, height: 720, zoom });
    const cases = viewports.flatMap(viewport => ['short', 'long-notes', 'long-error'].map(content => ({ ...viewport, content, fullscreen: false })));
    for (const [width, height] of [[640, 360], [1920, 1080]]) {
      cases.push({ width, height, zoom: 1, content: 'long-notes', fullscreen: true });
    }
    const results = [];
    for (const testCase of cases) {
      window.setContentSize(testCase.width, testCase.height);
      window.webContents.setZoomFactor(testCase.zoom);
      const result = await window.webContents.executeJavaScript(`(${inspectLayout.toString()})(${JSON.stringify(testCase)})`);
      results.push(result);
    }
    const failed = results.filter(result => result.failures.length);
    console.log(JSON.stringify({
      source: baseline ? 'HEAD baseline' : 'working tree', scale: Number(option('device-scale') || 1),
      passed: results.length - failed.length, total: results.length, failures: failed,
    }, null, 2));
    code = failed.length ? 1 : 0;
  } finally {
    window.destroy();
    await new Promise(resolve => server.close(resolve));
    app.exit(code);
  }
}

if (process.versions.electron && args.includes('--worker')) {
  runWorker().catch(error => {
    console.error(error.stack || error);
    require('electron').app.exit(1);
  });
} else {
  launchWorkers().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
}
