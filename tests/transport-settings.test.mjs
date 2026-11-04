import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{},URL};
vm.runInNewContext(fs.readFileSync(new URL('../kiosk-apps.js',import.meta.url),'utf8'),context);
const apps=context.window.EduvizeKioskApps;
for(const [app,target] of Object.entries(apps.urls)){
 const url=apps.resolve({type:'app',target:app});
 assert.equal(url.searchParams.get('viewMode'),'kiosk');assert.equal(url.searchParams.get('output'),'kiosk');
 assert.equal(url.searchParams.get('transport_settings'),app==='transport'?'browser':null);
}
for(const key of ['stops','name']){
 const url=apps.resolve({type:'app',target:'transport',appUrl:apps.urls.transport+'?'+key+'='+encodeURIComponent('Náměstí')+'&custom=x'});
 assert.equal(url.searchParams.get(key),'Náměstí');assert.equal(url.searchParams.has('transport_settings'),false);assert.equal(url.searchParams.get('custom'),'x');
}
console.log('Kiosk routing follows saved transport settings, preserves explicit legacy stops and other applications.');
