import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf("let lastEmbeddedLayout=''"),end=html.indexOf("window.addEventListener('resize',syncEmbeddedHeader)",start);
assert.ok(start>=0&&end>start);
for(const outerMode of ['kiosk','nsp']){
 const messages=[];
 const nav={getBoundingClientRect:()=>({height:1000})};
 const frame={classList:{contains:()=>false},getBoundingClientRect:()=>({width:1400,height:800}),contentWindow:{postMessage:m=>messages.push(m)}};
 const context={document:{body:{classList:{contains:v=>v==='menu-layout'}}},$:id=>id==='tiles'?nav:frame,
  kioskHeaderStyle:()=> 'light',config:{menuPosition:'left'},innerWidth:1920,innerHeight:1080,
  getComputedStyle:()=>({rowGap:'10px',paddingTop:'0px',paddingBottom:'0px'}),
  window:{EduvizeOutputModes:{mode:()=>outerMode},EduvizeTileNavigation:{layout:()=>({rows:5})}}};
 vm.runInNewContext(html.slice(start,end),context);
 context.syncEmbeddedHeader();
 assert.equal(messages.length,1);
 assert.equal(messages[0].parentMode,'kiosk','An NSP-sized kiosk must not force legacy app styling.');
 assert.equal(messages[0].menuLayout,true);
 assert.equal(context.window.EduvizeOutputModes.mode(),outerMode,'The outer output mode must stay unchanged.');
}
console.log('Embedded kiosk appearance is independent of outer NSP preview geometry.');
