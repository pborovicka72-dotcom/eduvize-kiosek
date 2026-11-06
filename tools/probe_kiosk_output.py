"""Explicit test-only HTTP probe. Credentials are read from env and never printed."""
import argparse
import json
import os
import re
import urllib.error
import urllib.request
import uuid

ORIGIN='https://test.skola.eduvize.cz'
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--revoke-output')
    args=parser.parse_args()
    token=os.environ['EDUVIZE_TEST_SESSION']
    profile=os.environ['EDUVIZE_TEST_PROFILE_ID']
    if not re.fullmatch('[a-f0-9]{32}',profile):raise SystemExit('Invalid test profile')
    opener=urllib.request.build_opener(NoRedirect)
    def call(method,path,body=None,key=None,public=False,expected=200):
        if not path.startswith('/') or path.startswith('//'):raise RuntimeError('Invalid probe path')
        headers={'Accept':'application/json','Origin':ORIGIN}
        if not public:headers['Authorization']='Bearer '+token
        if method!='GET':headers.update({'Idempotency-Key':key or str(uuid.uuid4()),'Content-Type':'application/json'})
        request=urllib.request.Request(ORIGIN+path,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method)
        try:
            with opener.open(request,timeout=30) as response:status,raw=response.status,response.read()
        except urllib.error.HTTPError as error:status,raw=error.code,error.read()
        if status!=expected:raise RuntimeError(f'{method} {path}: expected {expected}, got {status}')
        return json.loads(raw) if raw else None
    if args.revoke_output:
        ident=args.revoke_output
        if not re.fullmatch('[a-f0-9]{32}',ident):raise SystemExit('Invalid output ID')
        record=call('GET','/api/v1/outputs/'+ident)
        if record['appId']!='kiosk' or record['profileId']!=profile:raise RuntimeError('Unexpected test output')
        call('POST','/api/v1/outputs/'+ident+'/revoke',{'expectedRevision':record['revision']})
        call('GET','/api/public/v1/outputs/'+ident,public=True,expected=410)
        print(json.dumps({'status':'revoked','id':ident,'productionChanged':False}));return
    payload={'title':'Kiosek — syntetický test','startPage':'home','menuPosition':'left','idleSeconds':20,'pages':[
        {'id':'home','title':'Testovací nabídka','sections':[],'buttons':[{'id':'about','type':'page','label':'O testovací škole','pageId':'about'}]},
        {'id':'about','title':'O testovací škole','sections':[{'title':'Ověřený publikovaný obsah','text':'Žluťoučký kůň. Tento obsah patří pouze do izolovaného testu.'}],'buttons':[]}]}
    draft={'schemaVersion':1,'payloadVersion':1,'payload':payload,'presentation':{
        'mode':'kiosk','interaction':'interactive','kioskLayout':'menu','geometry':{
            'registryId':'kiosk-viewport','registryVersion':1,'orientation':'landscape','width':1920,'height':1080}}}
    assembly=call('POST','/api/v1/output-assemblies',{'schemaVersion':1,'appId':'kiosk','profileId':profile},expected=201)
    record=call('POST','/api/v1/outputs',{'schemaVersion':1,'appId':'kiosk','profileId':profile,'assemblyId':assembly['id'],'draft':draft},expected=201)
    ident=record['id'];path='/api/v1/outputs/'+ident
    call('GET',path+'/link',expected=409)
    call('GET','/api/public/v1/outputs/'+ident,public=True,expected=404)
    key=str(uuid.uuid4());body={'expectedRevision':record['revision']}
    published=call('POST',path+'/publish',body,key)
    if call('POST',path+'/publish',body,key)!=published:raise RuntimeError('Retry changed publication')
    for _ in range(3):
        if call('GET',path+'/link')['url']!=published['url']:raise RuntimeError('Unstable link')
    if call('GET',path)['revision']!=published['revision']:raise RuntimeError('Copy changed revision')
    snapshot=call('GET','/api/public/v1/outputs/'+ident,public=True)
    if snapshot['appId']!='kiosk' or snapshot['payload']['pages'][1]['sections'][0]['title']!='Ověřený publikovaný obsah':raise RuntimeError('Incorrect public content')
    call('GET','/api/public/v1/outputs/'+ident+'/theme',public=True)
    print(json.dumps({'status':'published-for-browser-test','id':ident,'url':published['url'],'productionChanged':False},ensure_ascii=False))

if __name__=='__main__':main()
