/* OneDrive uses the Documents service and its in-memory administrator credential. */
(function(root){
  const base='https://eduvize-dokumenty-api.onrender.com/api/admin/kiosk-configurations';
  function name(value){if(!/^[a-zA-Z0-9_-]{1,64}$/.test(value))throw Error('Použijte 1–64 písmen bez diakritiky, číslic, pomlček nebo podtržítek.');return value;}
  async function request(method,path,token,body){
    if(!token)throw Error('Zadejte administrační klíč Dokumentů.');
    const response=await fetch(base+path,{method,cache:'no-store',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body}:{})});
    const data=await response.json();
    if(!response.ok)throw Error(typeof data.detail==='string'?data.detail:'OneDrive není dostupný ('+response.status+').');
    return data;
  }
  const client={
    list:token=>request('GET','',token),
    save:(value,config,token)=>request('PUT','/'+name(value),token,root.EduvizeKioskConfigFile.stringify(config)),
    load:async(value,token)=>root.EduvizeKioskConfigFile.parse(JSON.stringify(await request('GET','/'+name(value),token)))
  };
  function mount(host,{getConfig,onLoad,onSaved}){
    function node(tag,cls,text){const e=document.createElement(tag);e.className=cls||'';if(text)e.textContent=text;return e;}
    function field(label,input){const wrap=node('label','edu-admin__field',label);wrap.append(input);return wrap;}
    host.append(node('h2','','Konfigurace na OneDrive'),node('p','help','Uložte nastavení pod vlastním názvem a načtěte je na jiném zařízení. Používá se OneDrive připojený v Dokumentech. Klíč zůstává pouze v paměti této stránky.'));
    const grid=node('div','edu-admin__field-grid'),key=node('input'),filename=node('input'),stored=node('select');
    key.type='password';key.autocomplete='off';key.value=root.EduvizeKioskDocuments.getToken();key.oninput=()=>root.EduvizeKioskDocuments.setToken(key.value);
    filename.value='hlavni-kiosek';filename.maxLength=64;filename.pattern='[a-zA-Z0-9_-]{1,64}';
    stored.append(new Option('Nejprve načtěte seznam…',''));stored.onchange=()=>{if(stored.value)filename.value=stored.value;};
    grid.append(field('Administrační klíč Dokumentů',key),field('Název konfigurace na OneDrive',filename),field('Uložené konfigurace',stored));host.append(grid);
    const actions=node('div','edu-admin__actions'),status=node('p','help');status.setAttribute('role','status');
    const buttons=[];
    function action(label,run,primary=false){const button=node('button','edu-admin__button'+(primary?'':' edu-admin__button--secondary'),label);button.type='button';buttons.push(button);button.onclick=async()=>{buttons.forEach(b=>b.disabled=true);status.textContent='Pracuji s OneDrive…';try{await run(root.EduvizeKioskDocuments.getToken());}catch(error){status.textContent=error.message;}finally{buttons.forEach(b=>b.disabled=false);}};actions.append(button);}
    action('Uložit na OneDrive',async token=>{await client.save(filename.value.trim(),getConfig(),token);onSaved?.();status.textContent='Konfigurace uložena na OneDrive do Eduvize-Dokumenty / _Eduvize-system / Kiosek. Při přepsání se zachovává i předchozí verze.';},true);
    action('Načíst z OneDrive',async token=>{const data=await client.load(filename.value.trim(),token);onLoad(data);status.textContent='Konfigurace načtena z OneDrive a uložena v tomto prohlížeči. Předchozí nastavení lze vrátit tlačítkem níže.';});
    action('Načíst seznam',async token=>{const data=await client.list(token);stored.replaceChildren(new Option('Vyberte konfiguraci…',''));for(const item of data.items)stored.append(new Option(item.name,item.name));status.textContent=data.items.length?'Vyberte konfiguraci a klikněte na Načíst z OneDrive.':'Na OneDrive zatím není uložená konfigurace kiosku.';});
    host.append(actions,status);
  }
  root.EduvizeKioskCloud=Object.freeze({client,mount});
})(window);
