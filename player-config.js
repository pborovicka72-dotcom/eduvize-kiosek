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
  function note(message) { $('status').textContent = message; }
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
    frame.style.aspectRatio = config.orientation === 'portrait' ? '9/16' : '16/9';
  }
  function renderLayouts() {
    const select = $('layout'); select.replaceChildren();
    const layouts = root.EduvizeNSPLayouts.layouts[config.orientation];
    for (const [id, rects] of Object.entries(layouts)) select.append(option(id, 'Šablona ' + id + ' · ' + rects.length + (rects.length === 1 ? ' segment' : rects.length < 5 ? ' segmenty' : ' segmentů')));
    select.value = String(config.layoutId);
  }
  function render() {
    $('orientation').value = config.orientation; renderLayouts();
    const host = $('segments'); host.replaceChildren();
    for (const segment of config.segments) {
      const section = document.createElement('section'); section.className = 'player-segment-editor';
      const title = document.createElement('h3'); title.textContent = 'Segment ' + segment.id;
      section.append(title);
      segment.entries.forEach((entry, index) => {
        const row = document.createElement('div'); row.className = 'player-entry';
        const app = document.createElement('select');
        app.append(option('', 'Vyberte aplikaci'));
        for (const [id, label] of Object.entries(model.APPS)) app.append(option(id, label));
        app.value = entry.appId;
        app.onchange = () => { entry.appId = app.value; entry.outputId = ''; render(); };
        const output = document.createElement('select');
        output.append(option('', 'Vyberte publikovaný výstup'));
        for (const item of candidates(entry.appId, segment.id))
          output.append(option(item.id, item.label));
        output.value = entry.outputId;
        output.onchange = () => { entry.outputId = output.value; preview(); };
        const seconds = document.createElement('input'); seconds.type = 'number'; seconds.min = '5'; seconds.max = '3600'; seconds.step = '1'; seconds.value = String(entry.seconds);
        seconds.onchange = () => { entry.seconds = Number(seconds.value); preview(); };
        for (const [label, control] of [['Aplikace', app], ['Publikovaný výstup', output], ['Doba (s)', seconds]]) {
          const field = document.createElement('label'); field.textContent = label; field.append(control); row.append(field);
        }
        row.append(button('↑', () => { [segment.entries[index - 1], segment.entries[index]] = [segment.entries[index], segment.entries[index - 1]]; render(); }, index === 0));
        row.append(button('↓', () => { [segment.entries[index + 1], segment.entries[index]] = [segment.entries[index], segment.entries[index + 1]]; render(); }, index === segment.entries.length - 1));
        row.append(button('Odebrat', () => { segment.entries.splice(index, 1); render(); }));
        section.append(row);
      });
      section.append(button('+ Přidat výstup', () => { if (segment.entries.length >= 20) return; segment.entries.push({ appId: '', outputId: '', seconds: 30 }); render(); }, segment.entries.length >= 20));
      host.append(section);
    }
    preview();
  }
  async function listApp(appId) {
    let after, result = [];
    do {
      const page = await client.listOutputs({ appId, profileId, after, limit: 100 });
      result.push(...page.items.filter(item => item.state === 'published'));
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
    const url = new URL(location.href); url.searchParams.set('edu-output', id); history.replaceState(null, '', url);
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
        const url = new URL(location.href); url.searchParams.set('edu-output', outputId); history.replaceState(null, '', url);
      }
      guard();
      current = await client.publishOutput(outputId, { expectedRevision: current.revision }, client.newOperation());
      const link = await client.getOutputLink(outputId); guard();
      $('open').href = link.url; $('open').hidden = false; $('copy').disabled = false;
      if (!$('existing').querySelector('option[value="' + outputId + '"]'))
        $('existing').append(option(outputId, 'Přehrávač · ' + outputId.slice(0, 8)));
      $('existing').value = outputId;
      note('Přehrávač je publikovaný. Odkaz lze přiřadit spárované Android obrazovce.');
    } catch (error) { note(error.message || 'Publikování se nezdařilo.'); }
    finally { busy = false; $('publish').disabled = false; }
  }
  async function init() {
    await auth.ready;
    const state = auth.status();
    if (!state.connected || !ID.test(state.profileId || '') || !state.schoolId) { note('Přihlaste se a vyberte školní profil.'); return; }
    const requested = new URL(location.href).searchParams.get('edu-profile');
    if (requested && requested !== state.profileId) { note('Otevřete Přehrávač ze správného školního profilu.'); return; }
    schoolId = state.schoolId; profileId = state.profileId;
    try {
      const players = await listPlayers(); guard();
      for (const item of players) $('existing').append(option(item.id, (item.label || 'Přehrávač') + ' · ' + item.id.slice(0, 8)));
      const requestedOutput = new URL(location.href).searchParams.get('edu-output');
      const target = requestedOutput || (players.length === 1 ? players[0].id : '');
      if (target) await openPlayer(target);
      else render();
      await loadCatalog(++loadEpoch);
    } catch (error) { note(error.message); }
  }
  $('existing').onchange = async () => {
    if (!$('existing').value) { $('new').click(); return; }
    try { await openPlayer($('existing').value); }
    catch (error) { note(error.message); }
  };
  $('new').onclick = () => {
    if (config.segments.some(s => s.entries.length) && !confirm('Začít nový Přehrávač? Neuložené změny se ztratí.')) { $('existing').value = outputId; return; }
    config = model.empty(); outputId = '';
    const url = new URL(location.href); url.searchParams.delete('edu-output'); history.replaceState(null, '', url);
    $('existing').value = ''; $('open').hidden = true; $('copy').disabled = true;
    render(); note('Nový Přehrávač je připravený.');
  };
  $('orientation').onchange = () => {
    if (config.segments.some(s => s.entries.length) && !confirm('Změna orientace odstraní přiřazené výstupy. Pokračovat?')) { render(); return; }
    config = model.empty($('orientation').value, 1); render();
  };
  $('layout').onchange = () => {
    if (config.segments.some(s => s.entries.length) && !confirm('Změna šablony odstraní přiřazené výstupy. Pokračovat?')) { render(); return; }
    config = model.empty(config.orientation, Number($('layout').value)); render();
  };
  $('publish').onclick = publish;
  $('copy').onclick = async () => {
    try { guard(); const link = await client.getOutputLink(outputId); guard(); await navigator.clipboard.writeText(link.url); note('Odkaz Přehrávače byl zkopírován.'); }
    catch (error) { note('Odkaz se nepodařilo zkopírovat: ' + error.message); }
  };
  root.addEventListener('message', event => { if (event.origin === location.origin && event.source === $('preview').contentWindow && event.data?.type === 'eduvize-player-preview-ready') preview(); });
  root.addEventListener('eduvize-admin-auth-change', () => { if (profileId) { try { guard(); } catch { ++loadEpoch; catalog = []; $('publish').disabled = true; $('copy').disabled = true; note('Profil se změnil. Obnovte nastavení Přehrávače.'); } } });
  init().catch(error => note(error.message));
})(window);
