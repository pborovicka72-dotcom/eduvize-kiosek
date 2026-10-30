/* Shared application routing for the kiosk and its configuration previews. */
(function (root) {
  'use strict';
  const version = '20261030-3';
  const urls = Object.freeze({
    weather: 'https://eduvize-weather.onrender.com/display',
    holidays: 'https://pborovicka72-dotcom.github.io/eduvize-svatky/',
    transport: 'https://pborovicka72-dotcom.github.io/eduvize-jizdni-rady/index.html',
    wisdom: 'https://pborovicka72-dotcom.github.io/eduvize-moudrost-dne/index.html',
    documents: 'https://pborovicka72-dotcom.github.io/eduvize-dokumenty/index.html',
    news: 'https://eduvize-aktuality.onrender.com/?display=1'
  });
  const paths = {holidays: 'eduvize-svatky', transport: 'eduvize-jizdni-rady',
    wisdom: 'eduvize-moudrost-dne', documents: 'eduvize-dokumenty', news: 'eduvize-aktuality'};
  const hosts = {weather: 'eduvize-weather.onrender.com', documents: 'eduvize-dokumenty-api.onrender.com',
    news: 'eduvize-aktuality.onrender.com'};
  function identify(value) {
    let url;
    try { url = new URL(value); } catch { return null; }
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    for (const [app, path] of Object.entries(paths)) {
      if (url.hostname === 'pborovicka72-dotcom.github.io' &&
          (url.pathname === '/' + path || url.pathname.startsWith('/' + path + '/'))) return app;
    }
    for (const [app, host] of Object.entries(hosts)) if (url.hostname === host) return app;
    return null;
  }
  function normalize(config) {
    if (!config || !Array.isArray(config.pages)) return config;
    for(const page of config.pages) if(page.id==='school') page.buttons=(page.buttons||[]).filter(item=>!(item.type==='page'&&item.target==='home'&&/^zpět$/i.test((item.label||'').trim())));
    for (const page of config.pages) for (const item of page.buttons || []) {
      if (item.type !== 'url') continue;
      const app = identify(item.target);
      if (!app) continue;
      item.appUrl = item.target;
      item.type = 'app';
      item.target = app;
      delete item.zoom;
    }
    return config;
  }
  function resolve(item, base) {
    if(item.type==='document'){const url=new URL(item.target,base);if(!['https:','http:'].includes(url.protocol))return null;return url;}
    const app = item.type === 'app' ? item.target : identify(item.target);
    if (item.type === 'app' && !urls[app]) return null;
    const supplied = item.type === 'app' ? item.appUrl : item.target;
    const canonical = app && new URL(urls[app]);
    const url = new URL(app ? urls[app] : item.target, base);
    // Keep application settings while always selecting its display entry point.
    if (app && identify(supplied) === app) {
      for (const [key, value] of new URL(supplied).searchParams) url.searchParams.set(key, value);
    }
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    if (app) {
      url.pathname = canonical.pathname;
      url.searchParams.set('viewMode', 'kiosk');
      url.searchParams.set('output', 'kiosk');
      url.searchParams.set('eduvize_ui_version', version);
      if (app === 'news') url.searchParams.set('display', '1');
    }
    return url;
  }
  root.EduvizeKioskApps = Object.freeze({urls, identify, normalize, resolve, version});
})(window);
