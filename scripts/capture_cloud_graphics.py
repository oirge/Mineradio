"""Read live cloud-emulator worker settings without changing rendering or input."""
import json
import subprocess
from collections import Counter
from pathlib import Path


def capture_process(pid):
    """Expose only the graphics setting and thread names, never the environment."""
    process = Path('/proc') / pid
    record = {'pid': int(pid)}
    try:
        environment = process.joinpath('environ').read_bytes().split(b'\0')
        record['lpNumThreads'] = next((entry.split(b'=', 1)[1].decode()
            for entry in environment if entry.startswith(b'LP_NUM_THREADS=')), None)
        names = []
        for task in process.joinpath('task').iterdir():
            try:
                names.append(task.joinpath('comm').read_text().strip())
            except OSError:
                pass
        record['threadNames'] = dict(Counter(names))
    except OSError as error:
        record['diagnosticError'] = str(error)
    return record


result = subprocess.run(['pgrep', '-f', 'qemu-system-x86_64'],
    text=True, capture_output=True, check=False)
records = [capture_process(pid) for pid in result.stdout.split() if pid.isdigit()]
target = Path('output/playwright/mobile/cloud-emulator-graphics.json')
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(records, indent=2) + '\n', encoding='utf-8')
