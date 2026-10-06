import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeModel, baseDrawing, wiresDrawing, portsDrawing } from './dist/model.js';

const data = JSON.parse(await readFile(new URL('./dist/data.json', import.meta.url), 'utf8'));
const model = makeModel(data);
const byTag = new Map(data.tags.map(t => [t.tag, t]));
assert.equal(byTag.size, 42);
assert.equal(data.tags.reduce((sum, t) => sum + t.qty, 0), 125);
assert.equal(byTag.get('0VCC').qty, 17);
assert.equal(byTag.get('24VCC').qty, 12);
assert.equal(byTag.has('W019'), false);
for (const tag of byTag.keys()) {
  const selected = model.select(tag);
  assert.ok(selected.direct.length > 0, `${tag}: conexão ausente`);
  assert.ok(selected.direct.every(e => e.tag === tag));
  for (const e of selected.edges) assert.ok(model.ports.has(e.from) && model.ports.has(e.to));
}

const g9se = { A1:'24VCC', A2:'0VCC', T11:'W003', T12:'W005', T21:'W004', T22:'W006', T31:'W016', T32:'W018', T33:'24VCC', X1:'W020', 13:'0VCC', 14:'0VCC', 23:'24VCC', 24:'W007' };
assert.equal(data.g9se.terminals.length, 14);
for (const [pin, tag] of Object.entries(g9se)) {
  assert.equal(data.g9se.terminals.find(t => t.id === pin)?.tag, tag);
  const edges = model.edges.filter(e => e.from === `RS.${pin}` || e.to === `RS.${pin}`);
  assert.equal(edges.length, 1, `G9SE ${pin}: ligação duplicada ou ausente`);
  assert.equal(edges[0].tag, tag, `G9SE ${pin}: tag incorreta`);
}
for (const [tag, pin] of [['U1','2T1'], ['V1','4T2'], ['W1','6T3']]) {
  const selected = model.select(tag);
  assert.equal(selected.direct.length, 1);
  assert.equal(selected.direct[0].from, `C3.${pin}`);
  assert.equal(selected.direct[0].to, `BM.${tag}`);
  assert.equal(selected.related.length, 2);
  assert.ok(selected.related.every(e => e.tag === null && e.bus === tag));
  for (const c of ['C1', 'C2', 'C3']) assert.ok(selected.nodes.has(`${c}.${pin}`));
  assert.equal(selected.nodes.size, 4);
  assert.equal(model.select(tag, false).related.length, 0);
}
assert.equal(model.select('__untagged', false).direct.length, 6);
for (const [tag, a, b] of [
  ['R3','C1.1L1','C2.5L3'], ['S3','C1.3L2','C2.3L2'],
  ['T3','C1.5L3','C2.1L1'], ['T6','C3.3L2','C3.5L3']
]) {
  const selected = model.select(tag, false);
  assert.equal(selected.direct.length, 1);
  assert.deepEqual([selected.direct[0].from, selected.direct[0].to], [a, b]);
}
assert.ok(model.select('T1').direct.some(e => e.missing));
assert.ok(model.select('T2').direct.some(e => e.to === 'T2.loose' || e.from === 'T2.loose'));
assert.equal(model.select('W003').nodes.has('RS.T12'), false, 'Sem simulação de contato interno');
assert.equal(model.select('W037').nodes.has('C1.A2'), false, 'Sem ligação implícita através da bobina');
assert.equal(model.select('S1').directNodes.has('D3.inN'), true);
assert.equal(model.select('R1').directNodes.has('D3.inN'), false);

for (const edge of model.edges) {
  const points = model.routePoints(edge);
  const a = model.ports.get(edge.from), b = model.ports.get(edge.to);
  assert.deepEqual(points[0], [a.x, a.y]);
  assert.deepEqual(points.at(-1), [b.x, b.y]);
  assert.ok(points.every(p => p.every(Number.isFinite)));
}
const html = await readFile(new URL('./dist/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('./dist/app.js', import.meta.url), 'utf8');
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
for (const [, id] of app.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.has(id), `Elemento ausente: ${id}`);
const drawing = baseDrawing(model) + wiresDrawing(model) + portsDrawing(model);
assert.ok(drawing.includes('RS.T11') && drawing.includes('RS.T33'));
assert.equal((drawing.match(/class="wire dim"/g) || []).length, model.edges.filter(e => e.kind === 'wire').length);
console.log('Verificado: 42 tags, 125 etiquetas, 14 bornes do G9SE, jumpers e três grupos independentes de saídas.');
