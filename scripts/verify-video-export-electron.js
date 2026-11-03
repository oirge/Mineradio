'use strict';

// Run only on the disposable Windows CI runner. This must never open the user's player.
if (process.env.GITHUB_ACTIONS !== 'true' || process.platform !== 'win32') {
  throw new Error('Video export Electron acceptance is restricted to Windows GitHub Actions.');
}

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { app, BrowserWindow, ipcMain } = require('electron');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'artifacts', 'ui-language', 'video-export');
const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-video-export-ci-'));
const ffmpeg = process.env.MINERADIO_VERIFY_FFMPEG;
assert.ok(ffmpeg && fs.existsSync(ffmpeg), 'MINERADIO_VERIFY_FFMPEG must name the CI decoder');
fs.mkdirSync(OUT, { recursive: true });
app.setPath('userData', PROFILE);
app.setPath('sessionData', path.join(PROFILE, 'session'));
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('use-gl', 'angle');
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');

let host, manager, server, port, dialogCount = 0, nextSaveName = '';
const failures = [], checks = [], exports = [], created = [];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

function waveFixture(seconds = 7, rate = 48000) {
  const frames = seconds * rate, bytes = Buffer.alloc(44 + frames * 4);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(2, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 4, 28);
  bytes.writeUInt16LE(4, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36);
  bytes.writeUInt32LE(frames * 4, 40);
  for (let i = 0; i < frames; i++) {
    // Changing amplitude also exercises the existing FFT-driven animation.
    const envelope = 0.55 + 0.4 * Math.sin(i / rate * Math.PI * 4);
    const value = Math.round(8000 * envelope * (Math.sin(i / rate * Math.PI * 880) + 0.25 * Math.sin(i / rate * Math.PI * 1760)));
    bytes.writeInt16LE(value, 44 + i * 4); bytes.writeInt16LE(value, 46 + i * 4);
  }
  return bytes;
}

const HOST_HTML = String.raw`<!doctype html><html><head><meta charset="UTF-8"><title>Mineradio export CI</title></head><body>
<audio id="fixture-audio" preload="auto" src="/fixture.wav"></audio>
<script src="/video-export.js"></script><script>
window.fixtureEvents = []; window.fixtureFrames = 0; window.fixtureTrack = 'export-fixture'; window.fixtureNoLyrics = false;
window.audio = document.getElementById('fixture-audio');
window.audioCtx = null; window.audioChain = null; window.analyser = null;
window.initAudio = function() {
  if (window.audioCtx) return;
  const ctx = window.audioCtx = new AudioContext();
  const source = ctx.createMediaElementSource(window.audio);
  window.analyser = ctx.createAnalyser(); window.analyser.fftSize = 2048;
  window.audioChain = { output: ctx.createGain() };
  const listenerVolume = ctx.createGain(); listenerVolume.gain.value = 0;
  source.connect(window.analyser); window.analyser.connect(window.audioChain.output);
  window.audioChain.output.connect(listenerVolume); listenerVolume.connect(ctx.destination);
};
window.resumeAudioAnalysis = async function() { if (window.audioCtx) await window.audioCtx.resume(); };
window.getPlaybackDurationSeconds = function() { return audio.duration; };
window.syncBeatMapPlaybackCursor = window.schedulePlaybackProgressUi = window.savePlaybackSession = function() {};
window.togglePlay = async function() { if (audio.paused) await audio.play(); else audio.pause(); };
function state() {
  return { uiLanguage: 'en', currentTrack: {id:fixtureTrack,title:'Video export fixture',artist:'Mineradio CI',album:'Background export',duration:audio.duration,cover:'',liked:false,filePath:'',format:'wav'},
    currentIndex:0,position:audio.currentTime,duration:audio.duration,playing:!audio.paused && !audio.ended,playbackRate:audio.playbackRate,
    outputLatency:0,volume:0,muted:true,playMode:'loop',queueRevision:1,libraryRevision:1,lyricsRevision:1,interface:'folia' };
}
function lyrics() {
  if (fixtureNoLyrics) return {trackId:fixtureTrack,lines:[]};
  if (fixtureTrack !== 'export-fixture') return {trackId:fixtureTrack,lines:[{time:0,endTime:7,text:'Changed song lyric',translation:'新歌曲歌词',words:[{time:0,duration:7,text:'Changed song lyric'}]}]};
  return { trackId: fixtureTrack, lines: [
    {time:0,endTime:2,text:'Listening to the morning',translation:'聆听清晨',words:[{time:0,duration:1,text:'Listening '},{time:1,duration:1,text:'to the morning'}]},
    {time:2,endTime:4,text:'Follow the light',translation:'追随光芒',words:[{time:2,duration:1,text:'Follow '},{time:3,duration:1,text:'the light'}]},
    {time:4,endTime:7,text:'Let the music carry on',translation:'让音乐继续',words:[{time:4,duration:1,text:'Let '},{time:5,duration:1,text:'the music '},{time:6,duration:1,text:'carry on'}]}
  ]};
}
function analysis() { return {trackId:fixtureTrack,revision:1,source:'live',beats:[],drums:null,vocal:null}; }
window.fixture = window.MineradioVideoExport.create(window, {getState:state,getLyrics:lyrics,getAnalysis:analysis,
  emit:function(event,value) { fixtureEvents.push({event:event,value:value}); }
});
window.desktopWindow.onVideoExportFrame(function() { fixtureFrames++; });
audio.addEventListener('ended', function() { window.fixture.beforeTrackEnd(); });
window.fixtureReady = new Promise(function(resolve,reject) {
  if (audio.readyState >= 1) return resolve();
  audio.addEventListener('loadedmetadata',resolve,{once:true}); audio.addEventListener('error',function(){reject(new Error('Fixture audio failed'));},{once:true});
});
window.fixtureVisuals = function(mode) { return {mode:mode,view:'lyrics',background:{mode:'latent'},daylight:false,lyricsFontScale:1,
  translation:true,subtitleContentMode:'translation',subtitleBackground:true,subtitleHidden:false,subtitleLayout:'translation',harmony:true,rhythm:true}; };
// The recorder must reuse an already existing player audio graph.
initAudio();
</script></body></html>`;

function logCheck(message) { checks.push(message); process.stdout.write(`PASS: ${message}\n`); }
function evaluate(source) { return host.webContents.executeJavaScript(source, true); }
async function until(source, label, timeout = 35000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await evaluate(source);
    if (result) return result;
    const current = await evaluate('window.fixture && window.fixture.getState()');
    if (current?.status === 'error') throw new Error(`${label}: ${current.error}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out: ${label}; state=${JSON.stringify(await evaluate('window.fixture.getState()'))}`);
}

async function start(name, width, height, mode = 'classic', startMode = 'current', noLyrics = false, transitionBehavior) {
  nextSaveName = name;
  await evaluate(`audio.pause(); audio.currentTime = ${startMode === 'from-start' ? 2 : 0}; fixtureTrack = 'export-fixture'; fixtureNoLyrics = ${noLyrics};
    window.fixtureSource = audio; window.fixtureContext = audioCtx; window.fixtureOutput = audioChain && audioChain.output;`);
  const transition = transitionBehavior ? `,transitionBehavior:${JSON.stringify(transitionBehavior)}` : '';
  const result = await evaluate(`window.fixture.start({width:${width},height:${height},startMode:${JSON.stringify(startMode)},visuals:fixtureVisuals(${JSON.stringify(mode)})${transition}})`);
  assert.notEqual(result?.status, 'error', JSON.stringify(result));
  await until("fixture.getState().status === 'recording'", `${name} recording`);
  const surface = BrowserWindow.getAllWindows().find(win=>win.webContents.isOffscreen());
  assert.ok(surface,'the production offscreen Folia surface must exist');
  assert.deepEqual(await surface.webContents.executeJavaScript('({width:innerWidth,height:innerHeight})'),{width,height},
    'offscreen layout must match the requested aspect ratio and resolution');
  assert.equal(await evaluate('audio === fixtureSource && (!fixtureContext || audioCtx === fixtureContext) && (!fixtureOutput || audioChain.output === fixtureOutput)'), true,
    'export must keep the existing media element and audio graph');
  return result;
}

async function playerIdentityPreserved() {
  assert.equal(await evaluate('audio === fixtureSource && audioCtx === fixtureContext && audioChain.output === fixtureOutput'),true,
    'finishing the export must preserve the existing media element and audio graph');
}

async function hiddenTrackBecomes(trackId) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const surface = BrowserWindow.getAllWindows().find(win=>win.webContents.isOffscreen());
    assert.ok(surface,'recording must retain the hidden Folia surface');
    const matches = await surface.webContents.executeJavaScript(`document.querySelector('.local-video-export-surface')?.dataset.videoExportTrack === ${JSON.stringify(trackId)} && document.body.textContent.includes('新歌曲歌词')`);
    if (matches) return;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error(`The hidden Folia surface did not follow track ${trackId}`);
}

function decodeOutput(filePath, width, height, minDuration, maxDuration) {
  const metadata = (() => { try { execFileSync(ffmpeg, ['-hide_banner', '-i', filePath], {encoding:'utf8',windowsHide:true}); return ''; }
    catch (error) { return String(error.stderr); } })();
  assert.match(metadata, new RegExp(`Video:.*\\b${width}x${height}\\b`));
  assert.match(metadata, /Audio:/, 'encoded video must contain an audio stream');
  const pcm = execFileSync(ffmpeg, ['-v','error','-i',filePath,'-vn','-ac','1','-ar','8000','-f','f32le','pipe:1'], {maxBuffer:16*1024*1024,windowsHide:true});
  let square = 0;
  for (let offset = 0; offset + 4 <= pcm.length; offset += 4) square += pcm.readFloatLE(offset) ** 2;
  const duration = pcm.length / 4 / 8000, rms = Math.sqrt(square / (pcm.length / 4));
  assert.ok(duration >= minDuration && duration <= maxDuration, `decoded audio duration ${duration} outside ${minDuration}–${maxDuration}`);
  assert.ok(rms > 0.025 && rms < 0.5, `export music RMS ${rms} must remain audible with the listening volume at zero`);
  const frame = seconds => execFileSync(ffmpeg, ['-v','error','-ss',String(seconds),'-i',filePath,'-an','-vf','scale=160:90','-frames:v','1','-pix_fmt','rgb24','-f','rawvideo','pipe:1'], {maxBuffer:1024*1024,windowsHide:true});
  const a = frame(Math.min(0.8, duration / 4)), b = frame(Math.min(2.5, duration * 0.7));
  assert.equal(a.length, 160 * 90 * 3, 'first sampled video frame must decode');
  assert.equal(b.length, a.length, 'second sampled video frame must decode');
  let sum = 0, variance = 0, difference = 0, highlights = 0;
  for (let index = 0; index < a.length; index++) { sum += a[index]; variance += a[index] ** 2; difference += Math.abs(a[index] - b[index]); if (a[index] > 100) highlights++; }
  const mean = sum / a.length, deviation = Math.sqrt(variance / a.length - mean ** 2);
  assert.ok(deviation > 6 && highlights > 30, `nonblack visual detail required: deviation=${deviation}, highlights=${highlights}`);
  assert.ok(difference / a.length > 0.2, `animation/lyric content must advance: difference=${difference / a.length}`);
  const result = {file:path.basename(filePath),width,height,bytes:fs.statSync(filePath).size,duration,rms,mean,deviation,frameDifference:difference/a.length};
  exports.push(result);
  return result;
}

async function run() {
  const wav = waveFixture();
  server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    if (pathname === '/' || pathname === '/index.html') { response.writeHead(200, {'content-type':'text/html; charset=utf-8'}); response.end(HOST_HTML); return; }
    if (pathname === '/fixture.wav') { response.writeHead(200, {'content-type':'audio/wav','content-length':wav.length}); response.end(wav); return; }
    const target = path.resolve(PUBLIC, `.${pathname}`);
    if (!target.startsWith(PUBLIC + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, {'content-type':mime[path.extname(target)] || 'application/octet-stream'});
    fs.createReadStream(target).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
  app.on('browser-window-created', (_event, win) => {
    const record = {id:win.id,shown:false,offscreen:win.webContents.isOffscreen()}; created.push(record);
    win.on('show', () => { record.shown = true; });
    win.webContents.on('console-message', (_event, level, message) => {
      if (level >= 2) fs.appendFileSync(path.join(OUT, 'renderer.log'), `${win.id}: ${message}\n`);
    });
    win.webContents.on('render-process-gone', (_event, details) => { failures.push(`renderer ${win.id}: ${details.reason}`); });
  });
  host = new BrowserWindow({show:false,width:1024,height:640,webPreferences:{preload:path.join(ROOT,'desktop','preload.js'),contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  ipcMain.on('mineradio-ui-state-read-sync', event => { event.returnValue = {}; });
  const {createVideoExportManager} = require('../desktop/video-export');
  manager = createVideoExportManager({BrowserWindow,ipcMain,
    dialog:{showSaveDialog:async (_window, options) => {
      dialogCount++;
      const extension = path.extname(options.defaultPath);
      const filePath = path.join(OUT, `${nextSaveName}${extension}`);
      if (nextSaveName.startsWith('cancel-')) fs.writeFileSync(filePath, 'existing target must survive cancellation');
      return {canceled:false,filePath};
    }},getMainWindow:()=>host,getMainServerPort:()=>port,
    trustedMainFrameHandler:fn=>(event,...args)=> {
      if (event.sender !== host.webContents || event.senderFrame !== host.webContents.mainFrame) throw new Error('UNTRUSTED_EXPORT_TEST_SENDER');
      return fn(event,...args);
    },translate:(_chinese, english)=>english || _chinese,
  });
  manager.registerIpc();
  await host.loadURL(`http://127.0.0.1:${port}/index.html`);
  await evaluate('window.fixtureReady');
  const originalBounds = host.getBounds();

  await start('landscape-full',1280,720,'classic','from-start');
  assert.ok(await evaluate('audio.currentTime < 1.2'), 'whole-song export must restart the song after preparing');
  await until("fixture.getState().status === 'saved'", 'whole-song automatic completion', 45000);
  const landscape = fs.readdirSync(OUT).find(file => /^landscape-full\.(mp4|webm)$/.test(file));
  assert.ok(landscape, 'full-song file must exist');
  decodeOutput(path.join(OUT,landscape),1280,720,6,8.5);
  assert.ok(await evaluate('fixtureFrames > 20'), 'offscreen frames must reach the real recorder');
  await playerIdentityPreserved();
  logCheck('whole-song landscape export: real Folia lyrics, moving frames, audio and automatic save');

  await start('portrait-segment',720,1280,'fume');
  await until('audio.currentTime > 1.1', 'portrait first segment');
  await evaluate('audio.pause()');
  await until("fixture.getState().status === 'paused'", 'recording follows host pause');
  const pausedAt = await evaluate('audio.currentTime');
  await new Promise(resolve => setTimeout(resolve, 700));
  assert.ok(Math.abs(await evaluate('audio.currentTime') - pausedAt) < 0.05);
  await evaluate('audio.play()');
  await until("fixture.getState().status === 'recording' && audio.currentTime > 3.2", 'recording resumes');
  // The default policy keeps recording when the user changes songs or seeks.
  await evaluate("fixture.beforeTrackChange(); fixtureTrack = 'changed-fixture'; audio.currentTime = 0.5");
  await until("fixture.getState().status === 'recording' && audio.currentTime > 1.0",'default recording continues after track change and seek');
  await hiddenTrackBecomes('changed-fixture');
  await evaluate('fixture.stop()');
  await until("fixture.getState().status === 'saved'", 'portrait final chunk save');
  const portrait = fs.readdirSync(OUT).find(file => /^portrait-segment\.(mp4|webm)$/.test(file));
  assert.ok(portrait);
  decodeOutput(path.join(OUT,portrait),720,1280,3.1,5.5);
  await playerIdentityPreserved();
  assert.equal(await evaluate('audio.paused'),false,'stopping export must not stop the music');
  logCheck('portrait export: pause/resume, default continued recording across songs and seeks, updated Folia track and final media chunk');

  await start('landscape-1080-no-lyrics',1920,1080,'fume','current',true);
  await until('audio.currentTime > 2.4', '1080p visualization-only recording');
  await evaluate('fixture.stop()');
  await until("fixture.getState().status === 'saved'", '1080p save');
  const hd = fs.readdirSync(OUT).find(file => /^landscape-1080-no-lyrics\.(mp4|webm)$/.test(file));
  assert.ok(hd);
  decodeOutput(path.join(OUT,hd),1920,1080,1.8,4);
  await playerIdentityPreserved();
  logCheck('1080p visualization without lyric data remains exportable');

  await start('save-transition',1280,720,'classic','current',false,'save');
  await until('audio.currentTime > 1.2','save-on-transition policy records a segment');
  await evaluate("fixture.beforeTrackChange(); fixtureTrack = 'save-policy-next'; audio.currentTime = 0.5");
  await until("fixture.getState().status === 'saved'",'explicit save policy finishes before the next song');
  const savedTransition = fs.readdirSync(OUT).find(file=>/^save-transition\.(mp4|webm)$/.test(file));
  assert.ok(savedTransition && fs.statSync(path.join(OUT,savedTransition)).size>2000);
  await playerIdentityPreserved();
  logCheck('explicit save policy finishes the segment on track change');

  const beforeCancel = fs.readdirSync(OUT).sort();
  await start('cancel-preserve',1280,720);
  await until('audio.currentTime > 1.3', 'cancellation after data has been written');
  await evaluate('fixture.cancel()');
  await until("fixture.getState().status === 'cancelled'", 'cancel cleanup');
  const cancelTarget = fs.readdirSync(OUT).find(file=>/^cancel-preserve\.(mp4|webm)$/.test(file));
  assert.ok(cancelTarget);
  assert.equal(fs.readFileSync(path.join(OUT,cancelTarget),'utf8'),'existing target must survive cancellation');
  assert.deepEqual(fs.readdirSync(OUT).filter(file=>file!==cancelTarget).sort(),beforeCancel,'cancel must leave no temporary output');
  assert.equal(BrowserWindow.getAllWindows().length,1,'export window must be destroyed after cancel');
  await playerIdentityPreserved();
  assert.equal(await evaluate('audio.paused'),false,'canceling export must not stop the music');
  logCheck('cancel cleans partial output and preserves the pre-existing target file');

  const previousDialogs = dialogCount;
  const rogue = new BrowserWindow({show:false,webPreferences:{preload:path.join(ROOT,'desktop','preload.js'),contextIsolation:true,nodeIntegration:false}});
  await rogue.loadURL(`http://127.0.0.1:${port}/index.html`);
  const denied = await rogue.webContents.executeJavaScript("desktopWindow.beginVideoExport({width:1280,height:720,extension:'webm',fileName:'blocked.webm'}).then(()=>false,()=>true)");
  assert.equal(denied,true,'a second renderer must not control the main export session');
  assert.equal(dialogCount,previousDialogs,'untrusted request must not reach the save dialog');
  rogue.destroy();
  assert.deepEqual(host.getBounds(),originalBounds,'export must never resize the main player');
  assert.equal(created.some(window=>window.shown),false,'export must never show a window or take focus');
  assert.ok(created.filter(window=>window.offscreen).length>=4,'real offscreen windows must have been used');
  assert.deepEqual(failures,[]);
  logCheck('sender authorization, hidden-window cleanup and unchanged player bounds');
}

app.whenReady().then(run).then(async()=> {
  fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify({checks,exports,windows:created,failures},null,2));
  await manager?.dispose(); host?.destroy(); await new Promise(resolve=>server.close(resolve)); app.exit(0);
}).catch(async error=> {
  failures.push(error.stack || String(error));
  fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify({checks,exports,windows:created,failures},null,2));
  process.stderr.write(`${error.stack || error}\n`);
  try { await manager?.dispose(); } catch {} try { host?.destroy(); } catch {} try { server?.close(); } catch {}
  app.exit(1);
});
