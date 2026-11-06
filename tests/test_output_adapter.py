"""HTTP lifecycle with the real shared registry and immutable assets in isolated SQLite."""
import copy
import json
import os
import sqlite3
import tempfile
import unittest
import uuid
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from eduvize_admin.output_registry import OutputRegistry, Actor, Adapter
from eduvize_admin.output_api import router
from eduvize_admin.output_media import read_asset
from eduvize_kiosk.output_adapter import validate, prepare

class Connection:
    def __init__(self,path):
        self.db=sqlite3.connect(path,timeout=10);self.db.execute('BEGIN IMMEDIATE')
    def execute(self,sql,args=()):
        return self.db.execute('SELECT 1') if 'pg_advisory_xact_lock' in sql else self.db.execute(sql.replace('%s','?'),args)
    def __enter__(self):return self
    def __exit__(self,typ,value,tb):
        self.db.rollback() if typ else self.db.commit()
        self.db.close()

class KioskOutputs(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.connect=lambda:Connection(str(Path(self.tmp.name)/'kiosk.db'))
        if os.getenv('OUTPUT_TEST_DATABASE_URL'):
            import psycopg
            from urllib.parse import urlsplit
            dsn=os.environ['OUTPUT_TEST_DATABASE_URL']
            if urlsplit(dsn).hostname not in ('localhost','127.0.0.1'):raise RuntimeError('Only isolated localhost PostgreSQL tests are allowed')
            schema='kiosk_test_'+uuid.uuid4().hex
            with psycopg.connect(dsn,autocommit=True) as c:c.execute('CREATE SCHEMA '+schema)
            self.connect=lambda:psycopg.connect(dsn,options='-c search_path='+schema)
            def cleanup():
                with psycopg.connect(dsn,autocommit=True) as c:c.execute('DROP SCHEMA '+schema+' CASCADE')
            self.addCleanup(cleanup)
        self.school='a'*32;self.profile='b'*32;self.other='c'*32
        self.file='MIGRATED!opaque_file';self.raw=b'\x89PNG\r\n\x1a\n'+b'test-only-png'
        with self.connect() as c:
            c.execute('CREATE TABLE eduvize_cloud_files_v1 (owner TEXT,id TEXT,content BYTEA,mime TEXT,deleted BOOLEAN,folder BOOLEAN)')
            c.execute('INSERT INTO eduvize_cloud_files_v1 VALUES (%s,%s,%s,%s,FALSE,FALSE)',(self.school,self.file,self.raw,'image/png'))
        self.adapter=Adapter(validate,'/eduvize-kiosek/published.html',prepare,lambda e,r:read_asset(self.connect,e,r))
        self.denied=False
        def entitlement(school,app):
            from eduvize_admin.output_registry import fail
            if self.denied:fail(403,'FORBIDDEN','Test entitlement denied')
        self.theme={'schemaVersion':1,'colors':{k:'#123456' for k in ['background','text','muted','surface','primary','primaryText','secondary','secondaryText','accent','border']},'controls':{'heightPx':40,'radiusPx':8},'cards':{'radiusPx':8},'icons':{'radiusPx':8}}
        self.registry=OutputRegistry(self.connect,{'kiosk':self.adapter},lambda p:self.school if p==self.profile else self.other,'https://test.skola.eduvize.cz',lambda p:self.theme,entitlement)
        def auth(token):
            if token not in ('Bearer test-a','Bearer test-b'):raise HTTPException(401)
            return Actor(self.school if token.endswith('a') else self.other,'test-user',frozenset(['read','create','save','publish','revoke']))
        app=FastAPI();app.include_router(router(self.registry,auth));self.client=TestClient(app)
        self.payload={'title':'Testovací kiosek','pages':[
            {'id':'home','title':'Nabídka','sections':[],'buttons':[{'id':'about','type':'page','label':'O škole','pageId':'about'},{'id':'photo','type':'media','label':'Fotografie','fileId':self.file}]},
            {'id':'about','title':'O škole','sections':[{'title':'Škola','text':'Žluťoučký kůň','imageFileId':self.file}],'buttons':[]}]}
        self.draft={'schemaVersion':1,'payloadVersion':1,'payload':self.payload,'presentation':{'mode':'kiosk','interaction':'interactive','kioskLayout':'menu','geometry':{'registryId':'kiosk-viewport','registryVersion':1,'orientation':'landscape','width':1920,'height':1080}}}
        a=self.call('POST','/api/v1/output-assemblies',{'schemaVersion':1,'appId':'kiosk','profileId':self.profile})
        self.assertEqual(a.status_code,201,a.text)
        body={'schemaVersion':1,'appId':'kiosk','profileId':self.profile,'assemblyId':a.json()['id'],'draft':self.draft}
        o=self.call('POST','/api/v1/outputs',body);self.assertEqual(o.status_code,201,o.text);self.id=o.json()['id']
    def call(self,method,path,body=None,key=None,actor='a'):
        return self.client.request(method,path,json=body,headers={'Authorization':'Bearer test-'+actor,'Idempotency-Key':key or str(uuid.uuid4())})
    def publish(self,revision=0):
        r=self.call('POST',f'/api/v1/outputs/{self.id}/publish',{'expectedRevision':revision});self.assertEqual(r.status_code,200,r.text);return r.json()
    def public(self):return self.client.get(f'/api/public/v1/outputs/{self.id}')
    def test_private_draft_and_pinned_public_snapshot(self):
        self.assertEqual(self.public().status_code,404)
        self.assertEqual(self.call('GET',f'/api/v1/outputs/{self.id}/link').status_code,409)
        self.publish();v=self.public().json();raw=json.dumps(v)
        self.assertNotIn(self.file,raw);self.assertNotIn('imageFileId',raw);self.assertNotIn('fileId',raw)
        self.assertEqual(len(v['media']),1)
        mid=v['payload']['pages'][0]['buttons'][1]['mediaId']
        self.assertEqual(mid,v['payload']['pages'][1]['sections'][0]['imageMediaId'])
        url=v['media'][0]['url'];self.assertEqual(self.client.get(url).content,self.raw)
        with self.connect() as c:c.execute('UPDATE eduvize_cloud_files_v1 SET content=%s,deleted=TRUE',(b'replaced',))
        self.assertEqual(self.client.get(url).content,self.raw)
        self.assertEqual(self.client.get('/o/'+self.id,follow_redirects=False).headers['location'],'/eduvize-kiosek/published.html?edu-output='+self.id)
    def test_failed_publication_keeps_previous_and_rolls_back_pins(self):
        first=self.publish();draft=copy.deepcopy(self.draft)
        draft['payload']['pages'][0]['buttons'].append({'id':'missing','type':'media','label':'Chybí','fileId':'unknown'})
        r=self.call('PUT',f'/api/v1/outputs/{self.id}/draft',{'expectedRevision':1,'draft':draft});self.assertEqual(r.status_code,200,r.text)
        failed=self.call('POST',f'/api/v1/outputs/{self.id}/publish',{'expectedRevision':2});self.assertEqual(failed.status_code,409)
        self.assertEqual(self.public().json()['publishedRevision'],first['publishedRevision'])
        self.assertEqual(self.call('GET',f'/api/v1/outputs/{self.id}/link').json()['url'],first['url'])
    def test_copy_retry_conflict_cross_school_revoke_and_entitlement(self):
        key=str(uuid.uuid4());path=f'/api/v1/outputs/{self.id}/publish';body={'expectedRevision':0}
        pub=self.call('POST',path,body,key).json();self.assertEqual(self.call('POST',path,body,key).json(),pub)
        for _ in range(3):self.assertEqual(self.call('GET',f'/api/v1/outputs/{self.id}/link').json()['url'],pub['url'])
        self.assertEqual(self.call('GET',f'/api/v1/outputs/{self.id}').json()['revision'],1)
        self.assertEqual(self.call('GET',f'/api/v1/outputs/{self.id}',actor='b').status_code,404)
        self.assertEqual(self.call('POST',path,{'expectedRevision':0}).status_code,409)
        self.denied=True;self.assertEqual(self.public().status_code,403);self.denied=False
        url=self.public().json()['media'][0]['url']
        self.assertEqual(self.call('POST',f'/api/v1/outputs/{self.id}/revoke',{'expectedRevision':1}).status_code,200)
        self.assertEqual(self.public().status_code,410);self.assertEqual(self.client.get(url).status_code,410)
    def test_scope_uses_verified_school_not_file_id_or_profile(self):
        with self.connect() as c:c.execute('UPDATE eduvize_cloud_files_v1 SET owner=%s',(self.other,))
        r=self.call('POST',f'/api/v1/outputs/{self.id}/publish',{'expectedRevision':0})
        self.assertEqual(r.status_code,409);self.assertEqual(self.public().status_code,404)
    def test_urls_credentials_child_apps_and_broken_graph_are_rejected(self):
        variants=[]
        for button in [dict(id='app',type='output',label='Dítě',outputId='d'*32),dict(id='web',type='url',label='Web',target='https://x.onrender.com')]:
            p=copy.deepcopy(self.payload);p['pages'][0]['buttons']=[button];variants.append(p)
        for key in ['schoolId','token','profileId']:
            variants.append({**self.payload,key:'private'})
        p=copy.deepcopy(self.payload);p['pages'][0]['buttons'][0]['pageId']='missing';variants.append(p)
        p=copy.deepcopy(self.payload);p['pages'].append(copy.deepcopy(p['pages'][0]));variants.append(p)
        for value in variants:
            with self.subTest(value=value),self.assertRaises((ValidationError,ValueError)):validate(value,{})
    def test_modes_and_kiosk_layout_schema(self):
        for mode in ['web','nsp','kiosk']:
            from eduvize_admin.output_schemas import Presentation
            p={'mode':mode,'interaction':'interactive','geometry':None}
            if mode=='nsp':p['geometry']={'registryId':'nsp-4k','registryVersion':1,'orientation':'landscape','layoutId':2,'segmentId':3}
            if mode=='kiosk':p=self.draft['presentation']
            self.assertEqual(Presentation.model_validate(p).mode,mode)

if __name__=='__main__':unittest.main()
