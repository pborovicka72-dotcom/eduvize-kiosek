import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.classList={add(){}};}
  setAttribute(key,value){this[key]=value;}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;}
}
const scope={window:{},URL,document:{createElement:tag=>new Element(tag)}};
vm.runInNewContext(fs.readFileSync(new URL('../../eduvize-styly/design-system/paged-panel.js',import.meta.url),'utf8'),scope);
vm.runInNewContext(fs.readFileSync(new URL('../page-content.js',import.meta.url),'utf8'),scope);
const content=scope.window.EduvizePageContent;
const host=new Element('article');
assert.equal(content.render(host,{id:'empty'}),false);
const page={id:'parents',content:{intro:'Úvod',sections:[{title:'<script>test</script>',text:'Text sekce'}]}};
assert.equal(content.render(host,JSON.parse(JSON.stringify(page))),true);
assert.equal(host.children[0].children[0].children[1].children[0].tagName,'h2');
assert.equal(host.children[0].children[0].children[1].children[0].textContent,'<script>test</script>');
assert.equal(content.safeUrl('javascript:alert(1)'),null);
page.content.sections.push({title:'Druhá sekce',text:'Další text',image:'https://example.org/photo.png',link:'https://example.org/',linkLabel:'Podrobnosti'});
let opened;
content.render(host,page,url=>opened=url);
assert.equal(host.children[1].hidden,false);
host.children[1].children[2].onclick();
assert.equal(host.children[1].children[1].textContent,'2 / 2');
const sheet=host.children[0].children[0];
assert.equal(sheet.children[0].tagName,'img');
assert.equal(sheet.children[0].hidden,true);
sheet.children[0].onload();assert.equal(sheet.children[0].hidden,false);
sheet.children[1].children[2].onclick();assert.equal(opened,'https://example.org/');
page.content.sections.pop();
let changes=0;
content.editor(host,page,()=>changes++);
const add=host.children.at(-1);
add.onclick();
assert.equal(page.content.sections.length,2);
assert.equal(changes,1);
content.editor(host,{id:'school'},()=>{});
assert.equal(host.hidden,true);
console.log('Structured content rendering, safe text, editing and persistence passed.');
