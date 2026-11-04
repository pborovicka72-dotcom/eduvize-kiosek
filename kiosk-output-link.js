/* New output links always carry the selected surface and a fresh configuration snapshot. */
(function(root){
 'use strict';
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
  await read(output); // Never copy a link that cannot restore its own snapshot.
  return output;
 }
 async function read(value){
  const u=value instanceof URL?value:new URL(value),compressed=u.searchParams.get('configz');
  const legacy=u.searchParams.get('config')||new URLSearchParams(u.hash.slice(1)).get('config');
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
 root.EduvizeKioskOutputLink=Object.freeze({url,read});
})(window);
