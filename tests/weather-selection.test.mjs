import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const html=fs.readFileSync(new URL('index.html',root),'utf8');
const source=html.slice(html.indexOf('function restorePreviewView('),html.indexOf('function fitMenuTiles('));
const scope={window:{},URL,console,structuredClone};
vm.runInNewContext(fs.readFileSync(new URL('kiosk-apps.js',root),'utf8'),scope);
const apps=scope.window.EduvizeKioskApps;
const regular={type:'app',target:'weather',label:'Počasí'},station={type:'app',target:'weather',label:'Meteostanice'};
apps.setWeatherStyle(station,'station');
const tiles=[regular,station].map(item=>({dataset:{buttonKey:apps.buttonKey(item)},active:false,classList:{toggle(name,value){tiles.find(tile=>tile.classList===this).active=value;}}}));
const frame={src:'',classList:{remove(){},add(){}},dataset:{}};
Object.assign(scope,{config:{menuLayout:true,pages:[{id:'home',buttons:[regular,station]}]},
document:{body:{classList:{contains(){return true;},toggle(){},add(){},remove(){}}},documentElement:{style:{setProperty(){}}}},
$:id=>id==='tiles'?{querySelectorAll:()=>tiles}:id==='contentFrame'?frame:{classList:{add(){},remove(){}}},
draw(){},updateNav(){},currentOutputUrl:value=>new URL(value),openRequest:0});
vm.runInNewContext(source,scope);
for(const item of [station,regular,station]){
 scope.restorePreviewView({page:'home',selected:JSON.parse(JSON.stringify(item)),inFrame:true,frameUrl:apps.resolve(item).href});
 assert.equal(scope.selectedMenuItem,item);
 assert.equal(tiles.filter(tile=>tile.active).length,1);
 assert.equal(tiles[item===station?1:0].active,true);
}
console.log('Weather buttons remain individually selected when restoring preview views.');
