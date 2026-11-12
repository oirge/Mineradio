"""Run the UI regressions against an isolated local server; usable in CI and on Windows."""
import argparse
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--suite', choices=['all', 'visuals', 'portability', 'playback', 'tools', 'translation', 'layout', 'translation-layout'], default='all')
args = parser.parse_args()
scripts = ['verify-upstream-visuals.py', 'verify-folia-rhythm-presets.py', 'verify-folia-preset-portability.py']
if args.suite == 'portability':
    scripts = ['verify-folia-preset-portability.py']
if args.suite == 'playback':
    scripts = ['verify-folia-playback-options.py']
if args.suite == 'tools':
    scripts = ['verify-folia-command-tools.py']
if args.suite == 'translation':
    scripts = ['verify-translation-source-ui.py']
if args.suite == 'layout':
    scripts = ['verify-player-layout.py']
if args.suite == 'translation-layout':
    scripts = ['verify-translation-layout.py']
if args.suite == 'all':
    scripts = ['verify-ui-language.py', 'verify-folia-language.py', 'verify-folia-resilience.py', *scripts]

root = Path(__file__).resolve().parents[1]
output = root / 'artifacts' / 'ui-language'
output.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='mineradio-ui-') as temporary:
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    env = dict(os.environ, PORT=str(port), HOST='127.0.0.1',
               MINERADIO_UPDATE_DIR=str(Path(temporary) / 'updates'),
               MINERADIO_BEAT_CACHE_DIR=str(Path(temporary) / 'beatmaps'))
    # Use this temporary update directory even if the caller has a desktop override.
    env['MINERADIO_UPDATE_DOWNLOAD_DIR'] = str(Path(temporary) / 'updates' / 'downloads')
    env['MINERADIO_PATCH_BACKUP_DIR'] = str(Path(temporary) / 'updates' / 'backups')
    url = f'http://127.0.0.1:{port}'
    with (output / 'browser-server.log').open('w', encoding='utf-8') as log:
        server = subprocess.Popen(['node', 'server.js'], cwd=root, env=env, stdout=log, stderr=log)
        try:
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            for attempt in range(160):
                if server.poll() is not None:
                    raise RuntimeError('UI server exited; see artifacts/ui-language/browser-server.log')
                try:
                    with opener.open(url, timeout=1) as response:
                        if response.status == 200:
                            break
                except OSError:
                    pass
                time.sleep(.25)
            else:
                raise TimeoutError('UI server did not become ready')
            for script in scripts:
                subprocess.run([sys.executable, str(root / 'scripts' / script), '--url', url], cwd=root, check=True, timeout=300)
        finally:
            server.terminate()
            try:
                server.wait(timeout=10)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait(timeout=10)
