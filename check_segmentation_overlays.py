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

assert js('Object.keys(embedded.segmentationMasks).length===202'),'Masks not embedded'
wait("!!document.querySelector('#mainPhoto')?.closest('.segmentation-widget')")
js("document.querySelector('#mainPhoto').closest('.segmentation-widget').querySelector('[data-segmentation-toggle]').click()")
wait("(()=>{const img=document.querySelector('.segmentation-overlay');return img?.complete&&img.naturalWidth>0;})()")
assert js("(()=>{const a=document.getElementById('mainPhoto'),b=document.querySelector('.segmentation-overlay');return Math.abs(a.naturalWidth/a.naturalHeight-b.naturalWidth/b.naturalHeight)<.01;})()"),'Mask/image aspect ratios differ'
js("const slider=document.querySelector('.segmentation-controls [type=range]');slider.value='70';slider.dispatchEvent(new Event('input',{bubbles:true}))")
assert js("document.querySelector('.segmentation-overlay').style.opacity==='0.7'"),'Opacity slider failed'
assert js('Object.keys(payload().segmentationMasks).length===202'),'Masks lost from saved/exported payload'
js("document.getElementById('topGallery').click()")
wait("document.querySelectorAll('.facade-gallery-card').length>0")
js("document.querySelector('.facade-gallery-card').click()")
wait("!!document.querySelector('#galleryPreview [data-segmentation-toggle]')")
js("document.querySelector('#galleryPreview [data-segmentation-toggle]').click()")
assert js("!!document.querySelector('#galleryPreview .segmentation-overlay')"),'Gallery overlay missing'
js("document.getElementById('galleryPreview').close();analysisSettings.analysisCanvas=[];analysisSettings.analysisCanvasConnections=[];analysisSettings.analysisCanvasGroups=[];document.getElementById('topAnalysis').click();document.getElementById('canvasAddPreview').click();")
wait("!!document.querySelector('.canvas-node[data-kind=preview] iframe')?.contentDocument.querySelector('.canvas-tool-preview')")
js("document.querySelector('.canvas-node[data-kind=preview] iframe').contentWindow.showCanvasProfiles(photos.slice(0,2).map(p=>p.id))")
wait("document.querySelector('.canvas-node[data-kind=preview] iframe').contentDocument.querySelectorAll('[data-segmentation-toggle]').length===2")
js("document.querySelector('.canvas-node[data-kind=preview] iframe').contentDocument.querySelector('[data-segmentation-toggle]').click()")
wait("(()=>{const img=document.querySelector('.canvas-node[data-kind=preview] iframe').contentDocument.querySelector('.segmentation-overlay');return img?.complete&&img.naturalWidth>0;})()")
assert js("document.querySelector('.canvas-node[data-kind=preview] iframe').contentDocument.querySelector('.segmentation-overlay').src.startsWith('blob:')"),'Canvas mask asset not shared'
assert js("[...document.querySelectorAll('.canvas-node iframe')].every(f=>f.srcdoc.length<3000000)"),'Large masks copied into each module document'
print('PASS: all 202 masks embedded; tagging, gallery and canvas overlays load; opacity and alignment checked; saved payload retains masks; canvas shares blob assets.')
