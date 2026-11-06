/* First-party service paths belong to the current deployment, never a hosting provider. */
(function(root){
 'use strict';
 const origin=new URL(root.location.origin).origin;
 const deployment=new URL(origin);
 const local=['localhost','127.0.0.1','[::1]'].includes(deployment.hostname);
 const hosted=deployment.protocol==='https:'&&!deployment.port&&['test.skola.eduvize.cz','skola.eduvize.cz'].includes(deployment.hostname);
 if(!hosted&&!local){
  throw Error('Kiosek musí běžet v prostředí Eduvize.');
 }
 function url(path){
  if(typeof path!=='string'||!path.startsWith('/')||path.startsWith('//')||path.includes('\\'))throw Error('Neplatná cesta služby Eduvize.');
  const value=new URL(path,origin);
  if(value.origin!==origin)throw Error('Služba musí patřit do stejného prostředí.');
  return value.href;
 }
 root.EduvizeKioskEnvironment=Object.freeze({origin,url});
})(window);
