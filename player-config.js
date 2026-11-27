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
  let selectedSegment = 1, baseline = JSON.stringify(config);
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
  function compatible(item, segmentId) {
    const p = item.presentation, g = p?.geometry;
    return p?.mode === 'web' || (p?.mode === 'nsp' && g?.registryId === 'nsp-4k' &&
      g.orientation === config.orientation && g.layoutId === config.layoutId && g.segmentId === segmentId);
  }
  function candidates(appId, segmentId) { return catalog.filter(item => item.appId === appId && compatible(item, segmentId)); }
  function preview() {
    const frame = $('preview');
    if (!frame.contentWindow) return;
    const draft = structuredClone(config);
    for (const segment of draft.segments)
      segment.entries = segment.entries.filter(entry => ID.test(entry.outputId || '') &&
        candidates(entry.appId, segment.id).some(item => item.id === entry.outputId));
    frame.contentWindow.postMessage({ type: 'eduvize-player-preview', config: draft }, location.origin);
    frame.dataset.orientation = config.orientation;
  }
  const LAYOUT_NAMES = {
    landscape: ['Celá obrazovka', 'Hlavní a dvě vedlejší', 'Dva sloupce', 'Hlavní plocha uprostřed',
      'Čtyři stejné části', 'Dvě plochy a dvě lišty', 'Tři sloupce', 'Hlavní plocha a spodní lišta'],
    portrait: ['Celá obrazovka', 'Horní lišta a hlavní plocha', 'Střed a dvě spodní části',
      'Tři části pod sebou', 'Čtyři stejné části']
  };
  function selectLayout(layoutId, segmentId = 1) {
    if (layoutId !== config.layoutId && config.segments.some(segment => segment.entries.length) &&
        !confirm('Změna šablony odstraní přiřazené výstupy. Pokračovat?')) return;
    if (layoutId !== config.layoutId) config = model.empty(config.orientation, layoutId);
    selectedSegment = segmentId;
    render();
  }
  function shape(host, orientation, layoutId, interactive = false) {
    const geometry = model.layout(orientation, Number(layoutId));
    host.replaceChildren();
    host.dataset.orientation = orientation;
    geometry.forEach(rect => {
      const node = document.createElement(interactive ? 'button' : 'span');
      node.style.left = rect.x / rect.canvasWidth * 100 + '%';
      node.style.top = rect.y / rect.canvasHeight * 100 + '%';
      node.style.width = rect.width / rect.canvasWidth * 100 + '%';
      node.style.height = rect.height / rect.canvasHeight * 100 + '%';
      node.textContent = String(rect.id);
      node.className = 'player-segment-shape';
      if (config.orientation === orientation && config.layoutId === Number(layoutId) && selectedSegment === rect.id)
        node.classList.add('is-selected');
      if (interactive) {
        node.type = 'button';
        node.setAttribute('aria-label', 'Segment ' + rect.id + ': ' + rect.width + ' × ' + rect.height + ' px');
        node.setAttribute('aria-pressed', String(selectedSegment === rect.id));
        node.onclick = () => { selectedSegment = rect.id; render(); };
      } else {
        node.title = 'Vybrat segment ' + rect.id;
        node.onclick = event => { event.stopPropagation(); selectLayout(Number(layoutId), rect.id); };
      }
      host.append(node);
    });
  }
  function renderLayouts() {
    const host = $('layouts'); host.replaceChildren();
    const layouts = root.EduvizeNSPLayouts.layouts[config.orientation];
    for (const [id, rects] of Object.entries(layouts)) {
      const tile = button('', () => selectLayout(Number(id)));
      tile.className = 'player-layout';
      tile.setAttribute('aria-pressed', String(Number(id) === config.layoutId));
      tile.setAttribute('aria-label', 'Styl ' + id + ': ' + LAYOUT_NAMES[config.orientation][Number(id) - 1] +
        ', ' + rects.length + (rects.length === 1 ? ' segment' : rects.length < 5 ? ' segmenty' : ' segmentů'));
      const mini = document.createElement('span'); mini.className = 'player-layout-mini';
      mini.style.aspectRatio = config.orientation === 'portrait' ? '9/16' : '16/9';
      shape(mini, config.orientation, id);
      const title = document.createElement('strong'); title.textContent = 'Styl ' + id;
      const description = document.createElement('small'); description.textContent = LAYOUT_NAMES[config.orientation][Number(id) - 1];
      tile.append(title, mini, description);
      host.append(tile);
    }
  }
  function renderSegments() {
    const host = $('segment-options'); host.replaceChildren();
    for (const rect of model.layout(config.orientation, config.layoutId)) {
      const control = button('Segment ' + rect.id + ': ' + rect.width + ' × ' + rect.height + ' px', () => {
        selectedSegment = rect.id; render();
      });
      control.className = 'player-segment-option';
      control.setAttribute('aria-pressed', String(rect.id === selectedSegment));
      host.append(control);
    }
  }
  let dragging = null;
  function startDrag(event, data) {
    dragging = data;
    event.dataTransfer.effectAllowed = data.kind === 'catalog' ? 'copy' : 'move';
    event.dataTransfer.setData('text/plain', JSON.stringify(data));
  }
  function pointerGrip(data) {
    const grip = document.createElement('span');
    grip.className = 'player-drag-grip'; grip.textContent = '⠿';
    grip.title = 'Přetáhnout'; grip.setAttribute('aria-hidden', 'true');
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
      $('content-dropzone').classList.toggle('is-over', Boolean(document.elementFromPoint(event.clientX, event.clientY)?.closest('#content-dropzone')));
      event.preventDefault();
    };
    grip.onpointerup = event => {
      if (!start || start.id !== event.pointerId) return;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.player-drop-entry, #content-dropzone');
      const active = start.active; start = null;
      $('content-dropzone').classList.remove('is-over');
      if (active && target && $('content-dropzone').contains(target)) {
        dragging = data;
        dropAt(target.classList.contains('player-drop-entry') ? Number(target.dataset.index) :
          config.segments[selectedSegment - 1].entries.length);
      }
    };
    grip.onpointercancel = () => { start = null; $('content-dropzone').classList.remove('is-over'); };
    return grip;
  }
  function dropAt(index) {
    const segment = config.segments[selectedSegment - 1];
    if (!dragging || !segment) return;
    if (dragging.kind === 'catalog') {
      const item = catalog.find(candidate => candidate.id === dragging.id && compatible(candidate, segment.id));
      if (!item || segment.entries.length >= 20) return;
      segment.entries.splice(index, 0, { appId: item.appId, outputId: item.id, seconds: 30 });
    } else if (dragging.kind === 'entry') {
      const from = dragging.index;
      if (!Number.isInteger(from) || from < 0 || from >= segment.entries.length) return;
      const [entry] = segment.entries.splice(from, 1);
      segment.entries.splice(from < index ? index - 1 : index, 0, entry);
    }
    dragging = null;
    render();
  }
  function renderDialog() {
    const dialog = $('content-dialog');
    if (!dialog.open) return;
    const segment = config.segments[selectedSegment - 1];
    $('content-dialog-title').textContent = 'Přidat obsah do segmentu ' + segment.id;
    $('content-target-title').textContent = 'Pořadí v segmentu ' + segment.id;
    const query = $('content-search').value.trim().toLocaleLowerCase('cs');
    const choices = catalog.filter(item => compatible(item, segment.id) &&
      (item.label + ' ' + (model.APPS[item.appId] || '')).toLocaleLowerCase('cs').includes(query));
    const list = $('content-catalog'); list.replaceChildren();
    if (!choices.length) {
      const empty = document.createElement('p'); empty.className = 'player-empty';
      empty.textContent = 'Pro tento segment nejsou dostupné žádné odpovídající publikované výstupy.';
      list.append(empty);
    }
    for (const item of choices) {
      const card = document.createElement('div'); card.className = 'player-content-item'; card.draggable = true;
      card.ondragstart = event => startDrag(event, { kind: 'catalog', id: item.id });
      card.ondragend = () => { dragging = null; card.classList.remove('is-dragging'); };
      const words = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = item.label;
      const app = document.createElement('small'); app.textContent = model.APPS[item.appId] || item.appId;
      words.append(title, app);
      const add = button('Přidat', () => { dragging = { kind: 'catalog', id: item.id }; dropAt(segment.entries.length); }, segment.entries.length >= 20);
      add.className = 'edu-admin__button edu-admin__button--secondary';
      card.append(pointerGrip({ kind: 'catalog', id: item.id }), words, add); list.append(card);
    }
    const zone = $('content-dropzone'); zone.replaceChildren();
    if (!segment.entries.length) {
      const empty = document.createElement('p'); empty.className = 'player-drop-hint';
      empty.textContent = 'Přetáhněte sem první výstup.'; zone.append(empty);
    }
    segment.entries.forEach((entry, index) => {
      const item = catalog.find(candidate => candidate.id === entry.outputId);
      const row = document.createElement('div'); row.className = 'player-drop-entry'; row.draggable = true;
      row.dataset.index = String(index);
      row.append(pointerGrip({ kind: 'entry', index }), document.createTextNode((index + 1) + '. ' +
        (item?.label || 'Nedostupný výstup') + ' · ' + entry.seconds + ' s'));
      row.ondragstart = event => startDrag(event, { kind: 'entry', index });
      row.ondragend = () => { dragging = null; row.classList.remove('drop-before'); };
      row.ondragover = event => { event.preventDefault(); event.stopPropagation(); row.classList.add('drop-before'); };
      row.ondragleave = () => row.classList.remove('drop-before');
      row.ondrop = event => { event.preventDefault(); event.stopPropagation(); row.classList.remove('drop-before'); dropAt(index); };
      zone.append(row);
    });
  }
  function render() {
    for (const control of document.querySelectorAll('[data-orientation]'))
      control.setAttribute('aria-pressed', String(control.dataset.orientation === config.orientation));
    selectedSegment = Math.min(selectedSegment, config.segments.length);
    renderLayouts();
    renderSegments();
    const host = $('segments'); host.replaceChildren();
    const segment = config.segments[selectedSegment - 1];
    const section = document.createElement('section'); section.className = 'player-segment-editor';
    const title = document.createElement('h3'); title.textContent = 'Segment ' + segment.id;
    const help = document.createElement('p'); help.textContent = 'Obsah se střídá shora dolů podle zadané doby.';
    section.append(title, help);
    if (!segment.entries.length) {
      const empty = document.createElement('p'); empty.className = 'player-empty';
      empty.textContent = 'Tento segment zatím nemá žádný výstup.'; section.append(empty);
    }
    segment.entries.forEach((entry, index) => {
        const row = document.createElement('div'); row.className = 'player-entry';
        const item = catalog.find(candidate => candidate.id === entry.outputId);
        const identity = document.createElement('div'); identity.className = 'player-entry-identity';
        const name = document.createElement('strong'); name.textContent = item?.label || 'Nedostupný výstup';
        const app = document.createElement('small'); app.textContent = model.APPS[entry.appId] || entry.appId;
        identity.append(name, app); row.append(identity);
        const seconds = document.createElement('input'); seconds.type = 'number'; seconds.min = '5'; seconds.max = '3600'; seconds.step = '1'; seconds.value = String(entry.seconds);
        seconds.onchange = () => { entry.seconds = Number(seconds.value); preview(); note('Máte nepublikované změny.'); };
        const field = document.createElement('label'); field.textContent = 'Doba (s)'; field.append(seconds); row.append(field);
        const actions = document.createElement('div'); actions.className = 'player-entry-actions';
        const up = button('↑', () => { [segment.entries[index - 1], segment.entries[index]] = [segment.entries[index], segment.entries[index - 1]]; render(); }, index === 0);
        up.className = 'edu-admin__button edu-admin__button--secondary'; up.setAttribute('aria-label', 'Posunout výstup nahoru');
        const down = button('↓', () => { [segment.entries[index + 1], segment.entries[index]] = [segment.entries[index], segment.entries[index + 1]]; render(); }, index === segment.entries.length - 1);
        down.className = 'edu-admin__button edu-admin__button--secondary'; down.setAttribute('aria-label', 'Posunout výstup dolů');
        const remove = button('Odebrat', () => { segment.entries.splice(index, 1); render(); });
        remove.className = 'edu-admin__button edu-admin__button--secondary';
        actions.append(up, down, remove); row.append(actions);
        section.append(row);
    });
    const add = button('+ Přidat obsah', () => { $('content-dialog').showModal(); renderDialog(); $('content-search').focus(); },
      segment.entries.length >= 20 || !catalog.length);
    add.className = 'edu-admin__button edu-admin__button--secondary player-add';
    section.append(add); host.append(section);
    shape($('screen-map'), config.orientation, config.layoutId, true);
    preview();
    renderDialog();
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
    baseline = JSON.stringify(config); selectedSegment = 1;
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
    const found = groups.flatMap(result => result.status === 'fulfilled' ? result.value : [])
      .filter(item => item.state === 'published' && item.publishedSummary?.presentation)
      .map(item => ({ id: item.id, appId: item.appId, presentation: item.publishedSummary.presentation,
        label: (item.label || item.publishedSummary.sourceName || model.APPS[item.appId]) +
          (item.publishedSummary.presentation.mode === 'web' ? ' · Běžná stránka' :
            ' · Segment ' + item.publishedSummary.presentation.geometry.segmentId) }));
    catalog = found; render();
    note(failed.length ? 'Některé výstupy se nepodařilo načíst. Obnovte stránku před publikováním.' :
      found.length ? 'Vyberte výstupy pro všechny segmenty.' :
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
    if (root.EduvizeProfiles?.picker) void root.EduvizeProfiles.picker($('player-profile-picker'));
    const state = auth.status();
    if (!state.connected || !ID.test(state.profileId || '') || !state.schoolId) { note('Přihlaste se a vyberte školní profil.'); return; }
    const requested = new URL(location.href).searchParams.get('edu-profile');
    if (requested && requested !== state.profileId) { note('Otevřete Přehrávač ze správného školního profilu.'); return; }
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
    config = model.empty(); outputId = ''; selectedSegment = 1; baseline = JSON.stringify(config);
    const url = new URL(location.href); url.searchParams.delete('player-id'); history.replaceState(null, '', url);
    $('existing').value = ''; $('open').hidden = true; $('copy').disabled = true;
    render(); note('Nová obrazovka je připravená.');
  };
  for (const control of document.querySelectorAll('[data-orientation]')) control.onclick = () => {
    if (control.dataset.orientation === config.orientation) return;
    if (config.segments.some(s => s.entries.length) &&
        !confirm('Změna orientace odstraní přiřazené výstupy. Pokračovat?')) return;
    config = model.empty(control.dataset.orientation, 1); selectedSegment = 1; render();
  };
  $('publish').onclick = publish;
  $('content-dialog-close').onclick = () => $('content-dialog').close();
  $('content-dialog').onclose = () => { dragging = null; $('content-search').value = ''; };
  $('content-search').oninput = renderDialog;
  $('content-dropzone').ondragover = event => { event.preventDefault(); $('content-dropzone').classList.add('is-over'); };
  $('content-dropzone').ondragleave = event => {
    if (!$('content-dropzone').contains(event.relatedTarget)) $('content-dropzone').classList.remove('is-over');
  };
  $('content-dropzone').ondrop = event => {
    event.preventDefault(); $('content-dropzone').classList.remove('is-over');
    dropAt(config.segments[selectedSegment - 1].entries.length);
  };
  $('copy').onclick = async () => {
    try { guard(); const link = await client.getOutputLink(outputId); guard(); await navigator.clipboard.writeText(link.url); note('Odkaz Přehrávače byl zkopírován.'); }
    catch (error) { note('Odkaz se nepodařilo zkopírovat: ' + error.message); }
  };
  root.addEventListener('message', event => { if (event.origin === location.origin && event.source === $('preview').contentWindow && event.data?.type === 'eduvize-player-preview-ready') preview(); });
  root.EduvizeProfileBeforeSwitch = async () => !dirty() || confirm('Přepnout profil? Neuložené změny Přehrávače se ztratí.');
  root.addEventListener('eduvize-profile-selected', () => { if (profileId && auth.status().profileId !== profileId) location.reload(); });
  root.addEventListener('eduvize-admin-auth-change', () => { if (profileId) { try { guard(); } catch { ++loadEpoch; catalog = []; $('publish').disabled = true; $('copy').disabled = true; note('Profil se změnil. Obnovte nastavení Přehrávače.'); } } });
  init().catch(error => note(error.message));
})(window);
