// ==UserScript==
// @name         ChatGPT Fuzzy Model Picker & Force Model v2.8 (cleaned)
// @namespace    http://tampermonkey.net/
// @version      0.9.5
// @description  Adds a side panel with model descriptions; original picker unchanged.
// @match        https://chatgpt.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
  'use strict';

  // ── 1. Model and Description Definitions ───────────────────────────────
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

  const DESCRIPTIONS = {
    'gpt-4o'      : 'Great for most tasks',
    'o3'          : 'Uses advanced reasoning',
    'o4-mini'     : 'Fastest at advanced reasoning',
    'o4-mini-high': 'Great at coding and visual reasoning',
    'gpt-4-5'     : 'Good for writing and exploring ideas',
    'gpt-4-1'     : 'Great for quick coding and analysis',
    'gpt-4-1-mini': 'Faster for everyday tasks',
  };

  // ── 2. State Initialization ────────────────────────────────────────────
  const DEFAULT_MODEL_ID = 'o4-mini-high';
  const storedModelId    = localStorage.getItem('tm-current-model');
  const urlModelId       = new URL(location.href).searchParams.get('model');

  let currentModel = MODELS.find(m => m.id === (urlModelId || storedModelId))
                   || MODELS.find(m => m.id === DEFAULT_MODEL_ID);

  let lastUrlModel = currentModel.id;
  let highlightedItem = null;

  function setCurrentModel(modelId) {
    const found = MODELS.find(m => m.id === modelId);
    if (!found || found.id === currentModel.id) return;
    currentModel = found;
    localStorage.setItem('tm-current-model', currentModel.id);
  }

  // ── 3. URL Sync Helpers ────────────────────────────────────────────────
  function updateUrlModel(modelId) {
    const url = new URL(location.href);
    if (url.searchParams.get('model') === modelId) return;
    url.searchParams.set('model', modelId);
    history.pushState({}, '', url);
    lastUrlModel = modelId;
  }

  function startUrlWatcher(interval = 1000) {
    setInterval(() => {
      const now = new URL(location.href).searchParams.get('model');
      if (now && now !== lastUrlModel) {
        lastUrlModel = now;
        setCurrentModel(now);
        refreshPickerHeader();
        refreshPickerClasses();
        refreshDetailClasses();
      }
    }, interval);
  }

  // ── 4. Force Model on Fetch ─────────────────────────────────────────────
  window.fetch = ((origFetch) => async (input, init = {}) => {
    const request = input instanceof Request ? input : new Request(input, init);
    if (request.url.includes('/backend-api/conversation')
        && request.method.toUpperCase() === 'POST') {
      try {
        const text   = await request.clone().text();
        const body   = JSON.parse(text);
        if (body.model && body.model !== currentModel.id) {
          body.model = currentModel.id;
          return origFetch(new Request(request, { body: JSON.stringify(body) }));
        }
      } catch {
        // parsing failed, continue with original request
      }
    }
    return origFetch(input, init);
  })(window.fetch);

  // ── 5. Analytics & Cookie Helpers ───────────────────────────────────────
  function sendAnalytics(from, to) {
    try {
      if (window.analytics?.track) {
        window.analytics.track('Model Switcher Model Changed', {
          from, to, origin: 'tampermonkey'
        });
      }
    } catch {
      // ignore analytics errors
    }
  }

  function setCookie(name, value, days = 365) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${value}; expires=${expires}; path=/; secure; sameSite=Lax`;
  }

  // ── 6. Inject Styles ────────────────────────────────────────────────────
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    /* current model highlight */
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
    /* detail panel text */
    .tm-detail-title { font-weight: 600; }
    .tm-detail-desc  { font-size: 12px; color: #aaa; }
  `;
  document.head.appendChild(styleEl);

  // ── 7. Build Picker UI ──────────────────────────────────────────────────
  const overlayEl = document.createElement('div');
  Object.assign(overlayEl.style, {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%,-50%)',
    background: '#343540',
    color: '#fff',
    padding: '16px',
    borderRadius: '8px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
    zIndex: 999999,
    width: '320px',
    display: 'none',
    fontFamily: 'sans-serif'
  });

  const headerEl = document.createElement('div');
  Object.assign(headerEl.style, {
    fontSize: '12px',
    color: '#aaa',
    marginBottom: '6px',
    textAlign: 'center'
  });
  overlayEl.appendChild(headerEl);

  const inputEl = document.createElement('input');
  Object.assign(inputEl.style, {
    width: '100%',
    padding: '8px',
    marginBottom: '8px',
    borderRadius: '4px',
    border: '1px solid #555',
    background: '#202123',
    color: '#fff',
    fontSize: '14px'
  });
  inputEl.placeholder = 'Type to filter…';
  overlayEl.appendChild(inputEl);

  const listEl = document.createElement('ul');
  Object.assign(listEl.style, {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    maxHeight: '200px',
    overflowY: 'auto',
    position: 'relative'
  });
  overlayEl.appendChild(listEl);

  MODELS.forEach(model => {
    const item = document.createElement('li');
    item.dataset.id = model.id;
    item.textContent = model.label;
    item.tabIndex = 0;
    Object.assign(item.style, {
      padding: '6px 8px',
      cursor: 'pointer',
      borderRadius: '4px',
      position: 'relative'
    });
    item.classList.toggle('current', model.id === currentModel.id);
    item.addEventListener('click', () => selectModel(model.id));
    item.addEventListener('mouseenter', () => highlightItem(item));
    listEl.appendChild(item);
  });

  document.body.appendChild(overlayEl);

  // ── 8. Build Detail Panel ───────────────────────────────────────────────
  const detailPanelEl = document.createElement('div');
  Object.assign(detailPanelEl.style, {
    position: 'fixed',
    top: '50%',
    left: 'calc(50% + 360px)',
    transform: 'translate(-50%,-50%)',
    background: '#2a2b2e',
    color: '#fff',
    padding: '16px',
    borderRadius: '8px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
    zIndex: 999999,
    width: '300px',
    display: 'none',
    fontFamily: 'sans-serif'
  });

  const detailListEl = document.createElement('ul');
  Object.assign(detailListEl.style, {
    listStyle: 'none',
    padding: 0,
    margin: 0
  });

  MODELS.forEach(model => {
    const detailItem = document.createElement('li');
    detailItem.dataset.id = model.id;
    Object.assign(detailItem.style, {
      padding: '6px 8px',
      borderRadius: '4px',
      position: 'relative'
    });
    detailItem.innerHTML = `
      <div class="tm-detail-title">${model.label}</div>
      <div class="tm-detail-desc">${DESCRIPTIONS[model.id] || ''}</div>
    `;
    detailListEl.appendChild(detailItem);
  });

  detailPanelEl.appendChild(detailListEl);
  document.body.appendChild(detailPanelEl);

  // ── 9. Picker Logic ─────────────────────────────────────────────────────
  let clickListenerActive = false;
  let inputListenerActive = false;

  function refreshPickerHeader() {
    headerEl.textContent = `Currently selected: ${currentModel.label}`;
  }

  function refreshPickerClasses() {
    listEl.childNodes.forEach(li => {
      li.classList.toggle('current', li.dataset.id === currentModel.id);
    });
  }

  function refreshDetailClasses() {
    detailListEl.childNodes.forEach(li => {
      const isCurrent = li.dataset.id === currentModel.id
                      || li.dataset.id === highlightedItem?.dataset?.id;
      li.classList.toggle('current', isCurrent);
    });
  }

  function fuzzyMatch(pattern, text) {
    let i = 0, j = 0;
    pattern = pattern.toLowerCase();
    text    = text.toLowerCase();
    while (i < pattern.length && j < text.length) {
      if (pattern[i] === text[j]) i++;
      j++;
    }
    return i === pattern.length;
  }

  function filterList() {
    const query = inputEl.value.trim().toLowerCase();
    let firstVisible = null;

    listEl.childNodes.forEach(li => {
      const matches = !query || fuzzyMatch(query, li.textContent);
      li.style.display = matches ? '' : 'none';
      li.style.background = '';
      if (matches && firstVisible === null) {
        firstVisible = li;
      }
    });

    if (firstVisible) {
      highlightItem(firstVisible);
    }
  }

  function highlightItem(item) {
    if (highlightedItem) {
      highlightedItem.style.background = '';
    }
    highlightedItem = item;
    item.style.background = '#555';
    refreshDetailClasses();
  }

  function openPicker() {
    overlayEl.style.display      = 'block';
    detailPanelEl.style.display  = 'block';
    inputEl.value                = '';
    refreshPickerHeader();
    refreshPickerClasses();
    refreshDetailClasses();
    filterList();
    inputEl.focus();

    if (!clickListenerActive) {
      document.addEventListener('click', handleOutsideClick);
      clickListenerActive = true;
    }

    if (!inputListenerActive) {
      inputEl.addEventListener('input', filterList);
      inputListenerActive = true;
    }

    inputEl.addEventListener('keydown', handleKeydown);
  }

  function closePicker() {
    overlayEl.style.display     = 'none';
    detailPanelEl.style.display = 'none';

    if (highlightedItem) {
      highlightedItem.style.background = '';
    }
    highlightedItem = null;

    if (clickListenerActive) {
      document.removeEventListener('click', handleOutsideClick);
      clickListenerActive = false;
    }

    if (inputListenerActive) {
      inputEl.removeEventListener('input', filterList);
      inputListenerActive = false;
    }

    inputEl.removeEventListener('keydown', handleKeydown);
  }

  function handleOutsideClick(event) {
    if (!overlayEl.contains(event.target)
        && !detailPanelEl.contains(event.target)) {
      closePicker();
    }
  }

  function selectModel(modelId) {
    const previousId = currentModel.id;
    setCurrentModel(modelId);
    updateUrlModel(currentModel.id);
    refreshPickerHeader();
    refreshPickerClasses();
    refreshDetailClasses();
    setCookie('oai-last-model', currentModel.id);
    sendAnalytics(previousId, currentModel.id);
    closePicker();
  }

  function handleKeydown(event) {
    const visibleItems = Array.from(listEl.childNodes)
      .filter(li => li.style.display !== 'none');
    if (visibleItems.length === 0) return;

    let index = visibleItems.indexOf(highlightedItem);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      index = (index + 1) % visibleItems.length;
      highlightItem(visibleItems[index]);
      visibleItems[index].scrollIntoView({ block: 'nearest' });

    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      index = (index - 1 + visibleItems.length) % visibleItems.length;
      highlightItem(visibleItems[index]);
      visibleItems[index].scrollIntoView({ block: 'nearest' });

    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (highlightedItem) {
        selectModel(highlightedItem.dataset.id);
      }
    }
  }

  // ── 10. Initialize ─────────────────────────────────────────────────────
  startUrlWatcher();
  refreshPickerHeader();

  window.addEventListener('keydown', event => {
    if (event.metaKey && event.shiftKey && event.key === '1') {
      event.preventDefault();
      if (overlayEl.style.display === 'none') {
        openPicker();
      } else {
        closePicker();
      }
    }
  });

})();
