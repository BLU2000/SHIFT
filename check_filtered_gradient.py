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



source=(root/'Facade-ID_BU_v017.html').read_text(encoding='utf-8');start=source.index('const graphGradientRangeCache=');end=source.index('function mapPhotoColorValues',start);functions=source[start:end]
check=r"""
const beforePhotos=filteredAnalysisPhotos,beforeRecords=records;
try{filteredAnalysisPhotos=[{id:'a'},{id:'b'},{id:'c'}];records={a:{wwrBand:'20%',context:{storeys:'4'},types:[{share:String.fromCharCode(188)}]},b:{wwrBand:'30%',context:{storeys:'6'},types:[{share:String.fromCharCode(189)}]},c:{wwrBand:'40%',context:{storeys:'8'},types:[{share:String.fromCharCode(190)}]}};const graph={type:'bar',attribute:'record.wwrBand',colorStyle:'blue-red'};const colors=['20%','30%','40%'].map(v=>graphColorFor(graph,v));if(colors.join(',')!=='#001482,#ffffff,#ff190f')throw Error('Filtered endpoints not applied: '+colors);const legend=graphColorLegend(graph);if(!legend.includes('20%')||!legend.includes('40%')||legend.includes('100%'))throw Error('Legend uses full collection range');const storeys={...graph,attribute:'context.storeys'};if(graphColorFor(storeys,'4')!=='#001482'||graphColorFor(storeys,'8')!=='#ff190f')throw Error('Storey range not numeric');const fractions={...graph,attribute:'type.share'};if(graphColorFor(fractions,String.fromCharCode(188))!=='#001482'||graphColorFor(fractions,String.fromCharCode(190))!=='#ff190f')throw Error('Fraction range incorrect');filteredAnalysisPhotos=[{id:'b'}];if(graphColorFor(graph,'30%')!=='#ffffff')throw Error('Singleton range incorrect');filteredAnalysisPhotos=[{id:'b'},{id:'c'}];if(graphColorFor(graph,'30%')!=='#001482'||graphColorFor(graph,'40%')!=='#ff190f')throw Error('Refilter did not update endpoints');if(graphColorFor({...graph,colorStyle:'categories'},'30%')!==graphCategoryColor(graphColorDomain(graphColorDefinition(graph)).indexOf('30%')))throw Error('Category palette changed');return 'PASS: filtered min/mid/max, numeric storeys, fractions, updated legend, single-value selection, refiltered range and stable category colors.';}finally{filteredAnalysisPhotos=beforePhotos;records=beforeRecords;}
"""
print(js('new Function('+json.dumps(functions+'\n'+check)+')()'))
