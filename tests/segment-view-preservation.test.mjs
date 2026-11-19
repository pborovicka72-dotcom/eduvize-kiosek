import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../config.html',import.meta.url),'utf8');
const code=html.slice(html.indexOf('function syncPreviewFrame('),html.indexOf("window.addEventListener('message',e=>",html.indexOf('function syncPreviewFrame(')));
const sent=[],frame={contentWindow:{postMessage(data){sent.push(data);}}};
const fields={subtitle:{value:''},showInfoPanel:{checked:true},tileCount:{value:'10'},menuPosition:{value:'left'},menuLayout:{value:'menu'},defaultApp:{value:'weather'},'kiosk-output-type':{value:'nsp'}};
const view={page:'home',inFrame:true,frameUrl:'https://eduvize-weather.onrender.com/display?weather_style=station',selected:{type:'app',target:'weather',appUrl:'https://eduvize-weather.onrender.com/display?weather_style=station',label:'Meteostanice'}};
const scope={schoolIdentity:null,structuredClone,JSON,Number,location:{origin:'https://test.local'},window:{EduvizeTileNavigation:{area(){return {capacity:10};}}},
 kioskSegmentHost:{querySelector(){return frame;}},$:(id)=>fields[id],normalizeKioskConfig:x=>x,c:{pages:[{id:'home'}]},current:'home',segOrientation:'landscape',segStyle:1,segBlock:1,previewLayoutKey:'',previewGeometryKey:'',previewRevision:0,previewResetPending:false,livePreviewView:view,
 resetPreviewToHome(){scope.livePreviewView=null;scope.previewRevision++;scope.previewResetPending=true;}};
vm.runInNewContext(fs.readFileSync(new URL('../kiosk-weather.js',import.meta.url),'utf8'),{window:scope.window,URL});
vm.runInNewContext(code,scope);
scope.syncPreviewFrame();
for(const [orientation,style,block]of [['landscape',3,2],['portrait',4,3],['landscape',1,1]]){
 Object.assign(scope,{segOrientation:orientation,segStyle:style,segBlock:block});
 scope.syncPreviewFrame();
 const snapshot=sent.at(-1).config;
 assert.equal(snapshot.previewView.frameUrl,view.frameUrl);
 assert.equal(snapshot.previewView.selected.label,'Meteostanice');
 assert.equal(snapshot.previewReset,undefined);
}
assert.equal(scope.previewRevision,3);
console.log('Segment and orientation changes preserve the selected meteostation and reject stale view messages.');
