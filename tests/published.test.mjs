import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../published.js',import.meta.url),'utf8');
const root={};vm.runInNewContext(source,{window:root,Date,Map,Error,Object});
function fixture(){
 class Node{
  constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.hidden=false;this.attributes={};this.style={setProperty(k,v){this[k]=v;}};}
  append(...items){this.children.push(...items);}
  replaceChildren(...items){this.children=items;}
  setAttribute(k,v){this.attributes[k]=v;}
  querySelectorAll(tag){return this.children.flatMap(n=>[...(n.tag===tag?[n]:[]),...n.querySelectorAll(tag)]);}
 }
 const ids=Object.fromEntries(['kiosk','menu','content','status','title','navigation','home','back'].map(id=>[id,new Node()]));
 let now=0;const timers=new Map();let sequence=0;
 const clock={innerWidth:1920,innerHeight:1080,Date:{now:()=>now},setInterval(fn){timers.set(++sequence,fn);return sequence;},clearInterval(id){timers.delete(id);}};
 const doc={getElementById:id=>ids[id],createElement:tag=>new Node(tag)};
 const view=root.EduvizeKioskPublished.create({document:doc,clock,layouts:{layouts:{portrait:{1:[[1080,1920]]},landscape:{2:[[3840,2160]]}}}});
 return {view,ids,clock,timers,advance(ms){now+=ms;for(const fn of [...timers.values()])fn();}};
}
const id='a'.repeat(32),image='b'.repeat(32),pdf='c'.repeat(32);
const snapshot={schemaVersion:1,id,appId:'kiosk',publishedRevision:1,
 presentation:{mode:'kiosk',interaction:'interactive',kioskLayout:'menu',geometry:{width:1920,height:1080}},
 media:[{id:image,mime:'image/png',url:`/api/public/v1/outputs/${id}/media/${image}`},{id:pdf,mime:'application/pdf',url:`/api/public/v1/outputs/${id}/media/${pdf}`}],
 payload:{title:'Škola',startPage:'home',menuPosition:'left',idleSeconds:10,pages:[
  {id:'home',title:'Nabídka',sections:[],buttons:[{id:'about',type:'page',label:'O škole',pageId:'about'},{id:'doc',type:'media',label:'Dokument',mediaId:pdf}]},
  {id:'about',title:'O škole',sections:[{title:'<script>test</script>',text:'Žluťoučký kůň',imageMediaId:image}],buttons:[]}]}};
const metrics={header:{height:100,title:34},text:{body:30,title:38,label:25}};
const f=fixture(),controller=new AbortController();f.view.render(snapshot,metrics,{signal:controller.signal});
assert.equal(f.ids.kiosk.hidden,false);assert.equal(f.ids.status.hidden,true);assert.equal(f.timers.size,1);
f.ids.menu.children[0].onclick();assert.equal(f.ids.title.textContent,'O škole');
assert.equal(f.ids.content.children[0].children[0].textContent,'<script>test</script>','Text must never be injected as HTML');
assert.equal(f.ids.content.querySelectorAll('img')[0].src,snapshot.media[0].url);
f.ids.back.onclick();assert.equal(f.ids.title.textContent,'Nabídka');
f.ids.menu.children[1].onclick();const frame=f.ids.content.children[0];assert.equal(frame.attributes.sandbox,'');assert.equal(frame.src,snapshot.media[1].url);
f.advance(10000);assert.equal(frame.src,'about:blank');assert.equal(f.ids.title.textContent,'Nabídka');
f.ids.menu.children[1].onclick();const open=f.ids.content.children[0];controller.abort();assert.equal(open.src,'about:blank');assert.equal(f.timers.size,0);
f.view.clear();assert.equal(f.ids.kiosk.hidden,true);assert.equal(f.ids.menu.children.length,0);assert.equal(f.ids.content.children.length,0);
for(const presentation of [
 {mode:'web',interaction:'display',geometry:null},
 {mode:'nsp',interaction:'display',geometry:{orientation:'portrait',layoutId:1,segmentId:1}},
 {mode:'kiosk',interaction:'interactive',kioskLayout:'tiles',geometry:{width:1080,height:1920}},
 {mode:'kiosk',interaction:'interactive',kioskLayout:'menu',geometry:{width:3840,height:2160}}
]){
 const t=fixture();t.view.render({...snapshot,presentation},metrics);
 if(presentation.mode==='web')assert.equal(t.ids.kiosk.style.transform,'');
 else assert.equal((t.ids.kiosk.style.transform.match(/scale\(/g)||[]).length,1,'Only the canonical viewport is scaled');
 if(presentation.interaction==='display'){assert.equal(t.ids.navigation.hidden,true);assert.equal(t.ids.menu.children[0].disabled,true);}
 assert.equal(t.ids.kiosk.style['--edu-text-body'],'30px');t.view.clear();
}
for(const mutate of [
 v=>v.media[0].url='https://external.onrender.com/image.png',
 v=>v.payload.pages[0].buttons.push({id:'child',type:'output',outputId:'d'.repeat(32)}),
 v=>v.payload.pages[0].buttons[0].pageId='missing'
]){
 const t=fixture(),v=structuredClone(snapshot);mutate(v);assert.throws(()=>t.view.render(v,metrics));assert.equal(t.ids.kiosk.hidden,true);assert.equal(t.timers.size,0);
}
const html=fs.readFileSync(new URL('../published.html',import.meta.url),'utf8');
assert.ok(html.includes('output-runtime.js'));assert.equal(/kiosk-output-link|active-theme|admin-auth|index\.html|localStorage|https:\/\//.test(html),false);
assert.equal(/localStorage|sessionStorage|configz|kiosk_id|fetch\(/.test(source),false);
console.log('Published kiosk: scoped media, navigation, abort/revoke cleanup, idle reset and single-scale modes passed.');
