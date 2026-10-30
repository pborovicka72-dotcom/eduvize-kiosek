import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../../eduvize-styly/design-system/tile-navigation.js',import.meta.url),'utf8'),context);
const {page,indexFor}=context.window.EduvizeTileNavigation;
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

const many=Array.from({length:30},(_,id)=>({id}));
assert.equal(page(many,0,12).slots,12);assert.equal(page(many,0,12).items.length,11);assert.equal(page(many,1,12).slots,12);
assert.equal(context.window.EduvizeTileNavigation.grid(3,4).capacity,12);
