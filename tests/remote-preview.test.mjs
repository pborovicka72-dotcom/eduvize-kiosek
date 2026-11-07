import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../kiosk-remote.js',import.meta.url),'utf8');
function fixture(preview,enabled=true){
 const events={},nodes=[];let calls=0;
 const panel={append(node){nodes.push(node);},clientHeight:160,clientWidth:900};
 function element(tag){return {tag,hidden:false,style:{},children:[],classList:{add(){},toggle(){}},setAttribute(){},append(...children){this.children.push(...children);}};}
 const window={EduvizeKioskRemoteAdapter:{preview:()=>preview,previewEnabled:()=>enabled,enabled:()=>!preview&&enabled,snapshot:()=>({items:[]})},EduvizeRemote:{revision:()=>'',request:()=>{calls++;return new Promise(()=>{});}},addEventListener(name,fn){(events[name]??=[]).push(fn);}};
 vm.runInNewContext(source,{window,document:{createElement:element,getElementById:()=>panel},ResizeObserver:class{constructor(fn){this.fn=fn;}observe(){this.fn();}},URL,setTimeout,Date});
 return {nodes,get calls(){return calls;},toggle(value){enabled=value;(events['eduvize-kiosk-remote-update']||[]).forEach(fn=>fn());}};
}
const p=fixture(true);
assert.equal(p.nodes.length,1);const host=p.nodes[0],img=host.children[0];
assert.equal(img.src,'remote-preview.svg');assert.equal(img.hidden,false);
assert.match(img.alt,/Ukázka/);assert.equal(p.calls,0);
const previewDetails=host.children[1];assert.match(previewDetails.children[0].textContent,/ukázka/);assert.match(previewDetails.children[1].textContent,/Ukázkový kód/);assert.match(previewDetails.children[2].textContent,/nejsou aktivní/);assert.match(previewDetails.children[2].textContent,/otevřete výstup/);
p.toggle(false);assert.equal(host.hidden,true);assert.equal(img.hidden,true);
p.toggle(true);assert.equal(host.hidden,false);assert.equal(img.hidden,false);assert.equal(p.calls,0);
assert.equal(fixture(true,false).nodes[0].hidden,true);
assert.equal(fixture(false,false).nodes.length,0);
assert.equal(fixture(false,true).calls,1);
console.log('QR preview: visible, disabled/enabled live, no pairing calls; live output still starts pairing.');
