import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{},URL};
vm.runInNewContext(fs.readFileSync(new URL('../kiosk-apps.js',import.meta.url),'utf8'),context);
const apps=context.window.EduvizeKioskApps;

for(const [path,app] of Object.entries({'/eduvize-skolni-kalendar/index.html':'school-calendar','/pocasi/display':'weather','/aktuality/':'news','/jidelnicek/index.html':'menu','/skolni-systemy/index.html':'school-systems','/prubeh-dne/index.html':'day-progress','/display':'documents','/eduvize-styly/fotogalerie/index.html':'gallery'})){
 for(const host of ['skola.eduvize.cz','test.skola.eduvize.cz'])assert.equal(apps.identify('https://'+host+path),app);
}
assert.equal(apps.identify('https://skola.eduvize.cz.evil.test/pocasi/display'),null);
const file=apps.resolve({type:'url',target:'https://test.skola.eduvize.cz/api/documents/test-id/file?edu-profile='+ 'a'.repeat(32)+'&future=one&future=two#part'});
assert.equal(file.searchParams.get('document'),'test-id');assert.equal(file.searchParams.get('edu-profile'),'a'.repeat(32));assert.equal(file.searchParams.getAll('future').join(','),'one,two');assert.equal(file.hash,'#part');
console.log('Single-host kiosk recognition and document profile/parameter preservation OK.');

const calendar=apps.resolve({type:'app',target:'school-calendar',appUrl:'https://test.skola.eduvize.cz/eduvize-skolni-kalendar/?type=ZS&district=Praha+1+a%C5%BE+5&categories=school'});assert.equal(calendar.pathname,'/eduvize-skolni-kalendar/');assert.equal(calendar.searchParams.get('viewMode'),'kiosk');assert.equal(calendar.searchParams.get('type'),'ZS');assert.equal(calendar.searchParams.get('interaction'),'interactive');
