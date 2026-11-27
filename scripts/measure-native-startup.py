"""Measure process-cold startup of the unpacked releases on hosted Windows only."""

import argparse
from array import array
from contextlib import contextmanager
import ctypes
from ctypes import wintypes
import json
import math
import os
from pathlib import Path
import socket
import statistics
import struct
import subprocess
import time
from urllib.request import build_opener, ProxyHandler
from uuid import uuid4
import wave
import zlib

from playwright.sync_api import Error as PlaywrightError, sync_playwright


def make_library(folder, songs):
    folder.mkdir()
    audio = folder / 'import.wav'
    rate = 8000
    samples = array('h', (round(3500 * math.sin(math.tau * 440 * sample / rate))
                          for sample in range(rate // 10)))
    with wave.open(str(audio), 'wb') as stream:
        stream.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
        stream.writeframes(samples.tobytes() * 120)

    def png_chunk(kind, payload):
        return (struct.pack('>I', len(payload)) + kind + payload
                + struct.pack('>I', zlib.crc32(kind + payload)))

    library = folder / 'library'
    library.mkdir()
    for first in range(0, songs, 100):
        album = library / f'Album-{first // 100:03d}'
        album.mkdir()
        pixel = bytes((first // 100 % 256, 90, 160))
        pixels = (b'\0' + pixel * 48) * 48
        png = (b'\x89PNG\r\n\x1a\n' + png_chunk(b'IHDR', struct.pack('>IIBBBBB', 48, 48, 8, 2, 0, 0, 0))
               + png_chunk(b'IDAT', zlib.compress(pixels)) + png_chunk(b'IEND', b''))
        (album / 'cover.png').write_bytes(png)
        for index in range(first, min(first + 100, songs)):
            track = album / f'Track-{index:05d}.wav'
            os.link(audio, track)
            track.with_suffix('.lrc').write_text(f'[00:00.00]Track {index}\n[00:04.00]Second line\n', encoding='utf-8')
    return library, audio


def chromium_window_probe():
    user32 = ctypes.WinDLL('user32', use_last_error=True)
    callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    user32.EnumWindows.argtypes = (callback_type, wintypes.LPARAM)
    user32.GetWindowThreadProcessId.argtypes = (wintypes.HWND, ctypes.POINTER(wintypes.DWORD))
    user32.IsWindowVisible.argtypes = (wintypes.HWND,)
    user32.GetClassNameW.argtypes = (wintypes.HWND, wintypes.LPWSTR, ctypes.c_int)
    def visible(pid):
        found = False

        @callback_type
        def inspect(hwnd, _):
            nonlocal found
            owner = wintypes.DWORD()
            user32.GetWindowThreadProcessId(hwnd, ctypes.byref(owner))
            if owner.value == pid and user32.IsWindowVisible(hwnd):
                name = ctypes.create_unicode_buffer(128)
                user32.GetClassNameW(hwnd, name, len(name))
                if name.value.startswith('Chrome_WidgetWin_'):
                    found = True
                    return False
            return True

        user32.EnumWindows(inspect, 0)
        return found

    return visible


def loopback_port():
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        return listener.getsockname()[1]


@contextmanager
def launch(playwright, executable, version, profile, app_port, log_file):
    debug_port = loopback_port()
    while debug_port == app_port:
        debug_port = loopback_port()
    origin = f'http://127.0.0.1:{app_port}'
    debug_url = f'http://127.0.0.1:{debug_port}'
    env = dict(os.environ, MINERADIO_PORT=str(app_port), MINERADIO_INSTANCE_ID=profile,
               MINERADIO_NO_DESKTOP_SHORTCUT='1')
    opener = build_opener(ProxyHandler({}))
    window_visible = chromium_window_probe()
    with log_file.open('wb') as log:
        epoch = time.time_ns() / 1_000_000
        start = time.monotonic()
        process = subprocess.Popen([str(executable), f'--remote-debugging-port={debug_port}',
                                    '--remote-debugging-address=127.0.0.1'], cwd=executable.parent,
                                   env=env, stdout=log, stderr=subprocess.STDOUT)
        browser = None
        try:
            while not window_visible(process.pid):
                if process.poll() is not None or time.monotonic() - start > 45:
                    raise RuntimeError(f'Native player window did not appear (exit={process.poll()})')
                time.sleep(.01)
            timings = {'windowVisibleMs': round((time.monotonic() - start) * 1000, 1)}
            while True:
                try:
                    with opener.open(f'{debug_url}/json/version', timeout=1):
                        break
                except OSError:
                    if process.poll() is not None or time.monotonic() - start > 45:
                        raise RuntimeError('Native player debugger not ready')
                    time.sleep(.025)
            browser = playwright.chromium.connect_over_cdp(debug_url, timeout=15000)
            context = browser.contexts[0]
            page = next((page for page in context.pages if page.url == f'{origin}/'), None)
            if page is None:
                page = context.pages[0] if context.pages else context.wait_for_event('page', timeout=15000)
                page.wait_for_url(f'{origin}/', wait_until='commit', timeout=15000)
            page.set_default_timeout(30000)
            timings.update(read_startup(page, epoch))
            installed = page.evaluate("async () => (await (await fetch('/api/app/version')).json()).version")
            if installed != version:
                raise RuntimeError(f'Unexpected app version: {installed!r} instead of {version}')
            yield page, timings, epoch
            page.evaluate('() => desktopWindow.setCloseToTray(false)')
            try:
                page.evaluate('() => desktopWindow.close()')
            except PlaywrightError as error:
                try:
                    process.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    raise error
            else:
                process.wait(timeout=15)
            if process.returncode != 0:
                raise RuntimeError(f'Native player exited with status {process.returncode}')
        finally:
            if process.poll() is None:
                subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], capture_output=True, timeout=15)
                process.wait(timeout=15)
            if browser and browser.is_connected():
                browser.close()


def read_startup(page, epoch):
    marks = page.wait_for_function("""() => {
      const home = performance.getEntriesByName('mineradio:home-revealed', 'mark')[0];
      const paint = performance.getEntriesByName('first-contentful-paint', 'paint')[0];
      return home && paint && window.desktopWindow && document.querySelector('#play-btn') && {
        navigation: performance.timeOrigin, home: home.startTime, paint: paint.startTime
      };
    }""").json_value()
    navigation = marks['navigation'] - epoch
    return {'navigationMs': round(navigation, 1), 'homeInitializedMs': round(navigation + marks['home'], 1),
            'firstContentfulPaintMs': round(navigation + marks['paint'], 1),
            'homeReadyMs': round(navigation + max(marks['home'], marks['paint']), 1)}


def seed_library(page, folder, songs):
    result = page.evaluate("""async folder => {
      if (!saveLocalLibraryFolderPaths([folder])) return false;
      setPersistentLocalStorageItem('mineradio-visual-guide-seen-v2', '1');
      setPersistentLocalStorageItem('mineradio-auto-playback-v1', 'off');
      return await reloadLocalLibraryFromAllRoots({ autoPlay: false });
    }""", str(folder))
    if not result:
        raise RuntimeError('Synthetic music library did not import')
    page.wait_for_function('count => localLibraryReady && localLibrarySongs.length === count', arg=songs)
    page.wait_for_function("""async ([folder, count]) => {
      const snapshot = await desktopWindow.loadLocalLibraryDb(folder, { index: false });
      return snapshot?.ok && snapshot.audioCount === count && snapshot.indexSavedAt > 0;
    }""", arg=[str(folder), songs], polling=250, timeout=60000)


def playback_probe(page, selector, event, action):
    page.evaluate("""([selector, event]) => {
      document.querySelector(selector).addEventListener(event, () => {
        const audio = window.audio;
        window.__nativeStartupAction = { at: performance.now(), audio, src: audio?.currentSrc, time: audio?.currentTime ?? 0 };
      }, {capture: true, once: true});
    }""", [selector, event])
    action()
    result = page.wait_for_function("""() => {
      const probe = window.__nativeStartupAction;
      const audio = window.audio;
      if (!probe || !audio || audio.paused || audio.error || audio.muted || audio.volume <= 0 || audio.readyState < 2) return false;
      const start = audio === probe.audio && audio.currentSrc === probe.src ? probe.time : 0;
      return audio.currentTime - start >= 0.025 && performance.now() - probe.at;
    }""").json_value()
    return round(result, 1)


def summarize(samples):
    metrics = {}
    for key in samples[0].keys() - {'sample'}:
        values = [sample[key] for sample in samples]
        metrics[key] = {'median': round(statistics.median(values), 1), 'min': min(values), 'max': max(values)}
    return metrics


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--releases', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--songs', type=int, default=5000)
    parser.add_argument('--repeats', type=int, default=6)
    args = parser.parse_args()
    if os.name != 'nt' or os.environ.get('GITHUB_ACTIONS') != 'true' or os.environ.get('RUNNER_ENVIRONMENT') != 'github-hosted':
        parser.error('Native startup measurement is restricted to GitHub-hosted Windows Actions')
    if not 1 <= args.songs <= 10000 or not 1 <= args.repeats <= 20:
        parser.error('Use 1–10,000 songs and 1–20 repetitions')
    versions = ('2.7.9', '2.8.0')
    releases = {version: (args.releases / version / 'Mineradio-oirge.exe').resolve(strict=True) for version in versions}
    args.output.mkdir(parents=True, exist_ok=True)
    folder, audio = make_library(args.releases / 'generated-media', args.songs)
    unique = uuid4().hex[:12]
    profiles = {version: f'bench-{unique}-{version.replace(".", "")}' for version in versions}
    app_ports = {version: loopback_port() for version in versions}
    report = {'songs': args.songs, 'repeats': args.repeats, 'clock': 'ms', 'platform': os.environ.get('ImageOS'),
              'imageVersion': os.environ.get('ImageVersion'), 'passed': False, 'errors': [], 'samples': {
        version: {'freshEmpty': [], 'savedLibrary': []} for version in versions}}
    try:
        with sync_playwright() as playwright:
            for version in versions:
                with launch(playwright, releases[version], version, profiles[version], app_ports[version],
                            args.output / f'{version}-seed.log') as (page, _, _):
                    seed_library(page, folder, args.songs)
            for sample in range(args.repeats):
                for version in versions if sample % 2 == 0 else reversed(versions):
                    for scenario in ('freshEmpty', 'savedLibrary'):
                        profile = f'{profiles[version]}-empty-{sample}' if scenario == 'freshEmpty' else profiles[version]
                        with launch(playwright, releases[version], version, profile, app_ports[version],
                                    args.output / f'{version}-{scenario}-{sample + 1}.log') as (page, metrics, epoch):
                            if scenario == 'freshEmpty':
                                if page.evaluate('() => localLibrarySongs.length || savedLocalLibraryFolderPaths().length'):
                                    raise RuntimeError('Empty profile unexpectedly contains local files')
                                file_input = page.locator('#file-input')
                                metrics['importToPlayingMs'] = playback_probe(
                                    page, '#file-input', 'change', lambda: file_input.set_input_files(audio))
                            else:
                                observed = page.wait_for_function("""count => localLibraryRestoreStarted && localLibraryReady &&
                                    localLibrarySongs.length === count && playQueue.length === count && performance.timeOrigin + performance.now()
                                """, arg=args.songs).json_value()
                                metrics['libraryObservedReadyMs'] = round(observed - epoch, 1)
                                if not page.evaluate('() => !window.audio || audio.paused'):
                                    raise RuntimeError('Audio started without a manual click')
                                metrics['clickToPlayingMs'] = playback_probe(
                                    page, '#play-btn', 'click', page.locator('#play-btn').click)
                            metrics['sample'] = sample + 1
                        report['samples'][version][scenario].append(metrics)
                        print(version, scenario, json.dumps(metrics), flush=True)
        report['passed'] = True
    except Exception as error:
        report['errors'].append(str(error))
        raise
    finally:
        report['summary'] = {version: {scenario: summarize(samples) for scenario, samples in scenarios.items() if samples}
                             for version, scenarios in report['samples'].items()}
        (args.output / 'report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
