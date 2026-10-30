import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.textContent = ''; this.dataset = {}; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  remove() { this.removed = true; }
}
const document = {createElement: tag => new Element(tag)};
const context = {window: {}, document, URL};
vm.runInNewContext(fs.readFileSync(new URL('../school.js', import.meta.url), 'utf8'), context);
const school = context.window.EduvizeSchool;
const host = new Element('article');
const all = element => [element, ...element.children.flatMap(all)];
school.render(host, {});
assert.ok(all(host).some(e => e.textContent === 'Naše škola'));
assert.ok(all(host).some(e => e.textContent === 'Informace o škole budou brzy doplněny.'));
assert.equal(all(host).filter(e => e.tagName === 'a').length, 0);

let config = {school: {name: '<script>alert(1)</script>', description: 'První odstavec\nDruhý odstavec',
  address: 'Školní 1\nPraha', email: 'info@example.org', phone: '+420 123 456 789',
  website: 'https://example.org/', photo: 'javascript:alert(1)'}};
let opened;
school.render(host, config, url => { opened = url; });
assert.ok(all(host).some(e => e.textContent === config.school.name));
assert.equal(all(host).filter(e => e.tagName === 'script').length, 0);
assert.equal(all(host).filter(e => e.tagName === 'img').length, 0);
assert.equal(all(host).some(e => e.textContent === 'Úřední hodiny'), false);
assert.equal(all(host).filter(e => e.tagName === 'a').length, 1);
const website=all(host).find(e=>e.tagName==='a');website.onclick({preventDefault(){}});assert.equal(opened,'https://example.org/');
assert.equal(all(host).some(e => e.textContent === config.school.website), false);
school.render(host, {school:{description:'x'.repeat(400)}});
const description=all(host).find(e=>e.className==='school-text');
assert.equal(description.textContent.length, school.limits.description);

let changes = 0;
const editor = new Element('div');
const controller = school.editor(editor, () => config, () => changes++);
controller.refresh();
const input = all(editor).find(e => e.id === 'school-name');
input.value = 'Základní škola Žďár';
input.oninput();
assert.equal(changes, 1);
assert.equal(config.school.name, input.value);
// Model the same JSON storage and UTF-8 shared-link roundtrip as the kiosk.
config = JSON.parse(Buffer.from(Buffer.from(JSON.stringify(config)).toString('base64'), 'base64').toString());
school.render(host, config);
assert.ok(all(host).some(e => e.textContent === 'Základní škola Žďár'));
config = {};
controller.refresh();
assert.equal(input.value, '');
assert.equal(school.webUrl('data:text/html,test'), null);
console.log('School rendering, editor, empty fields and shared data passed.');
