"""Cache the website's pinned Three.js JS modules for Node-only tests. No browser."""
import json
import pathlib
import posixpath
import re
import tempfile
import urllib.request

root = pathlib.Path(tempfile.gettempdir()) / 'coast-three'
pending = ['build/three.core.js', 'build/three.module.js', 'examples/jsm/loaders/GLTFLoader.js',
           'examples/jsm/geometries/RoundedBoxGeometry.js', 'examples/jsm/utils/SkeletonUtils.js',
           'examples/jsm/utils/BufferGeometryUtils.js', 'examples/jsm/libs/meshopt_decoder.module.js',
           'examples/jsm/math/Capsule.js', 'examples/jsm/math/Octree.js']
seen = set()
while pending:
    name = pending.pop()
    if name in seen:
        continue
    seen.add(name)
    assert len(seen) <= 24 and not name.startswith('../')
    path = root / name
    if not path.exists():
        data = urllib.request.urlopen('https://cdn.jsdelivr.net/npm/three@0.187.0/' + name, timeout=20).read(4_000_001)
        assert len(data) < 4_000_000
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    print(name, path.stat().st_size)
    for dependency in re.findall(r"(?:from\s*|import\s*)['\"]([^'\"]+)['\"]", path.read_text()):
        if dependency.startswith('.'):
            pending.append(posixpath.normpath(posixpath.join(posixpath.dirname(name), dependency)))
root.mkdir(parents=True, exist_ok=True)
(root / 'package.json').write_text(json.dumps({'type': 'module'}))
print('CPU modules ready:', root)
