#!/usr/bin/env python3
"""Cheap, offline checks for content and the actual GLB payloads."""
import hashlib
import json
import struct
from pathlib import Path
from urllib.parse import urlparse

root = Path(__file__).resolve().parents[1]
for name in ('projects', 'notes', 'papers'):
    data = json.loads((root / 'content' / f'{name}.json').read_text())
    ids = [entry['id'] for entry in data['items']]
    assert len(ids) == len(set(ids)), f'Duplicate id in {name}'
profile = json.loads((root / 'content/profile.json').read_text())
assert all(urlparse(c['url']).scheme == 'https' for c in profile['contacts'])
ui = json.loads((root / 'content/ui.json').read_text())
assert set(ui['zh']) == set(ui['en']), 'Missing interface translation'
exhibits = json.loads((root / 'content/exhibits.json').read_text())
total = 0
for item in exhibits['items']:
    if not item['available']:
        continue
    p = root / item['file']
    b = p.read_bytes()
    magic, version, size = struct.unpack_from('<III', b)
    assert magic == 0x46546C67 and version == 2 and size == len(b), p
    assert len(b) == item['bytes'], f'Incorrect manifest size: {p}'
    length, kind = struct.unpack_from('<II', b, 12)
    assert kind == 0x4E4F534A
    gltf = json.loads(b[20:20 + length])
    assert not any('uri' in buffer for buffer in gltf['buffers']), f'External buffer in {p}'
    assert not any('uri' in image and not image['uri'].startswith('data:') for image in gltf.get('images', [])), p
    total += len(b)
    print(p.name, len(b), 'bytes,', len(gltf.get('animations', [])), 'clips, SHA256', hashlib.sha256(b).hexdigest())
total += sum(p.stat().st_size for p in (root / 'models/nature').glob('*.glb'))
assert total < 2_000_000, 'Model payload exceeds the current budget'
assert 'RobotExpressive.glb' not in (root / 'scripts/gallery.js').read_text()
print('Content, translations and GLB checks passed. Total model payload:', total, 'bytes.')
