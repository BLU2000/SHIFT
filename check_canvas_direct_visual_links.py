import base64,json,os,pathlib,socket,struct,time,urllib.request
root=pathlib.Path(__file__).resolve().parent
pages = json.load(urllib.request.urlopen('http://127.0.0.1:9239/json'))
page = next(p for p in pages if p['type'] == 'page')
url = page['webSocketDebuggerUrl']
hostpath = url.split('://', 1)[1]
host, path = hostpath.split('/', 1)
sock = socket.create_connection(('127.0.0.1', 9239), timeout=30)
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
call('Page.navigate',{'url':(root/'Facade-ID_BU_v017.html').as_uri()})
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

wait("!!document.querySelector('#priorityStoreys')")
js("analysisSettings.analysisCanvas=[];analysisSettings.analysisCanvasConnections=[];document.getElementById('topAnalysis').click();")
wait("document.querySelectorAll('.canvas-node iframe').length===4&&[...document.querySelectorAll('.canvas-node iframe')].every(f=>f.contentDocument.querySelector('#analysisMatchCount'))")
wait("document.querySelectorAll('#canvasConnections path').length===3")
assert js("document.querySelector('.canvas-node[data-kind=data] iframe').contentDocument.querySelectorAll('.canvas-data-list>details').length===photos.length"),'Data does not list all images'
assert js("[...document.querySelectorAll('.canvas-node iframe')].every(f=>f.contentWindow.eval('photos.length')===photos.length)"),'Starter flow is empty'


js("document.getElementById('canvasAddMap').click()")
wait("document.querySelectorAll('.canvas-node[data-kind=map] iframe').length===2&&[...document.querySelectorAll('.canvas-node[data-kind=map] iframe')].every(f=>f.contentDocument.querySelector('#analysisMatchCount'))")
js("document.querySelector('.canvas-node[data-kind=map] .canvas-output').click();document.querySelector('.canvas-node[data-kind=analysis] .canvas-input').click();document.querySelector('.canvas-node[data-kind=analysis] .canvas-output').click();document.querySelectorAll('.canvas-node[data-kind=map] .canvas-input')[1].click();")
js("document.querySelector('.canvas-node[data-kind=map] iframe').contentWindow.eval(\"const attr=document.getElementById('canvasMapAttribute');attr.value='context.storeys';attr.dispatchEvent(new Event('change',{bubbles:true}));const palette=document.querySelector('[data-graph-color-style]');palette.value='blue-red';palette.dispatchEvent(new Event('change',{bubbles:true}));\")")
wait("document.querySelector('.canvas-node[data-kind=analysis] iframe').contentWindow.eval(\"analysisFilters.graphs[0].attribute==='context.storeys'&&analysisFilters.graphs[0].colorStyle==='blue-red'\")")
time.sleep(.5)
assert js("document.querySelectorAll('.canvas-node[data-kind=map] iframe')[1].contentWindow.eval(\"analysisFilters.graphs[0].attribute==='record.wwrBand'\")"),'Settings leaked through an indirect connection'
js("document.querySelector('.canvas-node[data-kind=analysis] iframe').contentWindow.eval(\"const attr=document.querySelector('[data-distribution-attribute]');attr.value='context.orientation';attr.dispatchEvent(new Event('change',{bubbles:true}));\")")
wait("[...document.querySelectorAll('.canvas-node[data-kind=map] iframe')].every(f=>f.contentWindow.eval(\"analysisFilters.graphs[0].attribute==='context.orientation'\"))")
js("[...document.querySelectorAll('#canvasConnections path')].find(p=>p.querySelector('title').textContent.includes('Map to Graph')).dispatchEvent(new MouseEvent('click'));document.querySelector('.canvas-node[data-kind=filter] .canvas-output').click();document.querySelector('.canvas-node[data-kind=analysis] .canvas-input').click();")
js("document.querySelector('.canvas-node[data-kind=analysis] iframe').contentWindow.eval(\"const attr=document.querySelector('[data-distribution-attribute]');attr.value='record.wwrBand';attr.dispatchEvent(new Event('change',{bubbles:true}));\")")
wait("document.querySelectorAll('.canvas-node[data-kind=map] iframe')[1].contentWindow.eval(\"analysisFilters.graphs[0].attribute==='record.wwrBand'\")")
time.sleep(.5)
assert js("document.querySelector('.canvas-node[data-kind=map] iframe').contentWindow.eval(\"analysisFilters.graphs[0].attribute==='context.orientation'\")"),'Shared filter incorrectly linked map and graph settings'
print('PASS: direct Map/Graph sync in both directions; no sync through indirect chains; shared-filter siblings stay independent; disconnect stops syncing immediately.')
