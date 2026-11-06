/* New output links always carry the selected surface and a fresh configuration snapshot. */
(function(root){
 'use strict';
 const isLocal=origin=>{try{return ['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname);}catch{return false;}};
 const API=root.EduvizeKioskEnvironment.origin;
 async function url(config,base,profileId){
  const u=new URL('./index.html',base),mode=['web','kiosk'].includes(config.outputType)?config.outputType:'nsp';
  const snapshot=structuredClone(config);
  for(const key of ['previewView','previewPage','previewRevision','previewReset'])delete snapshot[key];
  const raw=new TextEncoder().encode(JSON.stringify(snapshot));
  const bytes=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
  u.searchParams.set('configz',btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''));
  if(profileId)u.searchParams.set('edu-profile',profileId);
  u.searchParams.set('v','20261104-output-links-3');
  u.searchParams.set('viewMode',mode);
  if(mode==='nsp'){
   u.searchParams.set('output','nsp');
   u.searchParams.set('orientation',config.layoutOrientation==='portrait'?'portrait':'landscape');
   u.searchParams.set('style',String(config.layoutStyle||1));
   u.searchParams.set('block',String(config.layoutBlock||1));
  }
  const output=root.EduvizeOutputModes.url(u,mode);
  if(isLocal(root.location?.origin)&&isLocal(output.origin)){await read(output);return output;}
  { // Every public link is an authenticated, immutable server snapshot.
   const auth=root.EduvizeAdminAuth;await auth?.ready;
   if(!auth?.getToken('configurations')||!auth.status().schoolId)throw Error('Pro vytvoření krátkého odkazu se přihlaste účtem školy. Nastavení zůstalo uložené v prohlížeči.');
   const response=await auth.fetch(API+'/api/account/kiosk-outputs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({config:snapshot}),signal:AbortSignal.timeout(90000)},'configurations');
   const result=await response.json();
   if(!response.ok||!/^[a-f0-9]{32}$/.test(result.id||''))throw Error(typeof result.detail==='string'?result.detail:'Krátký odkaz se nepodařilo uložit. Zkuste to znovu.');
   output.searchParams.delete('configz');output.searchParams.set('kiosk_id',result.id);
  }
  await read(output); // Never copy a link that cannot restore its own snapshot.
  return output;
 }
 async function authorizedPreview(){
  // Loopback development is deliberately separate from hosted school outputs.
  if(isLocal(root.location?.origin))return true;
  try{
   if(new URL(API).origin!==root.location.origin)return false;
   let owner=root,auth,token;
   for(let depth=0;depth<=4;depth++){
    if(owner.location.origin!==root.location.origin)return false;
    auth=owner.EduvizeAdminAuth;
    if(auth){await auth.ready;token=auth.getToken('configurations');break;}
    if(owner.parent===owner||!owner.parent||depth===4)return false;
    owner=owner.parent;
   }
   if(!token)return false;
   const response=await fetch(API+'/api/admin-session/validate?scope=configurations',{headers:{Authorization:'Bearer '+token},cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000)});
   if(!response.ok)return false;const data=await response.json();
   return data.valid===true&&data.scope==='configurations'&&/^[a-f0-9]{32}$/.test(data.schoolId||'')&&Number(data.expiresAt)>Date.now()/1000;
  }catch{return false;}
 }
 async function read(value){
  const u=value instanceof URL?value:new URL(value),compressed=u.searchParams.get('configz');
  const id=u.searchParams.get('kiosk_id'),hash=new URLSearchParams(u.hash.slice(1));
  for(const key of ['kiosk_id','configz','config','preview','edu-profile'])if(u.searchParams.getAll(key).length>1)throw Error('Odkaz obsahuje nejednoznačnou konfiguraci.');
  if(hash.getAll('config').length>1||Number(u.searchParams.has('configz'))+Number(u.searchParams.has('config'))+Number(hash.has('config'))>1)throw Error('Odkaz obsahuje nejednoznačnou konfiguraci.');
  if(u.searchParams.has('kiosk_id')&&(u.searchParams.has('configz')||u.searchParams.has('config')||hash.has('config')||u.searchParams.has('preview')))throw Error('Publikovaný obsah nelze přepsat parametry odkazu.');
  if(u.searchParams.has('kiosk_id')){
   if(!/^[a-f0-9]{32}$/.test(id))throw Error('Identifikátor konfigurace není platný.');
   let result,response;
   try{response=await fetch(API+'/api/public/kiosk-outputs/'+id+(u.searchParams.get('edu-profile')?'?profile='+encodeURIComponent(u.searchParams.get('edu-profile')):''),{cache:'no-store',credentials:'same-origin',redirect:'error',signal:AbortSignal.timeout(90000)});result=await response.json();}
   catch{throw Error('Uloženou konfiguraci nyní nelze načíst. Zkontrolujte připojení a zkuste stránku obnovit.');}
   if(!response.ok||!result.config||!Array.isArray(result.config.pages)||!result.config.pages.some(p=>p?.id==='home'))throw Error(typeof result.detail==='string'?result.detail:'Uložená konfigurace není dostupná.');
   return result.config;
  }
  const legacy=u.searchParams.get('config')||new URLSearchParams(u.hash.slice(1)).get('config');
  if(!await authorizedPreview())throw Error('Tento odkaz není ověřený výstup školy. Otevřete původní konfiguraci v administraci a vytvořte nový výstupní odkaz.');
  if(!compressed&&!legacy)return null;
  try{
   const encoded=compressed||legacy;
   const bytes=Uint8Array.from(atob(encoded.replace(/-/g,'+').replace(/_/g,'/')),ch=>ch.charCodeAt(0));
   const raw=compressed?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text():new TextDecoder('utf-8',{fatal:true}).decode(bytes);
   const data=JSON.parse(raw);
   if(!data||!Array.isArray(data.pages)||!data.pages.some(p=>p?.id==='home'))throw Error('Invalid kiosk snapshot');
   return data;
  }catch(cause){
   throw Error('Odkaz je neúplný nebo poškozený. Použijte jeho úplnou původní adresu. Uložená konfigurace se tím nemění.',{cause});
  }
 }
 root.EduvizeKioskOutputLink=Object.freeze({url,read,authorizedPreview});
})(window);
