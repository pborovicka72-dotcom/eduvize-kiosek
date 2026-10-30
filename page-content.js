/* Structured plain-text content; no HTML is stored or evaluated. */
(function(root){
  const limits={intro:400,title:100,text:1600};
  function node(tag,className,text){const e=document.createElement(tag);e.className=className||'';if(text!==undefined)e.textContent=text;return e;}
  function render(host,page){
    host.replaceChildren();
    const content=page.content||{};
    if(content.intro)host.append(node('p','page-intro',String(content.intro)));
    for(const section of content.sections||[]){
      if(!section.title&&!section.text)continue;
      const card=node('section','page-section');
      if(section.title)card.append(node('h2','',String(section.title)));
      if(section.text)card.append(node('p','',String(section.text)));
      host.append(card);
    }
    return host.children.length>0;
  }
  function editor(host,page,onChange){
    host.replaceChildren();
    host.hidden=page.id==='home'||page.id==='school';
    if(host.hidden)return;
    page.content ||= {intro:'',sections:[]};
    const content=page.content;
    if(!Array.isArray(content.sections))content.sections=[];
    host.append(node('h2','','Obsah podstránky'),node('p','help','Struktura: úvod a sekce s nadpisem a textem. Tlačítka na aplikace, weby a další podstránky se zobrazí pod obsahem. Změny ihned vidíte v náhledu.'));
    function field(parent,label,value,max,change,textarea){
      const wrap=node('label','edu-admin__field',label),input=node(textarea?'textarea':'input');
      input.value=value||'';input.maxLength=max;if(textarea)input.rows=1;
      input.oninput=()=>{change(input.value);onChange();};wrap.append(input);parent.append(wrap);
    }
    field(host,'Úvodní text',content.intro,limits.intro,value=>content.intro=value,true);
    content.sections.forEach((section,index)=>{
      const card=node('div','buttonEditor');
      card.append(node('h3','','Sekce '+(index+1)));
      field(card,'Nadpis sekce',section.title,limits.title,value=>section.title=value,false);
      field(card,'Text sekce',section.text,limits.text,value=>section.text=value,true);
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
  root.EduvizePageContent=Object.freeze({render,editor,limits});
})(window);
