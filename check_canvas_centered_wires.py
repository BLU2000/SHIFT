import base64,json,os,pathlib,socket,struct,time,urllib.request
root=pathlib.Path(__file__).resolve().parent
pages = json.load(urllib.request.urlopen('http://127.0.0.1:9246/json'))
page = next(p for p in pages if p['type'] == 'page')
url = page['webSocketDebuggerUrl']
hostpath = url.split('://', 1)[1]
host, path = hostpath.split('/', 1)
sock = socket.create_connection(('127.0.0.1', 9246), timeout=30)
sock.sendall((f'GET /{path} HTTP/1.1\r\nHost: {host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: '+base64.b64encode(os.urandom(16)).decode()+'\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
reply = b''
while not reply.endswith(b'\r\n\r\n'): reply += sock.recv(1)
assert b'101' in reply, reply
seq = 0
def take(n):
    out=b''
    while len(out)<n:
        part=sock.recv(n-len(out))
        if not part: raise EOFError()
        out+=part
    return out
def call(method, params=None):
    global seq
    seq += 1
    raw=json.dumps({'id':seq,'method':method,'params':params or {}}).encode()
    mask=os.urandom(4); n=len(raw)
    header=bytes([0x81,0x80|n]) if n<126 else bytes([0x81,0x80|126])+struct.pack('!H',n) if n<65536 else bytes([0x81,0x80|127])+struct.pack('!Q',n)
    sock.sendall(header+mask+bytes(v^mask[i%4] for i,v in enumerate(raw)))
    while True:
        a,b=take(2); n=b&127
        if n==126:n=struct.unpack('!H',take(2))[0]
        if n==127:n=struct.unpack('!Q',take(8))[0]
        masking=take(4) if b&128 else None
        data=take(n)
        if masking:data=bytes(v^masking[i%4] for i,v in enumerate(data))
        if a&15==8:raise EOFError()
        result=json.loads(data)
        if result.get('method')=='Runtime.exceptionThrown': print('BROWSER ERROR',json.dumps(result))
        if result.get('id')==seq:return result


call('Runtime.enable');call('Page.enable')
call('Emulation.setDeviceMetricsOverride',{'width':1600,'height':1100,'deviceScaleFactor':1,'mobile':False})

def js(expression):
 r=call('Runtime.evaluate',{'expression':expression,'returnByValue':True})['result']
 if 'exceptionDetails' in r:raise RuntimeError(str(r['exceptionDetails']))
 return r.get('result',{}).get('value')
def wait(expression):
 for _ in range(100):
  if js(expression):return
  time.sleep(.2)
 raise AssertionError('Timed out: '+expression)
def center(selector):return js("(()=>{const r=document.querySelector("+json.dumps(selector)+").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()")
def drag(start,end):
 call('Input.dispatchMouseEvent',{'type':'mouseMoved',**start})
 call('Input.dispatchMouseEvent',{'type':'mousePressed',**start,'button':'left','clickCount':1})
 for step in range(1,13):call('Input.dispatchMouseEvent',{'type':'mouseMoved','x':start['x']+(end['x']-start['x'])*step/12,'y':start['y']+(end['y']-start['y'])*step/12,'button':'left','buttons':1})
 call('Input.dispatchMouseEvent',{'type':'mouseReleased',**end,'button':'left','clickCount':1});time.sleep(.3)


source=(root/'analysis-canvas-v017.js').read_text(encoding='utf-8');style=(root/'analysis-canvas-v017.css').read_text(encoding='utf-8')
js("window.releaseCanvasModules?.();document.getElementById('analysis-canvas-v017').textContent="+json.dumps(source)+";document.getElementById('analysis-canvas-v017-style').textContent="+json.dumps(style)+";new Function("+json.dumps(source)+")();view='insights';renderInsights();document.getElementById('canvasFit').click();")
wait("document.querySelectorAll('.canvas-node iframe').length>=4&&[...document.querySelectorAll('.canvas-node iframe')].every(f=>f.contentDocument.querySelector('#analysisMatchCount'))")
assert js("[...document.querySelectorAll('.canvas-node')].every(n=>{const node=n.getBoundingClientRect();return [...n.querySelectorAll('.canvas-port')].filter(p=>getComputedStyle(p).display!=='none').every(p=>{const r=p.getBoundingClientRect();return Math.abs((r.top+r.height/2)-(node.top+node.height/2))<1;});})"),'Sockets are not at module midpoints'
assert js("[...document.querySelectorAll('.canvas-node .canvas-output')].every(p=>{const r=p.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===p;})"),'Wire blocks socket interaction'
assert js("[...document.querySelectorAll('#canvasConnections path')].some(path=>{const p=path.getPointAtLength(path.getTotalLength()/2),screen=new DOMPoint(p.x,p.y).matrixTransform(path.getScreenCTM());return document.elementFromPoint(screen.x,screen.y)===path;})"),'Wires are not visible/hit-testable above canvas'
assert js("[...document.querySelectorAll('#canvasConnections path')].every(p=>p.getAttribute('vector-effect')==='non-scaling-stroke')"),'Wire thickness shrinks on zoom'
samples=js("[...document.querySelectorAll('#canvasConnections path')].flatMap(path=>[.2,.4,.6,.8].map(t=>{const p=path.getPointAtLength(path.getTotalLength()*t),q=new DOMPoint(p.x,p.y).matrixTransform(path.getScreenCTM());return {x:q.x,y:q.y};}))")
image=call('Page.captureScreenshot',{'format':'png'})['result']['data'];(root/'analysis-canvas-centered-wires.png').write_bytes(base64.b64decode(image))
print('PASS: all sockets vertically centered; wires visible and clickable; sockets remain unobstructed; wire thickness survives zoom.')

from PIL import Image
from io import BytesIO
pixels=Image.open(BytesIO(base64.b64decode(image))).convert('RGB')
visible=0
for point in samples:
 x,y=round(point['x']),round(point['y'])
 if 0<=x<pixels.width and 0<=y<pixels.height:
  r,g,b=pixels.getpixel((x,y));visible+=int(b>180 and r<80 and g<160)
assert visible>0,'Wire geometry exists but no blue pixels are painted'
print('PASS: actual blue wire pixels are visible in the screenshot.')
