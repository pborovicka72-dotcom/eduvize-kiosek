import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const loads=[];
class ImageProbe {set src(url){loads.push(url);Promise.resolve().then(()=>{if(url.includes('/photo?')){this.naturalWidth=640;this.naturalHeight=480;this.onload?.();}else this.onerror?.();});}}
const context={window:{Image:ImageProbe},URL,Map,Promise,setTimeout,clearTimeout,setInterval,clearInterval};
vm.runInNewContext(fs.readFileSync(new URL('../kiosk-apps.js',import.meta.url),'utf8'),context);
const apps=context.window.EduvizeKioskApps,source='https://example.org/photo?id=1';
assert.equal((await apps.resolveForOpen({type:'url',target:source})).searchParams.get('src'),source);
assert.equal(apps.isImageViewer((await apps.resolveForOpen({type:'url',target:source})).href),true);assert.equal(loads.length,1);
assert.equal((await apps.resolveForOpen({type:'url',target:'https://example.org/news'})).href,'https://example.org/news');
const doc=await apps.resolveForOpen({type:'url',target:'https://eduvize-dokumenty-api.onrender.com/display?document=abc'});
assert.equal(doc.hostname,'eduvize-dokumenty-api.onrender.com');assert.equal(doc.searchParams.get('document'),'abc');
assert.equal(await apps.resolveForOpen({type:'url',target:'javascript:alert(1)'}),null);
console.log('Extensionless images use the shared viewer; web links and document links retain their destinations.');
