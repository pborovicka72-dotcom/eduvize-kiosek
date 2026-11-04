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
  u.searchParams.set('viewMode',mode);
  if(mode==='nsp'){
   u.searchParams.set('output','nsp');
   u.searchParams.set('orientation',config.layoutOrientation==='portrait'?'portrait':'landscape');
   u.searchParams.set('style',String(config.layoutStyle||1));
   u.searchParams.set('block',String(config.layoutBlock||1));
  }
  return root.EduvizeOutputModes.url(u,mode);
 }
 root.EduvizeKioskOutputLink=Object.freeze({url});
})(window);
