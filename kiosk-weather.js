/* Resolve school weather settings before building kiosk previews and shared outputs. */
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
   u.searchParams.set('weather_settings','profile');item.appUrl=u.href;changed=changed||before!==u.href;
  }
  return changed;
 }
 async function load(){await root.EduvizeAdminAuth?.ready;const id=root.EduvizeAdminAuth?.status().profileId;if(!id||!root.EduvizeProfiles)return null;const p=await root.EduvizeProfiles.request('/'+id,{fresh:true});return p.apps?.weather?.config||null;}
 root.EduvizeKioskWeather=Object.freeze({apply,load});
})(window);
