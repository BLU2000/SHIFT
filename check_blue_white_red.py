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



function_source="function graphColorFor(graph,value){\n  if(value==null||value===''||['Unknown','Not applicable'].includes(value))return '#777777';\n  const definition=graphColorDefinition(graph),domain=graphColorDomain(definition),index=domain.indexOf(String(value));\n  if(index<0)return '#777777';\n  if(graph.colorStyle==='categories')return graphCategoryColor(index);\n  const ratio=definition.key==='record.wwrBand'?parseFloat(value)/100:['type.windows','type.share'].includes(definition.key)?({'0':0,'¼':.25,'⅓':1/3,'½':.5,'⅔':2/3,'¾':.75,'1':1}[value]):index/Math.max(1,domain.length-1);\n  if(ratio===undefined)return '#777777';\n  if(graph.colorStyle==='blue-red'){const t=Math.max(0,Math.min(1,ratio)),start=t<=.5?[0,20,130]:[255,255,255],end=t<=.5?[255,255,255]:[255,25,15],local=t<=.5?t*2:(t-.5)*2;return '#'+start.map((v,i)=>Math.round(v+(end[i]-v)*local).toString(16).padStart(2,'0')).join('');}\n  const start=[230,239,255],end=[0,87,255];return '#'+start.map((v,i)=>Math.round(v+(end[i]-v)*ratio).toString(16).padStart(2,'0')).join('');\n}\n"
result=js('new Function('+json.dumps("const graphColorDefinition=()=>({key:'record.wwrBand',values:['0%','50%','100%']});const graphColorDomain=d=>d.values;"+function_source+"return ['0%','50%','100%'].map(v=>graphColorFor({colorStyle:'blue-red'},v));")+')()')
assert result==['#001482','#ffffff','#ff190f'],result
print('PASS: dark blue at 0, white at 0.5, bright red at 1.')
