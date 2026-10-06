import { SIZE, makeModel, baseDrawing, wiresDrawing, portsDrawing, escapeXML } from './model.js';

const $ = id => document.getElementById(id);
const esc = escapeXML;
const svg = $('panel-map');
const state = { tag: 'U1', category: 'all', mode: 'diagram', related: true, selection: null };
let model, data, records, wireElements, portElements, deviceElements;
let view = { x: 0, y: 0, w: SIZE.width, h: SIZE.height };
let toastTimer;

function toast(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3200);
}

function setDrawer(open) {
  $('inspector').classList.toggle('drawer-open', open);
  $('drawer-handle').setAttribute('aria-expanded', String(open));
}

function setMode(mode) {
  state.mode = mode;
  const diagram = mode === 'diagram';
  $('map-viewport').hidden = !diagram;
  $('photo-view').hidden = diagram;
  for (const name of ['diagram', 'photo']) {
    $(`view-${name}`).classList.toggle('active', mode === name);
    $(`view-${name}`).setAttribute('aria-pressed', String(mode === name));
  }
  $('show-all').disabled = !diagram;
  document.querySelector('.diagram-note').textContent = diagram
    ? 'Traçados esquemáticos · componentes na posição da foto'
    : 'Foto fornecida por você · vista interna do painel';
}

function endpoint(id) {
  const p = model.ports.get(id);
  const device = p.device === 'RS' ? 'G9SE' : p.device === 'F' ? 'Fonte' : p.device === 'B' ? 'Borneira' : p.device === 'BM' ? 'Borne' : p.device === 'P' ? 'Porta' : p.device === 'pending' ? 'A confirmar' : p.device;
  const side = p.device === 'B' ? (id.endsWith('.t') ? ' · superior' : ' · inferior') : '';
  return `<span class="endpoint"><span class="device-code">${esc(device)}</span> <span class="pin-code">${esc(p.pin)}</span>${esc(side)}</span>`;
}

function edgeCard(edge, kind = 'direct') {
  const note = edge.tag === null ? 'Interligação sem etiqueta' : edge.missing ? 'Ponta a confirmar' : '';
  return `<div class="connection-card ${kind}">${endpoint(edge.from)}<span class="connection-arrow" aria-label="conectado a">↕</span>${endpoint(edge.to)}${note ? `<small>${esc(note)}</small>` : ''}</div>`;
}

function renderDetail() {
  const selection = state.selection;
  const record = records.get(state.tag);
  const special = state.tag === '__untagged';
  $('selection-title').textContent = special ? 'Sem tag' : state.tag || 'Selecione';
  $('selection-group').textContent = special ? 'Saídas dos contatores' : record?.group || 'Escolha uma tag';
  $('selection-quantity').hidden = !record;
  if (record) $('selection-quantity').textContent = `${record.qty} etiqueta${record.qty === 1 ? '' : 's'}`;
  $('drawer-tag').textContent = special ? 'Sem tag' : state.tag || 'Buscar';
  $('active-wire').hidden = !state.tag;
  $('active-wire').querySelector('b').textContent = special ? 'Sem tag' : state.tag || '';
  $('clear-selection').disabled = !state.tag;

  if (!selection) {
    $('connection-detail').innerHTML = '<p class="detail-note">Busque uma tag ou toque em um borne para localizar suas conexões no painel.</p>';
    return;
  }
  const logical = state.tag === '0VCC' || state.tag === '24VCC' || state.tag === 'R1' || state.tag === 'S1';
  let content = `<h2 class="detail-heading">${logical ? 'Pontos com a mesma tag' : special ? 'Interligações correspondentes' : 'Conexões do fio'}</h2>`;
  if (logical) {
    const points = [...selection.directNodes].map(id => `<li>${endpoint(id)}</li>`).join('');
    content += `<ul class="point-list">${points}</ul><p class="detail-note">Pontos identificados com a mesma tag. O percurso dentro das canaletas está representado de forma esquemática.</p>`;
  } else {
    content += selection.direct.map(edge => edgeCard(edge)).join('');
  }
  if (record?.note) {
    const pending = selection.direct.some(e => e.missing);
    content += `<p class="detail-note${pending ? ' pending' : ''}">${esc(record.note)}</p>`;
  }
  if (special || ['U1', 'V1', 'W1'].includes(state.tag)) {
    content += `<p class="detail-note">${esc(data.notes.outputs)}</p>`;
  }
  const relatedTags = [...new Set(selection.related.map(e => e.tag).filter(Boolean))];
  const untagged = selection.related.filter(e => e.tag === null);
  if (relatedTags.length || untagged.length) {
    content += '<div class="related-title">Conexões associadas · destaque verde</div>';
    if (relatedTags.length) content += `<div class="related-tags">${relatedTags.map(tag => `<button data-select="${esc(tag)}">${esc(tag)}</button>`).join('')}</div>`;
    content += untagged.map(edge => edgeCard(edge, 'related')).join('');
    if (relatedTags.length) content += '<p class="detail-note">Fios ligados aos mesmos bornes. Toque em outra tag para ver seus detalhes.</p>';
  }
  if (state.tag === '__untagged') content += '<p class="detail-note">São três linhas distintas: 2T1 com 2T1, 4T2 com 4T2 e 6T3 com 6T3.</p>';
  $('connection-detail').innerHTML = content;
  $('connection-detail').querySelectorAll('[data-select]').forEach(button => button.addEventListener('click', () => selectTag(button.dataset.select)));
}

function renderHighlights() {
  const selection = state.selection;
  const activeIds = new Set(selection?.edges.map(e => e.id) || []);
  for (const edge of model.edges) {
    if (edge.kind !== 'wire') continue;
    const el = wireElements.get(edge.id);
    el.classList.toggle('selected', !!selection?.directIds.has(edge.id));
    el.classList.toggle('related', activeIds.has(edge.id) && !selection?.directIds.has(edge.id));
    el.classList.toggle('dim', !activeIds.has(edge.id));
  }
  const directDevices = new Set();
  const relatedDevices = new Set();
  for (const p of model.ports.values()) {
    const active = !!selection?.directNodes.has(p.id);
    const associated = !!selection?.nodes.has(p.id) && !active;
    const el = portElements.get(p.id);
    el.classList.toggle('active', active);
    el.classList.toggle('associated', associated);
    if (active) directDevices.add(p.device);
    else if (associated) relatedDevices.add(p.device);
  }
  for (const d of model.devices.values()) {
    const el = deviceElements.get(d.id);
    el.classList.toggle('device-active', directDevices.has(d.id));
    el.classList.toggle('device-associated', relatedDevices.has(d.id) && !directDevices.has(d.id));
  }
  document.querySelectorAll('.tag-button').forEach(el => {
    const active = el.dataset.tag === state.tag;
    el.classList.toggle('active', active);
    el.setAttribute('aria-pressed', String(active));
  });
  $('untagged').classList.toggle('active', state.tag === '__untagged');
  $('untagged').setAttribute('aria-pressed', String(state.tag === '__untagged'));
}

function selectTag(tag, { closeDrawer = true } = {}) {
  if (tag !== null && tag !== '__untagged' && !records.has(tag)) return;
  state.tag = tag;
  state.selection = tag ? model.select(tag, state.related) : null;
  renderHighlights();
  renderDetail();
  $('search-results').hidden = true;
  if (tag) {
    $('tag-search').value = '';
    setMode('diagram');
  }
  if (closeDrawer && matchMedia('(max-width: 800px)').matches) {
    $('tag-search').blur();
    setDrawer(false);
  }
  const url = new URL(location.href);
  if (tag && tag !== '__untagged') url.searchParams.set('tag', tag);
  else url.searchParams.delete('tag');
  history.replaceState(null, '', url.pathname + url.search + url.hash);
}

function renderCatalog() {
  const list = data.tags.filter(t => state.category === 'all' || t.group === state.category);
  $('catalog-count').textContent = list.length;
  $('tag-grid').innerHTML = list.map(t => `<button class="tag-button${t.tag === state.tag ? ' active' : ''}" data-tag="${esc(t.tag)}" aria-pressed="${t.tag === state.tag}" title="${esc(t.points)}"><span>${esc(t.tag)}</span><span>${t.qty}</span></button>`).join('');
  $('tag-grid').querySelectorAll('button').forEach(button => button.addEventListener('click', () => selectTag(button.dataset.tag)));
  document.querySelectorAll('[data-category]').forEach(button => {
    button.classList.toggle('active', button.dataset.category === state.category);
    button.setAttribute('aria-pressed', String(button.dataset.category === state.category));
  });
}

function normalize(value) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s/g, ''); }
function searchTags(value) {
  const term = normalize(value);
  if (!term) return [];
  return data.tags.filter(record => {
    const direct = model.select(record.tag, false);
    const names = [...direct.directNodes].map(id => model.ports.get(id).label).join(' ');
    return normalize(`${record.tag} ${record.points} ${names}`).includes(term);
  }).sort((a, b) => Number(normalize(b.tag) === term) - Number(normalize(a.tag) === term)
    || Number(normalize(b.tag).startsWith(term)) - Number(normalize(a.tag).startsWith(term)));
}

function renderSearch() {
  const value = $('tag-search').value.trim();
  $('search-results').hidden = !value;
  if (!value) return;
  const matches = searchTags(value);
  $('search-results').innerHTML = matches.length ? matches.map(t => `<button data-tag="${esc(t.tag)}"><span>${esc(t.tag)}</span><small>${t.qty} etiquetas · ${esc(t.group)}</small></button>`).join('') : '<p>Nenhuma tag encontrada.</p>';
  $('search-results').querySelectorAll('button').forEach(button => button.addEventListener('click', () => selectTag(button.dataset.tag)));
}

function setView(next) {
  view = next;
  svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
}
function svgPoint(clientX, clientY) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return { x: SIZE.width / 2, y: SIZE.height / 2 };
  return new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
}
function zoom(factor, center = { x: view.x + view.w / 2, y: view.y + view.h / 2 }) {
  const width = Math.max(180, Math.min(SIZE.width * 2.4, view.w / factor));
  const ratio = width / view.w;
  setView({ x: center.x - (center.x - view.x) * ratio, y: center.y - (center.y - view.y) * ratio, w: width, h: view.h * ratio });
}
function fitSelection() {
  if (!state.selection) return;
  const points = state.selection.edges.flatMap(e => e.kind === 'wire' ? model.routePoints(e) : []);
  if (!points.length) return;
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const minX = Math.min(...xs) - 85, minY = Math.min(...ys) - 85;
  const w = Math.max(250, Math.max(...xs) - minX + 85), h = Math.max(300, Math.max(...ys) - minY + 85);
  setView({ x: minX, y: minY, w, h });
}

function downloadCSV() {
  const cell = value => `"${String(value).replaceAll('"', '""')}"`;
  const rows = [['Tag', 'Quantidade de etiquetas', 'Grupo', 'Pontos e conexões', 'Observação'], ...data.tags.map(t => [t.tag, t.qty, t.group, t.points, t.note])];
  const csv = '\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'Tags_e_conexoes_painel.csv';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Tags e conexões exportadas.');
}

function openG9SE() {
  $('g9se-dialog').showModal();
}
function wireOrPortTag(target) {
  const wireElement = target.closest('[data-edge]');
  if (wireElement) {
    const edge = model.edges.find(e => e.id === wireElement.dataset.edge);
    return edge.tag || edge.bus || '__untagged';
  }
  const portElement = target.closest('[data-port]');
  if (!portElement) return null;
  const id = portElement.dataset.port;
  const candidates = model.edges.filter(e => e.kind === 'wire' && (e.from === id || e.to === id));
  if (candidates.some(e => e.tag === state.tag)) return state.tag;
  return candidates.find(e => e.tag)?.tag || candidates.find(e => e.bus)?.bus || null;
}

function bindMap() {
  const pointers = new Map();
  let gesture = null, moved = false, downTarget = null;
  function snapshotGesture() {
    const points = [...pointers.values()];
    const center = points.length > 1 ? { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 } : points[0];
    if (!center) { gesture = null; return; }
    const dist = points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0;
    const matrix = svg.getScreenCTM();
    gesture = { center, dist, world: svgPoint(center.x, center.y), view: { ...view }, scaleX: matrix?.a || 1, scaleY: matrix?.d || 1 };
  }
  svg.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    if (!pointers.size) { moved = false; downTarget = event.target; }
    else moved = true;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    svg.setPointerCapture(event.pointerId);
    snapshotGesture();
  });
  svg.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.values()];
    const center = points.length > 1 ? { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 } : points[0];
    const dx = center.x - gesture.center.x, dy = center.y - gesture.center.y;
    if (Math.abs(dx) + Math.abs(dy) > 5 || points.length > 1) moved = true;
    if (!moved) return;
    svg.classList.add('is-dragging');
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const scale = points.length > 1 && gesture.dist ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) / gesture.dist : 1;
    const width = Math.max(180, Math.min(SIZE.width * 2.4, gesture.view.w / scale));
    const ratio = width / gesture.view.w;
    setView({ x: gesture.world.x - (gesture.world.x - gesture.view.x) * ratio - dx / gesture.scaleX * ratio,
      y: gesture.world.y - (gesture.world.y - gesture.view.y) * ratio - dy / gesture.scaleY * ratio,
      w: width, h: gesture.view.h * ratio });
  });
  function finishPointer(event, cancelled = false) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (!pointers.size) {
      svg.classList.remove('is-dragging');
      if (!moved && !cancelled && downTarget) {
        const tag = wireOrPortTag(downTarget);
        if (tag) selectTag(tag);
        else {
          const device = downTarget.closest('[data-device]')?.dataset.device;
          if (device === 'RS') openG9SE();
          else if (device) {
            $('tag-search').value = device === 'B' || device === 'BM' ? 'Borne' : device;
            setDrawer(true); renderSearch(); $('tag-search').focus();
          }
        }
      }
      gesture = null;
    } else snapshotGesture();
  }
  svg.addEventListener('pointerup', event => finishPointer(event));
  svg.addEventListener('pointercancel', event => finishPointer(event, true));
  svg.addEventListener('wheel', event => {
    event.preventDefault();
    zoom(Math.exp(-event.deltaY * .0014), svgPoint(event.clientX, event.clientY));
  }, { passive: false });
  svg.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const device = event.target.closest('[data-device]')?.dataset.device;
    if (!device) return;
    event.preventDefault();
    if (device === 'RS') openG9SE();
    else { $('tag-search').value = device === 'B' || device === 'BM' ? 'Borne' : device; setDrawer(true); renderSearch(); $('tag-search').focus(); }
  });
}

async function init() {
  const response = await fetch('./data.json');
  if (!response.ok) throw new Error('Não foi possível carregar as conexões.');
  data = await response.json();
  records = new Map(data.tags.map(t => [t.tag, t]));
  model = makeModel(data);
  svg.insertAdjacentHTML('beforeend', `<g id="components">${baseDrawing(model)}</g><g id="wires">${wiresDrawing(model)}</g><g id="ports">${portsDrawing(model)}</g>`);
  wireElements = new Map([...svg.querySelectorAll('[data-edge]')].map(el => [el.dataset.edge, el]));
  portElements = new Map([...svg.querySelectorAll('[data-port]')].map(el => [el.dataset.port, el]));
  deviceElements = new Map([...svg.querySelectorAll('[data-device]')].map(el => [el.dataset.device, el]));
  const total = data.tags.reduce((sum, t) => sum + t.qty, 0);
  $('total-count').textContent = `${data.tags.length} tags · ${total} etiquetas`;
  $('io-table-body').innerHTML = data.g9se.terminals.map(t => `<tr><td>${esc(t.id)}</td><td>${esc(t.function)}</td><td><button class="io-tag" data-tag="${esc(t.tag)}" title="Destacar ${esc(t.tag)} no painel">${esc(t.tag)}</button></td></tr>`).join('');
  $('io-table-body').querySelectorAll('button').forEach(button => button.addEventListener('click', () => { $('g9se-dialog').close(); selectTag(button.dataset.tag); }));
  $('g9se-source').href = data.g9se.source;
  $('g9se-open').addEventListener('click', openG9SE);
  $('g9se-close').addEventListener('click', () => $('g9se-dialog').close());
  $('g9se-dialog').addEventListener('click', event => { if (event.target === $('g9se-dialog')) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });
  $('export').addEventListener('click', downloadCSV);
  $('view-diagram').addEventListener('click', () => setMode('diagram'));
  $('view-photo').addEventListener('click', () => setMode('photo'));
  $('show-all').addEventListener('change', event => svg.classList.toggle('all-wires', event.target.checked));
  $('include-related').addEventListener('change', event => { state.related = event.target.checked; selectTag(state.tag, { closeDrawer: false }); });
  $('clear-selection').addEventListener('click', () => selectTag(null, { closeDrawer: false }));
  $('untagged').addEventListener('click', () => selectTag('__untagged'));
  $('drawer-handle').addEventListener('click', () => setDrawer(!$('inspector').classList.contains('drawer-open')));
  $('tag-search').addEventListener('input', renderSearch);
  $('tag-search').addEventListener('keydown', event => {
    if (event.key === 'Enter') { const first = searchTags(event.target.value)[0]; if (first) selectTag(first.tag); }
    if (event.key === 'Escape') { event.target.value = ''; renderSearch(); }
  });
  document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => { state.category = button.dataset.category; renderCatalog(); }));
  $('zoom-in').addEventListener('click', () => zoom(1.35));
  $('zoom-out').addEventListener('click', () => zoom(1 / 1.35));
  $('zoom-fit').addEventListener('click', () => setView({ x: 0, y: 0, w: SIZE.width, h: SIZE.height }));
  $('zoom-selection').addEventListener('click', fitSelection);
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !/INPUT|TEXTAREA/.test(event.target.tagName) && !$('g9se-dialog').open) { event.preventDefault(); setDrawer(true); $('tag-search').focus(); }
  });
  bindMap();
  renderCatalog();
  const initialTag = new URLSearchParams(location.search).get('tag')?.toUpperCase();
  selectTag(records.has(initialTag) ? initialTag : 'U1', { closeDrawer: false });
  if (matchMedia('(pointer: coarse)').matches) $('canvas-hint').textContent = 'Arraste para mover · use dois dedos para ampliar';
}

init().catch(error => {
  console.error(error);
  $('connection-detail').innerHTML = '<p class="detail-note pending">Não foi possível carregar o painel. Atualize a página para tentar novamente.</p>';
  $('selection-title').textContent = 'Erro';
});
