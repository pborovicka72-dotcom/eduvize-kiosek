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
assert.equal(host.children[0].children[0].children[0].children[0].children[0].tagName,'h2');
assert.equal(host.children[0].children[0].children[0].children[0].children[0].textContent,'<script>test</script>');
assert.equal(content.safeUrl('javascript:alert(1)'),null);
page.content.sections.push({title:'Třetí sekce',text:'Další text',image:'https://example.org/photo.png',link:'https://example.org/',linkLabel:'Podrobnosti'});
let opened;
content.render(host,page,url=>opened=url);
assert.equal(host.children[1].hidden,true);
assert.equal(host.children[0].children[0].children.length,2);
const second=page.content.sections[1];page.content.sections.push({...second,title:'Třetí sekce'});content.render(host,page,url=>opened=url);
assert.equal(host.children[1].hidden,false);
host.children[1].children[2].onclick();
assert.equal(host.children[1].children[1].textContent,'2 / 2');
const sheet=host.children[0].children[0];
const row=sheet.children[0],box=row.children[0],card=row.children[1];
assert.equal(box.tagName,'figure');assert.equal(box.hidden,true);
assert.equal(box.children[0].tagName,'img');box.children[0].onload();assert.equal(box.hidden,false);
assert.equal(box.children[0].alt,'Třetí sekce');
const clip=card.children[2];assert.equal(clip.textContent,'📎');assert.ok(clip['aria-label'].includes('Třetí sekce'));
clip.onclick();assert.equal(opened,'https://example.org/');
box.children[0].onerror();assert.equal(box.hidden,true);
page.content.sections.splice(1);
let changes=0;
content.editor(host,page,()=>changes++);
const add=host.children.at(-1);
add.onclick();
assert.equal(page.content.sections.length,2);
assert.equal(changes,1);
content.editor(host,{id:'school'},()=>{});
assert.equal(host.hidden,true);
console.log('Structured content rendering, safe text, editing and persistence passed.');
