"""Short-lived stdlib HTTP check; no browser, GPU or third-party dependency."""
import pathlib
import socket
import subprocess
import sys
import time
import urllib.request

root = pathlib.Path(__file__).resolve().parents[1]
with socket.socket() as probe:
    probe.bind(('127.0.0.1', 0))
    port = probe.getsockname()[1]
server = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1'], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    base = f'http://127.0.0.1:{port}/'
    for _ in range(30):
        try:
            urllib.request.urlopen(base, timeout=.2).close()
            break
        except OSError:
            time.sleep(.05)
    paths = ['index.html', 'credits.html', 'styles/gallery.css', 'scripts/content.js', 'scripts/gallery.js',
             'scripts/coast.js', 'scripts/physics.js', 'scripts/keyboard.js', 'scripts/render-policy.js',
             'content/profile.json', 'content/projects.json', 'content/notes.json', 'content/papers.json',
             'content/ui.json', 'content/exhibits.json', 'models/exhibits/mech.glb',
             'models/exhibits/robot-arm.glb', 'models/exhibits/companion.glb', 'models/nature/tree_oak.glb', 'models/nature/rock_small.glb']
    for path in paths:
        with urllib.request.urlopen(base+path, timeout=1) as response:
            assert response.status == 200, path
            body = response.read()
            if path.endswith('.glb'):
                assert body[:4] == b'glTF', path
    print('Static HTTP checks passed:', len(paths), 'resources. No browser/GPU used.')
finally:
    server.terminate()
    try:
        server.wait(timeout=2)
    except subprocess.TimeoutExpired:
        server.kill()
        server.wait()
