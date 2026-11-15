import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../remote-client.js',import.meta.url),'utf8');
function client(){
 const calls=[];let paired=false;
 const root={EduvizeKioskEnvironment:{url:p=>'https://test.skola.eduvize.cz'+p},EduvizeAdminAuth:{getToken(){throw Error('Remote control must not read the school administration token');}}};
 const response=(status,data)=>({ok:status<400,status,headers:{get:()=> 'application/json'},json:async()=>data});
 const fetch=async(url,options)=>{
  calls.push({url,options});
  // A valid HttpOnly browser gate cookie exists, but omit never sends it.
  if(options.credentials!=='same-origin')return response(401,{detail:'Main login required'});
  const path=new URL(url).pathname,cap=options.headers.Authorization;
  if(path.endsWith('/sessions'))return response(200,{id:'screen',owner:'screen-capability'});
  if(path.endsWith('/heartbeat'))return cap==='Bearer screen-capability'?response(200,{connected:paired,pairCode:'12345678'}):response(401,{detail:'Wrong owner'});
  if(path.endsWith('/join')){if(cap!=='Bearer one-use-pair-capability')return response(401,{detail:'Wrong pair capability'});paired=true;return response(200,{controller:'controller-capability'});}
  if(path.endsWith('/commands'))return cap==='Bearer controller-capability'&&paired?response(200,{ok:true}):response(401,{detail:'Wrong controller'});
  if(path.endsWith('/disconnect')){if(cap!=='Bearer screen-capability')return response(401,{detail:'Wrong owner'});paired=false;return response(200,{ok:true});}
  return response(404,{detail:'Unexpected route'});
 };
 vm.runInNewContext(source,{window:root,fetch,AbortController,setTimeout,clearTimeout,JSON,Error});
 return{remote:root.EduvizeRemote,calls};
}
test('main-login cookie and remote capabilities both survive the complete transport flow',async()=>{
 const{remote,calls}=client();const screen=await remote.request('/sessions',null,{title:'Synthetic screen',revision:'one',items:[]});
 await remote.request('/sessions/screen/heartbeat',screen.owner,{ack:0});
 const phone=await remote.request('/sessions/screen/join','one-use-pair-capability',{});
 await remote.request('/sessions/screen/commands',phone.controller,{id:'home',revision:'one',requestId:'synthetic-request'});
 await remote.request('/sessions/screen/disconnect',screen.owner,{});
 await assert.rejects(remote.request('/sessions/screen/commands',phone.controller,{id:'home'}),e=>e.status===401);
 assert.equal(calls[0].options.headers.Authorization,undefined);
 assert.equal(calls[1].options.headers.Authorization,'Bearer screen-capability');
 assert.equal(calls[3].options.headers.Authorization,'Bearer controller-capability');
 assert.ok(calls.every(c=>c.options.cache==='no-store'));
});
test('a logged-in browser does not replace the owner capability',async()=>{
 const{remote}=client();await assert.rejects(remote.request('/sessions/screen/heartbeat','wrong-capability',{}),e=>e.status===401&&e.message==='Wrong owner');
});
