/* Structured plain-text content; no HTML is stored or evaluated. */
(function(root){
  const limits={intro:400,title:100,text:1600};
  function node(tag,className,text){const e=document.createElement(tag);e.className=className||'';if(text!==undefined)e.textContent=text;return e;}
  function safeUrl(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
  function image(parent,url,alt){const src=safeUrl(url);if(!src)return;const box=node('figure','page-image-box'),img=node('img','page-section-image');img.alt=alt||'';box.hidden=true;img.onload=()=>{box.hidden=false;root.EduvizeFitPanel?.refresh();};img.onerror=()=>{box.hidden=true;root.EduvizeFitPanel?.refresh();};box.append(img);parent.append(box);img.src=src;}
  function render(host,page,onOpen){
    const content=page.content||{};
    const sections=(content.sections||[]).filter(section=>section.title||section.text||safeUrl(section.image)||safeUrl(section.link));
    const segments=sections.length?sections:[null];
    const hasContent=!!(content.intro||safeUrl(content.image)||sections.length);
    if(!hasContent){host.replaceChildren();return false;}
    root.EduvizePagedPanel.mount(host,segments,{key:page.id,label:'Stránkování podstránky',render:(sheet,section,index)=>{
      sheet.className='edu-paged-content page-content-sheet';
      if(index===0&&(content.intro||safeUrl(content.image))){const row=node('div','page-content-row');image(row,content.image,page.title);if(content.intro)row.append(node('p','page-intro edu-content-intro',String(content.intro)));sheet.append(row);}
      if(!section)return;
      const row=node('div','page-content-row');
      image(row,section.image,section.title||page.title);
      const card=node('section','page-section');
      if(section.title)card.append(node('h2','',String(section.title)));
      if(section.text)card.append(node('p','',String(section.text)));
      const link=safeUrl(section.link);
      if(link){const button=node('button','page-section-link','📎');button.type='button';button.title='Otevřít podrobnosti';button.setAttribute('aria-label','Otevřít podrobnosti'+(section.title?' – '+section.title:''));button.onclick=()=>onOpen?.(link);card.append(button);}
      if(card.children.length)row.append(card);sheet.append(row);
    }});
    return true;
  }
  function editor(host,page,onChange){
    host.replaceChildren();
    host.hidden=page.id==='home'||page.id==='school';
    if(host.hidden)return;
    page.content ||= {intro:'',sections:[]};
    const content=page.content;
    if(!Array.isArray(content.sections))content.sections=[];
    host.append(node('h2','','Obsah podstránky'),node('p','help','Každá obsahová sekce je samostatná stránka kiosku. Může mít obrázek před textem a vlastní odkaz. Úvod je na první stránce. Spodní tlačítka jsou volitelné rychlé akce.'));
    function field(parent,label,value,max,change,textarea){
      const wrap=node('label','edu-admin__field',label),input=node(textarea?'textarea':'input');
      input.value=value||'';input.maxLength=max;if(textarea)input.rows=1;
      input.oninput=()=>{change(input.value);onChange();};wrap.append(input);parent.append(wrap);
    }
    field(host,'Obrázek úvodu (URL)',content.image,2048,value=>content.image=value,false);
    field(host,'Úvodní text',content.intro,limits.intro,value=>content.intro=value,true);
    content.sections.forEach((section,index)=>{
      const card=node('div','buttonEditor');
      card.append(node('h3','','Sekce '+(index+1)));
      field(card,'Obrázek sekce (URL)',section.image,2048,value=>section.image=value,false);
      field(card,'Nadpis sekce',section.title,limits.title,value=>section.title=value,false);
      field(card,'Text sekce',section.text,limits.text,value=>section.text=value,true);
      field(card,'Odkaz sekce (URL)',section.link,2048,value=>section.link=value,false);
      const actions=node('div','edu-admin__actions');
      for(const [label,offset] of [['Nahoru',-1],['Dolů',1],['Odebrat sekci',0]]){
        const button=node('button','edu-admin__button edu-admin__button--secondary',label);button.type='button';
        button.disabled=offset!==0&&(index+offset<0||index+offset>=content.sections.length);
        button.onclick=()=>{if(!offset)content.sections.splice(index,1);else [content.sections[index],content.sections[index+offset]]=[content.sections[index+offset],content.sections[index]];editor(host,page,onChange);onChange();};actions.append(button);
      }
      card.append(actions);host.append(card);
    });
    const add=node('button','edu-admin__button','+ Obsahová sekce');add.type='button';
    add.onclick=()=>{content.sections.push({title:'',text:''});editor(host,page,onChange);onChange();};host.append(add);
  }
  root.EduvizePageContent=Object.freeze({render,editor,limits,safeUrl});
})(window);
