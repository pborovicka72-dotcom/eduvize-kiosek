import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const root={};const context=vm.createContext({window:root,URL});
for(const file of ['kiosk-apps.js','kiosk-news.js','kiosk-config-file.js'])vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
const source=(id,url,mode='auto')=>({id,name:id,url,mode,categories:'all'});
test('different menu buttons keep their sources through portable save and reload',()=>{
 const a={type:'app',target:'news',label:'Škola'},b={type:'app',target:'news',label:'Město'};
 root.EduvizeKioskNews.assign(a,source('school','https://school.example/news','html'));
 root.EduvizeKioskNews.assign(b,source('city','https://city.example/rss','feed'));
 const data=root.EduvizeKioskConfigFile.parse(root.EduvizeKioskConfigFile.stringify({pages:[{id:'home',buttons:[a,b]}]}));
 const [first,second]=data.pages[0].buttons.map(item=>root.EduvizeKioskApps.resolve(item,'https://kiosk.example/'));
 assert.equal(first.searchParams.get('url'),'https://school.example/news');
 assert.equal(second.searchParams.get('url'),'https://city.example/rss');
 assert.equal(second.searchParams.get('mode'),'feed');assert.equal(second.searchParams.get('viewMode'),'kiosk');
});
test('switching one source preserves the other button and its display settings',()=>{
 const a={type:'app',target:'news',appUrl:root.EduvizeKioskApps.urls.news+'&limit=3'},b={type:'app',target:'news'};
 root.EduvizeKioskNews.assign(a,source('first','https://first.example/'));
 root.EduvizeKioskNews.assign(b,source('second','https://second.example/'));
 root.EduvizeKioskNews.assign(a,source('third','https://third.example/'));
 assert.equal(root.EduvizeKioskNews.snapshot(b).url,'https://second.example/');
 assert.equal(new URL(a.appUrl).searchParams.get('limit'),'3');
});
test('legacy single-source profiles remain selectable',()=>{
 const rows=root.EduvizeKioskNews.sources({values:{url:'https://school.example/',mode:'html'}});
 assert.equal(rows.length,1);assert.equal(rows[0].url,'https://school.example/');
 assert.equal(root.EduvizeKioskNews.sources({}).length,0);
});
