/* Shared, strict Player v1 settings for the editor and the public renderer. */
(function (root) {
  'use strict';
  const APPS = Object.freeze({
    news: 'Aktuality', documents: 'Dokumenty školy', menu: 'Jídelníček',
    gallery: 'Fotogalerie', transport: 'Jízdní řády', wisdom: 'Moudrost dne',
    weather: 'Počasí', 'day-progress': 'Průběh dne',
    'school-calendar': 'Školní kalendář', 'school-systems': 'Školní informační systémy',
    holidays: 'Svátky'
  });
  const RENDERERS = Object.freeze({
    news: '/aktuality/published', documents: '/eduvize-dokumenty/published.html',
    menu: '/jidelnicek/published.html', gallery: '/eduvize-styly/fotogalerie/published.html',
    transport: '/eduvize-jizdni-rady/published.html', wisdom: '/eduvize-moudrost-dne/published.html',
    weather: '/pocasi/published', 'day-progress': '/prubeh-dne/',
    'school-calendar': '/eduvize-skolni-kalendar/published.html',
    'school-systems': '/skolni-systemy/published.html', holidays: '/eduvize-svatky/published.html'
  });
  const ID = /^[a-f0-9]{32}$/;
  function fail(message) { throw new Error(message); }
  function layout(orientation, layoutId) {
    const registry = root.EduvizeNSPLayouts;
    const sizes = registry?.layouts?.[orientation]?.[layoutId];
    const positions = registry?.positions?.[orientation]?.[layoutId];
    if (!sizes || !positions || sizes.length !== positions.length) fail('Neplatná šablona obrazovky.');
    const [width, height] = orientation === 'portrait' ? [2160, 3840] : [3840, 2160];
    return sizes.map(([w, h], i) => {
      const [x, y] = positions[i];
      if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > width || y + h > height) fail('Neplatná geometrie segmentu.');
      return { id: i + 1, x, y, width: w, height: h, canvasWidth: width, canvasHeight: height };
    });
  }
  function validate(value, { allowEmpty = false } = {}) {
    if (!value || Array.isArray(value) || typeof value !== 'object' ||
        Object.keys(value).sort().join('|') !== 'layoutId|orientation|segments|version' || value.version !== 1 ||
        !['portrait', 'landscape'].includes(value.orientation) ||
        !Number.isInteger(value.layoutId)) fail('Neplatné nastavení Přehrávače.');
    const geometry = layout(value.orientation, value.layoutId);
    if (!Array.isArray(value.segments) || value.segments.length !== geometry.length) fail('Každý segment musí mít vlastní seznam výstupů.');
    const segments = value.segments.map((segment, i) => {
      if (!segment || Array.isArray(segment) || typeof segment !== 'object' ||
          Object.keys(segment).sort().join('|') !== 'entries|id' || segment.id !== i + 1 ||
          !Array.isArray(segment.entries) || segment.entries.length > 20 ||
          (!allowEmpty && segment.entries.length === 0)) fail('Segment nemá platný obsah.');
      return { id: segment.id, entries: segment.entries.map(entry => {
        if (!entry || Array.isArray(entry) || typeof entry !== 'object' ||
            Object.keys(entry).sort().join('|') !== 'appId|outputId|seconds' ||
            !Object.hasOwn(APPS, entry.appId) || !ID.test(entry.outputId || '') ||
            !Number.isInteger(entry.seconds) || entry.seconds < 5 || entry.seconds > 3600)
          fail('Výstup musí mít aplikaci a dobu zobrazení 5–3600 sekund.');
        return { appId: entry.appId, outputId: entry.outputId, seconds: entry.seconds };
      }) };
    });
    return { version: 1, orientation: value.orientation, layoutId: value.layoutId, segments };
  }
  function empty(orientation = 'landscape', layoutId = 1) {
    return { version: 1, orientation, layoutId, segments: layout(orientation, layoutId).map(({ id }) => ({ id, entries: [] })) };
  }
  function renderer(appId, outputId, base = root.location.origin) {
    if (!Object.hasOwn(RENDERERS, appId) || !ID.test(outputId || '')) fail('Neplatný publikovaný výstup.');
    const url = new URL(RENDERERS[appId], base);
    if (url.origin !== base) fail('Cizí adresa výstupu.');
    url.searchParams.set('edu-output', outputId);
    return url.href;
  }
  root.EduvizePlayerModel = Object.freeze({ APPS, RENDERERS, layout, validate, empty, renderer });
})(typeof window === 'undefined' ? globalThis : window);
