// ==UserScript==
// @name         ChatGPT Fuzzy Model Picker & Force Model v2.6
// @namespace    http://tampermonkey.net/
// @version      0.9.3
// @description  ⌘+⇧+1 opens a fuzzy-search model picker; forces all chat fetches to use the selected model; highlights current model and always shows first fuzzy-match (whitespace-safe filtering).
// @match        https://chatgpt.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  /* ── 1. Model definitions ─────────────────────────────────────────────── */
  const MODELS = [
    { id: 'gpt-4-1-mini', label: 'GPT-4.1 Mini' },
    { id: 'o4-mini-high', label: 'o4-mini-high' },
    { id: 'o3',           label: 'o3' },
    { id: 'gpt-4o',       label: 'GPT-4o' },
    { id: 'gpt-4o-mini',  label: 'GPT-4o Mini' },
    { id: 'o4-mini',      label: 'o4-mini' },
    { id: 'gpt-4-5',      label: 'GPT-4.5' },
    { id: 'gpt-4-1',      label: 'GPT-4.1' },
  ];

  /* ── 2. State ─────────────────────────────────────────────────────────── */
  const DEFAULT_ID   = 'o4-mini-high';
  const storedId     = localStorage.getItem('tm-current-model');
  const urlId        = new URL(location.href).searchParams.get('model');
  let   current      = MODELS.find(m => m.id === (urlId || storedId)) ??
                       MODELS.find(m => m.id === DEFAULT_ID);
  let   lastUrlModel = current.id;

  function setCurrent(id) {
    const hit = MODELS.find(m => m.id === id);
    if (!hit || hit.id === current.id) return;
    current = hit;
    localStorage.setItem('tm-current-model', current.id);
  }

  /* ── 3. URL helpers ───────────────────────────────────────────────────── */
  function updateUrlModel(id) {
    const u = new URL(location.href);
    if (u.searchParams.get('model') === id) return;
    u.searchParams.set('model', id);
    history.pushState({}, '', u);
    lastUrlModel = id;
  }

  function startUrlWatcher(interval = 1000) {
    setInterval(() => {
      const now = new URL(location.href).searchParams.get('model');
      if (now && now !== lastUrlModel) {
        lastUrlModel = now;
        setCurrent(now);
        updateHeader();
        updateCurrentClasses();
      }
    }, interval);
  }

  /* ── 4. Patch fetch ───────────────────────────────────────────────────── */
  window.fetch = ((orig) => async (input, init = {}) => {
    const req = input instanceof Request ? input : new Request(input, init);
    if (req.url.includes('/backend-api/conversation') && req.method.toUpperCase() === 'POST') {
      try {
        const raw  = await req.clone().text();
        const body = JSON.parse(raw);
        if (body.model && body.model !== current.id) {
          body.model = current.id;
          return orig(new Request(req, { body: JSON.stringify(body) }));
        }
      } catch { /* fall through */ }
    }
    return orig(input, init);
  })(window.fetch);

  /* ── 5. Inject styles for “current” marker ─────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
    li.current {
      background-color: rgba(74,144,230,0.2) !important;
    }
    li.current::after {
      content: "✔";
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 13px;
      color: #4ea1f3;
    }
  `;
  document.head.appendChild(style);

  /* ── 6. Build picker UI ───────────────────────────────────────────────── */
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed', top: '50%', left: '50%',
    transform: 'translate(-50%,-50%)',
    background: '#343540', color: '#fff',
    padding: '16px', borderRadius: '8px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
    zIndex: 999999, width: '320px',
    display: 'none', fontFamily: 'sans-serif'
  });

  /* Header note – current model */
  const header = document.createElement('div');
  Object.assign(header.style, {
    fontSize: '12px', color: '#aaa', marginBottom: '6px', textAlign: 'center'
  });
  overlay.appendChild(header);

  /* Search box */
  const inp = document.createElement('input');
  Object.assign(inp.style, {
    width: '100%', padding: '8px', marginBottom: '8px',
    borderRadius: '4px', border: '1px solid #555',
    background: '#202123', color: '#fff', fontSize: '14px'
  });
  inp.placeholder = 'Type to filter…';
  overlay.appendChild(inp);

  /* List */
  const list = document.createElement('ul');
  Object.assign(list.style, {
    listStyle: 'none', padding: 0, margin: 0,
    maxHeight: '200px', overflowY: 'auto', position: 'relative'
  });
  overlay.appendChild(list);

  MODELS.forEach(m => {
    const li = document.createElement('li');
    li.dataset.id = m.id;
    li.textContent = m.label;
    li.tabIndex = 0;
    Object.assign(li.style, {
      padding: '6px 8px', cursor: 'pointer', borderRadius: '4px', position: 'relative'
    });
    li.classList.toggle('current', m.id === current.id);
    li.addEventListener('click', () => selectModel(m.id));
    li.addEventListener('mouseenter', () => highlight(li));
    list.appendChild(li);
  });

  document.body.appendChild(overlay);

  /* ── 7. Picker logic ──────────────────────────────────────────────────── */
  let highlighted       = null;
  let clickListenerLive = false;
  let inputListenerLive = false;

  function updateHeader() {
    header.textContent = `Currently selected: ${current.label}`;
  }

  function updateCurrentClasses() {
    list.childNodes.forEach(li => {
      li.classList.toggle('current', li.dataset.id === current.id);
    });
  }

  function fuzzy(needle, hay) {
    let i = 0, j = 0;
    needle = needle.toLowerCase();
    hay    = hay.toLowerCase();
    while (i < needle.length && j < hay.length) {
      if (needle[i] === hay[j]) i++;
      j++;
    }
    return i === needle.length;
  }

  function filterList() {
    const q = inp.value.trim().toLowerCase();        // <-- trim fixes whitespace bug
    let firstVisible = null;

    list.childNodes.forEach(li => {
      const ok = !q || fuzzy(q, li.textContent);
      li.style.display    = ok ? '' : 'none';
      li.style.background = '';
      if (ok && !firstVisible) firstVisible = li;
    });

    if (firstVisible) highlight(firstVisible);
  }

  function highlight(li) {
    if (highlighted) highlighted.style.background = '';
    highlighted = li;
    if (li) li.style.background = '#555';
  }

  function openPicker() {
    overlay.style.display = 'block';
    inp.value = '';
    updateHeader();
    updateCurrentClasses();
    filterList();
    inp.focus();

    if (!clickListenerLive) {
      document.addEventListener('click', outsideClick);
      clickListenerLive = true;
    }
    if (!inputListenerLive) {
      inp.addEventListener('input', filterList);   // real-time update
      inputListenerLive = true;
    }
    inp.addEventListener('keydown', onKeydown);
  }

  function closePicker() {
    overlay.style.display = 'none';
    if (highlighted) highlighted.style.background = '';
    highlighted = null;

    if (clickListenerLive) {
      document.removeEventListener('click', outsideClick);
      clickListenerLive = false;
    }
    if (inputListenerLive) {
      inp.removeEventListener('input', filterList);
      inputListenerLive = false;
    }
    inp.removeEventListener('keydown', onKeydown);
  }

  function outsideClick(e) {
    if (!overlay.contains(e.target)) closePicker();
  }

  function selectModel(id) {
    setCurrent(id);
    updateUrlModel(current.id);
    updateHeader();
    updateCurrentClasses();
    closePicker();
  }

  function onKeydown(e) {
    const items = Array.from(list.childNodes)
                       .filter(li => li.style.display !== 'none');
    if (!items.length) return;

    let idx = items.indexOf(highlighted);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      idx = (idx + 1) % items.length;
      highlight(items[idx]);
      items[idx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      idx = (idx - 1 + items.length) % items.length;
      highlight(items[idx]);
      items[idx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlighted) selectModel(highlighted.dataset.id);
    }
    /* no default “else” debounce needed – real-time ‘input’ handles filtering */
  }

  /* ── 8. Kick things off ──────────────────────────────────────────────── */
  startUrlWatcher();
  updateHeader();

  /* Toggle picker on ⌘+⇧+1 */
  window.addEventListener('keydown', e => {
    if (e.metaKey && e.shiftKey && e.key === '1') {
      e.preventDefault();
      overlay.style.display === 'none' ? openPicker() : closePicker();
    }
  });
})();
