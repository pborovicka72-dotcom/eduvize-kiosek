import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const baseline=JSON.parse(fs.readFileSync(new URL('fixtures/layout-preservation.json',import.meta.url),'utf8'));
for(const [path,expected] of Object.entries(baseline.files)){
 const bytes=fs.readFileSync(new URL('../'+path,import.meta.url));
 const actual=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
 assert.equal(actual,expected,path+': existing layout source must not change as part of offline test preparation');
}
console.log('Administration, legacy output and published markup/styles match the unchanged source baseline.');
for(const [path,expected] of Object.entries(baseline.markupWithoutScripts||{})){
 const markup=fs.readFileSync(new URL('../'+path,import.meta.url),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 assert.equal(createHash('sha256').update(markup).digest('hex'),expected,path+': original markup and styles must stay unchanged');
}
