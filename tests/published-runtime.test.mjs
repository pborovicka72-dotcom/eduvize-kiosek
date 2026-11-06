/* Real shared client/runtime + kiosk renderer. All responses are synthetic; no network. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const shared=new URL('../../eduvize-styly/design-system/',import.meta.url);
const code=name=>fs.readFileSync(new URL(name,shared),'utf8');
const renderer=fs.readFileSync(new URL('../published.js',import.meta.url),'utf8');
const id='a'.repeat(32),mediaId='b'.repeat(32),origin='https://test.skola.eduvize.cz';
const makeSnapshot=()=>({schemaVersion:1,id,appId:'kiosk',publishedRevision:1,
 presentation:{mode:'kiosk',interaction:'interactive',kioskLayout:'menu',geometry:{registryId:'kiosk-viewport',registryVersion:1,orientation:'landscape',width:1920,height:1080}},
 theme:{mode:'profile-active',url:`/api/public/v1/outputs/${id}/theme`,refreshSeconds:60},
 media:[{id:mediaId,mime:'application/pdf',url:`/api/public/v1/outputs/${id}/media/${mediaId}`}],
 payload:{title:'Testovací škola',startPage:'home',menuPosition:'left',idleSeconds:20,pages:[{id:'home',title:'Publikace jedna',sections:[],buttons:[{id:'pdf',label:'Dokument',type:'media',mediaId}]}]}});
const theme=color=>({schemaVersion:1,colors:Object.fromEntries(['background','text','muted','surface','primary','primaryText','secondary','secondaryText','accent','border'].map(k=>[k,color])),controls:{heightPx:56,radiusPx:10},cards:{radiusPx:12},icons:{radiusPx:10}});
function fixture(initialBehavior='ok'){
 class Node{
  constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.hidden=false;this.style={setProperty(k,v){this[k]=v;}};}
  append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}
  setAttribute(k,v){this[k]=v;}querySelectorAll(tag){return this.children.flatMap(n=>[...(n.tag===tag?[n]:[]),...n.querySelectorAll(tag)]);}
 }
 const nodes=Object.fromEntries(['kiosk','menu','content','status','title','navigation','home','back'].map(k=>[k,new Node()]));
 const events=new Map(),intervals=new Map(),timeouts=new Map();let sequence=0,now=0;
 const state={snapshot:makeSnapshot(),color:'#123456',behavior:initialBehavior,requests:[],renders:0,errors:[]};
 const doc={hidden:false,documentElement:new Node(),getElementById:k=>nodes[k],createElement:tag=>new Node(tag),addEventListener:(n,f)=>events.set(n,f),removeEventListener:n=>events.delete(n)};
 const clock={innerWidth:1920,innerHeight:1080,location:{origin,href:origin+'/eduvize-kiosek/published.html?edu-output='+id},crypto:{randomUUID:()=> 'c'.repeat(32)},
  Date:class extends Date{static now(){return now;}},
  setInterval(f,ms){intervals.set(++sequence,{f,ms});return sequence;},clearInterval:k=>intervals.delete(k),
  setTimeout(f,ms){timeouts.set(++sequence,{f,ms});return sequence;},clearTimeout:k=>timeouts.delete(k)};
 clock.fetch=async(url,options)=>{
  state.requests.push({url,options});assert.equal(new URL(url).origin,origin);assert.equal(options.method,'GET');
  assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');
  assert.equal('Authorization' in options.headers,false);
  assert.ok([`/api/public/v1/outputs/${id}`,`/api/public/v1/outputs/${id}/theme`].includes(new URL(url).pathname));
  if(state.behavior==='gate')throw new TypeError('Synthetic login redirect blocked');
  if(state.behavior!=='ok')return {ok:false,status:state.behavior,json:async()=>({error:{code:'TEST_ERROR',message:'Synthetic error'}})};
  return {ok:true,status:200,json:async()=>structuredClone(url.endsWith('/theme')?theme(state.color):state.snapshot)};
 };
 const context={window:clock,Date:clock.Date,URL,URLSearchParams,AbortController,Map,Error,TypeError,Object,Math,Number,Promise,structuredClone};
 for(const name of ['nsp-geometry.js','segment-profile.js','output-client.js','output-runtime.js'])vm.runInNewContext(code(name),context,{filename:name});
 vm.runInNewContext(renderer,context,{filename:'published.js'});clock.document=doc;
 const view=clock.EduvizeKioskPublished.create({document:doc,clock});
 const runtime=clock.EduvizeOutputRuntime.start({appId:'kiosk',onPresentation:view.apply,render(...args){state.renders++;return view.render(...args);},clear:view.clear,onError:e=>state.errors.push(e)});
 return {state,nodes,doc,intervals,timeouts,runtime,view,advance:ms=>{now+=ms;},stop(){runtime.stop();view.clear();}};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
{
 const f=fixture();await flush();assert.equal(f.nodes.kiosk.hidden,false);assert.equal(f.state.renders,1);
 const originalButton=f.nodes.menu.children[0];f.state.color='#abcdef';await f.runtime.refresh();
 assert.equal(f.doc.documentElement.style['--ev-bg'],'#abcdef');assert.equal(f.state.renders,1);
 assert.equal(f.nodes.menu.children[0],originalButton,'A theme refresh must preserve menu controls and current layout');
 originalButton.onclick();const pdf=f.nodes.content.children[0];assert.ok(pdf.src.endsWith(mediaId));
 f.state.snapshot.publishedRevision=2;f.state.snapshot.payload.pages[0].title='Publikace dvě';await f.runtime.refresh();
 assert.equal(pdf.src,'about:blank');assert.equal(f.state.renders,2);assert.equal(f.nodes.title.textContent,'Publikace dvě');
 f.nodes.menu.children[0].onclick();const active=f.nodes.content.children[0];f.state.behavior=410;await f.runtime.refresh();
 assert.equal(active.src,'about:blank');assert.equal(f.nodes.kiosk.hidden,true);assert.equal(f.nodes.content.children.length,0);
 assert.equal(f.intervals.size,0);const before=f.state.requests.length;await f.runtime.refresh();assert.equal(f.state.requests.length,before,'Revoked output stops requests');
 f.stop();
}
for(const status of [403,404]){
 const f=fixture();await flush();f.state.behavior=status;await f.runtime.refresh();
 assert.equal(f.nodes.kiosk.hidden,true);assert.equal(f.intervals.size,0);f.stop();
}
{
 const f=fixture('gate');await flush();
 assert.equal(f.nodes.menu.children.length,0);assert.equal(f.state.renders,0,'A login redirect is never successful playback');
 assert.equal(f.state.requests.length,1,'No alternate URL or login fallback');f.advance(300001);await f.runtime.refresh();
 assert.equal(f.nodes.kiosk.hidden,true);f.stop();
}
{
 const f=fixture();await flush();f.state.behavior='gate';await f.runtime.refresh();assert.equal(f.state.renders,1);
 f.advance(300001);await f.runtime.refresh();assert.equal(f.nodes.kiosk.hidden,true);assert.equal(f.nodes.menu.children.length,0);
 f.state.behavior='ok';await f.runtime.refresh();assert.equal(f.nodes.kiosk.hidden,false);assert.equal(f.state.renders,2);f.stop();
}
console.log('Real shared runtime: theme without rebuild, republish, revoke/403/404, policy gate and stale cleanup passed offline.');
