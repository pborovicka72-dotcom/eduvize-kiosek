/* Shared application routing for the kiosk and its configuration previews. */
(function (root) {
  'use strict';
  const version = '20261030-33';
  const urls = Object.freeze({
    weather: 'https://eduvize-weather.onrender.com/display',
    holidays: 'https://pborovicka72-dotcom.github.io/eduvize-svatky/',
    transport: 'https://pborovicka72-dotcom.github.io/eduvize-jizdni-rady/index.html',
    wisdom: 'https://pborovicka72-dotcom.github.io/eduvize-moudrost-dne/index.html',
    documents: 'https://eduvize-dokumenty-api.onrender.com/display',
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
  function documentFile(value){try{const u=new URL(value);if(u.hostname==='eduvize-dokumenty-api.onrender.com'&&u.pathname==='/display'&&u.searchParams.has('document')){u.searchParams.set('viewMode','kiosk');u.searchParams.set('output','kiosk');u.searchParams.set('eduvize_ui_version','20261030-33');return u;}const match=u.hostname==='eduvize-dokumenty-api.onrender.com'&&u.pathname.match(/^\/api\/documents\/([^/]+)\/file$/);if(!match)return null;const view=new URL('https://eduvize-dokumenty-api.onrender.com/display');view.searchParams.set('document',decodeURIComponent(match[1]));view.searchParams.set('viewMode','kiosk');view.searchParams.set('output','kiosk');view.searchParams.set('eduvize_ui_version','20261030-33');return view;}catch{return null;}}
  function imageSource(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&(/\.(?:png|jpe?g|gif|webp|avif|svg|bmp)(?:$)/i.test(u.pathname)||/^encrypted-tbn\d*\.gstatic\.com$/i.test(u.hostname)||u.hostname==='images.unsplash.com');}catch{return false;}}
  function imageViewer(value,base){const source=new URL(value,base);if(!['http:','https:'].includes(source.protocol))return null;const viewer=new URL('https://pborovicka72-dotcom.github.io/eduvize-styly/design-system/image-viewer.html');viewer.searchParams.set('src',source.href);viewer.searchParams.set('v','20261030-33');return viewer;}
  function normalize(config) {
    if (!config || !Array.isArray(config.pages)) return config;
    for(const page of config.pages) if(page.id==='school') page.buttons=(page.buttons||[]).filter(item=>!(item.type==='page'&&item.target==='home'&&/^zpět$/i.test((item.label||'').trim())));
    for (const page of config.pages) for (const item of page.buttons || []) {
      if(item.type==='app'&&item.appUrl){const previous=documentFile(item.appUrl);if(previous){item.type='document';item.target=previous.href;delete item.appUrl;delete item.zoom;continue;}if(imageSource(item.appUrl)){item.type='image';item.target=item.appUrl;delete item.appUrl;delete item.zoom;continue;}}
      if (item.type !== 'url') continue;const file=documentFile(item.target);if(file){item.type='document';item.target=file.href;delete item.zoom;continue;}if(imageSource(item.target)){item.type='image';delete item.zoom;continue;}
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
    if(item.type!=='image'){const file=documentFile(item.type==='app'?item.appUrl:item.target);if(file)return file;}
    if(item.type==='image'||(['url','document'].includes(item.type)&&imageSource(item.target)))return imageViewer(item.target,base);
    if(item.type==='document'){const url=new URL(item.target,base);if(url.hostname==='eduvize-dokumenty-api.onrender.com'&&url.searchParams.has('document'))url.searchParams.set('eduvize_ui_version','20261030-33');if(!['https:','http:'].includes(url.protocol))return null;return url;}
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
  const imageChecks=new Map();
  function probeImage(url){
    if(!root.Image)return Promise.resolve(false);
    if(imageChecks.has(url))return imageChecks.get(url);
    const result=new Promise(resolve=>{
      const image=new root.Image();let finished=false,timer,check;
      function finish(value){if(finished)return;finished=true;clearTimeout(timer);clearInterval(check);image.onload=null;image.onerror=null;resolve(value);}
      image.onload=()=>finish(image.naturalWidth>0&&image.naturalHeight>0);image.onerror=()=>finish(false);
      timer=setTimeout(()=>finish(false),4000);check=setInterval(()=>{if(image.naturalWidth>0&&image.naturalHeight>0)finish(true);},40);image.src=url;
    });
    imageChecks.set(url,result);result.then(found=>{if(!found)imageChecks.delete(url);});return result;
  }
  function isImageViewer(value){try{const u=new URL(value);return u.origin==='https://pborovicka72-dotcom.github.io'&&u.pathname==='/eduvize-styly/design-system/image-viewer.html';}catch{return false;}}
  async function resolveForOpen(item,base){
    const url=resolve(item,base);if(!url)return null;
    if(item.type!=='url'||identify(item.target)||isImageViewer(url.href))return url;
    return await probeImage(url.href)?imageViewer(url.href,base):url;
  }
  root.EduvizeKioskApps = Object.freeze({urls, identify, normalize, resolve, resolveForOpen, isImageViewer, imageSource, version});
})(window);
