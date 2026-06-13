// This source is injected into every page/document during recording. It listens
// for user actions and reports high-level steps back to the worker through the
// exposed binding `__automator_record`. Selectors are built to be reasonably
// robust (prefer id / name / data-testid, then a structural path).

export const RECORDER_SOURCE = `
(() => {
  if (window.__automatorInstalled) return;
  window.__automatorInstalled = true;

  const send = (action) => {
    try { window.__automator_record(JSON.stringify(action)); } catch (e) {}
  };

  const cssEscape = (s) =>
    (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/[^a-zA-Z0-9_-]/g, '\\\\$&');

  function selectorFor(el) {
    if (!(el instanceof Element)) return null;
    if (el.id) return '#' + cssEscape(el.id);
    const testid = el.getAttribute('data-testid') || el.getAttribute('data-test') || el.getAttribute('data-cy');
    if (testid) return el.tagName.toLowerCase() + '[data-testid="' + testid + '"]';
    const name = el.getAttribute('name');
    if (name) return el.tagName.toLowerCase() + '[name="' + cssEscape(name) + '"]';

    // Structural path fallback.
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 6) {
      let part = node.tagName.toLowerCase();
      if (node.id) { parts.unshift('#' + cssEscape(node.id)); break; }
      const parent = node.parentElement;
      if (parent) {
        const sameTag = Array.from(parent.children).filter(c => c.tagName === node.tagName);
        if (sameTag.length > 1) {
          part += ':nth-of-type(' + (sameTag.indexOf(node) + 1) + ')';
        }
      }
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.join(' > ');
  }

  function labelFor(el) {
    const text = (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.name || '').trim();
    return (text.slice(0, 60)) || el.tagName.toLowerCase();
  }

  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const tag = t.tagName;
    // Field focus clicks are represented by the fill/select step instead.
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'OPTION') return;
    const sel = selectorFor(t);
    if (sel) send({ type: 'click', selector: sel, label: labelFor(t) });
  }, true);

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const sel = selectorFor(t);
    if (!sel) return;
    if (t.tagName === 'SELECT') {
      send({ type: 'select', selector: sel, value: t.value, label: labelFor(t) });
    } else if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') {
      const type = (t.getAttribute('type') || 'text').toLowerCase();
      if (type === 'checkbox' || type === 'radio') {
        send({ type: 'click', selector: sel, label: labelFor(t) });
      } else if (type !== 'password') {
        send({ type: 'fill', selector: sel, value: t.value, label: labelFor(t) });
      } else {
        // Capture that a password field is used, but never the value.
        send({ type: 'fill', selector: sel, value: '', label: labelFor(t), secret: true });
      }
    }
  }, true);
})();
`;
