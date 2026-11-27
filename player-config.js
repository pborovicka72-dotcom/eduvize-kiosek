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
      if (interactive) {
        node.type = 'button'; node.textContent = 'Část ' + rect.id;
        node.setAttribute('aria-pressed', String(selectedSegment === rect.id));
        node.onclick = () => { selectedSegment = rect.id; render(); };
      }
      host.append(node);
    });
  }
  function renderLayouts() {
    const host = $('layouts'), more = $('additional-layouts'); host.replaceChildren(); more.replaceChildren();
    const layouts = root.EduvizeNSPLayouts.layouts[config.orientation];
    const featured = config.orientation === 'landscape' ? [1, 3, 2] : [1, 2, 4];
    for (const [id, rects] of Object.entries(layouts)) {
      const tile = button('', () => {
        if (Number(id) === config.layoutId) return;
        if (config.segments.some(segment => segment.entries.length) &&
            !confirm('Změna rozložení odstraní přiřazené výstupy. Pokračovat?')) return;
        config = model.empty(config.orientation, Number(id)); selectedSegment = 1; render();
      });
      tile.className = 'player-layout';
      tile.setAttribute('aria-pressed', String(Number(id) === config.layoutId));
      tile.setAttribute('aria-label', LAYOUT_NAMES[config.orientation][Number(id) - 1] + ', ' +
        rects.length + (rects.length === 1 ? ' část' : rects.length < 5 ? ' části' : ' částí'));
      const mini = document.createElement('span'); mini.className = 'player-layout-mini';
      mini.style.aspectRatio = config.orientation === 'portrait' ? '9/16' : '16/9';
      shape(mini, config.orientation, id);
      const title = document.createElement('strong'); title.textContent = LAYOUT_NAMES[config.orientation][Number(id) - 1];
      const count = document.createElement('small'); count.textContent = rects.length + (rects.length === 1 ? ' část' : rects.length < 5 ? ' části' : ' částí');
      tile.append(mini, title, count);
      (featured.includes(Number(id)) ? host : more).append(tile);
    }
    if (!featured.includes(config.layoutId)) $('more-layouts').open = true;
  }
  function render() {
    for (const control of document.querySelectorAll('[data-orientation]'))
      control.setAttribute('aria-pressed', String(control.dataset.orientation === config.orientation));
    selectedSegment = Math.min(selectedSegment, config.segments.length);
    renderLayouts();
    const tabs = $('segment-tabs'); tabs.replaceChildren();
    for (const segment of config.segments) {
      const tab = button('Část ' + segment.id, () => { selectedSegment = segment.id; render(); });
      tab.className = 'player-segment-tab';
      tab.setAttribute('aria-pressed', String(segment.id === selectedSegment));
      tabs.append(tab);
    }
    const host = $('segments'); host.replaceChildren();
    const segment = config.segments[selectedSegment - 1];
    const section = document.createElement('section'); section.className = 'player-segment-editor';
    const title = document.createElement('h3'); title.textContent = 'Část ' + segment.id;
    const help = document.createElement('p'); help.textContent = 'Obsah se střídá shora dolů podle zadané doby.';
    section.append(title, help);
    if (!segment.entries.length) {
      const empty = document.createElement('p'); empty.className = 'player-empty';
      empty.textContent = 'Tato část zatím nemá žádný výstup.'; section.append(empty);
    }
    segment.entries.forEach((entry, index) => {
        const row = document.createElement('div'); row.className = 'player-entry';
        const output = document.createElement('select');
        output.append(option('', 'Vyberte publikovaný výstup'));
        for (const [appId, name] of Object.entries(model.APPS)) {
          const choices = candidates(appId, segment.id);
          if (!choices.length) continue;
          const group = document.createElement('optgroup'); group.label = name;
          for (const item of choices) group.append(option(item.id, item.label));
          output.append(group);
        }
        output.value = entry.outputId;
        output.onchange = () => {
          const item = catalog.find(candidate => candidate.id === output.value);
          entry.appId = item?.appId || ''; entry.outputId = item?.id || ''; preview();
          note('Máte nepublikované změny.');
        };
        const seconds = document.createElement('input'); seconds.type = 'number'; seconds.min = '5'; seconds.max = '3600'; seconds.step = '1'; seconds.value = String(entry.seconds);
        seconds.onchange = () => { entry.seconds = Number(seconds.value); preview(); note('Máte nepublikované změny.'); };
        for (const [label, control] of [['Publikovaný výstup', output], ['Doba (s)', seconds]]) {
          const field = document.createElement('label'); field.textContent = label; field.append(control); row.append(field);
        }
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
    const add = button('+ Přidat publikovaný výstup', () => {
      if (segment.entries.length >= 20) return;
      segment.entries.push({ appId: '', outputId: '', seconds: 30 }); render();
      host.querySelector('.player-entry:last-of-type select')?.focus();
    }, segment.entries.length >= 20 || !catalog.length);
    add.className = 'edu-admin__button edu-admin__button--secondary player-add';
    section.append(add); host.append(section);
    shape($('screen-map'), config.orientation, config.layoutId, true);
    preview();
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
