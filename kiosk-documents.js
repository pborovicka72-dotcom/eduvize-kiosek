/* Uses the existing Documents/OneDrive service. Never stores credentials in config. */
(function(root){
  const base='https://eduvize-dokumenty-api.onrender.com';
  let token='';
  function viewer(id){const url=new URL('/display',base);url.searchParams.set('document',id);url.searchParams.set('viewMode','kiosk');url.searchParams.set('output','kiosk');return url.href;}
  function node(tag,className,text){const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;}
  function editor(host,item,onChange){
    const panel=node('div','document-button-editor');
    panel.append(node('p','help','Vyberte existující dokument nebo nahrajte nový do stejného OneDrive jako v Dokumentech. Klíč je jen v paměti této stránky, nikoli v konfiguraci kiosku.'));
    const auth=node('label','edu-admin__field','Administrační klíč Dokumentů');const password=node('input');password.type='password';password.autocomplete='off';password.value=token;password.oninput=()=>token=password.value;auth.append(password);panel.append(auth);
    const load=node('button','edu-admin__button edu-admin__button--secondary','Načíst dokumenty a kategorie');load.type='button';panel.append(load);
    const label=node('label','edu-admin__field','Existující dokument');const select=node('select');select.append(new Option('Vyberte dokument…',''));label.append(select);panel.append(label);
    select.onchange=()=>{if(!select.value)return;item.target=viewer(select.value);if(!item.label||item.label==='Nové tlačítko')item.label=select.selectedOptions[0].textContent;onChange();};
    const form=node('form','edu-document-upload');
    const fields=node('div','edu-admin__field-grid');
    const fileLabel=node('label','','Soubor (nejvýše 20 MB)');const file=node('input');file.type='file';file.required=true;fileLabel.append(file);
    const categoryLabel=node('label','','Kategorie');const category=node('select');category.append(new Option('Ostatní','Ostatní'));categoryLabel.append(category);fields.append(fileLabel,categoryLabel);
    const button=node('button','edu-admin__button','Nahrát a přiřadit dokument');button.type='submit';
    const progress=node('div');progress.hidden=true;progress.setAttribute('aria-live','polite');const bar=node('progress');bar.max=100;bar.value=0;const message=node('div');progress.append(bar,message);form.append(fields,button,progress);panel.append(form);host.append(panel);
    const assign=result=>{item.target=viewer(result.id);if(!item.label||item.label==='Nové tlačítko')item.label=result.name;onChange();};
    root.EduvizeDocumentUpload.bind({form,file,category,button,progress,bar,message,getToken:()=>token,endpoint:base+'/api/admin/documents',onSuccess:assign});
    load.onclick=async()=>{
      load.disabled=true;progress.hidden=false;message.textContent='Načítám dokumenty…';
      try{
        const response=await fetch(base+'/api/documents',{cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.detail||'Chyba serveru '+response.status);
        select.replaceChildren(new Option('Vyberte dokument…',''));
        for(const doc of data.items||[])select.append(new Option(doc.name,doc.id));
        if(token){const response=await fetch(base+'/api/admin/categories',{headers:{Authorization:'Bearer '+token}});const data=await response.json();if(!response.ok)throw Error(data.detail||'Nelze načíst kategorie');category.replaceChildren();for(const name of data.categories||[])category.append(new Option(name,name));}
        message.textContent='Vyberte dokument, nebo nahrajte nový soubor.';
      }catch(error){message.textContent=error.message+' Připojení OneDrive lze spravovat v administraci Dokumentů.';}
      finally{load.disabled=false;}
    };
  }
  root.EduvizeKioskDocuments=Object.freeze({editor,viewer,getToken:()=>token,setToken:value=>{token=String(value||'');}});
})(window);
