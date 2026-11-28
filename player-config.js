(function (root) {
  'use strict';
  const model = root.EduvizePlayerModel;
  const auth = root.EduvizeAdminAuth;
  const client = root.EduvizeOutputClient.create({ origin: location.origin, getAuthorization: () => {
    const token = auth.getToken('configurations');
    if (!token) throw Error('Přihlaste se ke správě školy.');
    return 'Bearer ' + token;
  } });
  const $ = id => document.getElementById(id);
  const ID = /^[a-f0-9]{32}$/;
  let config = model.empty(), catalog = [], profileId = '', schoolId = '', outputId = '', busy = false, loadEpoch = 0;
  let selectedItem = null, pendingId = '', dragging = null, baseline = JSON.stringify(config), lastPreview = '';
  const openedApps = new Set();
  let unavailableApps = new Set();
  function note(message, error = false) { $('status').textContent = message; $('status').dataset.error = String(error); }
  function dirty() { return JSON.stringify(config) !== baseline; }
  function guard() {
    const state = auth.status();
    if (!state.connected || !ID.test(state.profileId || '') || !state.schoolId ||
        state.profileId !== profileId || state.schoolId !== schoolId || !auth.getToken('configurations'))
      throw Error('Školní profil nebo přihlášení se změnily. Obnovte stránku.');
  }
  function option(value, label) { const el = document.createElement('option'); el.value = value; el.textContent = label; return el; }
  function button(label, action, disabled = false) {
    const el = document.createElement('button'); el.type = 'button'; el.textContent = label; el.disabled = disabled; el.onclick = action; return el;
  }
  function compatible(item, segmentId, state = config) {
    const p = item.presentation, g = p?.geometry;
    return p?.mode === 'web' || (p?.mode === 'nsp' && g?.registryId === 'nsp-4k' &&
      g.orientation === state.orientation && g.layoutId === state.layoutId && g.segmentId === segmentId);
  }
  function candidates(appId, segmentId) { return catalog.filter(item => item.appId === appId && compatible(item, segmentId)); }
  function preview(force = false) {
    const frame = $('preview');
    if (!frame.contentWindow) return;
    const draft = structuredClone(config);
    for (const segment of draft.segments)
      segment.entries = segment.entries.filter(entry => ID.test(entry.outputId || '') &&
        candidates(entry.appId, segment.id).some(item => item.id === entry.outputId));
    const signature = JSON.stringify(draft);
    if (!force && signature === lastPreview) return;
    lastPreview = signature;
    frame.contentWindow.postMessage({ type: 'eduvize-player-preview', config: draft }, location.origin);
  }
  const LAYOUT_NAMES = {
    landscape: ['Celá obrazovka', 'Hlavní a dvě vedlejší', 'Dva sloupce', 'Hlavní plocha uprostřed',
      'Čtyři stejné části', 'Dvě plochy a dvě lišty', 'Tři sloupce', 'Hlavní plocha a spodní lišta'],
    portrait: ['Celá obrazovka', 'Horní lišta a hlavní plocha', 'Střed a dvě spodní části',
      'Tři části pod sebou', 'Čtyři stejné části']
  };
  function changeLayout(orientation, layoutId) {
    if (orientation === config.orientation && layoutId === config.layoutId) return;
    const next = model.empty(orientation, layoutId);
    const moves = [];
    for (const segment of config.segments) for (const entry of segment.entries) {
      const item = catalog.find(candidate => candidate.id === entry.outputId);
      const targets = next.segments.filter(target => item && compatible(item, target.id, next) && target.entries.length < 20);
      const target = targets.find(candidate => candidate.id === segment.id) || targets[0];
      if (!target) {
        note('Šablonu nelze změnit: Některý výstup není pro nové rozdělení vhodný. Nejdříve jej odeberte nebo nahraďte.', true);
        return;
      }
      target.entries.push({ ...entry });
      if (target.id !== segment.id) moves.push('Segment ' + segment.id + ' → ' + target.id);
    }
    if (moves.length && !confirm('Nová šablona přesune obsah mezi segmenty (' + [...new Set(moves)].join(', ') + '). Pokračovat?')) return;
    config = next; selectedItem = null; pendingId = ''; render();
    note(moves.length ? 'Šablona byla změněna a obsah převeden do vhodných segmentů.' :
      'Šablona byla změněna. Obsah ve stejných segmentech zůstal zachován.');
  }
  function miniShape(host, orientation, layoutId) {
    const geometry = model.layout(orientation, Number(layoutId));
    host.dataset.orientation = orientation;
    for (const rect of geometry) {
      const shape = document.createElement('span'); shape.className = 'player-segment-shape';
      shape.textContent = String(rect.id);
      shape.style.left = rect.x / rect.canvasWidth * 100 + '%';
      shape.style.top = rect.y / rect.canvasHeight * 100 + '%';
      shape.style.width = rect.width / rect.canvasWidth * 100 + '%';
      shape.style.height = rect.height / rect.canvasHeight * 100 + '%';
      host.append(shape);
    }
  }
  function renderLayouts() {
    const host = $('layouts'); host.replaceChildren();
    for (const [id, rects] of Object.entries(root.EduvizeNSPLayouts.layouts[config.orientation])) {
      const tile = button('', () => changeLayout(config.orientation, Number(id)));
      tile.className = 'player-layout'; tile.setAttribute('aria-pressed', String(Number(id) === config.layoutId));
      tile.setAttribute('aria-label', 'Styl ' + id + ': ' + LAYOUT_NAMES[config.orientation][Number(id) - 1] +
        ', ' + rects.length + (rects.length === 1 ? ' segment' : rects.length < 5 ? ' segmenty' : ' segmentů'));
      const title = document.createElement('strong'); title.textContent = 'Styl ' + id;
      const mini = document.createElement('span'); mini.className = 'player-layout-mini';
      miniShape(mini, config.orientation, id);
      const description = document.createElement('small'); description.textContent = LAYOUT_NAMES[config.orientation][Number(id) - 1];
      tile.append(title, mini, description); host.append(tile);
    }
  }
  function itemById(id) { return catalog.find(item => item.id === id); }
  function outputCount(number) { return number + (number === 1 ? ' výstup' : number > 1 && number < 5 ? ' výstupy' : ' výstupů'); }
  function itemForDrop(data, segmentId) {
    if (data?.kind === 'entry') {
      const entry = config.segments[data.segmentId - 1]?.entries[data.index];
      return itemById(entry?.outputId);
    }
    if (data?.kind === 'catalog') return itemById(data.id);
    if (data?.kind !== 'app') return null;
    const available = candidates(data.appId, segmentId);
    const exact = available.filter(item => item.presentation.mode === 'nsp');
    // Published NSP geometry identifies the target segment. Prefer it over
    // generic web output and use its published ID for the renderer URL.
    const matches = exact.length ? exact : available;
    return matches.length === 1 ? matches[0] : null;
  }
  function canPlace(data, segmentId) {
    const target = config.segments[segmentId - 1];
    if (!target) return false;
    const item = itemForDrop(data, segmentId);
    return Boolean(item && compatible(item, segmentId) &&
      (target.entries.length < 20 || data.kind === 'entry' && data.segmentId === segmentId));
  }
  function place(data, segmentId, at = null) {
    if (!canPlace(data, segmentId)) { note('Výstup není pro tento segment dostupný nebo je segment plný.', true); return; }
    const target = config.segments[segmentId - 1];
    let index = at === null ? target.entries.length : at;
    let entry;
    if (data.kind === 'catalog' || data.kind === 'app') {
      const item = itemForDrop(data, segmentId);
      entry = { appId: item.appId, outputId: item.id, seconds: 30 };
    } else if (data.kind === 'entry') {
      const source = config.segments[data.segmentId - 1];
      [entry] = source.entries.splice(data.index, 1);
      if (source === target && data.index < index) index--;
    } else return;
    target.entries.splice(index, 0, entry);
    selectedItem = { segmentId, index }; pendingId = ''; dragging = null;
    render(); note('Výstup je v segmentu ' + segmentId + '. Nastavte dobu zobrazení.');
  }
  function dragStart(event, data) {
    dragging = data;
    event.dataTransfer.effectAllowed = data.kind === 'entry' ? 'move' : 'copy';
    event.dataTransfer.setData('text/plain', JSON.stringify(data));
  }
  function dragTarget(node, segmentId, index = null) {
    node.ondragover = event => {
      if (!canPlace(dragging, segmentId)) return;
      event.preventDefault(); event.stopPropagation(); node.classList.add('is-over');
    };
    node.ondragleave = () => node.classList.remove('is-over');
    node.ondrop = event => {
      event.preventDefault(); event.stopPropagation(); node.classList.remove('is-over');
      if (dragging) place(dragging, segmentId, index);
    };
  }
  function touchGrip(data) {
    const grip = document.createElement('span'); grip.className = 'player-drag-grip';
    grip.textContent = '⠿'; grip.title = 'Přetáhnout'; grip.setAttribute('aria-hidden', 'true');
    let start = null;
    grip.onpointerdown = event => {
      if (event.pointerType === 'mouse' || event.button !== 0) return;
      grip.setPointerCapture(event.pointerId);
      start = { id: event.pointerId, x: event.clientX, y: event.clientY, active: false };
      event.preventDefault();
    };
    grip.onpointermove = event => {
      if (!start || start.id !== event.pointerId) return;
      if (!start.active && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 8) return;
      start.active = true;
      document.querySelectorAll('.player-canvas-segment.is-over,.player-segment-lane.is-over').forEach(node => node.classList.remove('is-over'));
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-drop-segment]');
      if (target && canPlace(data, Number(target.dataset.dropSegment))) target.classList.add('is-over');
      event.preventDefault();
    };
    grip.onpointerup = event => {
      if (!start || start.id !== event.pointerId) return;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-drop-segment]');
      const active = start.active; start = null;
      if (target) target.classList.remove('is-over');
      if (active && target) place(data, Number(target.dataset.dropSegment),
        target.dataset.dropIndex === undefined ? null : Number(target.dataset.dropIndex));
    };
    grip.onpointercancel = () => { start = null; document.querySelectorAll('.is-over').forEach(node => node.classList.remove('is-over')); };
    return grip;
  }
  function renderLibrary() {
    const host = $('library-apps'); host.replaceChildren();
    const query = $('library-search').value.trim().toLocaleLowerCase('cs');
    $('library-hint').textContent = pendingId ? 'Výstup je vybraný. Klikněte na segment vpravo nebo použijte tlačítko Vložit sem.' :
      'Přetáhněte výstup na segment vpravo.';
    for (const [appId, appName] of Object.entries(model.APPS)) {
      const all = catalog.filter(item => item.appId === appId);
      const matches = all.filter(item => (item.label + ' ' + appName).toLocaleLowerCase('cs').includes(query));
      if (query && !appName.toLocaleLowerCase('cs').includes(query) && !matches.length) continue;
      const entries = query && appName.toLocaleLowerCase('cs').includes(query) ? all : matches;
      const group = document.createElement('details'); group.className = 'player-app-group';
      group.open = openedApps.has(appId) || Boolean(query);
      group.ontoggle = () => { if (!group.isConnected) return; if (group.open) openedApps.add(appId); else openedApps.delete(appId); };
      const summary = document.createElement('summary');
      const name = document.createElement('strong'); name.textContent = appName;
      const count = document.createElement('span'); count.textContent = all.length ? outputCount(all.length) : 'Bez výstupu';
      summary.append(name, count); group.append(summary);
      const body = document.createElement('div'); body.className = 'player-app-body';
      if (all.length) {
        const data = { kind: 'app', appId };
        const ready = config.segments.some(segment => canPlace(data, segment.id));
        const bundle = document.createElement('div'); bundle.className = 'player-source player-app-bundle';
        bundle.draggable = ready; bundle.classList.toggle('is-incompatible', !ready);
        bundle.ondragstart = event => dragStart(event, data);
        bundle.ondragend = () => { dragging = null; bundle.classList.remove('is-dragging'); };
        if (ready) bundle.append(touchGrip(data));
        const label = document.createElement('div');
        const title = document.createElement('strong'); title.textContent = 'Vložit ' + appName;
        const detail = document.createElement('small'); detail.textContent = ready ?
          'Výstup a odkaz se zvolí podle cílového segmentu' : 'Vyberte konkrétní výstup níže';
        label.append(title, detail); bundle.append(label); body.append(bundle);
      }
      if (!entries.length) {
        const empty = document.createElement('p');
        empty.textContent = unavailableApps.has(appId) ? 'Aplikace v tomto profilu není dostupná.' :
          'Zatím žádný publikovaný výstup.';
        body.append(empty);
      }
      for (const item of entries) {
        const ready = config.segments.some(segment => compatible(item, segment.id));
        const card = document.createElement('div'); card.className = 'player-source';
        card.draggable = ready; card.classList.toggle('is-incompatible', !ready);
        card.classList.toggle('is-pending', pendingId === item.id);
        card.ondragstart = event => dragStart(event, { kind: 'catalog', id: item.id });
        card.ondragend = () => { dragging = null; card.classList.remove('is-dragging'); };
        const text = document.createElement('div');
        const title = document.createElement('strong'); title.textContent = item.label;
        const kind = document.createElement('small'); kind.textContent = item.presentation.mode === 'nsp' ?
          'Výstup NSP · segment ' + item.presentation.geometry.segmentId : 'Běžná stránka';
        text.append(title, kind);
        if (ready) card.append(touchGrip({ kind: 'catalog', id: item.id }));
        card.append(text);
        const select = button('Vybrat', () => { pendingId = item.id; render(); $('screen-map').scrollIntoView({ block: 'nearest' }); }, !ready);
        select.className = 'edu-admin__button edu-admin__button--secondary'; card.append(select);
        body.append(card);
      }
      if (!unavailableApps.has(appId)) {
        const create = document.createElement('a'); create.className = 'player-create-output';
        create.href = '/eduvize-styly/aplikace.html#aplikace'; create.target = '_blank'; create.rel = 'noopener noreferrer';
        create.textContent = all.length ? 'Vytvořit další výstup ↗' : 'Vytvořit výstup v aplikaci ↗';
        body.append(create);
      }
      group.append(body); host.append(group);
    }
  }
  function renderCanvas() {
    const geometry = model.layout(config.orientation, config.layoutId);
    const host = $('screen-map'); host.replaceChildren(); host.dataset.orientation = config.orientation;
    $('screen-stage').dataset.orientation = config.orientation;
    for (const rect of geometry) {
      const segment = config.segments[rect.id - 1];
      const box = document.createElement('div'); box.className = 'player-canvas-segment';
      box.dataset.dropSegment = String(rect.id); box.tabIndex = 0; box.setAttribute('role', 'button');
      box.setAttribute('aria-label', 'Segment ' + rect.id + ': ' + rect.width + ' × ' + rect.height + ' px, ' +
        outputCount(segment.entries.length) + (pendingId && canPlace({ kind: 'catalog', id: pendingId }, rect.id) ? ', vložit vybraný výstup' : ''));
      box.style.left = rect.x / rect.canvasWidth * 100 + '%'; box.style.top = rect.y / rect.canvasHeight * 100 + '%';
      box.style.width = rect.width / rect.canvasWidth * 100 + '%'; box.style.height = rect.height / rect.canvasHeight * 100 + '%';
      box.classList.toggle('can-insert', Boolean(pendingId && canPlace({ kind: 'catalog', id: pendingId }, rect.id)));
      const number = document.createElement('strong'); number.textContent = 'Segment ' + rect.id;
      const info = document.createElement('small'); info.textContent = segment.entries.length ?
        outputCount(segment.entries.length) : 'Přetáhněte obsah';
      box.append(number, info);
      if (box.classList.contains('can-insert')) {
        const hint = document.createElement('em'); hint.textContent = 'Vložit sem'; box.append(hint);
      }
      box.onclick = () => { if (pendingId) place({ kind: 'catalog', id: pendingId }, rect.id); };
      box.onkeydown = event => { if (pendingId && ['Enter', ' '].includes(event.key)) { event.preventDefault(); box.click(); } };
      dragTarget(box, rect.id); host.append(box);
    }
    const lanes = $('segment-lanes'); lanes.replaceChildren();
    for (const rect of geometry) {
      const segment = config.segments[rect.id - 1];
      const lane = document.createElement('section'); lane.className = 'player-segment-lane';
      lane.dataset.dropSegment = String(rect.id);
      const heading = document.createElement('div'); heading.className = 'player-lane-heading';
      const title = document.createElement('h3'); title.textContent = 'Segment ' + rect.id;
      const size = document.createElement('small'); size.textContent = rect.width + ' × ' + rect.height + ' px';
      heading.append(title, size);
      if (pendingId && canPlace({ kind: 'catalog', id: pendingId }, rect.id)) {
        const add = button('Vložit sem', () => place({ kind: 'catalog', id: pendingId }, rect.id));
        add.className = 'edu-admin__button edu-admin__button--secondary'; heading.append(add);
      }
      lane.append(heading);
      if (!segment.entries.length) {
        const empty = document.createElement('p'); empty.className = 'player-lane-empty';
        empty.textContent = 'Přetáhněte sem publikovaný výstup.'; lane.append(empty);
      }
      segment.entries.forEach((entry, index) => {
        const item = itemById(entry.outputId);
        const row = document.createElement('div'); row.className = 'player-lane-entry'; row.draggable = true;
        row.dataset.dropSegment = String(rect.id); row.dataset.dropIndex = String(index);
        row.classList.toggle('is-selected', selectedItem?.segmentId === rect.id && selectedItem?.index === index);
        row.ondragstart = event => dragStart(event, { kind: 'entry', segmentId: rect.id, index });
        row.ondragend = () => { dragging = null; row.classList.remove('is-over'); };
        dragTarget(row, rect.id, index);
        row.append(touchGrip({ kind: 'entry', segmentId: rect.id, index }));
        const select = button((index + 1) + '. ' + (item?.label || 'Nedostupný výstup'), () => {
          selectedItem = { segmentId: rect.id, index }; render();
        });
        select.className = 'player-lane-select';
        const duration = document.createElement('small'); duration.textContent = entry.seconds + ' s';
        row.append(select, duration); lane.append(row);
      });
      dragTarget(lane, rect.id); lanes.append(lane);
    }
    $('canvas-hint').textContent = pendingId ? 'Výstup je vybraný. Klikněte na cílový segment nebo na Vložit sem.' :
      'Přetáhněte výstup zleva do požadovaného segmentu. V jednom segmentu se výstupy střídají v pořadí níže.';
  }
  function renderDetail() {
    const host = $('item-detail-fields'); host.replaceChildren();
    const section = $('item-detail');
    const entry = selectedItem && config.segments[selectedItem.segmentId - 1]?.entries[selectedItem.index];
    if (!entry) { selectedItem = null; section.hidden = true; return; }
    section.hidden = false;
    const item = itemById(entry.outputId);
    $('item-detail-title').textContent = 'Nastavení: Segment ' + selectedItem.segmentId + ', výstup ' + (selectedItem.index + 1);
    const source = document.createElement('p'); source.className = 'player-detail-source';
    source.textContent = (item?.label || 'Nedostupný výstup') + ' · ' + (model.APPS[entry.appId] || entry.appId);
    host.append(source);
    const seconds = document.createElement('input'); seconds.type = 'number'; seconds.min = '5'; seconds.max = '3600'; seconds.step = '1'; seconds.value = String(entry.seconds);
    seconds.id = 'item-seconds';
    seconds.onchange = () => { entry.seconds = Number(seconds.value); render(); note('Doba zobrazení byla změněna.'); };
    const duration = document.createElement('label'); duration.textContent = 'Doba zobrazení (sekundy)'; duration.append(seconds);
    host.append(duration);
    const replace = document.createElement('select'); replace.id = 'item-replace';
    for (const candidate of catalog.filter(value => compatible(value, selectedItem.segmentId)))
      replace.append(option(candidate.id, (model.APPS[candidate.appId] || candidate.appId) + ' · ' + candidate.label));
    if (!item) replace.prepend(option(entry.outputId, 'Nedostupný výstup'));
    replace.value = entry.outputId;
    replace.onchange = () => { const next = itemById(replace.value); if (next) { entry.appId = next.appId; entry.outputId = next.id; render(); note('Výstup byl nahrazen.'); } };
    const replacement = document.createElement('label'); replacement.textContent = 'Nahradit jiným publikovaným výstupem'; replacement.append(replace);
    host.append(replacement);
    const actions = document.createElement('div'); actions.className = 'player-detail-actions';
    const segment = config.segments[selectedItem.segmentId - 1], index = selectedItem.index;
    const up = button('↑ Posunout nahoru', () => {
      [segment.entries[index - 1], segment.entries[index]] = [segment.entries[index], segment.entries[index - 1]];
      selectedItem.index--; render();
    }, index === 0);
    const down = button('↓ Posunout dolů', () => {
      [segment.entries[index + 1], segment.entries[index]] = [segment.entries[index], segment.entries[index + 1]];
      selectedItem.index++; render();
    }, index === segment.entries.length - 1);
    const remove = button('Odebrat', () => { segment.entries.splice(index, 1); selectedItem = null; render(); });
    for (const control of [up, down, remove]) control.className = 'edu-admin__button edu-admin__button--secondary';
    actions.append(up, down, remove); host.append(actions);
    const open = document.createElement('a'); open.className = 'player-create-output';
    open.href = '/eduvize-styly/aplikace.html#aplikace'; open.target = '_blank'; open.rel = 'noopener noreferrer';
    open.textContent = 'Otevřít nastavení aplikací v nové kartě ↗'; host.append(open);
  }
  function render() {
    for (const control of document.querySelectorAll('[data-orientation]'))
      control.setAttribute('aria-pressed', String(control.dataset.orientation === config.orientation));
    renderLayouts(); renderLibrary(); renderCanvas(); renderDetail(); preview();
    if (dirty()) note('Máte nepublikované změny.');
  }
  async function listApp(appId) {
    let after, result = [];
    do {
      const page = await client.listOutputs({ appId, profileId, after, limit: 100 });
      result.push(...page.items.filter(item => item.state === 'published' && !item.archived));
      after = page.nextCursor;
      if (result.length >= 500) break;
    } while (after);
    return result;
  }
  async function listPlayers() {
    let after, items = [];
    do {
      const page = await client.listOutputs({ appId: 'player', profileId, after, limit: 100 });
      items.push(...page.items.filter(item => !['deleted', 'revoked'].includes(item.state)));
      after = page.nextCursor;
    } while (after && items.length < 500);
    return items;
  }
  async function openPlayer(id) {
    guard();
    if (!ID.test(id)) throw Error('Neplatný odkaz na nastavení.');
    const current = await client.getOutput(id); guard();
    if (current.appId !== 'player' || current.profileId !== profileId) throw Error('Výstup patří jinému profilu.');
    config = model.validate(current.draft.payload);
    outputId = id;
    baseline = JSON.stringify(config); selectedItem = null; pendingId = '';
    const url = new URL(location.href); url.searchParams.set('player-id', id); history.replaceState(null, '', url);
    $('existing').value = id;
    $('open').hidden = current.state !== 'published';
    $('copy').disabled = current.state !== 'published';
    if (current.state === 'published') $('open').href = current.url;
    render(); note('Přehrávač byl načten.');
  }
  async function loadCatalog(epoch) {
    note('Načítám publikované výstupy školy…');
    const groups = await Promise.allSettled(Object.keys(model.APPS).map(appId => listApp(appId)));
    if (epoch !== loadEpoch) return;
    const failed = groups.filter(result => result.status === 'rejected' && result.reason?.status !== 422);
    unavailableApps = new Set(groups.flatMap((result, index) => result.status === 'rejected' && result.reason?.status === 422 ?
      [Object.keys(model.APPS)[index]] : []));
    const found = groups.flatMap(result => result.status === 'fulfilled' ? result.value : [])
      .filter(item => item.state === 'published' && item.publishedSummary?.presentation)
      .map(item => ({ id: item.id, appId: item.appId, presentation: item.publishedSummary.presentation,
        label: item.label || item.publishedSummary.sourceName || model.APPS[item.appId] }));
    if (!openedApps.size) for (const item of found) {
      openedApps.add(item.appId);
      if (openedApps.size === 2) break;
    }
    catalog = found; render();
    note(failed.length ? 'Některé výstupy se nepodařilo načíst. Obnovte stránku před publikováním.' :
      found.length ? 'Přetáhněte publikované výstupy do segmentů obrazovky.' :
        'V tomto profilu zatím nejsou publikované výstupy aplikací. Nejprve je vytvořte v jejich nastavení.');
  }
  async function publish() {
    if (busy) return;
    try {
      guard();
      const payload = model.validate(config);
      for (const segment of payload.segments) for (const entry of segment.entries)
        if (!candidates(entry.appId, segment.id).some(item => item.id === entry.outputId))
          throw Error('Vybraný výstup není dostupný pro segment ' + segment.id + '.');
      busy = true; $('publish').disabled = true; note('Ukládám a publikuji Přehrávač…');
      const draft = { schemaVersion: 1, payloadVersion: 1, presentation: { mode: 'web', geometry: null, interaction: 'display', kioskLayout: null }, payload };
      let current;
      if (outputId) {
        current = await client.getOutput(outputId); guard();
        if (current.appId !== 'player' || current.profileId !== profileId) throw Error('Výstup patří jinému profilu.');
        current = await client.saveDraft(outputId, { expectedRevision: current.revision, draft }, client.newOperation());
      } else {
        const assembly = await client.createAssembly({ schemaVersion: 1, appId: 'player', profileId }, client.newOperation()); guard();
        current = await client.createOutput({ schemaVersion: 1, appId: 'player', profileId, assemblyId: assembly.id, draft }, client.newOperation());
        outputId = current.id;
        const url = new URL(location.href); url.searchParams.set('player-id', outputId); history.replaceState(null, '', url);
      }
      guard();
      current = await client.publishOutput(outputId, { expectedRevision: current.revision }, client.newOperation());
      const link = await client.getOutputLink(outputId); guard();
      $('open').href = link.url; $('open').hidden = false; $('copy').disabled = false;
      if (!$('existing').querySelector('option[value="' + outputId + '"]'))
        $('existing').append(option(outputId, 'Přehrávač · ' + outputId.slice(0, 8)));
      $('existing').value = outputId;
      baseline = JSON.stringify(config);
      note('Přehrávač je publikovaný. Odkaz lze přiřadit spárované Android obrazovce.');
    } catch (error) { note(error.message || 'Publikování se nezdařilo.', true); }
    finally { busy = false; $('publish').disabled = false; }
  }
  async function init() {
    await auth.ready;
    const initial = auth.status();
    if (!initial.connected || !initial.schoolId) { note('Přihlaste se a vyberte školní profil.'); return; }
    const requested = new URL(location.href).searchParams.get('edu-profile');
    if (requested && !ID.test(requested)) { note('Neplatný školní profil v odkazu.', true); return; }
    if (requested && requested !== initial.profileId) await auth.selectProfile(requested);
    const state = auth.status();
    if (!ID.test(state.profileId || '') || requested && requested !== state.profileId) {
      note('Požadovaný školní profil se nepodařilo aktivovat.', true); return;
    }
    if (root.EduvizeProfiles?.picker) void root.EduvizeProfiles.picker($('player-profile-picker'));
    schoolId = state.schoolId; profileId = state.profileId;
    try {
      const players = await listPlayers(); guard();
      for (const item of players) $('existing').append(option(item.id, (item.label || 'Přehrávač') + ' · ' + item.id.slice(0, 8)));
      const requestedOutput = new URL(location.href).searchParams.get('player-id');
      const target = requestedOutput || (players.length === 1 ? players[0].id : '');
      if (target) await openPlayer(target);
      else render();
      await loadCatalog(++loadEpoch);
    } catch (error) { note(error.message); }
  }
  $('existing').onchange = async () => {
    if (!$('existing').value) { $('new').click(); return; }
    if (dirty() && !confirm('Přejít na jinou obrazovku? Neuložené změny se ztratí.')) {
      $('existing').value = outputId; return;
    }
    try { await openPlayer($('existing').value); }
    catch (error) { $('existing').value = outputId; note(error.message, true); }
  };
  $('new').onclick = () => {
    if (dirty() && !confirm('Začít novou obrazovku? Neuložené změny se ztratí.')) { $('existing').value = outputId; return; }
    config = model.empty(); outputId = ''; selectedItem = null; pendingId = ''; baseline = JSON.stringify(config);
    const url = new URL(location.href); url.searchParams.delete('player-id'); history.replaceState(null, '', url);
    $('existing').value = ''; $('open').hidden = true; $('copy').disabled = true;
    render(); note('Nová obrazovka je připravená.');
  };
  for (const control of document.querySelectorAll('[data-orientation]')) control.onclick = () => {
    if (control.dataset.orientation === config.orientation) return;
    changeLayout(control.dataset.orientation, 1);
  };
  $('publish').onclick = publish;
  $('library-search').oninput = renderLibrary;
  $('copy').onclick = async () => {
    try { guard(); const link = await client.getOutputLink(outputId); guard(); await navigator.clipboard.writeText(link.url); note('Odkaz Přehrávače byl zkopírován.'); }
    catch (error) { note('Odkaz se nepodařilo zkopírovat: ' + error.message); }
  };
  root.addEventListener('message', event => { if (event.origin === location.origin && event.source === $('preview').contentWindow && event.data?.type === 'eduvize-player-preview-ready') preview(true); });
  root.EduvizeProfileBeforeSwitch = async () => !dirty() || confirm('Přepnout profil? Neuložené změny Přehrávače se ztratí.');
  root.addEventListener('eduvize-profile-selected', () => { if (profileId && auth.status().profileId !== profileId) location.reload(); });
  root.addEventListener('eduvize-admin-auth-change', () => { if (profileId) { try { guard(); } catch { ++loadEpoch; catalog = []; $('publish').disabled = true; $('copy').disabled = true; note('Profil se změnil. Obnovte nastavení Přehrávače.'); } } });
  $('preview').addEventListener('load', () => preview(true));
  render();
  init().catch(error => note(error.message));
})(window);
