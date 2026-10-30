import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.dataset={};}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;}
}
const scope={window:{},document:{createElement:tag=>new Element(tag)}};
vm.runInNewContext(fs.readFileSync(new URL('../page-content.js',import.meta.url),'utf8'),scope);
const content=scope.window.EduvizePageContent;
const host=new Element('article');
assert.equal(content.render(host,{id:'empty'}),false);
const page={id:'parents',content:{intro:'Úvod',sections:[{title:'<script>test</script>',text:'Text sekce'}]}};
assert.equal(content.render(host,JSON.parse(JSON.stringify(page))),true);
assert.equal(host.children[0].children[1].children[0].tagName,'h2');
assert.equal(host.children[0].children[1].children[0].textContent,'<script>test</script>');
let changes=0;
content.editor(host,page,()=>changes++);
const add=host.children.at(-1);
add.onclick();
assert.equal(page.content.sections.length,2);
assert.equal(changes,1);
content.editor(host,{id:'school'},()=>{});
assert.equal(host.hidden,true);
console.log('Structured content rendering, safe text, editing and persistence passed.');
