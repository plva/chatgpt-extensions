// ==UserScript==
// @name         ChatGPT Fuzzy Model Picker & Force Model v2
// @namespace    http://tampermonkey.net/
// @version      0.6
// @description  Cmd+Shift+1 → dark overlay fuzzy-search model picker. Forces outgoing requests to selected model. Debounced & event-scoped for minimal overhead.
// @match        https://chatgpt.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
  'use strict';

  function main() {
    // ─── 1. Up-to-date model list ──────────────────────────────────────────────
    const MODELS = [
      { id:'gpt-4-1-mini',     label:'GPT-4.1 Mini',        testid:'model-switcher-gpt-4-1-mini'  },
      { id:'o4-mini-high',     label:'o4-mini-high',        testid:'model-switcher-o4-mini-high'  },
      { id:'o3',               label:'o3',                  testid:'model-switcher-o3'            },
      { id:'gpt-4o',           label:'GPT-4o',              testid:'model-switcher-gpt-4o'        },
      { id:'gpt-4o-mini',      label:'GPT-4o Mini',         testid:'model-switcher-gpt-4o-mini'   },
      { id:'o4-mini',          label:'o4-mini',             testid:'model-switcher-o4-mini'       },
      { id:'gpt-4-5',          label:'GPT-4.5',             testid:'model-switcher-gpt-4-5'       },
      { id:'gpt-4-1',          label:'GPT-4.1',             testid:'model-switcher-gpt-4-1'       },
    ];
    let current = MODELS.find(m => m.id === 'o4-mini-high');

    // ─── 2. Patch fetch → force model ─────────────────────────────────────────
    const _fetch = window.fetch;
    window.fetch = (url, init = {}) => {
      if (typeof url === 'string'
        && url.includes('/backend-api/conversation')
        && init.method === 'POST'
        && init.body
      ) {
        try {
          const p = JSON.parse(init.body);
          if (p.model && p.model !== current.id) {
            p.model = current.id;
            init.body = JSON.stringify(p);
          }
        } catch {}
      }
      return _fetch(url, init);
    };

    // ─── 3. UI overlay creation ─────────────────────────────────────────────────
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position:'fixed', top:'50%', left:'50%',
      transform:'translate(-50%,-50%)',
      background:'#343540', color:'#fff',
      padding:'16px', borderRadius:'8px',
      boxShadow:'0 10px 30px rgba(0,0,0,0.5)',
      zIndex:999999, width:'320px',
      display:'none', fontFamily:'sans-serif'
    });
    const inp = document.createElement('input');
    Object.assign(inp.style, {
      width:'100%', padding:'8px', marginBottom:'8px',
      borderRadius:'4px', border:'1px solid #555',
      background:'#202123', color:'#fff',
      fontSize:'14px'
    });
    inp.placeholder = 'Type to filter…';
    const list = document.createElement('ul');
    Object.assign(list.style, {
      listStyle:'none', padding:0, margin:0,
      maxHeight:'200px', overflowY:'auto'
    });
    // populate
    MODELS.forEach(m => {
      const li = document.createElement('li');
      li.tabIndex = 0; li.dataset.id = m.id; li.textContent = m.label;
      Object.assign(li.style, {
        padding:'6px 8px', cursor:'pointer', borderRadius:'4px'
      });
      li.addEventListener('click', () => selectModel(m.id));
      li.addEventListener('mouseenter', () => highlight(li));
      list.appendChild(li);
    });
    overlay.append(inp, list);
    document.body.appendChild(overlay);

    // ─── 4. Fuzzy & UI logic ───────────────────────────────────────────────────
    let highlighted = null, filterDebounce = 0;

    function openPicker() {
      overlay.style.display = 'block';
      inp.value = '';
      filter();
      inp.focus();
      document.addEventListener('click', outsideClick);
      inp.addEventListener('keydown', onKeydown);
    }
    function closePicker() {
      overlay.style.display = 'none';
      if (highlighted) highlighted.style.background = '';
      highlighted = null;
      document.removeEventListener('click', outsideClick);
      inp.removeEventListener('keydown', onKeydown);
    }
    function outsideClick(e) {
      if (!overlay.contains(e.target)) closePicker();
    }
    function filter() {
      const q = inp.value.toLowerCase();
      const visible = [];
      list.childNodes.forEach(li => {
        const ok = !q || fuzzy(q, li.textContent);
        li.style.display = ok ? '' : 'none';
        if (ok) visible.push(li);
        li.style.background = '';
      });
      if (visible.length) highlight(visible[0]);
    }
    function fuzzy(p, s) {
      let i = 0, j = 0;
      p = p.toLowerCase(); s = s.toLowerCase();
      while (i < p.length && j < s.length) {
        if (p[i] === s[j]) i++;
        j++;
      }
      return i === p.length;
    }
    function highlight(li) {
      if (highlighted) highlighted.style.background = '';
      highlighted = li; li.style.background = '#555';
    }
    function selectModel(id) {
      const m = MODELS.find(x => x.id === id);
      if (!m) return;
      current = m;
      closePicker();
      reflect();
    }
    function onKeydown(e) {
      const items = Array.from(list.childNodes).filter(li => li.style.display !== 'none');
      let idx = items.indexOf(highlighted);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        idx = (idx + 1) % items.length;
        highlight(items[idx]);
        items[idx].scrollIntoView({block:'nearest'});
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        idx = (idx - 1 + items.length) % items.length;
        highlight(items[idx]);
        items[idx].scrollIntoView({block:'nearest'});
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectModel(highlighted.dataset.id);
      } else {
        clearTimeout(filterDebounce);
        filterDebounce = setTimeout(filter, 100);
      }
    }

    // ─── 5. Reflect selection in ChatGPT’s own UI ─────────────────────────────
    function reflect() {
      const btn = document.querySelector('button[aria-haspopup="menu"]');
      if (!btn) return;
      btn.dispatchEvent(new MouseEvent('mouseover', {bubbles:true}));
      setTimeout(() => {
        btn.dispatchEvent(new MouseEvent('click', {bubbles:true}));
        setTimeout(() => {
          const opt = document.querySelector(`[data-testid="model-switcher-${current.id}"]`);
          if (opt) {
            opt.dispatchEvent(new MouseEvent('mouseover', {bubbles:true}));
            opt.dispatchEvent(new MouseEvent('click', {bubbles:true}));
          }
        }, 300);
      }, 150);
    }

    // ─── 6. Toggle on ⌘+⇧+1 ────────────────────────────────────────────────────
    window.addEventListener('keydown', e => {
      if (e.metaKey && e.shiftKey && e.key === '1') {
        e.preventDefault();
        overlay.style.display === 'none' ? openPicker() : closePicker();
      }
    });
  }

  // Run once
  main();

})();
