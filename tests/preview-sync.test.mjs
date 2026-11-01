import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../config.html',import.meta.url),'utf8');
const start=html.indexOf('function resetPreviewToHome()');
const end=html.indexOf("window.addEventListener('message',e=>",start);
const sent=[],frame={contentWindow:{postMessage:m=>sent.push(m)}};
const controls={subtitle:{value:'School'},showInfoPanel:{checked:true},tileCount:{value:'10'},menuPosition:{value:'left'},menuLayout:{value:'menu'},defaultApp:{value:'weather'},'kiosk-output-type':{value:'kiosk'}};
const context={c:{pages:[{id:'home'},{id:'school'}]},current:'school',
 livePreviewView:{page:'home',inFrame:true,frameUrl:'https://example.org/app'},
 previewLayoutKey:'',previewGeometryKey:'',previewRevision:0,previewResetPending:false,
 segOrientation:'landscape',segStyle:1,segBlock:1,
 kioskSegmentHost:{querySelector:()=>frame},$:id=>controls[id],
 normalizeKioskConfig:x=>x,structuredClone,location:{origin:'https://example.org'},
 window:{EduvizeTileNavigation:{area:v=>({capacity:Number(v)})}}};
vm.runInNewContext(html.slice(start,end),context);
context.syncPreviewFrame();
assert.equal(sent.at(-1).config.previewView.frameUrl,'https://example.org/app');
assert.equal(sent.at(-1).config.previewReset,undefined);
controls.menuLayout.value='tiles';
context.syncPreviewFrame();
assert.equal(sent.at(-1).config.previewReset,true);
assert.equal(sent.at(-1).config.previewPage,'home');
assert.equal(sent.at(-1).config.previewView,undefined);
assert.equal(sent.at(-1).config.previewRevision,1);
assert.equal(context.current,'school','The editor selection must not change.');
function acknowledge(){context.previewResetPending=false;context.livePreviewView={page:'home',inFrame:false};}
acknowledge();
controls.subtitle.value='New content';
context.syncPreviewFrame();
assert.equal(sent.at(-1).config.previewReset,undefined);
assert.equal(sent.at(-1).config.previewRevision,1);
for(const mutate of [
 ()=>controls.menuPosition.value='right',
 ()=>controls.tileCount.value='12',
 ()=>controls.defaultApp.value='holidays',
 ()=>controls['kiosk-output-type'].value='nsp',
]){
 acknowledge();const revision=context.previewRevision;mutate();context.syncPreviewFrame();
 assert.equal(sent.at(-1).config.previewReset,true);
 assert.equal(sent.at(-1).config.previewPage,'home');
 assert.equal(sent.at(-1).config.previewRevision,revision+1);
}
for(const mutate of [()=>context.segOrientation='portrait',()=>context.segStyle=2,()=>context.segBlock=2]){
 acknowledge();context.livePreviewView={page:'home',inFrame:true,frameUrl:'https://example.org/current'};
 const revision=context.previewRevision;mutate();context.syncPreviewFrame();
 assert.equal(sent.at(-1).config.previewReset,undefined,'Geometry alone must preserve opened content.');
 assert.equal(sent.at(-1).config.previewView.frameUrl,'https://example.org/current');
 assert.equal(sent.at(-1).config.previewRevision,revision+1,'Reject old frame acknowledgements after geometry changes.');
}
console.log('Preview reset, geometry-only content preservation and stale-revision protection passed.');
