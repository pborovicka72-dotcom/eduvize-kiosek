import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../kiosk-menu.js',import.meta.url),'utf8'),context);
const page=context.window.EduvizeKioskMenu.page,items=Array.from({length:18},(_,id)=>({id}));
assert.equal(page(items.slice(0,8)).hasMore,false);
const seen=[];
for(let index=0;index<3;index++){const current=page(items,index);assert.ok(current.items.length+1<=8);seen.push(...current.items.map(x=>x.id));}
assert.deepEqual(seen,items.map(x=>x.id));
assert.equal(page(items,2).next,0);
assert.equal(page(items,99).index,0);
console.log('Eight-tile menu pagination preserves all destinations and cycles back.');
