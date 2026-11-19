/* Resolve linked application settings from the active school profile, never browser defaults. */
(function(root){
 'use strict';
 const fields={'setting-place':'misto','setting-lat':'lat','setting-lon':'lon','setting-region':'region','setting-source':'zdroj','setting-station':'station'};
 function apply(config,weather){
  const v=weather?.values;if(!v)return false;
  const lat=Number(v['setting-lat']),lon=Number(v['setting-lon']);
  if(!v['setting-lat']||!v['setting-lon']||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<48.5||lat>51.2||lon<12||lon>19)return false;
  let changed=false;
  for(const page of config.pages||[])for(const item of page.buttons||[]){
   if(item.type!=='app'||item.target!=='weather')continue;
   const u=new URL(item.appUrl||root.EduvizeKioskApps.urls.weather);
   if(u.searchParams.get('weather_settings')!=='profile'&&['misto','place','lat','lon','station'].some(k=>u.searchParams.has(k)))continue;
   const before=u.href;u.searchParams.delete('place');
   for(const [field,key]of Object.entries(fields)){u.searchParams.delete(key);if(v[field]!==undefined&&v[field]!=='')u.searchParams.set(key,String(v[field]));}
   if(v['setting-source']==='meteogram')u.searchParams.delete('station');
   for(const [field,key]of [['setting-hourly-forecast','hourly'],['setting-daily-forecast','daily'],['setting-text-forecast','text'],['setting-station-text-forecast','station_text']])if(typeof v[field]==='boolean'&&!u.searchParams.has(key))u.searchParams.set(key,v[field]?'on':'off');
   u.searchParams.set('weather_settings','profile');u.searchParams.sort();item.appUrl=u.href;changed=changed||before!==u.href;
  }
  return changed;
 }
 function applyTransport(config,transport){
  if(!transport||!Array.isArray(transport.stops)||!transport.stops.length||!transport.stops.every(s=>typeof s==='string'&&s.trim()))return false;
  if(!['pid','cz_gtfs'].includes(transport.source))return false;
  let changed=false;
  for(const page of config.pages||[])for(const item of page.buttons||[]){
   if(item.type!=='app'||item.target!=='transport')continue;
   const u=new URL(item.appUrl||root.EduvizeKioskApps.urls.transport),mode=u.searchParams.get('transport_settings');
   if(mode!=='profile'&&mode!=='browser'&&['stops','name'].some(k=>u.searchParams.has(k)))continue;
   const before=u.href;u.searchParams.delete('name');u.searchParams.set('source',transport.source);u.searchParams.set('stops',transport.stops.join('|'));
   for(const key of ['minutes','limit','pageSeconds'])if(transport.values?.[key]!==undefined)u.searchParams.set(key,String(transport.values[key]));
   if(Array.isArray(transport.types))u.searchParams.set('types',transport.types.join(','));
   u.searchParams.set('transport_settings','profile');u.searchParams.sort();item.appUrl=u.href;changed=changed||before!==u.href;
  }
  return changed;
 }
 function projectSchool(config,identity){
  // Inherited card values belong only to the preview/shared snapshot, not the draft.
  // An existing empty field is an explicit clear and must never be restored automatically.
  if(identity?.schemaVersion!==1||!identity.data||typeof identity.data!=='object'||Array.isArray(identity.data))return config;
  const updates={};
  for(const key of ['name','address','ico']){
   if(Object.prototype.hasOwnProperty.call(config.school||{},key))continue;
   const value=identity.data[key];
   if(typeof value!=='string'||!value.trim())continue;
   if(key==='ico'&&!/^[0-9]{8}$/.test(value.trim()))continue;
   if(key!=='ico'&&value.length>300)continue;
   updates[key]=value.trim();
  }
  return Object.keys(updates).length?{...config,school:{...(config.school||{}),...updates}}:config;
 }
 async function loadBundle(){
  await root.EduvizeAdminAuth?.ready;
  // The shared profile script is loaded asynchronously by the common toolbar.
  // Authentication can finish before that script has exported its request API.
  const started=Date.now();
  while(!root.EduvizeProfiles){
   if(!root.EduvizeAdminAuth?.status().profileId)return null;
   if(Date.now()-started>=10000)throw Error('Správa profilů se nepodařila načíst. Obnovte stránku.');
   await new Promise(resolve=>setTimeout(resolve,50));
  }
  const id=root.EduvizeAdminAuth?.status().profileId;if(!id)return null;
  const p=await root.EduvizeProfiles.request('/'+id,{fresh:true});
  if(root.EduvizeAdminAuth?.status().profileId!==id)return null;
  return {profileId:id,weather:p.apps?.weather?.config||null,transport:p.apps?.transport?.config||null,school:p.apps?.['school-identity']?.config||null};
 }
 async function load(){return (await loadBundle())?.weather||null;}
 function weatherCaption(item,weather){
  const u=new URL(item.appUrl||root.EduvizeKioskApps.urls.weather);
  if(u.searchParams.get('weather_settings')!=='profile'&&['misto','place','lat','lon','station'].some(k=>u.searchParams.has(k)))return 'Vlastní lokalita tlačítka: '+(u.searchParams.get('misto')||u.searchParams.get('place')||u.searchParams.get('station')||[u.searchParams.get('lat'),u.searchParams.get('lon')].join(', '));
  return weather?.values?.['setting-place']?'Lokalita z nastavení počasí školy: '+weather.values['setting-place']:'Nastavení počasí tohoto profilu zatím není načtené.';
 }
 function transportCaption(item,transport){
  const u=new URL(item.appUrl||root.EduvizeKioskApps.urls.transport),mode=u.searchParams.get('transport_settings');
  if(mode!=='profile'&&mode!=='browser'&&['stops','name'].some(k=>u.searchParams.has(k)))return 'Vlastní zastávky tlačítka: '+(u.searchParams.get('stops')||u.searchParams.get('name')).split('|').join(', ');
  return transport?.stops?.length?'Zastávky z nastavení dopravy školy: '+transport.stops.join(', '):'Nastavení dopravy tohoto profilu zatím není načtené.';
 }
 root.EduvizeKioskWeather=Object.freeze({apply,applyTransport,projectSchool,load,loadBundle,weatherCaption,transportCaption});
})(window);
