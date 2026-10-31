"""Drive a local headless Chrome debugging session using only Python's standard library."""
import base64
import json
import os
from pathlib import Path
import socket
import struct
import time
import urllib.request

pages = json.load(urllib.request.urlopen('http://127.0.0.1:9223/json'))
page = next(p for p in pages if p['type'] == 'page')
host, path = page['webSocketDebuggerUrl'].split('://', 1)[1].split('/', 1)
sock = socket.create_connection(('127.0.0.1', 9223), timeout=40)
sock.sendall((f'GET /{path} HTTP/1.1\r\nHost: {host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ' + base64.b64encode(os.urandom(16)).decode() + '\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
reply = b''
while not reply.endswith(b'\r\n\r\n'):
    reply += sock.recv(1)
assert b'101' in reply, reply
seq = 0


def take(n):
    value = b''
    while len(value) < n:
        chunk = sock.recv(n-len(value))
        if not chunk:
            raise EOFError()
        value += chunk
    return value


def call(method, params=None):
    global seq
    seq += 1
    raw = json.dumps({'id': seq, 'method': method, 'params': params or {}}).encode()
    mask = os.urandom(4)
    n = len(raw)
    header = bytes([0x81, 0x80 | n]) if n < 126 else bytes([0x81, 0x80 | 126]) + struct.pack('!H', n)
    sock.sendall(header + mask + bytes(value ^ mask[i % 4] for i, value in enumerate(raw)))
    while True:
        a, b = take(2)
        n = b & 127
        if n == 126:
            n = struct.unpack('!H', take(2))[0]
        if n == 127:
            n = struct.unpack('!Q', take(8))[0]
        data = take(n)
        result = json.loads(data)
        if result.get('id') == seq:
            return result


call('Page.enable')
call('Emulation.setDeviceMetricsOverride', {'width': 1400, 'height': 1050, 'deviceScaleFactor': 1, 'mobile': False})
call('Page.navigate', {'url': os.environ.get('WWR_TEST_URL', 'http://127.0.0.1:8766') + '/tests/interactive-checks.html'})
value = 'RUNNING'
for _ in range(100):
    time.sleep(.3)
    response = call('Runtime.evaluate', {'expression': 'document.getElementById("result")?.textContent', 'returnByValue': True})
    value = response.get('result', {}).get('result', {}).get('value', 'RUNNING')
    if value and value.startswith(('PASS:', 'FAIL:')):
        break
print(value)
Path(__file__).resolve().parents[1].joinpath('results', 'interactive-browser-checks.txt').write_text(str(value), encoding='utf-8')
call('Browser.close')
assert value.startswith('PASS:'), value
