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

const {layout}=context.window.EduvizeTileNavigation;
for(const [position,portrait,columns,rows,capacity] of [['left',false,2,5,10],['right',false,2,5,10],['top',false,7,1,7],['bottom',false,7,1,7],['left',true,1,9,9],['right',true,1,9,9],['top',true,5,2,10],['bottom',true,5,2,10]]){
 const setup=layout(position,portrait);assert.equal(setup.columns,columns);assert.equal(setup.rows,rows);assert.equal(setup.capacity,capacity);
 assert.equal(page(Array(capacity).fill(0),0,capacity).next,null);
 assert.equal(page(Array(capacity+1).fill(0),0,capacity).next,1);
}
for(const capacity of [7,9,10])for(const length of [8,10,11,19,30,50]){
 const items=Array.from({length},(_,id)=>id),seen=[];
 for(let i=0;i<page(items,0,capacity).count;i++){
  const view=page(items,i,capacity);assert.ok(view.items.length+Number(view.previous!==null)+Number(view.next!==null)<=capacity);seen.push(...view.items);
 }
 assert.deepEqual(seen,items);
}
console.log('All menu orientations and capacity boundaries passed.');

const {area,count}=context.window.EduvizeTileNavigation;
assert.equal(area(10).columns,4);assert.equal(area(10).rows,3);assert.equal(area(10).capacity,10);
assert.equal(area(10,true).columns,3);assert.equal(area(10,true).rows,4);
assert.equal(area(25).columns,5);assert.equal(area(25).rows,5);assert.equal(area(26).capacity,25);
assert.equal(count({}),10);assert.equal(count({tileColumns:3,tileRows:4}),12);assert.equal(count({tileCount:10,tileColumns:8,tileRows:8}),10);

const wide=area(10,false,1200,500,8),tall=area(10,true,500,1200,8);
assert.equal(wide.columns,5);assert.equal(wide.rows,2);
assert.equal(tall.columns,2);assert.equal(tall.rows,5);
for(const total of [3,7,10,17,25])for(const [width,height] of [[1200,500],[500,1200],[800,800]]){
 const fitted=area(total,height>width,width,height,8);
 assert.equal(fitted.capacity,total);assert.ok(fitted.columns*fitted.rows>=total);
 assert.ok(fitted.columns*(fitted.rows-1)<total);
}
console.log('Area grids adapt to the available aspect ratio without shrinking the grid.');

for(const total of [1,2,7,10,11,17,25])for(const [w,h] of [[1200,600],[400,700]]){
 const packed=context.window.EduvizeTileNavigation.pack(total,w,h,8);
 assert.equal(packed.counts.reduce((a,b)=>a+b,0),total);
 assert.equal(packed.rows,packed.counts.length);
 assert.ok(Math.max(...packed.counts)-Math.min(...packed.counts)<=1);
 assert.ok(packed.counts.every(n=>n>0));
}
console.log('Balanced rows contain every visible tile, without empty cells.');
