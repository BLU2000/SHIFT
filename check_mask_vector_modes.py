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


js("current=photos.find(p=>records[p.id]?.wwrSegmentation?.measurement.vector_measurement?.windows.length>0).id;render()")
wait("!!document.querySelector('#mainPhoto')?.closest('.segmentation-widget')")
js("document.querySelector('[data-segmentation-toggle]').click();const range=document.querySelector('.segmentation-controls [type=range]');range.value='100';range.dispatchEvent(new Event('input',{bubbles:true}))")
assert js("document.getElementById('mainPhoto').style.opacity==='0'&&document.querySelector('[data-overlay-kind=mask]').style.opacity==='1'"),'100% still shows original image'
js("(()=>{const mode=document.querySelector('[data-segmentation-mode]');mode.value='vector';mode.dispatchEvent(new Event('change',{bubbles:true}));})()")
wait("(()=>{const image=document.querySelector('[data-overlay-kind=vector]');return image?.complete&&image.naturalWidth>0;})()")
assert js("(()=>{const image=document.querySelector('[data-overlay-kind=vector]'),svg=new DOMParser().parseFromString(decodeURIComponent(image.src.split(',').slice(1).join(',')),'image/svg+xml'),m=records[current].wwrSegmentation.measurement,v=m.vector_measurement,rectangles=svg.querySelectorAll('rect');return rectangles.length===v.windows.length+1&&Math.abs(Number(rectangles[0].getAttribute('x'))-(m.roi_pixels[0]+v.facade[0]*(m.roi_pixels[2]-m.roi_pixels[0])))<.001;})()"),'Reviewed vector geometry or ROI placement incorrect'
js("(()=>{const mode=document.querySelector('[data-segmentation-mode]');mode.value='both';mode.dispatchEvent(new Event('change',{bubbles:true}));})()")
assert js("[...document.querySelectorAll('.segmentation-overlay')].filter(i=>!i.hidden).length===2"),'Combined overlay failed'
js("document.querySelector('[data-segmentation-toggle]').click()")
assert js("document.getElementById('mainPhoto').style.opacity==='1'&&[...document.querySelectorAll('.segmentation-overlay')].every(i=>i.hidden)"),'Original image did not restore'
print('PASS: 100% hides the photo, saved vector rectangles render at the ROI position, mask+vector mode works, and switching off restores the original image.')
