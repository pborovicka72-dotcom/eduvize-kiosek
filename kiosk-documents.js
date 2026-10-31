/* Uses the existing Documents/OneDrive service. Never stores credentials in config. */
(function(root){
  const base='https://eduvize-dokumenty-api.onrender.com';
  let token='';let documents=[];let categories=['Ostatní'];const views=new Set();let pending;
  async function refresh(includeCloud=true){
    if(!pending)pending=(async()=>{
      const response=await fetch(base+'/api/documents?scope=kiosk',{cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.detail||'Chyba serveru '+response.status);
      documents=Array.isArray(data.items)?data.items:[];
      let categoryError;
      if(token){try{const r=await fetch(base+'/api/admin/categories?scope=kiosk',{cache:'no-store',headers:{Authorization:'Bearer '+token}});const data=await r.json();if(!r.ok)throw Error(data.detail||'Nelze načíst kategorie');categories=data.categories||[];}catch(e){categoryError=e;}}
      for(const view of views){if(!view.panel.isConnected){views.delete(view);continue;}view.fill();}
      if(categoryError)throw categoryError;
      return documents;
    })().finally(()=>{pending=null;});
    const results=await Promise.allSettled([pending,...(includeCloud&&root.EduvizeKioskCloud?.refreshList?[root.EduvizeKioskCloud.refreshList()]:[])]);
    const failed=results.filter(r=>r.status==='rejected');if(failed.length)throw Error(failed.map(r=>r.reason.message).join(' '));return documents;
  }
  function remember(doc){if(!doc?.id)return;const index=documents.findIndex(x=>String(x.id)===String(doc.id));if(index<0)documents.push(doc);else documents[index]=doc;}
  function assignedId(item){try{return new URL(item.target,base).searchParams.get('document')||''}catch{return ''}}

  function viewer(id){const url=new URL('/display',base);url.searchParams.set('document',id);url.searchParams.set('viewMode','kiosk');url.searchParams.set('output','kiosk');return url.href;}
  function node(tag,className,text){const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;}
  function editor(host,item,onChange){
    const panel=node('div','document-button-editor');
    panel.append(node('p','help','Vyberte existující dokument nebo nahrajte nový do stejného OneDrive jako v Dokumentech. Společný administrační klíč zadejte jednou v horní části stránky.'));
    const load=node('button','edu-admin__button edu-admin__button--secondary','Načíst dokumenty a kategorie');load.type='button';const loadStatus=node('p','edu-upload-status');loadStatus.setAttribute('role','status');loadStatus.setAttribute('aria-live','polite');panel.append(load,loadStatus);
    const label=node('label','edu-admin__field','Existující dokument');const select=node('select');function fillDocuments(){const id=assignedId(item);const options=documents.slice();if(id&&!options.some(doc=>String(doc.id)===id))options.push({id,name:item.label||'Přiřazený dokument'});select.replaceChildren(new Option('Vyberte dokument…',''));for(const doc of options)select.append(new Option(doc.name,String(doc.id)));select.value=id;}fillDocuments();label.append(select);panel.append(label);
    select.onchange=()=>{if(!select.value)return;item.target=viewer(select.value);item.label=select.selectedOptions[0].textContent;onChange();};
    const form=node('form','edu-document-upload');
    const fields=node('div','edu-admin__field-grid');
    const fileLabel=node('label','','Soubor (nejvýše 20 MB)');const file=node('input');file.type='file';file.required=true;fileLabel.append(file);
    const categoryLabel=node('label','','Kategorie');const category=node('select');for(const name of categories)category.append(new Option(name,name));categoryLabel.append(category);fields.append(fileLabel,categoryLabel);
    const button=node('button','edu-admin__button','Nahrát a přiřadit dokument');button.type='submit';
    const progress=node('div');progress.hidden=true;progress.setAttribute('aria-live','polite');const bar=node('progress');bar.max=100;bar.value=0;const message=node('div');progress.append(bar,message);form.append(fields,button,progress);panel.append(form);host.append(panel);
    views.add({panel,fill:()=>{fillDocuments();const selected=category.value;category.replaceChildren();for(const name of categories)category.append(new Option(name,name));if(categories.includes(selected))category.value=selected;}});
    const assign=result=>{remember(result);item.target=viewer(result.id);item.label=result.name;onChange();};
    root.EduvizeDocumentUpload.bind({form,file,category,button,progress,bar,message,getToken:()=>token,endpoint:base+'/api/admin/documents',scope:'kiosk',onSuccess:assign});
    load.onclick=async()=>{
      if(load.disabled)return;load.disabled=true;select.disabled=true;category.disabled=true;load.textContent='Načítám…';panel.setAttribute('aria-busy','true');loadStatus.textContent='Načítám dokumenty a kategorie z OneDrive…';
      try{
        await refresh();
        loadStatus.textContent='Načteno '+Math.max(0,select.children.length-1)+' dokumentů. Vyberte dokument, nebo nahrajte nový soubor.';
      }catch(error){loadStatus.textContent='Načtení se nezdařilo: '+error.message+' Připojení OneDrive lze spravovat v administraci Dokumentů.';}
      finally{load.disabled=false;select.disabled=false;category.disabled=false;load.textContent='Načíst dokumenty a kategorie';panel.setAttribute('aria-busy','false');}
    };
  }
  root.EduvizeKioskDocuments=Object.freeze({editor,viewer,refresh,getToken:()=>token,setToken:value=>{token=String(value||'').trim();}});
})(window);
