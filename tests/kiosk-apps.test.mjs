import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const context = {window: {}, URL};
vm.runInNewContext(fs.readFileSync(new URL('kiosk-apps.js', root), 'utf8'), context);
const apps = context.window.EduvizeKioskApps;
for (const [app, target] of Object.entries(apps.urls)) {
  for (const item of [{type: 'app', target: app}, {type: 'url', target}]) {
    const url = apps.resolve(item);
    assert.equal(url.searchParams.get('viewMode'), 'kiosk', app);
    assert.equal(url.searchParams.get('output'), 'kiosk', app);
  }
}
const legacy = {pages: [{buttons: [
  {type: 'url', target: 'https://eduvize-weather.onrender.com/display?school=123&viewMode=web', zoom: 60},
  {type: 'url', target: 'https://eduvize-aktuality.onrender.com/?display=0&school=42'},
  {type: 'url', target: 'https://example.org/?viewMode=web'}
]}]};
apps.normalize(legacy);
const [weather, news, external] = legacy.pages[0].buttons;
assert.equal(apps.resolve(weather).searchParams.get('school'), '123');
assert.equal(apps.resolve(weather).searchParams.get('viewMode'), 'kiosk');
assert.equal(apps.resolve(news).searchParams.get('display'), '1');
assert.equal(apps.resolve(news).searchParams.get('school'), '42');
assert.equal(external.type, 'url');
assert.equal(apps.resolve(external).searchParams.get('viewMode'), 'web');
assert.equal(apps.identify('https://example.org/eduvize-svatky/'), null);
assert.equal(apps.identify('https://eduvize-weather.onrender.com.example.org/'), null);
assert.equal(apps.resolve({type: 'url', target: 'javascript:alert(1)'}), null);
for (const name of ['index.html', 'config.html']) {
  const html = fs.readFileSync(new URL(name, root), 'utf8');
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (match[1].trim()) new vm.Script(match[1], {filename: name});
  }
  // Exercise the real example configuration, including its appended applications.
  const defaults = html.match(/const DEFAULT=([\s\S]*?);const ICON_PATHS=/)[1];
  const scope = {structuredClone};
  vm.runInNewContext('var DEFAULT=' + defaults + ';var config=structuredClone(DEFAULT);', scope);
  apps.normalize(scope.config);
  const buttons = scope.config.pages[0].buttons;
  for (const app of Object.keys(apps.urls)) {
    const item = buttons.find(item => item.type === 'app' && item.target === app);
    assert.ok(item, `${name}: missing ${app}`);
    assert.equal(apps.resolve(item).searchParams.get('output'), 'kiosk');
  }
}
console.log('Kiosk application routing and example configurations passed.');

const picture={type:'url',target:'https://example.org/picture.PNG?size=large',zoom:60};apps.normalize({pages:[{buttons:[picture]}]});assert.equal(picture.type,'image');assert.equal(picture.zoom,undefined);
assert.equal(apps.resolve(picture).searchParams.get('src'),'https://example.org/picture.PNG?size=large');
assert.equal(apps.resolve({type:'image',target:'https://example.org/image?id=1'}).searchParams.get('src'),'https://example.org/image?id=1');
assert.equal(apps.resolve({type:'image',target:'javascript:alert(1)'}),null);
assert.equal(apps.resolve({type:'url',target:'https://eduvize-dokumenty-api.onrender.com/api/documents/example/file'}).searchParams.get('document'),'example');

const previousImage={type:'app',target:'documents',appUrl:'https://eduvize-dokumenty-api.onrender.com/api/documents/picture/file'};
apps.normalize({pages:[{buttons:[previousImage]}]});assert.equal(previousImage.type,'document');assert.equal(apps.resolve(previousImage).searchParams.get('document'),'picture');

const documents=apps.resolve({type:'app',target:'documents'});
assert.equal(documents.hostname,'eduvize-dokumenty-api.onrender.com');assert.equal(documents.pathname,'/display');
const legacyDocuments=apps.resolve({type:'url',target:'https://pborovicka72-dotcom.github.io/eduvize-dokumenty/index.html?pdf_columns=2'});
assert.equal(legacyDocuments.hostname,'eduvize-dokumenty-api.onrender.com');assert.equal(legacyDocuments.searchParams.get('pdf_columns'),'2');

/* Restoring a preview must refresh its application version without losing settings. */
for (const [app, target] of Object.entries(apps.urls)) {
 const old = new URL(target);
 old.searchParams.set('eduvize_ui_version', 'old');
 old.searchParams.set('station', 'saved-station');
 old.searchParams.set('limit', '6');
 const restored = apps.refreshUrl(old.href);
 assert.equal(restored.searchParams.get('eduvize_ui_version'), apps.version, app);
 assert.equal(restored.searchParams.get('station'), 'saved-station', app);
 assert.equal(restored.searchParams.get('limit'), '6', app);
}
const externalFrame='https://example.org/?viewMode=web&zoom=80';
assert.equal(apps.refreshUrl(externalFrame).href,externalFrame);
const restoredImage=apps.refreshUrl('https://pborovicka72-dotcom.github.io/eduvize-styly/design-system/image-viewer.html?src=https%3A%2F%2Fexample.org%2Fimage.png&v=old');
assert.equal(restoredImage.searchParams.get('v'),apps.version);
assert.equal(restoredImage.searchParams.get('src'),'https://example.org/image.png');

const weatherChoice = {type:'app',target:'weather',label:'Počasí',appUrl:'https://eduvize-weather.onrender.com/display?station=0-203-0-11201018001&lat=50&lon=14'};
assert.equal(apps.weatherStyle(weatherChoice), 'standard');
apps.setWeatherStyle(weatherChoice, 'station');
assert.equal(weatherChoice.label, 'Meteostanice');
assert.equal(apps.weatherStyle(weatherChoice), 'station');
assert.equal(apps.resolve(weatherChoice).searchParams.get('weather_style'), 'station');
assert.equal(apps.resolve(weatherChoice).searchParams.get('station'), '0-203-0-11201018001');
assert.equal(apps.resolve(weatherChoice).searchParams.get('lat'), '50');
const weatherReloaded=JSON.parse(JSON.stringify(weatherChoice));
apps.normalize({pages:[{buttons:[weatherReloaded]}]});
assert.equal(apps.weatherStyle(weatherReloaded), 'station');
apps.setWeatherStyle(weatherReloaded, 'standard');
assert.equal(weatherReloaded.label, 'Počasí');
assert.equal(apps.resolve(weatherReloaded).searchParams.get('weather_style'), 'standard');
const newWeather={type:'app',target:'weather'};
apps.setWeatherStyle(newWeather,'station');
assert.equal(apps.resolve(newWeather).searchParams.get('weather_style'),'station');
assert.equal(apps.resolve(newWeather).searchParams.get('output'),'kiosk');
const otherApp={type:'app',target:'news',label:'Aktuality'};
apps.setWeatherStyle(otherApp,'station');
assert.equal(otherApp.label,'Aktuality');

for(const [app,title]of Object.entries(apps.names)){
 const button={type:'url',target:'https://example.org',label:'Nové tlačítko',appUrl:'https://example.org'};
 apps.selectApp(button,app);assert.equal(button.label,title);assert.equal(button.target,app);assert.equal(button.appUrl,undefined);
}
const regular={type:'app',target:'weather',label:'Počasí'},station={type:'app',target:'weather',label:'Meteostanice'};
apps.setWeatherStyle(station,'station');assert.notEqual(apps.buttonKey(regular),apps.buttonKey(station));
apps.setWeatherText(station,false);assert.equal(apps.resolve(station).searchParams.get('text'),'off');
assert.equal(apps.weatherText(station),false);assert.equal(apps.weatherStyle(station),'station');
apps.setWeatherText(station,true);assert.equal(apps.resolve(station).searchParams.get('text'),'on');
apps.setWeatherStyle(station,'standard');assert.equal(apps.resolve(station).searchParams.get('text'),'on');
const saved=JSON.parse(JSON.stringify(station));assert.equal(apps.buttonKey(saved),apps.buttonKey(station));
