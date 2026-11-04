import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../remote.js',import.meta.url),'utf8');
const snapshot={title:'Školní kiosek',revision:'r1',items:[{id:'home',label:'Domů',active:true}]};
async function fixture(hash='',expire=false){
 const nodes=new Map(),events={},timers=[],requests=[];
 const element=()=>({hidden:false,value:'',disabled:false,textContent:'',children:[],append(n){this.children.push(n);},replaceChildren(){this.children=[];},setAttribute(){},querySelectorAll(){return this.children;},getTracks(){return [];}});
 const get=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
 const window={addEventListener(n,fn){events[n]=fn;},EduvizeRemote:{async request(path,token,body){
  requests.push({path,token,body});
  if(path==='/join-code')return {session:'S'.repeat(32),controller:'C'.repeat(43),snapshot};
  if(path.endsWith('/join')){if(expire)throw Object.assign(Error('Spojení není platné.'),{status:401});return {controller:'C'.repeat(43),snapshot};}
  if(path.endsWith('/state'))return {snapshot};
  return {};
 }}};
 const context={window,document:{getElementById:get,createElement:element},location:{hash,pathname:'/eduvize-kiosek/remote.html',search:'',origin:'https://pborovicka72-dotcom.github.io'},history:{replaceState(){}},crypto:{randomUUID:()=> 'test-request-123456'},navigator:{},URL,setTimeout(fn){timers.push(fn);}};
 await vm.runInNewContext(source,context);await Promise.resolve();
 return {get,events,timers,requests};
}
const empty=await fixture();assert.equal(empty.get('pairing').hidden,false);
empty.get('pairCode').value='1234 5678';empty.get('pairForm').onsubmit({preventDefault(){}});
await new Promise(r=>setTimeout(r,0));
assert.equal(empty.requests[0].path,'/join-code');assert.equal(empty.requests[0].body.code,'12345678');
assert.equal(empty.get('pairing').hidden,true);assert.equal(empty.get('leave').hidden,false);
await empty.get('leave').onclick();assert.equal(empty.get('pairing').hidden,false);
empty.get('pairCode').value='8765 4321';empty.get('pairForm').onsubmit({preventDefault(){}});
await new Promise(r=>setTimeout(r,0));assert.equal(empty.get('pairing').hidden,true);
const expired=await fixture('#'+'S'.repeat(32)+'.'+'P'.repeat(43),true);
assert.match(expired.get('status').textContent,/Spojení není platné/);assert.equal(expired.get('pairing').hidden,false);
assert.equal(expired.get('menu').children.length,0);
const qr=await fixture('#'+'S'.repeat(32)+'.'+'P'.repeat(43));
assert.equal(qr.get('pairing').hidden,true);assert.equal(qr.requests[0].token,'P'.repeat(43));
await qr.get('scan').onclick();assert.match(qr.get('status').textContent,/Kamera není dostupná/);
console.log('Manual pairing, expired QR recovery, leave/rejoin, legacy QR and camera fallback passed.');
