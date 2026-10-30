/* School information is stored in the existing kiosk configuration. */
(function (root) {
  'use strict';
  const fields = [
    ['name', 'Název školy', 'textarea'],
    ['motto', 'Motto nebo krátké představení', 'textarea'],
    ['description', 'O škole', 'textarea'],
    ['address', 'Adresa', 'textarea'],
    ['phone', 'Telefon', 'tel'],
    ['email', 'E-mail', 'email'],
    ['website', 'Web školy', 'url'],
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
  function render(host, config, openWebsite) {
    const data = values(config);
    host.replaceChildren();
    const intro = node('section', 'school-intro');
    const heading = node('div', 'school-intro-copy');
    heading.append(node('p', 'school-eyebrow', 'Vítejte u nás'), node('h2', '', data.name || 'Naše škola'));
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
    host.append(intro);
    const grid = node('div', 'school-cards');
    function card(title, text, wide) {
      if (!text) return null;
      const section = node('section', 'school-card' + (wide ? ' school-card-wide' : ''));
      section.append(node('h3', '', title), node('p', 'school-text', text));
      grid.append(section);
      return section;
    }
    card('O škole', data.description, true);
    card('Kde nás najdete', data.address);
    if (data.phone || data.email || data.website) {
      const contact = node('section', 'school-card');
      contact.append(node('h3', '', 'Kontakt'));
      function link(label, href, action) {
        const p = node('p', 'school-contact');
        if (href) {
          const a = node('a', '', label);
          a.href = href;
          if (action) a.onclick = event => { event.preventDefault(); action(href); };
          p.append(a);
        } else p.textContent = label;
        contact.append(p);
      }
      if (data.phone) link(data.phone, /^[+\d\s()./-]+$/.test(data.phone) ? 'tel:' + data.phone.replace(/[^+\d]/g, '') : null);
      if (data.email) link(data.email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) ? 'mailto:' + data.email : null);
      if (data.website) link(data.website, webUrl(data.website), openWebsite);
      grid.append(contact);
    }
    card('Vedení školy', data.director);
    card('Úřední hodiny', data.officeHours);
    card('IČO', data.ico);
    card('Pro návštěvníky', data.additionalInfo, true);
    if (!grid.children.length && !data.name && !data.motto && !photo) {
      card('Informace o škole', 'Informace o škole budou brzy doplněny.', true);
    }
    host.append(grid);
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
      input.oninput = () => {
        const config = getConfig();
        if (!config.school || typeof config.school !== 'object') config.school = {};
        config.school[key] = input.value;
        onChange();
      };
      controls[key] = input;
      wrap.append(input);
      grid.append(wrap);
    }
    host.append(grid);
    return {refresh() {
      const data = values(getConfig());
      for (const [key, input] of Object.entries(controls)) input.value = data[key];
    }};
  }
  root.EduvizeSchool = Object.freeze({values, webUrl, render, editor});
})(window);
