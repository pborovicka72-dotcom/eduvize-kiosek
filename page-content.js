/* Structured plain-text content; no HTML is stored or evaluated. */
(function(root){
  const limits={title:100,text:1600};const openSections=new WeakSet();
  function node(tag,className,text){const e=document.createElement(tag);e.className=className||'';if(text!==undefined)e.textContent=text;return e;}
  function safeUrl(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
  function image(parent,url,alt){const src=safeUrl(url);if(!src)return;const box=node('figure','page-image-box'),img=node('img','page-section-image');img.alt=alt||'';box.hidden=false;img.onload=()=>{box.hidden=false;root.EduvizeFitPanel?.refresh();};img.onerror=()=>{box.hidden=true;root.EduvizeFitPanel?.refresh();};box.append(img);parent.append(box);img.src=src;}
  function render(host,page,onOpen){
    root.EduvizeContentSurface?.mount(host,{flow:true});const content=page.content||{};
    const sections=(content.sections||[]).filter(section=>section.title||section.text||safeUrl(section.image)||safeUrl(section.link));
    const segments=sections;
    const hasContent=sections.length>0;
    if(!hasContent){host.replaceChildren();return false;}
    root.EduvizePagedPanel.mountFlow(host,segments,{key:page.id,fit:false,label:'Stránkování podstránky',render:(sheet,items)=>{
      sheet.className='edu-paged-content page-content-sheet';
      for(const section of items){
      const row=node('div','page-content-row');
      image(row,section.image,section.title||page.title);
      const card=node('section','page-section');
      if(section.title)card.append(node('h2','',String(section.title)));
      if(section.text)card.append(node('p','',String(section.text)));
      const link=safeUrl(section.link);
      if(link){const button=node('button','page-section-link','📎');button.type='button';button.title='Otevřít podrobnosti';button.setAttribute('aria-label','Otevřít podrobnosti'+(section.title?' – '+section.title:''));button.onclick=()=>onOpen?.(link);card.append(button);}
      if(card.children.length)row.append(card);sheet.append(row);
      }
    }});
    return true;
  }
  function editor(host,page,onChange){
    host.replaceChildren();
    host.hidden=page.id==='home'||page.id==='school';
    if(host.hidden)return;
    page.content ||= {sections:[]};
    const content=page.content;
    if(!Array.isArray(content.sections))content.sections=[];
    host.append(node('h2','','Obsah podstránky'),node('p','help','Sekce mají obrázek vlevo, nadpis, text a volitelný odkaz na podrobnosti. Na jednu stránku se seskupí tolik celých sekcí, kolik se jich vejde. Spodní tlačítka jsou volitelné rychlé akce.'));
    function field(parent,label,value,max,change,textarea){
      const wrap=node('label','edu-admin__field',label),input=node(textarea?'textarea':'input');
      input.value=value||'';input.maxLength=max;if(textarea)input.rows=1;
      input.oninput=()=>{change(input.value);onChange();};wrap.append(input);parent.append(wrap);
    }

    const list=node('div','edu-item-editor-list');host.append(list);
    content.sections.forEach((section,index)=>{
      const card=node('details','edu-item-editor ev-admin');card.open=openSections.has(section);
      card.ontoggle=()=>{if(card.open)openSections.add(section);else openSections.delete(section)};
      const summary=node('summary','edu-item-editor__summary');
      const grip=node('button','edu-item-editor__drag','⠿');grip.type='button';grip.setAttribute('aria-label','Přetáhnout sekci pro změnu pořadí');grip.title='Přetáhnout pro změnu pořadí';grip.onclick=e=>{e.preventDefault();e.stopPropagation()};
      const heading=node('span','edu-item-editor__heading'),title=node('strong','',section.title||'Sekce '+(index+1));heading.append(title,node('small','',section.image?'Text a obrázek':'Textová sekce'));summary.append(grip,heading);
      const body=node('div','edu-item-editor__body'),fields=node('div','edu-item-editor__fields');
      field(fields,'Nadpis sekce',section.title,limits.title,value=>{section.title=value;title.textContent=value||'Sekce '+(index+1)},false);
      field(fields,'Obrázek sekce (URL)',section.image,2048,value=>section.image=value,false);
      field(fields,'Odkaz sekce (URL)',section.link,2048,value=>section.link=value,false);
      field(fields,'Text sekce',section.text,limits.text,value=>section.text=value,true);
      fields.lastElementChild?.classList.add('edu-item-editor__wide');
      body.append(fields);
      const actions=node('div','edu-admin__actions edu-item-editor__actions');
      for(const [label,offset] of [['Nahoru',-1],['Dolů',1],['Odebrat sekci',0]]){
        const button=node('button','edu-admin__button edu-admin__button--secondary',label);button.type='button';
        button.disabled=offset!==0&&(index+offset<0||index+offset>=content.sections.length);
        button.onclick=()=>{if(!offset)content.sections.splice(index,1);else [content.sections[index],content.sections[index+offset]]=[content.sections[index+offset],content.sections[index]];editor(host,page,onChange);onChange();};actions.append(button);
      }
      body.append(actions);card.append(summary,body);list.append(card);
    });
    root.EduvizeItemSort?.mount(list,{onMove:(from,to)=>{const [section]=content.sections.splice(from,1);content.sections.splice(to,0,section);editor(host,page,onChange);onChange()}});
    const add=node('button','edu-admin__button','+ Obsahová sekce');add.type='button';
    add.onclick=()=>{const section={title:'',text:''};content.sections.push(section);openSections.add(section);editor(host,page,onChange);onChange();};
    const addRow=node('div','edu-admin__control-row');addRow.append(add);host.append(addRow);
  }
  root.EduvizePageContent=Object.freeze({render,editor,limits,safeUrl});
})(window);
