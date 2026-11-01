/* Each menu button stores its own explicit news-source URL, independent of browser storage. */
(function(root){
 'use strict';
 const displayFields=['limit','seconds','showImages','imageFit','showDate','showLink','paging'];
 function displaySettings(data){return Object.fromEntries(displayFields.filter(k=>['string','number','boolean'].includes(typeof data?.[k])).map(k=>[k,data[k]]));}
 function snapshot(item){try{const u=new URL(item.appUrl);return {...displaySettings(Object.fromEntries(u.searchParams)),id:u.searchParams.get('newsSource')||'',name:u.searchParams.get('sourceName')||'',url:u.searchParams.get('url')||'',mode:u.searchParams.get('mode')||'auto',categories:u.searchParams.get('categories')||'all'};}catch{return {id:'',name:'',url:'',mode:'auto',categories:'all'};}}
 function assign(item,source){const u=new URL(root.EduvizeKioskApps.urls.news);try{for(const [k,v]of new URL(item.appUrl).searchParams)u.searchParams.set(k,v);}catch{}for(const [key,value]of Object.entries({newsSource:source.id||'',sourceName:source.name||'',url:source.url||'',mode:source.mode||'auto',categories:source.categories||'all',...displaySettings(source)}))u.searchParams.set(key,typeof value==='boolean'?(value?'1':'0'):String(value));item.appUrl=u.href;}
 function sources(config){const values=config?.values||{};return (Array.isArray(values.sources)&&values.sources.length?values.sources:values.url?[{id:'default',name:values.sourceName||'Aktuality školy',url:values.url,mode:values.mode||'auto',categories:values.categories||'all'}]:[]).filter(s=>s&&typeof s.url==='string'&&/^https?:\/\//i.test(s.url)).map(s=>({...displaySettings(values),...s}));}
 function applyCatalog(config,catalog){for(const page of config.pages||[])for(const item of page.buttons||[]){if(item.type!=='app'||item.target!=='news')continue;const current=snapshot(item);const source=(catalog||[]).find(s=>current.id?s.id===current.id:s.url===current.url&&s.mode===current.mode&&s.categories===current.categories);if(source)assign(item,source);}}
 async function load(){await root.EduvizeAdminAuth?.ready;const id=root.EduvizeAdminAuth?.status().profileId;if(!id||!root.EduvizeProfiles)return null;const profile=await root.EduvizeProfiles.request('/'+id);return sources(profile.apps?.news?.config);}
 function editor(host,item,catalog,changed){
  const make=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
  const selected=snapshot(item),label=make('label','Zdroj aktualit');label.className='edu-admin__field';const select=make('select');select.setAttribute('aria-label','Zdroj aktualit');select.add(new Option('Vlastní zdroj / vložený odkaz',''));
  for(const source of catalog||[])select.add(new Option(source.name||source.url,source.id));
  const match=(catalog||[]).find(s=>s.id===selected.id&&s.url===selected.url&&s.mode===selected.mode&&s.categories===selected.categories);
  select.value=match?.id||'';label.append(select);host.append(label);
  const custom=make('label','Adresa vlastního zdroje (web nebo RSS)');custom.className='edu-admin__field';const input=make('input');input.type='url';input.placeholder='https://www.skola.cz/aktuality';input.value=selected.url;input.setAttribute('aria-label','Adresa vlastního zdroje');custom.append(input);host.append(custom);custom.hidden=!!match;
  select.onchange=()=>{const source=(catalog||[]).find(s=>s.id===select.value);custom.hidden=!!source;if(source){assign(item,source);input.value=source.url;}else assign(item,{...snapshot(item),id:''});changed();};
  input.oninput=()=>{assign(item,{...snapshot(item),id:'',url:input.value.trim()});changed();};
  const help=make('p',(catalog||[]).length?'Zdroje se spravují v administraci Aktualit a ukládají do stejného profilu. Tlačítko si uchová vybraný zdroj.':'Zdroje přidejte v administraci Aktualit, uložte na OneDrive do stejného profilu a obnovte jejich seznam. Můžete také zadat adresu přímo.');help.className='edu-admin__hint wide';host.append(help);
 }
 root.EduvizeKioskNews=Object.freeze({snapshot,assign,sources,applyCatalog,load,editor});
})(window);

