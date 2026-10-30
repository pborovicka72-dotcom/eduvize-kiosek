(function () {
  function fit(field) {
    field.rows = 1;
    field.style.setProperty('height', '0px', 'important');
    field.style.setProperty('height', Math.max(44, field.scrollHeight + 2) + 'px', 'important');
  }
  const fields = () => document.querySelectorAll('textarea:not([readonly])');
  const refresh = () => fields().forEach(fit);
  document.addEventListener('input', event => {
    if (event.target.tagName === 'TEXTAREA') fit(event.target);
  });
  // Resetting the form or restoring saved values changes the value property.
  document.addEventListener('click', () => requestAnimationFrame(refresh));
  const observer = new ResizeObserver(refresh);
  fields().forEach(field => observer.observe(field.parentElement));
  window.addEventListener('resize', refresh);
  document.fonts?.ready.then(refresh);
  refresh();
})();
