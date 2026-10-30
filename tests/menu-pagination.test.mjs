import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../kiosk-menu.js',import.meta.url),'utf8'),context);
const {page,indexFor}=context.window.EduvizeKioskMenu;
for(const length of [0,8,9,14,15,18,50]){
 const items=Array.from({length},(_,id)=>({id})),seen=[];
 const count=page(items).count;
 for(let index=0;index<count;index++){
  const current=page(items,index);assert.ok(current.slots<=8);seen.push(...current.items.map(x=>x.id));
  assert.equal(current.previous,index?index-1:null);assert.equal(current.next,index<count-1?index+1:null);
 }
 assert.deepEqual(seen,items.map(x=>x.id));
 for(let index=0;index<items.length;index++)assert.ok(page(items,indexFor(items,index)).items.includes(items[index]));
}
console.log('Menu pages contain at most eight tiles; Back/Next cover every entry without cycling.');
