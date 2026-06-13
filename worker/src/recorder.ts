// This source is injected into every page/document during recording. It listens
// for user actions and reports high-level steps back to the worker through the
// exposed binding `__automator_record`.
//
// For each target element it produces an ORDERED LIST of candidate selectors
// (best/most-stable first). At playback the worker tries them in order until one
// resolves, which makes replay far more robust against dynamic DOM changes than
// a single brittle structural path.

export const RECORDER_SOURCE = `
(() => {
  if (window.__automatorInstalled) return;
  window.__automatorInstalled = true;

  const send = (action) => {
    try { window.__automator_record(JSON.stringify(action)); } catch (e) {}
  };

  const cssEscape = (s) =>
    (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/[^a-zA-Z0-9_-]/g, '\\\\$&');

  const q = (s) => JSON.stringify(String(s));

  // Heuristic: ids/classes that look auto-generated (long digit/hash runs) are
  // unstable, so we still record them but at lower priority.
  const looksDynamic = (v) => /[0-9]{4,}/.test(v) || /^[a-z]+-[0-9a-f]{6,}/i.test(v);

  function structuralPath(el) {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 6) {
      if (node.id && !looksDynamic(node.id)) {
        parts.unshift('#' + cssEscape(node.id));
        break;
      }
      let part = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (parent) {
        const sameTag = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
        if (sameTag.length > 1) {
          part += ':nth-of-type(' + (sameTag.indexOf(node) + 1) + ')';
        }
      }
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.join(' > ');
  }

  function candidatesFor(el) {
    const tag = el.tagName.toLowerCase();
    const stable = [];
    const weak = [];

    if (el.id) (looksDynamic(el.id) ? weak : stable).push('#' + cssEscape(el.id));

    for (const a of ['data-testid', 'data-test', 'data-cy', 'data-qa']) {
      const v = el.getAttribute(a);
      if (v) { stable.push('[' + a + '=' + q(v) + ']'); break; }
    }

    const name = el.getAttribute('name');
    if (name) stable.push(tag + '[name=' + q(name) + ']');

    const aria = el.getAttribute('aria-label');
    if (aria) stable.push('[aria-label=' + q(aria) + ']');

    const placeholder = el.getAttribute('placeholder');
    if (placeholder) stable.push('[placeholder=' + q(placeholder) + ']');

    const type = el.getAttribute('type');
    if (tag === 'input' && type && !['hidden'].includes(type)) {
      weak.push('input[type=' + q(type) + ']');
    }

    // Accessible-name / text based (great for buttons and links).
    const text = (el.innerText || el.textContent || '').trim().replace(/\\s+/g, ' ');
    if (text && text.length > 0 && text.length <= 50) {
      const role = tag === 'a' ? 'link' : tag === 'button' ? 'button' : null;
      if (role) stable.push('role=' + role + '[name=' + q(text) + ']');
      if (tag === 'button' || tag === 'a' || el.getAttribute('role') === 'button') {
        weak.push(tag + ' >> text=' + q(text));
      }
    }

    const title = el.getAttribute('title');
    if (title) weak.push('[title=' + q(title) + ']');

    weak.push(structuralPath(el));

    const all = stable.concat(weak).filter(Boolean);
    return Array.from(new Set(all)).slice(0, 8);
  }

  function labelFor(el) {
    const text = (
      el.getAttribute('aria-label') ||
      el.getAttribute('placeholder') ||
      el.innerText ||
      el.value ||
      el.getAttribute('name') ||
      el.getAttribute('title') ||
      ''
    ).trim().replace(/\\s+/g, ' ');
    return text.slice(0, 60) || el.tagName.toLowerCase();
  }

  function emit(type, el, extra) {
    const selectors = candidatesFor(el);
    if (!selectors.length) return;
    send(Object.assign({ type, selector: selectors[0], selectors, label: labelFor(el) }, extra || {}));
  }

  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const tag = t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'OPTION') return;
    const x = Math.round(e.clientX);
    const y = Math.round(e.clientY);
    // Prefer the nearest meaningful clickable ancestor for stable selectors.
    const clickable = t.closest('a, button, [role="button"], [onclick], summary, label, [tabindex]:not([tabindex="-1"])');
    if (clickable instanceof Element) {
      emit('click', clickable, { x, y });
    } else {
      // Click on a non-interactive area (e.g. clicking into empty space to
      // dismiss an autocomplete/overlay). A selector on a big generic element
      // would click its center, not where the user actually clicked, so we
      // replay these positionally using the recorded viewport coordinates.
      emit('click', t, { x, y, positional: true });
    }
  }, true);

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.tagName === 'SELECT') {
      emit('select', t, { value: t.value });
    } else if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') {
      const type = (t.getAttribute('type') || 'text').toLowerCase();
      if (type === 'checkbox' || type === 'radio') {
        emit('click', t);
      } else if (type !== 'password') {
        emit('fill', t, { value: t.value });
      } else {
        emit('fill', t, { value: '', secret: true });
      }
    }
  }, true);

  // Pressing Enter in a field often submits a form WITHOUT a preceding 'change'
  // event firing, so we capture the current value here as a fill (it collapses
  // with any change-based fill) and then record the Enter press so the submit
  // replays naturally instead of relying on a recorded navigation URL.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const t = e.target;
    if (!(t instanceof Element)) return;
    const tag = t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      const type = (t.getAttribute('type') || 'text').toLowerCase();
      if (type === 'password') {
        emit('fill', t, { value: '', secret: true });
      } else if (type !== 'checkbox' && type !== 'radio') {
        emit('fill', t, { value: t.value });
      }
      emit('press', t, { key: 'Enter' });
    }
  }, true);
})();
`;
