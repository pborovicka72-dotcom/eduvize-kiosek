import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const scope={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../kiosk-config-file.js',import.meta.url),'utf8'),scope);
const format=scope.window.EduvizeKioskConfigFile;
const original={tileCount:10,logoUrl:'https://example.org/logo.svg',showInfoPanel:true,showLogo:false,tileColumns:4,tileRows:3,title:'Škola Žďár',idleSeconds:60,school:{name:'Základní škola'},pages:[{id:'home',title:'Nabídka',buttons:[{type:'page',label:'Rodiče',target:'parents'}]},{id:'parents',title:'Pro rodiče',buttons:[{type:'document',target:'https://example.org/file.pdf',label:'Formulář'}],content:{intro:'Úvod',sections:[{title:'Kontakty',text:'Text\ns diakritikou'}]}}]};
assert.deepEqual(JSON.parse(JSON.stringify(format.parse(format.stringify(original)))),original);
assert.equal(format.parse(JSON.stringify(original)).pages.length,2);
assert.throws(()=>format.parse('{'));
assert.throws(()=>format.parse(JSON.stringify({pages:[]})));
assert.throws(()=>format.parse(JSON.stringify({format:'eduvize-kiosk',version:999,config:original})));
assert.throws(()=>format.parse('{"__proto__":{},"pages":[]}'));
assert.throws(()=>format.parse('x'.repeat(2*1024*1024+1)));
assert.throws(()=>format.parse(JSON.stringify({pages:[{id:'home',buttons:[],content:{sections:[{text:42}]}}]})));
assert.equal(format.parse(format.stringify({...original,token:'must-not-export'})).token,undefined);
console.log('Configuration JSON roundtrip, legacy import, invalid files and credential exclusion passed.');

assert.throws(()=>format.parse(format.stringify({...original,logoUrl:'javascript:alert(1)'})));

assert.throws(()=>format.stringify({...original,tileCount:26}));
assert.throws(()=>format.stringify({...original,tileCount:9.5}));
