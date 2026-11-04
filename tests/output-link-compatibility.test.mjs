import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {Blob} from 'node:buffer';
import {CompressionStream,DecompressionStream} from 'node:stream/web';
import {gzipSync} from 'node:zlib';
const scope={window:{EduvizeOutputModes:{url:(u)=>{u.searchParams.set('edu-link','1');return u;}}},URL,URLSearchParams,TextEncoder,TextDecoder,Response,Blob,CompressionStream,DecompressionStream,Uint8Array,atob,btoa,structuredClone};
vm.runInNewContext(fs.readFileSync(new URL('../kiosk-output-link.js',import.meta.url),'utf8'),scope);
const api=scope.window.EduvizeKioskOutputLink;
let seed=1;const long=Array.from({length:18000},()=>{seed=(seed*1664525+1013904223)>>>0;return String.fromCharCode(32+seed%90);}).join('');
const config={title:'Škola Žďár',pages:[{id:'home',buttons:[{label:'Rodiče',type:'page',target:'parents'}]},{id:'parents',buttons:[],content:{intro:'Úvod',sections:[{text:long}]}}],school:{name:'Testovací škola'},menuLayout:true};
const raw=Buffer.from(JSON.stringify(config));
const zipped=gzipSync(raw).toString('base64url');
const legacy=new URL('https://example.test/index.html?configz='+zipped);
assert.ok(legacy.href.length>2000);
assert.deepEqual(JSON.parse(JSON.stringify(await api.read(legacy))),config);
for(const parameter of ['?config=','#config=']){
 assert.deepEqual(JSON.parse(JSON.stringify(await api.read('https://example.test/index.html'+parameter+raw.toString('base64url')))),config);
}
for(const outputType of ['web','kiosk','nsp']){
 const input={...config,outputType,layoutOrientation:'portrait',layoutStyle:2,layoutBlock:1};
 const before=JSON.stringify(input),url=await api.url(input,'https://example.test/config.html','a'.repeat(32));
 assert.ok(url.href.length>2000);assert.equal(url.searchParams.get('viewMode'),outputType);
 assert.equal(url.searchParams.get('edu-profile'),'a'.repeat(32));
 assert.deepEqual(JSON.parse(JSON.stringify(await api.read(url))),input);
 assert.equal(JSON.stringify(input),before);
}
await assert.rejects(api.read(legacy.href.slice(0,2000)),/neúplný nebo poškozený/);
await assert.rejects(api.read('https://example.test/?config=bad'),/neúplný nebo poškozený/);
assert.equal(await api.read('https://example.test/?viewMode=kiosk'),null);
console.log('Legacy gzip/base64/query/hash, >2000-character snapshots, three modes, school profile, immutability and truncation checks OK');
