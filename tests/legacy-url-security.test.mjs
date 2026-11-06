import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {Blob} from 'node:buffer';
import {CompressionStream,DecompressionStream} from 'node:stream/web';
import {gzipSync} from 'node:zlib';
const origin='https://test.skola.eduvize.cz',profile='a'.repeat(32);
const config={title:'Synthetic school',pages:[{id:'home',buttons:[]},{id:'parents',buttons:[]}]};
function fixture(){
 let active=true,expiresAt=Date.now()/1000+60,schoolId=profile,posts=0;const snapshots=new Map(),calls=[];
 const auth={ready:Promise.resolve(),getToken:()=>active?'test-only':'',status:()=>({schoolId}),fetch:async(url,options)=>{
  assert.equal(new URL(url).origin,origin);assert.equal(options.method,'POST');const id=(++posts).toString(16).padStart(32,'0');
  snapshots.set(id,JSON.parse(options.body).config);return new Response(JSON.stringify({id}));}};
 const win={location:{origin},EduvizeAdminAuth:auth,EduvizeKioskEnvironment:{origin},EduvizeOutputModes:{url:u=>u}};win.parent=win;
 const context={window:win,URL,URLSearchParams,TextEncoder,TextDecoder,Response,Blob,CompressionStream,DecompressionStream,Uint8Array,atob,btoa,structuredClone,AbortSignal,fetch:async(url,options)=>{
  calls.push({url,options});assert.equal(new URL(url).origin,origin);
  if(url.includes('/validate?')){assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');return new Response(JSON.stringify({valid:active,scope:'configurations',schoolId,expiresAt}),{status:active?200:401});}
  assert.equal(options.credentials,'same-origin');assert.equal(options.redirect,'error');
  const u=new URL(url),id=u.pathname.split('/').at(-1),ok=snapshots.has(id)&&(!u.searchParams.has('profile')||u.searchParams.get('profile')===profile);
  return new Response(JSON.stringify(ok?{config:snapshots.get(id)}:{}),{status:ok?200:404});}};
 vm.runInNewContext(fs.readFileSync(new URL('../kiosk-output-link.js',import.meta.url),'utf8'),context);
 return {win,context,api:win.EduvizeKioskOutputLink,auth,calls,snapshots,setActive:v=>active=v,setExpiry:v=>expiresAt=v,setSchool:v=>schoolId=v,posts:()=>posts};
}
const raw=Buffer.from(JSON.stringify(config)),legacy=['?config='+raw.toString('base64url'),'#config='+raw.toString('base64url'),'?configz='+gzipSync(raw).toString('base64url')];
{
 const f=fixture(),u=await f.api.url(config,origin+'/config.html',profile);
 assert.equal(f.posts(),1,'even short hosted configurations must be immutable server snapshots');
 assert(u.searchParams.has('kiosk_id'));assert(!u.searchParams.has('configz'));
 for(const suffix of legacy)assert.equal((await f.api.read(origin+'/'+suffix)).title,config.title);
 f.setActive(false);
 for(const suffix of [...legacy,'?preview=1',''])await assert.rejects(f.api.read(origin+'/'+suffix),/ověřený výstup/);
 assert.equal((await f.api.read(u)).title,config.title);
 const before=f.calls.length;
 for(const suffix of ['&config=','&configz=','&preview=0','&preview=1','&kiosk_id=','&kiosk_id='+'f'.repeat(32),'#config=','#config=a&config=b'])await assert.rejects(f.api.read(u.href+suffix));
 for(const suffix of ['?kiosk_id=','?kiosk_id=bad','?config=&config=x','?configz=&config=','?config=&configz=','#config=&config=x','?config=#config='])await assert.rejects(f.api.read(origin+'/'+suffix));
 assert.equal(f.calls.length,before,'ambiguous input must fail before transport');
 await assert.rejects(f.api.url(config,origin+'/config.html'),/přihlaste/);
 const wrongProfile=new URL(u);wrongProfile.searchParams.set('edu-profile','b'.repeat(32));await assert.rejects(f.api.read(wrongProfile));
 const wrongId=new URL(u);wrongId.searchParams.set('kiosk_id','f'.repeat(32));await assert.rejects(f.api.read(wrongId));
}
{
 for(const invalid of ['expired','revoked','school']){const f=fixture();if(invalid==='expired')f.setExpiry(Date.now()/1000-1);if(invalid==='revoked')f.setActive(false);if(invalid==='school')f.setSchool('bad');assert.equal(await f.api.authorizedPreview(),false);}
 const f=fixture();delete f.win.EduvizeAdminAuth;
 let ancestor=f.win;for(let i=0;i<4;i++){ancestor.parent={location:{origin}};ancestor=ancestor.parent;}ancestor.parent=ancestor;ancestor.EduvizeAdminAuth=f.auth;
 assert.equal(await f.api.authorizedPreview(),true,'bounded same-origin nested preview');
 assert.equal((await f.api.read(origin+'/'+legacy[0])).title,config.title);
 ancestor.location.origin='https://other.example';assert.equal(await f.api.authorizedPreview(),false);
 ancestor.location.origin=origin;delete ancestor.EduvizeAdminAuth;ancestor.parent={location:{origin},EduvizeAdminAuth:f.auth};ancestor.parent.parent=ancestor.parent;
 assert.equal(await f.api.authorizedPreview(),false,'authority beyond four ancestors must be rejected');
 f.win.EduvizeAdminAuth={ready:Promise.resolve(),getToken:()=>''};assert.equal(await f.api.authorizedPreview(),false,'first authority cannot fall through to a different one');
}
{
 const f=fixture();f.win.location.origin='http://localhost:8000';f.win.EduvizeAdminAuth=null;
 assert.equal(await f.api.authorizedPreview(),true);const u=await f.api.url(config,'http://localhost:8000/config.html');assert(u.searchParams.has('configz'));assert.equal(f.posts(),0);
}
// Execute the real legacy navigation functions with an isolated DOM, no network or browser session.
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
{
 const f=fixture(),u=await f.api.url(config,origin+'/config.html',profile);f.setActive(false);
 const frame={src:'about:blank',classList:{remove(){}}},hero={classList:{add(){}}},style={setProperty(){}},classes={add(){},remove(){}};
 const c={URL,URLSearchParams,TextEncoder,btoa,location:{href:u.href},sp:u.searchParams,config:await f.api.read(u),$:id=>id==='contentFrame'?frame:hero,window:{EduvizeOutputModes:{mode:()=> 'kiosk'}},document:{body:{classList:classes},documentElement:{style}},inFrame:false,updateNav(){},withHeaderStyle:url=>{url.searchParams.set('edu-profile',profile);return url;}};
 vm.runInNewContext(html.slice(html.indexOf('function openMenuSubpage('),html.indexOf('async function openContentLink(')),c);
 c.openMenuSubpage('parents');const child=new URL(frame.src);
 assert.equal(child.searchParams.get('kiosk_id'),u.searchParams.get('kiosk_id'));assert.equal(child.searchParams.get('edu-profile'),profile);assert.equal(child.hash,'');
 for(const key of ['config','configz','preview'])assert.equal(child.searchParams.has(key),false);
 assert.equal((await f.api.read(child)).title,config.title);
 // Exact page-validation fragment refuses an arbitrary page, without changing the source snapshot.
 const guard=html.slice(html.indexOf("const embeddedPage=sp.get('embedded_page');"),html.indexOf('if(embeddedPage){'));
 assert(guard.includes('throw Error'));
 vm.runInNewContext(guard,{sp:child.searchParams,config});
 child.searchParams.set('embedded_page','attacker');assert.throws(()=>vm.runInNewContext(guard,{sp:child.searchParams,config}),/Podstránka/);
 assert.equal((await f.api.read(child)).title,config.title);
 const nav={onclick:null};let draws=0;vm.runInNewContext(html.slice(html.indexOf("$('back').onclick="),html.indexOf("$('home').onclick=")),{$:()=>nav,activity(){},inFrame:true,draw(){draws++},history:[]});nav.onclick();assert.equal(draws,1,'Back keeps the established parent view');
}
// A failed hosted read must never consult localStorage or defaults.
{
 const f=fixture();f.setActive(false);let storageReads=0;
 const fn=html.slice(html.indexOf('async function getConfig()'),html.indexOf('function saveConfig('));
 const c={window:{EduvizeKioskOutputLink:f.api},location:{href:origin+'/'},normalizeKioskConfig:x=>x,localStorage:{getItem(){storageReads++;return JSON.stringify(config)}},KEY:'test',DEFAULT:config,structuredClone};vm.runInNewContext(fn,c);
 await assert.rejects(c.getConfig());assert.equal(storageReads,0);
}
// Execute the actual preview message callback with forged sources.
{
 const fragment=html.slice(html.indexOf("window.addEventListener('message',event=>"),html.indexOf("window.parent.postMessage({type:'eduvize-kiosk-preview-ready'}"));
 let handler;const parent={},window={parent,addEventListener:(name,cb)=>handler=cb};
 vm.runInNewContext(fragment,{window,location:{origin}});
 for(const event of [{source:{},origin,data:{type:'eduvize-kiosk-preview',config:{pages:[]}}},{source:parent,origin:'https://other.example',data:{type:'eduvize-kiosk-preview',config:{pages:[]}}}])assert.doesNotThrow(()=>handler(event));
}
console.log('Legacy URL/preview security, immutable embedded navigation and no-fallback regressions passed.');
