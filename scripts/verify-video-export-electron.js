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
const { execFileSync, spawnSync } = require('node:child_process');
const { app, BrowserWindow, ipcMain, nativeImage } = require('electron');

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

let host, manager, server, port, permissionBridge, dialogCount = 0, nextSaveName = '';
const failures = [], checks = [], mediaExports = [], created = [], surfaceSnapshots = [], permissionDecisions = [], frameRateChecks = [];
const watchdog = setTimeout(async () => {
  const message = 'Video export acceptance exceeded its three-minute execution budget.';
  failures.push(message);
  await snapshotSurfaces('watchdog');
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ checks, mediaExports, windows: created, failures, permissions:permissionDecisions, surfaces:surfaceSnapshots, fixture:await fixtureSnapshot() }, null, 2));
  process.stderr.write(message + '\n');
  app.exit(1);
}, 180000);
watchdog.unref();
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

function waveFixture(seconds = 7, rate = 48000, frequency = 440) {
  const frames = seconds * rate, bytes = Buffer.alloc(44 + frames * 4);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(2, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 4, 28);
  bytes.writeUInt16LE(4, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36);
  bytes.writeUInt32LE(frames * 4, 40);
  for (let i = 0; i < frames; i++) {
    // Changing amplitude also exercises the existing FFT-driven animation.
    const envelope = 0.55 + 0.4 * Math.sin(i / rate * Math.PI * 4);
    const value = Math.round(8000 * envelope * (Math.sin(i / rate * Math.PI * 2 * frequency) + 0.25 * Math.sin(i / rate * Math.PI * 4 * frequency)));
    bytes.writeInt16LE(value, 44 + i * 4); bytes.writeInt16LE(value, 46 + i * 4);
  }
  return bytes;
}

const HOST_HTML = String.raw`<!doctype html><html><head><meta charset="UTF-8"><title>Mineradio export CI</title></head><body>
<audio id="fixture-audio" preload="auto" src="/fixture.wav"></audio>
<audio id="fixture-next" preload="auto" src="/fixture-next.wav"></audio>
<script src="/video-export.js"></script><script>
window.fixtureEvents = []; window.fixtureTransportEvents = []; window.fixtureFrames = 0; window.fixtureTrack = 'export-fixture'; window.fixtureNoLyrics = false;
window.fixtureDiagnostics = []; window.fixtureDraws = 0; window.fixtureRequests = 0;
window.fixtureDiagnostic = function(kind,detail) {
  fixtureDiagnostics.push({kind:kind,at:performance.now(),position:window.audio ? audio.currentTime : null,frames:fixtureFrames,draws:fixtureDraws,requests:fixtureRequests,detail:detail});
  if (fixtureDiagnostics.length>500) fixtureDiagnostics.splice(0,fixtureDiagnostics.length-500);
};
window.fixtureFirst = document.getElementById('fixture-audio'); window.fixtureNext = document.getElementById('fixture-next');
window.audio = window.fixtureFirst;
window.audioCtx = null; window.audioChain = null; window.analyser = null;
window.initAudio = function() {
  if (window.audioCtx) return;
  const ctx = window.audioCtx = new AudioContext();
  window.analyser = ctx.createAnalyser(); window.analyser.fftSize = 2048;
  window.audioChain = { output: ctx.createGain() };
  const listenerVolume = ctx.createGain(); listenerVolume.gain.value = 0;
  window.fixtureSources = [fixtureFirst,fixtureNext].map(function(media) {
    const source = ctx.createMediaElementSource(media); source.connect(window.analyser); return source;
  });
  window.analyser.connect(window.audioChain.output);
  window.audioChain.output.connect(listenerVolume); listenerVolume.connect(ctx.destination);
};
window.resumeAudioAnalysis = async function() { if (window.audioCtx) await window.audioCtx.resume(); };
window.getPlaybackDurationSeconds = function() { return audio.duration; };
window.syncBeatMapPlaybackCursor = window.schedulePlaybackProgressUi = window.savePlaybackSession = function() {};
window.togglePlay = async function() { if (audio.paused) await audio.play(); else audio.pause(); };
const nativeStart = MediaRecorder.prototype.start;
MediaRecorder.prototype.start = function() {
  const recorder = this;
  fixtureDiagnostic('recorder-before-start',{mimeType:recorder.mimeType,videoBits:recorder.videoBitsPerSecond,audioBits:recorder.audioBitsPerSecond,
    tracks:recorder.stream.getTracks().map(function(track){return {kind:track.kind,state:track.readyState,muted:track.muted,settings:track.getSettings()};})});
  ['start','pause','resume','stop','error','dataavailable'].forEach(function(kind) {
    recorder.addEventListener(kind,function(event) { fixtureDiagnostic('recorder-'+kind,{state:recorder.state,mimeType:recorder.mimeType,size:event.data && event.data.size,error:event.error && String(event.error)}); });
  });
  return nativeStart.apply(recorder,arguments);
};
// Record capture constraints without adding a second video consumer or readback.
const nativeGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
navigator.mediaDevices.getUserMedia = async function(constraints) {
  const stream = await nativeGetUserMedia(constraints);
  window.fixtureCaptureInfo = {constraints:constraints,settings:stream.getVideoTracks()[0].getSettings()};
  return stream;
};
function state() {
  return { uiLanguage: 'en', currentTrack: {id:fixtureTrack,title:'Video export fixture',artist:'Mineradio CI',album:'Background export',duration:audio.duration,cover:'',liked:false,filePath:'',format:'wav'},
    currentIndex:0,position:audio.currentTime,duration:audio.duration,playing:!audio.paused && !audio.ended,playbackRate:audio.playbackRate,
    outputLatency:0,volume:0,muted:true,playMode:'loop',queueRevision:1,libraryRevision:1,lyricsRevision:1,interface:'folia' };
}
function lyrics() {
  if (fixtureNoLyrics) return {trackId:fixtureTrack,lines:[]};
  if (fixtureTrack !== 'export-fixture') return {trackId:fixtureTrack,lines:[{time:0,endTime:30,text:'Changed song lyric',translation:'新歌曲歌词',words:[{time:0,duration:1.5,text:'Changed song lyric'}]}]};
  return { trackId: fixtureTrack, lines: [
    {time:0,endTime:2,text:'Listening to the morning',translation:'聆听清晨',words:[{time:0,duration:1,text:'Listening '},{time:1,duration:1,text:'to the morning'}]},
    {time:2,endTime:4,text:'Follow the light',translation:'追随光芒',words:[{time:2,duration:1,text:'Follow '},{time:3,duration:1,text:'the light'}]},
    {time:4,endTime:7,text:'Let the music carry on',translation:'让音乐继续',words:[{time:4,duration:1,text:'Let '},{time:5,duration:1,text:'the music '},{time:6,duration:1,text:'carry on'}]}
  ]};
}
function analysis() { return {trackId:fixtureTrack,revision:1,source:'live',beats:[],drums:null,vocal:null}; }
window.fixture = window.MineradioVideoExport.create(window, {getState:state,getLyrics:lyrics,getAnalysis:analysis,
  emit:function(event,value) { fixtureEvents.push({event:event,value:value,at:performance.now(),position:audio.currentTime}); fixtureDiagnostic('export-state',value); }
});
[fixtureFirst,fixtureNext].forEach(function(media) {
  ['play','playing','pause','ended','seeking','seeked'].forEach(function(kind) {
    media.addEventListener(kind,function(){fixtureTransportEvents.push({kind:kind,mediaId:media.id,at:performance.now(),position:media.currentTime,paused:media.paused,ended:media.ended,selected:window.audio===media});});
  });
  media.addEventListener('ended', function() { if (window.audio === media) window.fixture.beforeTrackEnd(); });
});
window.fixtureReady = Promise.all([fixtureFirst,fixtureNext].map(function(media) { return new Promise(function(resolve,reject) {
  if (media.readyState >= 1) return resolve();
  media.addEventListener('loadedmetadata',resolve,{once:true}); media.addEventListener('error',function(){reject(new Error('Fixture audio failed'));},{once:true});
}); }));
window.fixtureHandoff = async function(trackId) {
  fixture.beforeTrackChange(); audio.pause(); window.audio = fixtureNext; fixtureTrack = trackId;
  audio.currentTime = 0.5; window.fixtureSource = audio; await audio.play();
};
// Isolate DOM lyric capture from the CPU-only runner's expensive fluid shader.
// The Fume and no-lyric cases retain that shader to cover composed backgrounds.
window.fixtureVisuals = function(mode) { return {mode:mode,view:'lyrics',background:mode==='classic'?{mode:'common',common:{disableGeometricBackground:true}}:{mode:'latent'},daylight:false,lyricsFontScale:1,
  translation:true,subtitleContentMode:'translation',subtitleBackground:true,subtitleHidden:false,subtitleLayout:'translation',harmony:true,rhythm:true}; };
// The recorder must reuse an already existing player audio graph.
initAudio();
</script></body></html>`;

function logCheck(message) { checks.push(message); process.stdout.write(`PASS: ${message}\n`); }
function evaluate(source) { return host.webContents.executeJavaScript(source, true); }
async function snapshotSurfaces(label, pixelSample = false) {
  for (const surface of BrowserWindow.getAllWindows().filter(win=>new URL(win.webContents.getURL() || 'about:blank').searchParams.has('videoExport'))) {
    try {
      const result = await Promise.race([surface.webContents.executeJavaScript(`(function() {
        const bounds = function(node) { const r=node.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; };
        const summary = function(node) {
          const css=getComputedStyle(node);
          return {tag:node.tagName,className:typeof node.className==='string'?node.className:'',text:(node.textContent||'').trim().slice(0,160),bounds:bounds(node),
            style:{display:css.display,visibility:css.visibility,opacity:css.opacity,transform:css.transform,position:css.position,zIndex:css.zIndex,
              color:css.color,font:css.font,filter:css.filter,mixBlendMode:css.mixBlendMode,clipPath:css.clipPath,textFill:css.webkitTextFillColor},
            parents:Array.from((function*(p){for(let i=0;p&&i<3;p=p.parentElement,i++)yield p;})(node.parentElement)).map(function(parent){const s=getComputedStyle(parent);return {tag:parent.tagName,className:typeof parent.className==='string'?parent.className:'',bounds:bounds(parent),opacity:s.opacity,display:s.display,visibility:s.visibility,filter:s.filter,zIndex:s.zIndex};})};
        };
        const stage=document.querySelector('.local-video-export-surface');
        const words=Array.from(document.querySelectorAll('span,p,h1,h2,h3')).filter(function(node){return !node.querySelector('span,p,h1,h2,h3') && /Listening|morning|Follow|light|music|carry|Changed|song|lyric|聆听|追随|新歌曲/.test(node.textContent||'');}).slice(0,60);
        let visualizer={unavailable:'React visualizer props were not found'},fumePixels=null;
        if(stage) {
          try {
            const key=Object.keys(stage).find(function(name){return name.startsWith('__reactProps$');});
            const props=key&&stage[key]?.children?.props?.children?.props;
            if(props?.currentTime?.get)visualizer={position:props.currentTime.get(),currentLineIndex:props.currentLineIndex,paused:props.paused,
              lines:props.lines?.length,activeLine:props.lines?.[props.currentLineIndex]?.fullText||null,mode:props.mode};
          }catch(error){visualizer={unavailable:String(error)};}
          // Readback can flush a large GPU canvas. Only sample while playback/recording is
          // explicitly paused, so this diagnostic cannot lengthen a recorded segment.
          if(${pixelSample}&&stage.dataset.videoExportMode==='fume') {
            const canvas=stage.querySelector('canvas.absolute.inset-0.h-full.w-full');
            if(canvas)try {
              const context=canvas.getContext('2d'),pixels=context?.getImageData(0,0,canvas.width,canvas.height).data;
              if(pixels){let alphaNonzero=0,alphaOpaque=0;for(let i=3;i<pixels.length;i+=4){if(pixels[i])alphaNonzero++;if(pixels[i]===255)alphaOpaque++;}
                fumePixels={width:canvas.width,height:canvas.height,pixels:pixels.length/4,alphaNonzero,alphaOpaque};}
            }catch(error){fumePixels={unavailable:String(error)};}
          }
        }
        return {url:location.href,at:performance.now(),viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},visibility:document.visibilityState,hidden:document.hidden,
          raf:window.__videoExportRafDiagnostic||null,updates:window.__videoExportUpdateDiagnostic||null,visualizer,fumePixels,stage:stage?summary(stage):null,text:(document.body.textContent||'').slice(0,2000),
          canvases:Array.from(document.querySelectorAll('canvas')).map(function(canvas){return {...summary(canvas),width:canvas.width,height:canvas.height};}),words:words.map(summary)};
      })()`,true), new Promise(resolve=>setTimeout(()=>resolve({unavailable:'surface did not answer'}),pixelSample?12000:1500))]);
      surfaceSnapshots.push({label,windowId:surface.id,...result});
    } catch(error) { surfaceSnapshots.push({label,windowId:surface.id,unavailable:String(error)}); }
  }
  fs.writeFileSync(path.join(OUT,'surface-diagnostics.json'),JSON.stringify(surfaceSnapshots,null,2));
}
async function fixtureSnapshot() {
  if (!host || host.isDestroyed()) return null;
  try {
    return await Promise.race([evaluate('({state:window.fixture && fixture.getState(),frames:window.fixtureFrames,draws:window.fixtureDraws,requests:window.fixtureRequests,events:window.fixtureEvents,transport:window.fixtureTransportEvents,capture:window.fixtureCaptureInfo,diagnostics:window.fixtureDiagnostics,position:window.audio && audio.currentTime,ended:window.audio && audio.ended})'),
      new Promise(resolve=>setTimeout(()=>resolve({unavailable:'renderer did not answer'}),1500))]);
  } catch (error) { return {unavailable:String(error)}; }
}

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

async function start(name, width, height, mode = 'classic', startMode = 'current', noLyrics = false, transitionBehavior, frameRate) {
  nextSaveName = name;
  await evaluate(`fixtureFirst.pause(); fixtureNext.pause(); window.audio = fixtureFirst; audio.src=${JSON.stringify(name === 'landscape-full' ? '/fixture.wav' : '/fixture-long.wav')}; audio.load();`);
  await until('audio.readyState>=3','fixture song load');
  await evaluate(`audio.currentTime = ${startMode === 'from-start' ? 2 : 0}; fixtureTrack = 'export-fixture'; fixtureNoLyrics = ${noLyrics};
    window.fixtureSource = audio; window.fixtureContext = audioCtx; window.fixtureOutput = audioChain && audioChain.output; window.fixtureLastFrame=null;`);
  const transition = transitionBehavior ? `,transitionBehavior:${JSON.stringify(transitionBehavior)}` : '';
  const frameRateOption = frameRate === undefined ? '' : `,frameRate:${JSON.stringify(frameRate)}`;
  // Read the playhead in the same renderer task that starts capture. Evidence
  // snapshots can be slow on SwiftShader and must not change this timing check.
  const result = await evaluate(`(async function(){const result=await window.fixture.start({width:${width},height:${height},startMode:${JSON.stringify(startMode)},visuals:fixtureVisuals(${JSON.stringify(mode)})${transition}${frameRateOption}});return {...result,playheadAtStart:audio.currentTime};})()`);
  assert.notEqual(result?.status, 'error', JSON.stringify(result));
  await until("fixture.getState().status === 'recording'", `${name} recording`);
  const surface = BrowserWindow.getAllWindows().find(win=>new URL(win.webContents.getURL() || 'about:blank').searchParams.has('videoExport'));
  assert.ok(surface,'the production offscreen Folia surface must exist');
  assert.deepEqual(await surface.webContents.executeJavaScript('({width:innerWidth,height:innerHeight})'),{width,height},
    'offscreen layout must match the requested aspect ratio and resolution');
  const targetFrameRate = frameRate ?? 30;
  assert.equal(result.frameRate, targetFrameRate, 'host state must retain the selected FPS');
  const capture = await evaluate('fixtureCaptureInfo');
  assert.equal(capture.constraints.video.mandatory.maxFrameRate, targetFrameRate, 'native tab capture must request the selected FPS');
  assert.ok(capture.settings.frameRate > 0 && capture.settings.frameRate <= targetFrameRate + 0.01,
    'the native track must report a valid frame rate within the selected cap');
  assert.equal(await surface.webContents.executeJavaScript("Number(document.querySelector('.local-video-export-surface').dataset.videoExportFrameRate)"),
    targetFrameRate, 'the hidden production surface must receive the selected FPS');
  frameRateChecks.push({ name, targetFrameRate, capture });
  fs.writeFileSync(path.join(OUT, 'frame-rate-checks.json'), JSON.stringify(frameRateChecks, null, 2));
  assert.equal(await evaluate('audio === fixtureSource && (!fixtureContext || audioCtx === fixtureContext) && (!fixtureOutput || audioChain.output === fixtureOutput)'), true,
    'export must keep the existing media element and audio graph');
  return result;
}

async function playerIdentityPreserved() {
  assert.equal(await evaluate('audio === fixtureSource && audioCtx === fixtureContext && audioChain.output === fixtureOutput'),true,
    'finishing the export must preserve the existing media element and audio graph');
}

async function stopWhilePreservingPlayback(label) {
  const immediate=await evaluate(`(function(){
    window.fixtureStopEventAt=fixtureTransportEvents.length;
    const before={paused:audio.paused,ended:audio.ended,position:audio.currentTime};
    fixture.stop();
    return {before:before,after:{paused:audio.paused,ended:audio.ended,position:audio.currentTime}};
  })()`);
  assert.equal(immediate.before.paused,false,`${label}: the fixture must be playing before stop`);
  assert.equal(immediate.before.ended,false,`${label}: stop must be exercised before the fixture ends`);
  assert.equal(immediate.after.paused,false,`${label}: stopping capture must leave music playing immediately`);
  assert.equal(immediate.after.ended,false,`${label}: stopping capture must not end the music`);
  await until("fixture.getState().status === 'saved'",`${label} final chunk save`);
  const final=await evaluate('({paused:audio.paused,ended:audio.ended,position:audio.currentTime,events:fixtureTransportEvents.slice(fixtureStopEventAt).filter(event=>event.mediaId===fixtureSource.id)})');
  assert.deepEqual(final.events.filter(event=>event.kind==='pause'&&!event.ended),[],`${label}: saving must never pause the selected song`);
  assert.ok(!final.paused||final.ended,`${label}: only natural completion may stop the selected song while saving`);
  assert.ok(final.position>=immediate.before.position,`${label}: saving must preserve playback progress`);
  checks.push(`${label}: transport preserved immediately and throughout saving (${final.ended?'fixture naturally ended':'still playing'})`);
}

async function hiddenTrackBecomes(trackId) {
  const deadline = Date.now() + 10000;
  let stable = 0;
  while (Date.now() < deadline) {
    const surface = BrowserWindow.getAllWindows().find(win=>new URL(win.webContents.getURL() || 'about:blank').searchParams.has('videoExport'));
    assert.ok(surface,'recording must retain the hidden Folia surface');
    const matches = await surface.webContents.executeJavaScript(`document.querySelector('.local-video-export-surface')?.dataset.videoExportTrack === ${JSON.stringify(trackId)} && document.body.textContent.includes('新歌曲歌词') && !document.querySelector('svg.lucide-hourglass')`);
    stable = matches ? stable + 1 : 0;
    if (stable >= 3) return;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error(`The hidden Folia surface did not follow track ${trackId}`);
}

function toneMagnitude(pcm, start, seconds, frequency) {
  const first = Math.max(0, Math.floor(start * 8000));
  const last = Math.min(pcm.length / 4, first + Math.floor(seconds * 8000));
  let cosine = 0, sine = 0;
  for (let sample = first; sample < last; sample++) {
    const value = pcm.readFloatLE(sample * 4), phase = sample / 8000 * Math.PI * 2 * frequency;
    cosine += value * Math.cos(phase); sine += value * Math.sin(phase);
  }
  return Math.hypot(cosine, sine) / Math.max(1, last - first);
}

function saveSampleFrame(rgb, fileName) {
  const bgra=Buffer.alloc(160*90*4);
  for(let source=0,target=0;source<rgb.length;source+=3,target+=4) {
    bgra[target]=rgb[source+2];bgra[target+1]=rgb[source+1];bgra[target+2]=rgb[source];bgra[target+3]=255;
  }
  fs.writeFileSync(path.join(OUT,fileName),nativeImage.createFromBitmap(bgra,{width:160,height:90}).toPNG());
}

function inspectVideoTimeline(filePath, audioDuration) {
  const decoded=spawnSync(ffmpeg,['-hide_banner','-nostats','-v','info','-i',filePath,'-an','-vf','showinfo','-fps_mode','passthrough','-f','null','-'],
    {encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});
  assert.equal(decoded.status,0,`full video decode failed: ${decoded.stderr}`);
  const frames=[];
  for(const line of String(decoded.stderr).split(/\r?\n/)) {
    if(!/\[Parsed_showinfo_/.test(line))continue;
    const match=/\bn:\s*(\d+)\s+pts:.*?\bpts_time:\s*([-\d.]+)/.exec(line);
    if(!match)continue;
    const duration=/\bduration_time:\s*([-\d.]+)/.exec(line);
    frames.push({index:Number(match[1]),pts:Number(match[2]),duration:duration?Number(duration[1]):null});
  }
  const counts={};
  for(const frame of frames) { const second=String(Math.floor(frame.pts));counts[second]=(counts[second]||0)+1; }
  const last=frames.at(-1), previous=frames.at(-2);
  const lastDuration=last?.duration??(last&&previous?last.pts-previous.pts:0);
  const videoEnd=last?last.pts+lastDuration:null;
  return {frameCount:frames.length,firstPts:frames[0]?.pts??null,lastPts:last?.pts??null,lastDuration,videoEnd,audioDuration,
    audioMinusVideoEnd:videoEnd===null?null:audioDuration-videoEnd,framesPerSecond:counts,frames};
}

function decodeOutput(filePath, width, height, minDuration, maxDuration, toneChange, mainLyrics = false) {
  const metadata = (() => { try { execFileSync(ffmpeg, ['-hide_banner', '-i', filePath], {encoding:'utf8',windowsHide:true}); return ''; }
    catch (error) { return String(error.stderr); } })();
  assert.match(metadata, new RegExp(`Video:.*\\b${width}x${height}\\b`));
  assert.match(metadata, /Audio:/, 'encoded video must contain an audio stream');
  assert.match(metadata, /Duration: \d{2}:\d{2}:\d{2}\.\d+/, 'the saved video must expose a finite duration to media players');
  const pcm = execFileSync(ffmpeg, ['-v','error','-i',filePath,'-vn','-ac','1','-ar','8000','-f','f32le','pipe:1'], {maxBuffer:16*1024*1024,windowsHide:true});
  let square = 0;
  for (let offset = 0; offset + 4 <= pcm.length; offset += 4) square += pcm.readFloatLE(offset) ** 2;
  const duration = pcm.length / 4 / 8000, rms = Math.sqrt(square / (pcm.length / 4));
  const stem=path.basename(filePath,path.extname(filePath));
  const result = {file:path.basename(filePath),width,height,bytes:fs.statSync(filePath).size,duration,rms,videoTimeline:inspectVideoTimeline(filePath,duration)};
  const saveDecode=()=>fs.writeFileSync(path.join(OUT,`${stem}-decode.json`),JSON.stringify(result,null,2));
  saveDecode();
  assert.ok(duration >= minDuration && duration <= maxDuration, `decoded audio duration ${duration} outside ${minDuration}–${maxDuration}`);
  assert.ok(rms > 0.025 && rms < 0.5, `export music RMS ${rms} must remain audible with the listening volume at zero`);
  assert.ok(Math.abs(result.videoTimeline.audioMinusVideoEnd)<1.25,`video must continue until the audio ends: delta=${result.videoTimeline.audioMinusVideoEnd}`);
  const frame = seconds => execFileSync(ffmpeg, ['-v','error','-ss',String(seconds),'-i',filePath,'-an','-vf','scale=160:90','-frames:v','1','-pix_fmt','rgb24','-f','rawvideo','pipe:1'], {maxBuffer:1024*1024,windowsHide:true});
  const a = frame(Math.min(0.8, duration / 4)), b = frame(Math.min(2.5, duration * 0.7));
  assert.equal(a.length, 160 * 90 * 3, 'first sampled video frame must decode');
  assert.equal(b.length, a.length, 'second sampled video frame must decode');
  saveSampleFrame(a,`${stem}-frame-a.png`);saveSampleFrame(b,`${stem}-frame-b.png`);
  let sum = 0, variance = 0, difference = 0, highlights = 0;
  for (let index = 0; index < a.length; index++) { sum += a[index]; variance += a[index] ** 2; difference += Math.abs(a[index] - b[index]); if (a[index] > 100) highlights++; }
  const mean = sum / a.length, deviation = Math.sqrt(variance / a.length - mean ** 2);
  // Inspect every encoded frame after the first sample. A slow GPU shader can
  // produce nearly equal frames at two fixed seek points while advancing later.
  const allFrames=execFileSync(ffmpeg,['-v','error','-i',filePath,'-an','-vf','scale=160:90','-fps_mode','passthrough','-enc_time_base','1:30000','-pix_fmt','rgb24','-f','rawvideo','pipe:1'],{maxBuffer:32*1024*1024,windowsHide:true});
  assert.equal(allFrames.length,result.videoTimeline.frameCount*a.length,'every encoded frame must decode');
  let maximumDifference=difference/a.length, changedAt=null;
  let detailFrame={pts:null,mean,deviation,highlights},motionFrame=null;
  for(let index=0;index<result.videoTimeline.frameCount;index++) {
    const pts=result.videoTimeline.frames[index].pts;
    if(pts<Math.min(0.8,duration/4))continue;
    const candidate=allFrames.subarray(index*a.length,(index+1)*a.length);
    let delta=0,total=0,square=0,bright=0;
    for(let pixel=0;pixel<a.length;pixel++) {
      delta+=Math.abs(a[pixel]-candidate[pixel]);total+=candidate[pixel];square+=candidate[pixel]**2;
      if(candidate[pixel]>100)bright++;
    }
    const candidateMean=total/a.length,candidateDeviation=Math.sqrt(square/a.length-candidateMean**2);
    if(candidateDeviation>detailFrame.deviation)detailFrame={pts,mean:candidateMean,deviation:candidateDeviation,highlights:bright};
    if(delta/a.length>maximumDifference) {
      maximumDifference=delta/a.length;changedAt=pts;motionFrame=candidate;
    }
  }
  if(motionFrame)saveSampleFrame(motionFrame,`${stem}-frame-c.png`);
  Object.assign(result,{mean,deviation,detailFrame,frameDifference:maximumDifference,sampledFrameDifference:difference/a.length,changedAt});saveDecode();
  if (mainLyrics) {
    // The fixture uses #f4f4f5 main lyrics. Exclude the bottom subtitle so animated
    // background pixels or translation text cannot stand in for the main words.
    const rgb=execFileSync(ffmpeg,['-v','error','-ss','1.2','-i',filePath,'-an','-frames:v','1','-pix_fmt','rgb24','-f','rawvideo','pipe:1'],{maxBuffer:16*1024*1024,windowsHide:true});
    assert.equal(rgb.length,width*height*3,'main lyric sample must decode at native resolution');
    let white=0;
    for(let offset=0;offset<width*Math.floor(height*0.8)*3;offset+=3) {
      const low=Math.min(rgb[offset],rgb[offset+1],rgb[offset+2]),high=Math.max(rgb[offset],rgb[offset+1],rgb[offset+2]);
      if(low>=200&&high-low<30)white++;
    }
    result.mainLyricPixels=white;saveDecode();
    assert.ok(white>=100,`main lyrics must be visible in the encoded frame, found ${white} near-white pixels`);
  }
  assert.ok(detailFrame.deviation > 6 && detailFrame.highlights > 30, `nonblack visual detail required after the entry animation: ${JSON.stringify(detailFrame)}`);
  assert.ok(maximumDifference > 0.2, `animation/lyric content must advance: maximum difference=${maximumDifference}`);
  if (toneChange) {
    const firstBefore = toneMagnitude(pcm,0.35,0.3,toneChange[0]), firstAfter = toneMagnitude(pcm,0.35,0.3,toneChange[1]);
    const lastBefore = toneMagnitude(pcm,duration-0.45,0.3,toneChange[0]), lastAfter = toneMagnitude(pcm,duration-0.45,0.3,toneChange[1]);
    assert.ok(firstBefore > firstAfter * 4 && firstBefore > 0.01,'the recording must begin with the first song tone');
    assert.ok(lastAfter > lastBefore * 4 && lastAfter > 0.01,'the recording must contain the new song tone after the real audio owner changes');
    result.toneChange = {frequencies:toneChange,firstBefore,firstAfter,lastBefore,lastAfter};
  }
  saveDecode();
  mediaExports.push(result);
  return result;
}

async function decodeRecordedSegment(filePath, width, height, minimum, toneChange) {
  const elapsed = await evaluate('fixture.getState().elapsed');
  assert.ok(elapsed >= minimum, `recording clock ${elapsed} must include the exercised segment`);
  const result = decodeOutput(filePath, width, height, elapsed - 0.5, elapsed + 0.5, toneChange);
  result.recordingElapsed = elapsed;
  fs.writeFileSync(path.join(OUT, `${path.basename(filePath,path.extname(filePath))}-decode.json`), JSON.stringify(result,null,2));
}

async function run() {
  const wav = waveFixture(), longWav = waveFixture(30), nextWav = waveFixture(30,48000,660);
  server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    if (pathname === '/' || pathname === '/index.html') { response.writeHead(200, {'content-type':'text/html; charset=utf-8'}); response.end(HOST_HTML); return; }
    if (pathname === '/fixture.wav') { response.writeHead(200, {'content-type':'audio/wav','content-length':wav.length}); response.end(wav); return; }
    if (pathname === '/fixture-long.wav') { response.writeHead(200, {'content-type':'audio/wav','content-length':longWav.length}); response.end(longWav); return; }
    if (pathname === '/fixture-next.wav') { response.writeHead(200, {'content-type':'audio/wav','content-length':nextWav.length}); response.end(nextWav); return; }
    const target = path.resolve(PUBLIC, `.${pathname}`);
    if (!target.startsWith(PUBLIC + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, {'content-type':mime[path.extname(target)] || 'application/octet-stream'});
    fs.createReadStream(target).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
  app.on('browser-window-created', (_event, win) => {
    const record = {id:win.id,shown:false,exportSurface:false}; created.push(record);
    win.on('show', () => { record.shown = true; });
    win.webContents.on('console-message', (_event, level, message) => {
      if (level >= 2) fs.appendFileSync(path.join(OUT, 'renderer.log'), `${win.id}: ${message}\n`);
    });
    win.webContents.on('render-process-gone', (_event, details) => { failures.push(`renderer ${win.id}: ${details.reason}`); });
    win.webContents.on('dom-ready',()=> {
      if(!new URL(win.webContents.getURL() || 'about:blank').searchParams.has('videoExport'))return;
      record.exportSurface=true;
      void win.webContents.executeJavaScript(`(function(){
        const info=window.__videoExportRafDiagnostic={count:0,startedAt:performance.now(),lastAt:0,maxGap:0};
        const tick=function(at){info.count++;if(info.lastAt)info.maxGap=Math.max(info.maxGap,at-info.lastAt);info.lastAt=at;requestAnimationFrame(tick);};
        requestAnimationFrame(tick);
        const updates=window.__videoExportUpdateDiagnostic={count:0,last:null,samples:[]};
        window.mineradioVideoExport?.onUpdate(function(value){
          updates.count++;updates.last={at:performance.now(),position:value.state?.position,playing:value.state?.playing,trackId:value.state?.currentTrack?.id};
          if(updates.count<=4||updates.count%30===0){updates.samples.push(updates.last);if(updates.samples.length>12)updates.samples.shift();}
        });
      })()`,true).catch(()=>{});
    });
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
  // Install the application's real shared-session policy. Electron's default
  // permissive session hid a production Permission denied regression in 2.6.7.
  const {createWallpaperEngineBridge} = require('../desktop/wallpaper-engine-bridge');
  permissionBridge = createWallpaperEngineBridge({getMainWindow:()=>host,getMainServerPort:()=>port,
    isVideoExportCaptureAllowed:(...args)=>manager.allowsCapturePermission(...args),
    userDataPath:PROFILE,nativeTempPath:path.join(PROFILE,'native')});
  const ses = host.webContents.session;
  const setCheck = ses.setPermissionCheckHandler.bind(ses);
  const setRequest = ses.setPermissionRequestHandler.bind(ses);
  ses.setPermissionCheckHandler = handler => setCheck((contents,permission,origin,details)=> {
    const allowed = handler(contents,permission,origin,details);
    permissionDecisions.push({phase:'check',contentsId:contents?.id,url:contents?.getURL(),permission,origin,details,allowed});
    return allowed;
  });
  ses.setPermissionRequestHandler = handler => setRequest((contents,permission,callback,details)=> {
    handler(contents,permission,allowed=> {
      permissionDecisions.push({phase:'request',contentsId:contents?.id,url:contents?.getURL(),permission,details,allowed}); callback(allowed);
    },details);
  });
  permissionBridge.configureSessionPermissions();
  ses.setPermissionCheckHandler = setCheck;
  ses.setPermissionRequestHandler = setRequest;
  await host.loadURL(`http://127.0.0.1:${port}/index.html`);
  await evaluate('window.fixtureReady');
  const originalBounds = host.getBounds();

  const landscapeStart = await start('landscape-full',1280,720,'classic','from-start');
  assert.ok(permissionDecisions.some(decision=>decision.phase==='request' && decision.allowed
    && decision.permission==='media' && decision.details.mediaTypes?.length===0
    && decision.details.isMainFrame && decision.url.includes('videoExport=')),
  'the real production policy must authorize the current hidden tab capture');
  logCheck('production session policy authorizes only the active export tab capture');
  assert.ok(landscapeStart.playheadAtStart < 1.2, 'whole-song export must restart the song after preparing');
  await until('audio.currentTime>=1.2','landscape first active lyric');
  await until('audio.currentTime>=2.8','landscape second active lyric');
  await until("fixture.getState().status === 'saved'", 'whole-song automatic completion', 45000);
  const landscape = fs.readdirSync(OUT).find(file => /^landscape-full\.(mp4|webm)$/.test(file));
  assert.ok(landscape, 'full-song file must exist');
  decodeOutput(path.join(OUT,landscape),1280,720,6,8.5,undefined,true);
  assert.ok(mediaExports.at(-1).videoTimeline.frameCount > 20, 'native visual frames must reach the real recorder');
  await playerIdentityPreserved();
  logCheck('whole-song landscape export: real Folia lyrics, moving frames, audio and automatic save');

  await start('portrait-segment',720,1280,'fume','current',false,undefined,60);
  await until('audio.currentTime > 1.1', 'portrait first segment');
  await evaluate('audio.pause()');
  await until("fixture.getState().status === 'paused'", 'recording follows host pause');
  await snapshotSurfaces('portrait-paused',true);
  const pausedAt = await evaluate('audio.currentTime');
  await new Promise(resolve => setTimeout(resolve, 700));
  assert.ok(Math.abs(await evaluate('audio.currentTime') - pausedAt) < 0.05);
  await evaluate('audio.play()');
  await until("fixture.getState().status === 'recording' && audio.currentTime > 3.2", 'recording resumes');
  // The default policy keeps recording when the user changes songs or seeks.
  await evaluate("fixtureHandoff('changed-fixture')");
  await until("fixture.getState().status === 'recording' && audio === fixtureNext && audio.currentTime > 1.35",'default recording continues after a real audio-deck handoff and seek');
  assert.equal(await evaluate('fixtureFirst.paused && fixtureSources.length === 2'),true,'only the selected song should play through the existing graph');
  await hiddenTrackBecomes('changed-fixture');
  await snapshotSurfaces('portrait-after-real-track-handoff');
  await until('audio.currentTime>2.8','new song visual frames before stopping');
  await stopWhilePreservingPlayback('portrait');
  const portrait = fs.readdirSync(OUT).find(file => /^portrait-segment\.(mp4|webm)$/.test(file));
  assert.ok(portrait);
  await decodeRecordedSegment(path.join(OUT,portrait),720,1280,3.1,[440,660]);
  await playerIdentityPreserved();
  logCheck('portrait export: pause/resume, continued recording through real 440Hz→660Hz song/deck handoff, updated Folia lyrics and final media chunk');

  await start('landscape-1080-no-lyrics',1920,1080,'fume','current',true,undefined,90);
  await until('audio.currentTime > 5', '1080p visualization-only recording');
  await stopWhilePreservingPlayback('1080p');
  const hd = fs.readdirSync(OUT).find(file => /^landscape-1080-no-lyrics\.(mp4|webm)$/.test(file));
  assert.ok(hd);
  await decodeRecordedSegment(path.join(OUT,hd),1920,1080,1.8);
  await playerIdentityPreserved();
  logCheck('1080p visualization without lyric data remains exportable');

  await start('save-transition',1280,720,'classic','current',false,'save',120);
  await until('audio.currentTime > 1.6','save-on-transition policy records a segment');
  await evaluate("fixtureHandoff('save-policy-next')");
  await until("fixture.getState().status === 'saved'",'explicit save policy finishes before the next song');
  const savedTransition = fs.readdirSync(OUT).find(file=>/^save-transition\.(mp4|webm)$/.test(file));
  assert.ok(savedTransition && fs.statSync(path.join(OUT,savedTransition)).size>2000);
  await decodeRecordedSegment(path.join(OUT,savedTransition),1280,720,1.3);
  await playerIdentityPreserved();
  logCheck('explicit save policy finishes the segment on track change');
  assert.deepEqual([...new Set(frameRateChecks.map(check=>check.targetFrameRate))].sort((a,b)=>a-b),[30,60,90,120]);
  logCheck('all four FPS targets reach production native capture and export decodable audio/video (software GPU does not certify sustained target FPS)');

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
  assert.ok(created.filter(window=>window.exportSurface).length>=4,'real offscreen windows must have been used');
  assert.deepEqual(failures,[]);
  logCheck('sender authorization, hidden-window cleanup and unchanged player bounds');
}

app.whenReady().then(run).then(async()=> {
  fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify({checks,exports:mediaExports,windows:created,failures,permissions:permissionDecisions,surfaces:surfaceSnapshots,fixture:await fixtureSnapshot()},null,2));
  await manager?.dispose(); await permissionBridge?.dispose(); host?.destroy(); await new Promise(resolve=>server.close(resolve)); app.exit(0);
}).catch(async error=> {
  failures.push(error.stack || String(error));
  await snapshotSurfaces('failure');
  fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify({checks,exports:mediaExports,windows:created,failures,permissions:permissionDecisions,surfaces:surfaceSnapshots,fixture:await fixtureSnapshot()},null,2));
  process.stderr.write(`Permission decisions: ${JSON.stringify(permissionDecisions)}\n`);
  process.stderr.write(`${error.stack || error}\n`);
  try { await manager?.dispose(); } catch {} try { await permissionBridge?.dispose(); } catch {} try { host?.destroy(); } catch {} try { server?.close(); } catch {}
  app.exit(1);
});
