/* School information is stored in the existing kiosk configuration. */
(function (root) {
  'use strict';
  const limits = {description:240,motto:80,additionalInfo:240};
  const shorten=(text,max)=>text.length>max?text.slice(0,max-1).trimEnd()+'…':text;
  const fields = [
    ['name', 'Název školy', 'textarea'],
    ['motto', 'Motto nebo krátké představení', 'textarea'],
    ['description', 'O škole', 'textarea'],
    ['address', 'Adresa', 'textarea'],
    ['phone', 'Telefon', 'tel'],
    ['email', 'E-mail', 'email'],
    ['director', 'Ředitel / ředitelka', 'textarea'],
    ['officeHours', 'Úřední hodiny', 'textarea'],
    ['ico', 'IČO', 'text'],
    ['additionalInfo', 'Další informace pro návštěvníky', 'textarea'],
    ['photo', 'URL fotografie školy', 'url']
  ];
  function values(config) {
    const source = config.school || {};
    return Object.fromEntries(fields.map(([key]) => [key, typeof source[key] === 'string' ? source[key].trim() : '']));
  }
  function webUrl(value) {
    try {
      const url = new URL(value);
      return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
    } catch { return null; }
  }
  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function render(host, config) {
    const data = values(config);
    for(const [key,limit] of Object.entries(limits))data[key]=shorten(data[key],limit);
    host.replaceChildren();
    host.dataset.eduFit='';
    const sheet=node('div','school-sheet');
    const intro = node('section', 'school-intro');
    const heading = node('div', 'school-intro-copy');
    heading.append(node('h2', '', data.name || 'Naše škola'));
    if (data.motto) heading.append(node('p', 'school-motto', data.motto));
    intro.append(heading);
    const photo = webUrl(data.photo);
    if (photo) {
      const image = node('img', 'school-photo');
      image.src = photo;
      image.alt = data.name ? 'Fotografie školy ' + data.name : 'Fotografie školy';
      image.onerror = () => image.remove();
      intro.append(image);
    }
    sheet.append(intro);
    const grid = node('div', 'school-cards');
    function card(title, text, wide) {
      if (!text) return null;
      const section = node('section', 'school-card' + (title === 'Pro návštěvníky' ? ' school-card-visitors' : '') + (wide ? ' school-card-wide' : ''));
      section.append(node('h3', '', title), node('p', 'school-text', text));
      grid.append(section);
      return section;
    }
    card('O škole', data.description, true);
    if (data.address || data.phone || data.email) {
      const contact = node('section', 'school-card');
      contact.append(node('h3', '', 'Adresa a kontakt'));
      if(data.address) contact.append(node('p', 'school-text school-address', data.address));
      if(data.phone)contact.append(node('p','school-contact',data.phone));
      if(data.email)contact.append(node('p','school-contact',data.email));
      grid.append(contact);
    }
    if (data.director || data.officeHours || data.ico) {
      const details = node('section', 'school-card');
      details.append(node('h3', '', 'Vedení a provoz'));
      const facts = node('dl', 'school-facts');
      for(const [label,value] of [['Ředitel / ředitelka',data.director],['Úřední hodiny',data.officeHours],['IČO',data.ico]]) {
        if(!value) continue;
        const row=node('div','school-fact');
        row.append(node('dt','',label),node('dd','school-text',value));
        facts.append(row);
      }
      details.append(facts);grid.append(details);
    }
    card('Pro návštěvníky', data.additionalInfo, true);
    if (!grid.children.length && !data.name && !data.motto && !photo) {
      card('Informace o škole', 'Informace o škole budou brzy doplněny.', true);
    }
    sheet.append(grid);
    host.append(sheet);
  }
  function editor(host, getConfig, onChange) {
    host.replaceChildren();
    const grid = node('div', 'edu-admin__field-grid school-editor-grid');
    const controls = {};
    for (const [key, label, type] of fields) {
      const wrap = node('label', 'edu-admin__field' + (type === 'textarea' ? ' school-editor-wide' : ''), label);
      const input = node(type === 'textarea' ? 'textarea' : 'input');
      input.id = 'school-' + key;
      if (type === 'textarea') input.rows = 1;
      else input.type = type;
      if (type === 'url') input.placeholder = 'https://…';
      const counter=limits[key]?node('small','school-field-counter'):null;
      const updateCounter=()=>{if(counter)counter.textContent=input.value.length+' / '+limits[key]+' znaků; delší uložený text se ve výstupu zkrátí.'};
      if(limits[key])input.maxLength=limits[key];
      input.oninput = () => {
        updateCounter();
        const config = getConfig();
        if (!config.school || typeof config.school !== 'object') config.school = {};
        config.school[key] = input.value;
        onChange();
      };
      controls[key] = input;
      input.updateCounter=updateCounter;
      wrap.append(input);
      if(counter)wrap.append(counter);
      grid.append(wrap);
    }
    host.append(grid);
    return {refresh() {
      const data = values(getConfig());
      for (const [key, input] of Object.entries(controls)) {input.value = data[key];input.updateCounter();}
    }};
  }
  root.EduvizeSchool = Object.freeze({values, webUrl, render, editor, limits});
})(window);
