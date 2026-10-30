/* Portable kiosk data only: upload credentials are never part of this schema. */
(function(root){
  const keys=['title','subtitle','idleSeconds','pages','school','menuLayout','menuPosition','defaultApp','keyboardMode','layoutOrientation','layoutStyle','layoutBlock','outputType'];
  function validate(data){
    if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Soubor neobsahuje konfiguraci kiosku.');
    if(!Array.isArray(data.pages)||!data.pages.length||data.pages.length>200)throw Error('Chybí platný seznam podstránek.');
    const ids=new Set();let total=0;
    function text(value,label){if(value!==undefined&&typeof value!=='string')throw Error(label+' musí být text.');}
    for(const page of data.pages){
      if(!page||typeof page.id!=='string'||!page.id||ids.has(page.id))throw Error('Podstránky musí mít jedinečné identifikátory.');
      ids.add(page.id);text(page.title,'Název podstránky');text(page.subtitle,'Podtitulek');
      if(!Array.isArray(page.buttons)||page.buttons.length>200)throw Error('Neplatný seznam tlačítek.');
      total+=page.buttons.length;if(total>5000)throw Error('Konfigurace obsahuje příliš mnoho tlačítek.');
      for(const button of page.buttons){if(!button||!['page','url','app','document'].includes(button.type)||typeof button.target!=='string')throw Error('Neplatná akce tlačítka.');text(button.label,'Název tlačítka');}
      if(page.content!==undefined){
        if(!page.content||typeof page.content!=='object'||!Array.isArray(page.content.sections)||page.content.sections.length>100)throw Error('Neplatná struktura obsahu.');
        text(page.content.intro,'Úvod');for(const section of page.content.sections){if(!section||typeof section!=='object')throw Error('Neplatná obsahová sekce.');text(section.title,'Nadpis sekce');text(section.text,'Text sekce');}
      }
    }
    if(!ids.has('home'))throw Error('Chybí hlavní nabídka home.');
    for(const key of ['title','subtitle','menuPosition','defaultApp','keyboardMode','layoutOrientation','outputType'])text(data[key],key);
    if(data.idleSeconds!==undefined&&(!Number.isFinite(data.idleSeconds)||data.idleSeconds<0))throw Error('Neplatný čas návratu.');
    if(data.school!==undefined){if(!data.school||typeof data.school!=='object'||Array.isArray(data.school))throw Error('Neplatné údaje školy.');for(const value of Object.values(data.school))if(typeof value!=='string')throw Error('Údaje školy musí být text.');}
    return Object.fromEntries(keys.filter(key=>data[key]!==undefined).map(key=>[key,data[key]]));
  }
  function parse(text){
    if(text.length>2*1024*1024)throw Error('Konfigurační soubor je větší než 2 MB.');
    const data=JSON.parse(text,(key,value)=>{if(['__proto__','constructor','prototype'].includes(key))throw Error('Soubor obsahuje nepovolený klíč.');return value;});
    if(data?.format!==undefined){if(data.format!=='eduvize-kiosk'||data.version!==1)throw Error('Nepodporovaný formát nebo verze konfigurace.');return validate(data.config);}
    return validate(data);
  }
  function stringify(config){return JSON.stringify({format:'eduvize-kiosk',version:1,exportedAt:new Date().toISOString(),config:validate(config)},null,2);}
  root.EduvizeKioskConfigFile=Object.freeze({parse,stringify});
})(window);
