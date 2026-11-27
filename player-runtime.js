(function (root) {
  'use strict';
  const model = root.EduvizePlayerModel;
  const ID = /^[a-f0-9]{32}$/;
  const status = document.getElementById('status');
  const stage = document.getElementById('stage');
  const outputId = new URL(location.href).searchParams.get('edu-output');
  const preview = new URL(location.href).searchParams.get('preview') === '1' && root.parent !== root;
  const client = root.EduvizeOutputClient.create({ origin: location.origin });
  let revision = 0, players = [], currentConfig = null, stopped = false;
  function report(message) { status.textContent = message; status.hidden = !message; }
  function scaleFrame(frame) {
    const box = frame.parentElement, width = Number(frame.dataset.width), height = Number(frame.dataset.height);
    if (!box || !width || !height) return;
    frame.style.width = width + 'px'; frame.style.height = height + 'px';
    frame.style.transform = 'scale(' + Math.min(box.clientWidth / width, box.clientHeight / height) + ')';
  }
  function size() {
    if (!currentConfig) return;
    const portrait = currentConfig.orientation === 'portrait';
    const [w, h] = portrait ? [2160, 3840] : [3840, 2160];
    const scale = Math.min(innerWidth / w, innerHeight / h);
    stage.style.width = Math.floor(w * scale) + 'px';
    stage.style.height = Math.floor(h * scale) + 'px';
    stage.querySelectorAll('iframe.player-frame').forEach(scaleFrame);
  }
  function stop() {
    for (const player of players) player.stop();
    players = []; stage.replaceChildren();
  }
  function segmentPlayer(segment, geometry) {
    const box = document.createElement('section');
    box.className = 'player-segment';
    box.setAttribute('aria-label', 'Segment ' + segment.id);
    Object.assign(box.style, {
      left: geometry.x / geometry.canvasWidth * 100 + '%',
      top: geometry.y / geometry.canvasHeight * 100 + '%',
      width: geometry.width / geometry.canvasWidth * 100 + '%',
      height: geometry.height / geometry.canvasHeight * 100 + '%'
    });
    stage.append(box);
    if (!segment.entries.length) { box.textContent = 'Segment ' + segment.id + ' · Přidejte výstup'; box.classList.add('player-segment--empty'); return { stop() { box.replaceChildren(); } }; }
    let index = -1, timer = 0, active = null, cancelled = false, epoch = 0;
    const schedule = (fn, ms) => { clearTimeout(timer); timer = setTimeout(fn, ms); };
    async function show(nextIndex) {
      if (cancelled) return;
      const ticket = ++epoch, entry = segment.entries[nextIndex];
      try {
        const child = await client.getPublicOutput(entry.outputId);
        if (cancelled || ticket !== epoch) return;
        const g = child.presentation?.geometry;
        const compatible = child.presentation?.mode === 'web' ||
          (child.presentation?.mode === 'nsp' && g?.registryId === 'nsp-4k' &&
           g.orientation === currentConfig.orientation &&
           g.layoutId === currentConfig.layoutId && g.segmentId === segment.id);
        if (child.appId !== entry.appId || !compatible)
          throw Error('Výstup neodpovídá segmentu.');
        const frame = document.createElement('iframe');
        frame.className = 'player-frame player-frame--loading';
        frame.dataset.outputId = entry.outputId;
        frame.dataset.width = String(geometry.width);
        frame.dataset.height = String(geometry.height);
        frame.title = model.APPS[entry.appId];
        frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
        frame.setAttribute('allow', 'autoplay');
        frame.setAttribute('referrerpolicy', 'no-referrer');
        let settled = false;
        const fail = () => { if (settled || cancelled || ticket !== epoch) return; settled = true; frame.remove(); schedule(() => show(segment.entries.length > 1 ? (nextIndex + 1) % segment.entries.length : nextIndex), 10000); };
        const watchdog = setTimeout(fail, 20000);
        frame.onload = () => {
          if (settled || cancelled || ticket !== epoch) { frame.remove(); return; }
          try { if (frame.contentWindow.location.href === 'about:blank') return; } catch (_) { /* The renderer can still load without DOM access. */ }
          settled = true; clearTimeout(watchdog);
          frame.classList.remove('player-frame--loading');
          if (active && active !== frame) active.remove();
          active = frame; index = nextIndex;
          schedule(() => show((index + 1) % segment.entries.length),
            Math.max(entry.seconds, segment.entries.length === 1 ? 60 : 5) * 1000);
        };
        frame.onerror = () => { clearTimeout(watchdog); fail(); };
        frame.src = model.renderer(entry.appId, entry.outputId);
        box.append(frame);
        scaleFrame(frame);
      } catch (error) {
        if (!cancelled && ticket === epoch) {
          if ([401, 403, 404, 410].includes(error?.status) && active?.dataset.outputId === entry.outputId) {
            active.remove(); active = null;
          }
          schedule(() => show(segment.entries.length > 1 ? (nextIndex + 1) % segment.entries.length : nextIndex), 10000);
        }
      }
    }
    show(0);
    return { stop() { cancelled = true; ++epoch; clearTimeout(timer); box.replaceChildren(); } };
  }
  function renderConfig(raw, nextRevision) {
    const config = model.validate(raw, { allowEmpty: preview });
    const geometry = model.layout(config.orientation, config.layoutId);
    stop(); currentConfig = config; revision = nextRevision;
    size(); players = config.segments.map((segment, i) => segmentPlayer(segment, geometry[i]));
    report('');
  }
  async function refresh() {
    if (stopped || !ID.test(outputId || '')) { stop(); report('Neplatný odkaz Přehrávače.'); return; }
    try {
      const snapshot = await client.getPublicOutput(outputId);
      if (stopped) return;
      if (snapshot.appId !== 'player' || !Number.isSafeInteger(snapshot.publishedRevision)) throw Error('Neplatný výstup Přehrávače.');
      if (snapshot.publishedRevision === revision) return;
      renderConfig(snapshot.payload, snapshot.publishedRevision);
    } catch (error) {
      if (stopped) return;
      // An explicit denial clears the scene. A temporary outage keeps the last
      // verified scene while the next poll retries.
      if ([401, 403, 404, 410].includes(error?.status) || !currentConfig) {
        stop(); revision = 0; currentConfig = null;
        report('Přehrávač není dostupný. Připojení se zkusí znovu.');
      } else report('Připojení je přerušené. Zobrazuji poslední ověřený obsah.');
    }
  }
  root.addEventListener('resize', size);
  if (preview) {
    root.addEventListener('message', event => {
      if (event.origin !== location.origin || event.source !== root.parent || event.data?.type !== 'eduvize-player-preview') return;
      try { renderConfig(event.data.config, ++revision); }
      catch (error) { stop(); report(error.message); }
    });
    root.parent.postMessage({ type: 'eduvize-player-preview-ready' }, location.origin);
  }
  const polling = preview ? null : setInterval(refresh, 30000);
  root.addEventListener('pagehide', () => { stopped = true; clearInterval(polling); stop(); }, { once: true });
  if (!preview) refresh();
})(window);
