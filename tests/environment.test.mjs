import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
for(const origin of ['https://test.skola.eduvize.cz','https://skola.eduvize.cz','http://127.0.0.1:8789']){
 const calls=[];
 const context={window:{location:{origin}},URL,AbortController,setTimeout,clearTimeout,
  fetch:async(url,options)=>{calls.push({url,options});return {ok:true,headers:new Headers({'Content-Type':'application/json'}),json:async()=>({ok:true})};}};
 vm.runInNewContext(read('kiosk-environment.js'),context);
 const env=context.window.EduvizeKioskEnvironment;
 assert.equal(env.origin,origin);
 for(const bad of ['https://other.test/api','//other.test/api','/\\other.test/api','relative'])assert.throws(()=>env.url(bad));
 vm.runInNewContext(read('remote-client.js'),context);
 await context.window.EduvizeRemote.request('/join-code',null,{code:'12345678'});
 assert.equal(calls[0].url,origin+'/api/kiosk-remote/join-code');
 assert.equal(calls[0].options.credentials,'omit');
 assert.equal(calls[0].options.cache,'no-store');
}
for(const origin of ['https://test.skola.eduvize.cz.evil.test','https://pborovicka72-dotcom.github.io','https://example.onrender.com']){
 assert.throws(()=>vm.runInNewContext(read('kiosk-environment.js'),{window:{location:{origin}},URL}));
}
for(const page of ['index.html','config.html','remote.html']){
 const html=read(page);
 assert.ok(html.includes('kiosk-environment.js'));
 if(html.includes('remote-client.js'))assert.ok(html.indexOf('kiosk-environment.js')<html.indexOf('remote-client.js'));
 assert.equal(/https:\/\/pborovicka72-dotcom.github.io\/eduvize-styly\/design-system\//.test(html),false);
}
assert.ok(read('remote.js').includes("script.src='qr-reader.js?v=1.4.0'"));
assert.ok(read('qr-reader.js').includes('jsQR'));
assert.ok(read('LICENSE-jsQR.txt').length>1000);
for(const name of ['remote-client.js','kiosk-cloud.js','kiosk-documents.js','kiosk-output-link.js']){
 assert.equal(read(name).includes('onrender.com'),false,name+' must use the deployment origin');
}
console.log('Environment isolation, public capability transport, asset paths and QR packaging passed.');
