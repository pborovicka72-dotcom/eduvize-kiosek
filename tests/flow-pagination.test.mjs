import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.style={};this.dataset={};this.classList={add(){}};}
 append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n);}}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);this.height=0;}
 remove(){this.parent.children=this.parent.children.filter(n=>n!==this);}
 setAttribute(){}
 get scrollHeight(){return this.height||this.children.reduce((sum,e)=>sum+e.scrollHeight,0);}
 querySelector(){return this.children.find(n=>n.className==='edu-pagination');}
 getBoundingClientRect(){return {height:this.hidden?0:34};}
}
const scope={window:{},document:{createElement:t=>new Element(t)},getComputedStyle:()=>({rowGap:'10'})};
vm.runInNewContext(fs.readFileSync(new URL('../../eduvize-styly/design-system/paged-panel.js',import.meta.url),'utf8'),scope);
const panel=scope.window.EduvizePagedPanel,host=new Element('article');host.clientWidth=500;host.clientHeight=200;
const blocks=[60,60,90,90];
const options={key:'parents',render:(sheet,items)=>{sheet.height=items.reduce((sum,n)=>sum+n,0);sheet.items=items;}};
panel.mountFlow(host,blocks,options);
assert.equal(host.children[1].children[1].textContent,'1 / 3');
assert.equal(host.children[0].children[0].items.length,2);
host.children[1].children[2].onclick();
assert.equal(host.children[1].children[1].textContent,'2 / 3');
host.clientHeight=400;panel.mountFlow(host,blocks,options);
assert.equal(host.children[1].hidden,true);
assert.equal(host.children[0].children[0].items.length,4);
host.clientHeight=200;panel.mountFlow(host,[500],{...options,key:'large'});
assert.equal(host.children[1].hidden,true);
assert.equal(host.children[0].dataset.eduFit,'');
console.log('Flow pagination packs complete blocks, regroups on resize and fits oversized blocks.');
