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
