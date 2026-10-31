import base64,json,os,pathlib,socket,struct,time,urllib.request
root=pathlib.Path(__file__).resolve().parent
pages = json.load(urllib.request.urlopen('http://127.0.0.1:9234/json'))
page = next(p for p in pages if p['type'] == 'page')
url = page['webSocketDebuggerUrl']
hostpath = url.split('://', 1)[1]
host, path = hostpath.split('/', 1)
sock = socket.create_connection(('127.0.0.1', 9234), timeout=30)
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
js("analysisSettings.analysisCanvas=[];analysisSettings.analysisCanvasConnections=[];document.getElementById('topAnalysis').click();document.getElementById('canvasAddFilter').click();document.getElementById('canvasAddMap').click();document.getElementById('canvasAddAnalysis').click();")
wait("[...document.querySelectorAll('.canvas-node iframe')].length===3&&[...document.querySelectorAll('.canvas-node iframe')].every(f=>f.contentDocument.querySelector('#analysisMatchCount'))")
assert js("getComputedStyle(document.querySelector('.shell>aside')).display==='none'"),'Outer tagging sidebar still visible'
old=js("parseFloat(document.querySelector('.canvas-node').style.left)")
a=center('.canvas-node-title');drag(a,{'x':a['x']+40,'y':a['y']+30})
assert js("parseFloat(document.querySelector('.canvas-node').style.left)")>old,'Title did not drag'
drag(center('.canvas-node:nth-of-type(1) .canvas-output'),center('.canvas-node:nth-of-type(2) .canvas-input'))
wait("document.querySelectorAll('#canvasConnections path').length===1")
drag(center('.canvas-node:nth-of-type(1) .canvas-output'),center('.canvas-node:nth-of-type(3) .canvas-input'))
wait("document.querySelectorAll('#canvasConnections path').length===2")
js("document.querySelector('.canvas-node iframe').contentWindow.eval(\"analysisFilters.search='__no_photo_matches_this__';updateFilteredAnalysis();persist();\")")
wait("[...document.querySelectorAll('.canvas-node iframe')].slice(1).every(f=>f.contentWindow.eval('photos.length')===0)")
old=js("document.getElementById('canvasZoomLabel').textContent")
js("document.getElementById('canvasZoomIn').click()")
assert js("document.getElementById('canvasZoomLabel').textContent")!=old,'Zoom did not change'
assert js("document.querySelectorAll('#canvasConnections path').length===2")

oldWidth=js("parseFloat(document.querySelector('.canvas-node').style.width)")
a=center('.canvas-resize-grip');drag(a,{'x':a['x']+35,'y':a['y']+25})
assert js("parseFloat(document.querySelector('.canvas-node').style.width)")>oldWidth,'Resize grip did not work'
assert js("(()=>{const f=document.querySelectorAll('.canvas-node iframe')[1];const panel=f.contentDocument.querySelector('#mapPolygonPanel');return !panel||f.contentWindow.getComputedStyle(panel).display==='none';})()"),'Map still shows tagging controls'
js("document.getElementById('canvasFit').click()")
a=js("(()=>{const r=document.querySelector('.canvas-viewport').getBoundingClientRect();return {x:r.left+200,y:r.bottom-70};})()")
oldScroll=js("document.querySelector('.canvas-viewport').scrollLeft")
drag(a,{'x':a['x']-80,'y':a['y']-30})
assert js("document.querySelector('.canvas-viewport').scrollLeft")>oldScroll,'Blank canvas did not pan'
js("document.getElementById('canvasFit').click()")
image=call('Page.captureScreenshot',{'format':'png'})['result']['data'];(root/'analysis-canvas-interaction.png').write_bytes(base64.b64decode(image))
print('PASS: real mouse title dragging, drag-to-connect fan-out, downstream filtering, zoom, visible sockets, and no tagging sidebar.')
