const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const root = { URL, location: { origin: 'https://test.skola.eduvize.cz' } };
root.EduvizeNSPLayouts = {
  layouts: { landscape: { 1: [[3840, 2160]], 2: [[1200, 2160], [2640, 1480], [2640, 680]] }, portrait: { 1: [[2160, 3840]] } },
  positions: { landscape: { 1: [[0, 0]], 2: [[0, 0], [1200, 0], [1200, 1480]] }, portrait: { 1: [[0, 0]] } }
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'player-model.js'), 'utf8'), root);
const model = root.EduvizePlayerModel;
const id = 'a'.repeat(32);

test('one segment can rotate two published outputs independently of other segments', () => {
  const value = model.empty('landscape', 2);
  value.segments[0].entries.push({ appId: 'news', outputId: id, seconds: 15 }, { appId: 'weather', outputId: 'b'.repeat(32), seconds: 45 });
  value.segments[1].entries.push({ appId: 'menu', outputId: 'c'.repeat(32), seconds: 30 });
  value.segments[2].entries.push({ appId: 'gallery', outputId: 'd'.repeat(32), seconds: 30 });
  const normalized = model.validate(value);
  assert.equal(normalized.segments[0].entries.length, 2);
  assert.equal(normalized.segments[1].entries.length, 1);
  assert.equal(model.layout('landscape', 2)[2].y, 1480);
});

test('invalid durations, output ids and incomplete segments cannot be published', () => {
  const value = model.empty();
  assert.throws(() => model.validate(value));
  value.segments[0].entries.push({ appId: 'news', outputId: id, seconds: 4 });
  assert.throws(() => model.validate(value));
  value.segments[0].entries[0].seconds = 30;
  value.segments[0].entries[0].outputId = 'invalid';
  assert.throws(() => model.validate(value));
});

test('child renderer URL remains same origin and names only an output ID', () => {
  assert.equal(model.renderer('news', id), 'https://test.skola.eduvize.cz/aktuality/published?edu-output=' + id);
  assert.throws(() => model.renderer('untrusted', id));
});
