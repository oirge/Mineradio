"""Emit only sealed repository secrets; the signing key stays on the cloud runner."""
import base64
import json
import os
from pathlib import Path
from nacl.public import PublicKey, SealedBox

public_key = os.environ.get('MOBILE_SIGNING_PUBLIC_KEY', '')
if not public_key:
    raise SystemExit('Repository signing public key is required for the first build')
box = SealedBox(PublicKey(base64.b64decode(public_key)))
values = {
    'MOBILE_KEYSTORE_BASE64': base64.b64encode(Path(os.environ['MOBILE_KEYSTORE_PATH']).read_bytes()).decode(),
    'MOBILE_KEYSTORE_PASSWORD': os.environ['MOBILE_KEYSTORE_PASSWORD'],
}
payload = {
    'key_id': os.environ['MOBILE_SIGNING_KEY_ID'],
    'secrets': {name: base64.b64encode(box.encrypt(value.encode())).decode() for name, value in values.items()},
}
Path('release/android-signing-sealed.json').write_text(json.dumps(payload), encoding='utf-8')
