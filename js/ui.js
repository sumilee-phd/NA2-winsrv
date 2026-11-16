/* 공통 화면 부품: DOM 도우미, 직접 그린 단순 아이콘, 오른쪽 단추 메뉴, 대화상자, 메시지 상자, IP 주소 네 칸 입력, 숫자 상자, 탭, 트리, 목록.
 * 가독성 우선: 모든 크기는 em 단위이며 작업 영역의 글자 크기(--fs)를 따라 커진다.
 */
(function (G) {
  'use strict';
  const WS = G.WS = G.WS || {};
  const OUT_TIP = '이 연습에서 다루지 않는 기능입니다.';

  function h(tag, props, ...kids) {
    const svg = tag === 'svg' || tag === 'path' || tag === 'rect' || tag === 'circle' || tag === 'line';
    const el = svg ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
    if (props) for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.setAttribute('class', v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (!svg && k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
    }
    return el;
  }

  /* ---------------------------------------------------------- 아이콘(직접 그린 단순 도형, 32×32)
   * 색은 Windows 관리 도구의 느낌(노랑 폴더, 흰 문서, 파랑 네트워크, 금색 자물쇠, 회색 서버)에 맞췄고 모양은 새로 그렸다. */
  const ICONS = {
    net: `<rect x="3" y="4" width="13" height="10" rx="1" fill="#DCEBFA" stroke="#1F5FA8" stroke-width="2"/><rect x="16" y="17" width="13" height="10" rx="1" fill="#DCEBFA" stroke="#1F5FA8" stroke-width="2"/><path d="M9.5 14v5.5H16" fill="none" stroke="#1F5FA8" stroke-width="2"/><path d="M6 17h7" stroke="#5A5A5A" stroke-width="2"/>`,
    sec: `<path d="M11 14v-4a5 5 0 0 1 10 0v4" fill="none" stroke="#6B6B6B" stroke-width="2.6"/><rect x="6.5" y="13.5" width="19" height="15" rx="2" fill="#F2C744" stroke="#A67C00" stroke-width="2"/><circle cx="16" cy="20" r="2.3" fill="#5A4300"/><path d="M16 21v3.5" stroke="#5A4300" stroke-width="2"/>`,
    dhcp: `<rect x="3" y="3.5" width="11" height="8" rx="1" fill="#FFFFFF" stroke="#1F5FA8" stroke-width="2"/><rect x="18" y="12" width="11" height="8" rx="1" fill="#DCEBFA" stroke="#1F5FA8" stroke-width="2"/><rect x="3" y="20.5" width="11" height="8" rx="1" fill="#FFFFFF" stroke="#1F5FA8" stroke-width="2"/><path d="M14 7.5h2.5v17H14M16.5 16H18" fill="none" stroke="#2F7D32" stroke-width="2.2"/>`,
    dns: `<circle cx="16" cy="16" r="11.5" fill="#DCEBFA" stroke="#1F5FA8" stroke-width="2"/><path d="M4.5 16h23M16 4.5c-4.5 4-4.5 19 0 23M16 4.5c4.5 4 4.5 19 0 23M6.5 9.5h19M6.5 22.5h19" fill="none" stroke="#1F5FA8" stroke-width="1.6"/>`,
    folder: `<path d="M2.5 8.5h10.5l2.5 3h14v15.5h-27z" fill="#F4CF67" stroke="#B88A1E" stroke-width="1.8"/><path d="M2.5 13.5h27" stroke="#B88A1E" stroke-width="1.2"/>`,
    doc: `<path d="M8 3.5h11l5.5 5.5v19.5H8z" fill="#FFFFFF" stroke="#6B6B6B" stroke-width="1.8"/><path d="M19 3.5v5.5h5.5" fill="none" stroke="#6B6B6B" stroke-width="1.6"/><path d="M11.5 14h9M11.5 18.5h9M11.5 23h6" stroke="#1F5FA8" stroke-width="1.8"/>`,
    server: `<rect x="7" y="3.5" width="18" height="25" rx="1.5" fill="#E6E6E6" stroke="#5A5A5A" stroke-width="2"/><path d="M10.5 9.5h11M10.5 14h11" stroke="#5A5A5A" stroke-width="2"/><circle cx="16" cy="22" r="2" fill="#2F9E44"/>`,
  };
  function icon(name, cls) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 32 32');
    s.setAttribute('class', 'ico' + (cls ? ' ' + cls : ''));
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICONS[name] || ICONS.doc;
    return s;
  }

  /* ---------------------------------------------------------- 오른쪽 단추 메뉴 */
  let openMenu = null;
  function closeMenu() { if (openMenu) { openMenu.remove(); openMenu = null; } document.removeEventListener('mousedown', outside, true); }
  function outside(e) { if (openMenu && !openMenu.contains(e.target)) closeMenu(); }
  /* at: {x,y} 또는 기준 요소. items: {label, onClick, disabled, out, tip, sep, bold} */
  function menu(at, items) {
    closeMenu();
    const el = h('div', { class: 'menu', role: 'menu' });
    let first = null;
    for (const it of items) {
      if (!it) continue;
      if (it.sep) { el.appendChild(h('div', { class: 'msep', role: 'separator' })); continue; }
      const dis = it.out || (typeof it.disabled === 'function' ? it.disabled() : it.disabled);
      const b = h('button', { type: 'button', class: 'mi' + (it.bold ? ' bold' : '') + (it.out ? ' out' : ''), role: 'menuitem', disabled: !!dis,
        title: it.out ? OUT_TIP : (it.tip || '') }, h('span', { class: 'ml' }, it.label), it.out ? h('span', { class: 'mtag' }, '연습 범위 밖') : null);
      if (!dis) {
        b.addEventListener('click', e => { e.stopPropagation(); closeMenu(); if (it.onClick) it.onClick(); });
        if (!first) first = b;
      }
      el.appendChild(b);
    }
    el.addEventListener('keydown', e => {
      const bs = [...el.querySelectorAll('.mi:not([disabled])')];
      const i = bs.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); (bs[i + 1] || bs[0]).focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); (bs[i - 1] || bs[bs.length - 1]).focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); closeMenu(); }
    });
    document.body.appendChild(el);
    let x, y;
    if (at && at.getBoundingClientRect) { const r = at.getBoundingClientRect(); x = r.left; y = r.bottom + 2; }
    else { x = at.x; y = at.y; }
    const mw = el.offsetWidth, mh = el.offsetHeight;
    if (x + mw > innerWidth - 6) x = Math.max(6, innerWidth - mw - 6);
    if (y + mh > innerHeight - 6) y = Math.max(6, innerHeight - mh - 6);
    el.style.left = x + 'px'; el.style.top = y + 'px';
    openMenu = el;
    setTimeout(() => document.addEventListener('mousedown', outside, true), 0);
    if (first) first.focus({ preventScroll: true });
    return el;
  }

  /* ---------------------------------------------------------- 대화상자 */
  const stack = [];
  function topDialog() { return stack[stack.length - 1] || null; }
  function dialog(o) {
    const back = h('div', { class: 'modal-back' });
    const titleId = 'dt' + Math.random().toString(36).slice(2, 8);
    const closeBtn = h('button', { type: 'button', class: 'dlg-x', title: '닫기', 'aria-label': '닫기', onclick: () => cancel() }, '✕');
    const title = h('div', { class: 'dlg-title' }, h('span', { id: titleId }, o.title), closeBtn);
    const bodyEl = h('div', { class: 'dlg-body' });
    const foot = h('div', { class: 'dlg-foot' });
    const el = h('div', { class: 'dlg' + (o.cls ? ' ' + o.cls : ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId,
      style: { width: o.width ? o.width + 'em' : 'auto' } }, title, bodyEl, foot);
    const api = { el, body: bodyEl, foot, close, cancel, buttons: {}, setButtons };
    function setButtons(list) {
      foot.innerHTML = '';
      api.buttons = {};
      const left = h('div', { class: 'left' });
      foot.appendChild(left);
      for (const bt of list) {
        const b = h('button', { type: 'button', class: 'db' + (bt.primary ? ' primary' : ''), disabled: !!bt.disabled, title: bt.out ? OUT_TIP : (bt.tip || '') }, bt.label);
        b.addEventListener('click', () => {
          if (bt.cancel) return cancel();
          const r = bt.onClick ? bt.onClick(api) : undefined;
          if (r !== false && !bt.keep) close(bt.label);
        });
        (bt.left ? left : foot).appendChild(b);
        api.buttons[bt.label] = b;
        b._def = bt;
      }
    }
    if (typeof o.body === 'function') bodyEl.appendChild(o.body(api)); else if (o.body) bodyEl.appendChild(o.body);
    setButtons(o.buttons || [{ label: '확인', primary: true }, { label: '취소', cancel: true }]);
    document.body.appendChild(back);
    document.body.appendChild(el);
    const place = () => {
      el.style.left = Math.max(8, (innerWidth - el.offsetWidth) / 2 + (stack.length - 1) * 18) + 'px';
      el.style.top = Math.max(8, (innerHeight - el.offsetHeight) / 2.6 + (stack.length - 1) * 18) + 'px';
    };
    title.addEventListener('mousedown', e => {
      if (e.target.closest('button')) return;
      e.preventDefault();
      const sx = e.clientX - el.offsetLeft, sy = e.clientY - el.offsetTop;
      const mv = ev => { el.style.left = Math.min(innerWidth - 80, Math.max(-el.offsetWidth + 120, ev.clientX - sx)) + 'px'; el.style.top = Math.min(innerHeight - 40, Math.max(0, ev.clientY - sy)) + 'px'; };
      const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); };
      addEventListener('mousemove', mv); addEventListener('mouseup', up);
    });
    el.addEventListener('keydown', e => {
      if (topDialog() !== api) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); return; }
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON' && !e.target.closest('[data-noenter]')) {
        const pb = [...foot.querySelectorAll('.db.primary')].filter(b => !b.disabled)[0];
        if (pb) { e.preventDefault(); e.stopPropagation(); pb.click(); }
      }
    });
    // 포커스를 대화상자 안에 묶는다
    el.addEventListener('keydown', e => {
      if (e.key !== 'Tab' || topDialog() !== api) return;
      const f = [...el.querySelectorAll('button, input, select, textarea, [tabindex="0"]')].filter(x => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });
    stack.push(api);
    place();
    const prevFocus = document.activeElement;
    let done = false;
    function close(res) {
      if (done) return; done = true;
      back.remove(); el.remove();
      const i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1);
      if (o.onClose) o.onClose(res);
      if (prevFocus && prevFocus.isConnected && prevFocus.focus) prevFocus.focus({ preventScroll: true });
    }
    function cancel() { if (o.onCancel && o.onCancel(api) === false) return; close(null); }
    setTimeout(() => {
      const f = el.querySelector('[autofocus]') || el.querySelector('.dlg-body input:not([disabled]):not([type=radio]):not([type=checkbox]), .dlg-body select:not([disabled])') || foot.querySelector('.db.primary') || closeBtn;
      if (f) { f.focus({ preventScroll: true }); if (f.select && f.tagName === 'INPUT') f.select(); }
    }, 0);
    api.place = place;
    return api;
  }
  function anyDialog() { return stack.length > 0; }
  /* 메시지 상자: 누른 단추 이름을 돌려준다 */
  function msg(o) {
    return new Promise(res => {
      const labels = o.buttons || ['확인'];
      const btns = labels.map((label, i) => ({ label, primary: i === (o.def || 0), onClick: () => res(label) }));
      dialog({ title: o.title || '알림', width: o.width || 34, cls: 'msgdlg',
        body: h('div', { class: 'msgbox' }, h('div', { class: 'mic ' + (o.icon || 'warn'), 'aria-hidden': 'true' }, { warn: '!', err: '✕', info: 'i', q: '?' }[o.icon || 'warn']),
          h('div', { class: 'mtext' }, ...[].concat(o.text).map(t => h('p', {}, t)))),
        buttons: btns, onCancel: () => { res(labels[labels.length - 1]); } });
    });
  }
  function toast(text, ms) {
    const t = h('div', { class: 'toast', role: 'status' }, text);
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms || 2400);
  }

  /* ---------------------------------------------------------- IP 주소 네 칸 입력 */
  /* 숫자 세 자리 또는 점(.)으로 다음 칸, 빈 칸에서 Backspace로 앞 칸, 붙여넣기·한꺼번에 들어온 글자는 네 칸에 나눠 넣는다.
   * Tab은 Windows의 IP 주소 칸처럼 네 칸을 건너 다음 입력 항목으로 간다(첫 칸만 Tab 순서에 들어간다). */
  function ipBox(o) {
    o = o || {};
    const wrap = h('span', { class: 'ipbox', role: 'group', 'aria-label': o.label || 'IP 주소' });
    const parts = [];
    for (let i = 0; i < 4; i++) {
      const inp = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', spellcheck: false, tabindex: i ? -1 : 0, 'aria-label': (o.label || 'IP 주소') + ' ' + (i + 1) + '번째 칸' });
      parts.push(inp);
      wrap.appendChild(inp);
      if (i < 3) wrap.appendChild(h('span', { class: 'dot', 'aria-hidden': 'true' }, '.'));
    }
    let checking = false;
    function checkPart(inp) {
      if (checking) return;
      const n = Number(inp.value);
      if (inp.value !== '' && n > 255) {
        checking = true;
        const bad = inp.value;
        inp.value = '255';
        msg({ title: '값 확인', icon: 'warn', text: bad + '은(는) 올바른 값이 아닙니다. 0에서 255 사이의 값을 입력합니다.' }).then(() => { checking = false; inp.focus(); inp.select(); });
      }
    }
    parts.forEach((inp, i) => {
      inp.addEventListener('keydown', e => {
        const s = inp.selectionStart, en = inp.selectionEnd;
        if (e.key === '.' || e.key === 'Decimal' || e.key === ' ') {
          e.preventDefault();
          if (inp.value !== '' && i < 3) { parts[i + 1].focus(); parts[i + 1].select(); }
        } else if (e.key === 'Backspace' && s === 0 && en === 0 && i > 0) {
          e.preventDefault();
          const p = parts[i - 1]; p.focus(); p.value = p.value.slice(0, -1); p.setSelectionRange(p.value.length, p.value.length); fire();
        } else if (e.key === 'ArrowLeft' && s === 0 && en === 0 && i > 0) {
          e.preventDefault(); const p = parts[i - 1]; p.focus(); p.setSelectionRange(p.value.length, p.value.length);
        } else if (e.key === 'ArrowRight' && s === inp.value.length && i < 3) {
          e.preventDefault(); const p = parts[i + 1]; p.focus(); p.setSelectionRange(0, 0);
        } else if (e.key.length === 1 && !/[0-9]/.test(e.key) && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
        }
      });
      inp.addEventListener('input', () => {
        const raw = inp.value;
        if (raw.indexOf('.') >= 0) {                     // 「192.168.0.1」처럼 한꺼번에 들어온 값
          const segs = raw.split('.');
          let k = 0;
          for (; k < segs.length && i + k < 4; k++) parts[i + k].value = segs[k].replace(/[^0-9]/g, '').slice(0, 3);
          const last = parts[Math.min(3, i + k - 1)];
          last.focus(); last.setSelectionRange(last.value.length, last.value.length);
          parts.forEach(checkPart);
          fire();
          return;
        }
        const clean = raw.replace(/[^0-9]/g, '');
        if (clean.length > 3) {                         // 넷째 숫자는 다음 칸으로
          inp.value = clean.slice(0, 3);
          if (i < 3) { const p = parts[i + 1]; p.value = clean.slice(3, 6); p.focus(); p.setSelectionRange(p.value.length, p.value.length); }
          checkPart(inp); fire();
          return;
        }
        if (clean !== raw) inp.value = clean;
        if (inp.value.length === 3 && i < 3 && inp.selectionStart === 3) {
          checkPart(inp);
          if (!checking) { parts[i + 1].focus(); parts[i + 1].select(); }
        }
        fire();
      });
      inp.addEventListener('blur', () => checkPart(inp));
      inp.addEventListener('focus', () => wrap.classList.add('focus'));
      inp.addEventListener('blur', () => wrap.classList.remove('focus'));
      inp.addEventListener('paste', e => {
        const t = (e.clipboardData || window.clipboardData).getData('text').trim();
        if (/^\d{1,3}(\.\d{0,3}){1,3}$/.test(t)) { e.preventDefault(); set(t); fire(); parts[3].focus(); }
      });
    });
    function fire() { if (o.onChange) o.onChange(get()); }
    function get() {
      const v = parts.map(p => p.value);
      if (v.every(x => x === '')) return '';
      return v.join('.');
    }
    function set(s) {
      const v = String(s || '').split('.');
      parts.forEach((p, i) => { p.value = v[i] !== undefined ? v[i].replace(/[^0-9]/g, '').slice(0, 3) : ''; });
    }
    function setDisabled(d) { parts.forEach(p => { p.disabled = !!d; }); wrap.classList.toggle('dis', !!d); }
    set(o.value);
    if (o.disabled) setDisabled(true);
    Object.defineProperty(wrap, 'value', { get, set });
    wrap.setDisabled = setDisabled;
    wrap.focusFirst = () => { parts[0].focus(); parts[0].select(); };
    wrap.parts = parts;
    return wrap;
  }

  /* ---------------------------------------------------------- 숫자 상자(▲▼) */
  function spin(o) {
    o = o || {};
    const inp = h('input', { type: 'text', inputmode: 'numeric', class: 'spin-in', value: o.value == null ? '' : String(o.value), autocomplete: 'off',
      'aria-label': o.label || '', style: { width: (o.width || 4.5) + 'em' } });
    const step = d => {
      if (inp.disabled) return;
      let n = Number(inp.value) || 0;
      n += d;
      if (o.min != null) n = Math.max(o.min, n);
      if (o.max != null) n = Math.min(o.max, n);
      inp.value = String(n);
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.focus();
    };
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); step(-1); }
    });
    inp.addEventListener('input', () => { if (o.onChange) o.onChange(inp.value); });
    const up = h('button', { type: 'button', class: 'spin-b', tabindex: -1, title: '1 올림', 'aria-label': '1 올림', onclick: () => step(1) }, '▲');
    const dn = h('button', { type: 'button', class: 'spin-b', tabindex: -1, title: '1 내림', 'aria-label': '1 내림', onclick: () => step(-1) }, '▼');
    const wrap = h('span', { class: 'spin' }, inp, h('span', { class: 'spin-bs' }, up, dn));
    Object.defineProperty(wrap, 'value', { get: () => inp.value.trim(), set: v => { inp.value = v == null ? '' : String(v); } });
    wrap.setDisabled = d => { inp.disabled = up.disabled = dn.disabled = !!d; wrap.classList.toggle('dis', !!d); };
    wrap.input = inp;
    if (o.disabled) wrap.setDisabled(true);
    return wrap;
  }

  function textIn(o) {
    o = o || {};
    const inp = h('input', { type: 'text', class: 'tin', value: o.value || '', autocomplete: 'off', spellcheck: false, 'aria-label': o.label || '',
      style: o.width ? { width: o.width + 'em' } : null, readOnly: !!o.readonly, disabled: !!o.disabled });
    if (o.onInput) inp.addEventListener('input', () => o.onInput(inp.value));
    return inp;
  }
  function select(opts, value, o) {
    const s = h('select', { class: 'dsel', 'aria-label': (o && o.label) || '' }, opts.map(x => h('option', { value: x, selected: x === value }, x)));
    return s;
  }
  let fid = 0;
  /* 이름표 + 입력 한 줄 */
  function field(label, input, o) {
    const id = 'f' + (++fid);
    const target = input.querySelector ? (input.tagName === 'INPUT' || input.tagName === 'SELECT' ? input : input.querySelector('input, select')) : null;
    if (target) target.id = id;
    return h('div', { class: 'frow' + (o && o.cls ? ' ' + o.cls : '') }, h('label', { for: id, class: 'flab' }, label), h('div', { class: 'fin' }, input, o && o.after ? h('span', { class: 'fafter' }, o.after) : null));
  }
  function radio(name, label, checked, onChange, disabled) {
    const r = h('input', { type: 'radio', name, checked: !!checked, disabled: !!disabled });
    r.addEventListener('change', () => { if (r.checked && onChange) onChange(); });
    const l = h('label', { class: 'radio' + (disabled ? ' dis' : '') }, r, h('span', {}, label));
    l.input = r;
    return l;
  }
  function check(label, checked, onChange, disabled) {
    const c = h('input', { type: 'checkbox', checked: !!checked, disabled: !!disabled });
    c.addEventListener('change', () => { if (onChange) onChange(c.checked); });
    const l = h('label', { class: 'check' + (disabled ? ' dis' : '') }, c, h('span', {}, label));
    l.input = c;
    return l;
  }
  function group(title, ...kids) { return h('fieldset', { class: 'grp' }, title ? h('legend', {}, title) : null, ...kids); }

  /* ---------------------------------------------------------- 탭 */
  function tabs(defs, initial) {
    const bar = h('div', { class: 'dtabs', role: 'tablist' });
    const panes = h('div', { class: 'dpanes' });
    let cur = initial || defs[0].id;
    const show = id => {
      cur = id;
      [...bar.children].forEach((b, i) => { const on = defs[i].id === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
      [...panes.children].forEach((p, i) => { p.hidden = defs[i].id !== id; });
    };
    for (const d of defs) {
      bar.appendChild(h('button', { type: 'button', role: 'tab', disabled: !!d.out, title: d.out ? OUT_TIP : '', onclick: () => show(d.id) }, d.label));
      panes.appendChild(h('div', { class: 'dpane', role: 'tabpanel' }, d.body || h('div')));
    }
    show(cur);
    const el = h('div', { class: 'dtabwrap' }, bar, panes);
    el.show = show;
    el.current = () => cur;
    return el;
  }

  /* ---------------------------------------------------------- 트리 */
  /* nodes: [{id, label, icon, kids, out}] · ui: {sel, open:Set} · on: {select(id), context(id, at, wasSelected), dbl(id), refresh()}
   * 선택은 그 자리에서 표시만 바꾸고 on.select를 부른다(트리를 다시 그리지 않아야 두 번 누르기가 살아 있다). */
  function tree(nodes, ui, on) {
    const root = h('ul', { class: 'tree', role: 'tree' });
    function choose(row, focus) {
      root.querySelectorAll('.trow.sel').forEach(r => { r.classList.remove('sel'); r.setAttribute('aria-selected', 'false'); r.tabIndex = -1; });
      row.classList.add('sel'); row.setAttribute('aria-selected', 'true'); row.tabIndex = 0;
      if (focus) row.focus();
      if (ui.sel !== row.dataset.id) { ui.sel = row.dataset.id; on.select(row.dataset.id); }
    }
    function add(list, parent, depth) {
      for (const n of list) {
        const hasKids = n.kids && n.kids.length;
        const open = ui.open.has(n.id);
        const tog = h('span', { class: 'tog', 'aria-hidden': 'true', onclick: e => { e.stopPropagation(); if (!hasKids) return; open ? ui.open.delete(n.id) : ui.open.add(n.id); on.refresh(); } }, hasKids ? (open ? '▾' : '▸') : '');
        const row = h('div', { class: 'trow' + (ui.sel === n.id ? ' sel' : '') + (n.out ? ' out' : '') + (n.dim ? ' dim' : ''), style: { paddingLeft: (0.4 + depth * 1.25) + 'em' },
          role: 'treeitem', tabindex: ui.sel === n.id ? 0 : -1, 'aria-selected': ui.sel === n.id ? 'true' : 'false', 'aria-expanded': hasKids ? String(open) : null, 'data-id': n.id },
          tog, n.icon ? icon(n.icon) : null, h('span', { class: 'tl' }, n.label));
        row.addEventListener('mousedown', e => { if (e.button === 0 && !e.target.classList.contains('tog')) choose(row); });
        row.addEventListener('dblclick', e => { if (e.target.classList.contains('tog')) return; if (hasKids) { open ? ui.open.delete(n.id) : ui.open.add(n.id); on.refresh(); } else if (on.dbl) on.dbl(n.id); });
        row.addEventListener('contextmenu', e => { e.preventDefault(); on.context(n.id, { x: e.clientX, y: e.clientY }, ui.sel === n.id); });
        row.addEventListener('keydown', e => {
          if (e.key === 'ArrowRight' && hasKids && !open) { ui.open.add(n.id); on.refresh(); }
          else if (e.key === 'ArrowLeft' && hasKids && open) { ui.open.delete(n.id); on.refresh(); }
          else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const rows = [...root.querySelectorAll('.trow')];
            const i = rows.indexOf(row), nx = rows[i + (e.key === 'ArrowDown' ? 1 : -1)];
            if (nx) choose(nx, true);
          } else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
            e.preventDefault(); const r = row.getBoundingClientRect(); on.context(n.id, { x: r.left + 40, y: r.bottom }, true);
          }
        });
        const li = h('li', {}, row);
        parent.appendChild(li);
        if (hasKids && open) { const ul = h('ul', { role: 'group' }); li.appendChild(ul); add(n.kids, ul, depth + 1); }
      }
    }
    add(nodes, root, 0);
    return root;
  }

  /* ---------------------------------------------------------- 목록(자세히 보기) */
  /* cols: [{label, w}] · rows: [{cells:[], key, cls}] · on: {select(key), dbl(key), context(key, at)} */
  function listView(cols, rows, sel, on, empty) {
    const table = h('table', { class: 'lv' },
      h('colgroup', {}, cols.map(c => h('col', { style: c.w ? { width: c.w } : null }))),
      h('thead', {}, h('tr', {}, cols.map(c => h('th', { scope: 'col' }, c.label)))));
    const tb = h('tbody');
    if (!rows.length) tb.appendChild(h('tr', { class: 'empty' }, h('td', { colspan: cols.length }, empty || '표시할 항목이 없습니다.')));
    const trs = [];
    function choose(tr, key, focus) {
      trs.forEach(x => { x.classList.remove('sel'); x.tabIndex = -1; });
      tr.classList.add('sel'); tr.tabIndex = 0;
      if (focus) tr.focus();
      if (on.select) on.select(key);
    }
    rows.forEach((r, i) => {
      const tr = h('tr', { class: (sel === r.key ? 'sel ' : '') + (r.cls || ''), tabindex: sel === r.key || (sel == null && i === 0) ? 0 : -1 }, r.cells.map(c => h('td', {}, c)));
      trs.push(tr);
      tr.addEventListener('mousedown', e => { if (e.button === 0 || e.button === 2) choose(tr, r.key); });
      tr.addEventListener('dblclick', () => { if (on.dbl) on.dbl(r.key); });
      tr.addEventListener('contextmenu', e => { e.preventDefault(); if (on.context) on.context(r.key, { x: e.clientX, y: e.clientY }); });
      tr.addEventListener('keydown', e => {
        if (e.key === 'Enter' && on.dbl) { e.preventDefault(); on.dbl(r.key); }
        else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const nx = trs[i + (e.key === 'ArrowDown' ? 1 : -1)];
          if (nx) choose(nx, rows[trs.indexOf(nx)].key, true);
        } else if ((e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) && on.context) {
          e.preventDefault(); const rc = tr.getBoundingClientRect(); on.context(r.key, { x: rc.left + 40, y: rc.bottom });
        }
      });
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    return h('div', { class: 'lvwrap' }, table);
  }

  WS.ui = { h, icon, menu, closeMenu, dialog, anyDialog, msg, toast, ipBox, spin, textIn, select, field, radio, check, group, tabs, tree, listView, OUT_TIP };
})(typeof window !== 'undefined' ? window : globalThis);
