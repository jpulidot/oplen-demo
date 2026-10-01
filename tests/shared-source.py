"""Verify real source sharing, cache invalidation and restricted file access."""
import os
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import HTTPError

base = os.environ.get('OPLEN_DEMO_URL', 'http://localhost:8878')
app = Path(os.environ.get('OPLEN_SHARED_APP_ROOT', Path(__file__).resolve().parents[2] / 'app'))

def read(url):
    with urlopen(url) as response:
        return response.read(), response.headers

html, headers = read(base + '/')
assert headers['Cache-Control'] == 'no-store'
assert html.index(b'demo/backend.js') < html.index(b'assets/app.js')
asset, headers = read(base + '/assets/styles.css')
assert asset == (app / 'assets/styles.css').read_bytes()
etag = headers['ETag']
try:
    urlopen(Request(base + '/assets/styles.css', headers={'If-None-Match': etag}))
    raise AssertionError('Expected 304')
except HTTPError as error:
    assert error.code == 304

file = app / 'assets/styles.css'
original = file.read_bytes()
try:
    file.write_bytes(original + b'\n/* shared source test */\n')
    updated, updated_headers = read(base + '/assets/styles.css')
    assert updated == file.read_bytes()
    assert updated_headers['ETag'] != etag
    assert read(base + '/')[0] != html
finally:
    file.write_bytes(original)

for target in ['/asset.php?file=../config.php', '/assets/config.php', '/api/index.php']:
    try:
        urlopen(base + target)
        raise AssertionError(target + ' must not be served')
    except HTTPError as error:
        assert error.code == 404
print('PASS: shared bytes, immediate updates, cache invalidation, no PHP/config/API exposure')
