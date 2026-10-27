"""Minimal local Chrome DevTools client, using only the standard library."""
import base64
import json
import os
import pathlib
import socket
import struct
import time
import urllib.request

root = pathlib.Path(__file__).resolve().parent
pages = json.load(urllib.request.urlopen('http://127.0.0.1:9222/json'))
page = next(p for p in pages if p['type'] == 'page')
url = page['webSocketDebuggerUrl']
hostpath = url.split('://', 1)[1]
host, path = hostpath.split('/', 1)
sock = socket.create_connection(('127.0.0.1', 9222), timeout=30)
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

call('Runtime.enable')
call('Page.enable')
call('Emulation.setDeviceMetricsOverride',{'width':1440,'height':1100,'deviceScaleFactor':1,'mobile':False})
call('Page.navigate',{'url':(root/'browser-checks.html').as_uri()})
for i in range(60):
    time.sleep(.25)
    result=call('Runtime.evaluate',{'expression':'document.querySelector("#test-results")?.textContent || document.title','returnByValue':True})
    value=result.get('result',{}).get('result',{}).get('value','')
    if value.startswith(('PASS:','FAIL:','JS ERROR')):break
print(value)
if not value.startswith('PASS:'):raise SystemExit(1)
call('Page.navigate',{'url':(root/'Facade-ID.html').as_uri()})
time.sleep(3)
result=call('Runtime.evaluate',{'expression':'JSON.stringify({photos:photos.length,gpsPhotos:photos.filter(p=>p.location).length,rendered:!!document.querySelector("#next"),imageLoaded:document.querySelector("#mainPhoto")?.naturalWidth,autosave:storageOK,firstLatitude:document.querySelector("#lat")?.value})','returnByValue':True})
print('STANDALONE:',result['result']['result'].get('value'))
result=call('Runtime.evaluate',{'expression':'''(async()=>{
const original=structuredClone(rec());
document.querySelector('#openLocationMap').click();
for(let i=0;i<60;i++){if(locationMap?.isStyleLoaded())break;await new Promise(r=>setTimeout(r,250));}
if(!locationMap||!locationMap.isStyleLoaded())return JSON.stringify({error:'Live map did not load',status:document.querySelector('#locationMapStatus').textContent});
locationMap.fire('click',{lngLat:{lat:48.1501,lng:11.5651},originalEvent:{target:locationMap.getCanvas()}});await saveQueue;
const clicked=rec().location.lat==='48.1501000'&&document.querySelector('#lat').value==='48.1501000';
locationMarker.setLngLat([11.5662,48.1512]);locationMarker.fire('dragend');await saveQueue;
const dragged=rec().location.lat==='48.1512000'&&rec().location.source==='Manual map pin';
const mapPin=[locationMarker.getLngLat().lng,locationMarker.getLngLat().lat];
step=1;render();const removed=locationMap===null;step=0;render();
const reopened=locationMarker&&Math.abs(locationMarker.getLngLat().lat-48.1512)<1e-7;
const vendorEmbedded=!document.querySelector('script[src]')&&!document.querySelector('link[rel=stylesheet]');
records[current]=original;await persist();syncLocationMarker(true);
return JSON.stringify({styleLoaded:true,clicked,dragged,mapPin,removed,reopened:!!reopened,vendorEmbedded});
})()''','awaitPromise':True,'returnByValue':True})
live=result.get('result',{}).get('result',{}).get('value','')
print('LIVE MAP:',live)
if not live or not all(json.loads(live).get(key) for key in ['styleLoaded','clicked','dragged','removed','reopened','vendorEmbedded']):
    print('LIVE MAP DIAGNOSTIC:',json.dumps(result))
    call('Browser.close');raise SystemExit(1)
result=call('Runtime.evaluate',{'expression':'''(async()=>{for(let i=0;i<60;i++){if(locationMap?.loaded()&&locationMap.queryRenderedFeatures().length>0)break;await new Promise(r=>setTimeout(r,250));}document.querySelector('#locationMap').scrollIntoView({block:'center'});return JSON.stringify({renderedFeatures:locationMap?.queryRenderedFeatures().length,status:document.querySelector('#locationMapStatus').textContent});})()''','awaitPromise':True,'returnByValue':True})
tiles=json.loads(result['result']['result']['value'])
print('STREET MAP:',json.dumps(tiles))
if not tiles.get('renderedFeatures'):
    call('Browser.close');raise SystemExit(1)
shot=call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
(root/'preview.png').write_bytes(base64.b64decode(shot['result']['data']))
call('Browser.close')
