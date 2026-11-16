/* 관리 도구 창 공통 부품: 메뉴 막대, 트리 | 목록 두 칸 배치, 안내 상자, IP 주소 목록(추가·제거·위로·아래로) */
(function (G) {
  'use strict';
  const WS = G.WS;
  const { h, menu, msg, ipBox } = WS.ui;
  WS.tools = WS.tools || {};

  /* defs: [{label, items: () => menuItems, out}] */
  function menubar(defs) {
    const bar = h('div', { class: 'mbar', role: 'menubar' });
    for (const d of defs) {
      const b = h('button', { type: 'button', class: 'mb' + (d.out ? ' out' : ''), role: 'menuitem', disabled: !!d.out, title: d.out ? WS.ui.OUT_TIP : '' }, d.label);
      if (!d.out) b.addEventListener('click', () => menu(b, d.items()));
      bar.appendChild(b);
    }
    return bar;
  }
  function split(left, right) {
    return h('div', { class: 'split' }, h('div', { class: 'pane-l' }, left), h('div', { class: 'pane-r' }, right));
  }
  function info(title, ...lines) {
    return h('div', { class: 'pane-info' }, title ? h('h3', {}, title) : null, ...lines.map(t => h('p', {}, t)));
  }
  const OUT_NODE = () => info('연습 범위 밖', '이 연습에서 다루지 않는 항목입니다. 과제에 필요한 폴더를 왼쪽에서 고릅니다.');

  /* 주소 목록 편집기: arr를 직접 바꾼다 */
  function ipList(arr, o) {
    o = o || {};
    const box = ipBox({ label: o.label || 'IP 주소' });
    const lb = h('select', { class: 'lbox', size: o.size || 4, 'aria-label': o.listLabel || '추가한 주소' });
    function draw() {
      const keep = lb.selectedIndex;
      lb.innerHTML = '';
      arr.forEach(a => lb.appendChild(h('option', {}, a)));
      if (arr.length) lb.selectedIndex = Math.min(Math.max(keep, 0), arr.length - 1);
    }
    function add() {
      const v = box.value;
      if (!v) { msg({ title: '주소 추가', icon: 'warn', text: 'IP 주소를 입력합니다.' }); return; }
      if (!WSModel.isIp(v)) { msg({ title: '주소 추가', icon: 'err', text: 'IP 주소의 네 칸을 모두 0에서 255 사이 숫자로 입력합니다.' }); return; }
      const n = WSModel.normIp(v);
      if (arr.indexOf(n) >= 0) { msg({ title: '주소 추가', icon: 'warn', text: n + '은(는) 이미 목록에 있습니다.' }); return; }
      arr.push(n); box.value = ''; draw(); lb.selectedIndex = arr.length - 1;
      if (o.onChange) o.onChange();
      box.focusFirst();
    }
    function move(d) {
      const i = lb.selectedIndex, j = i + d;
      if (i < 0 || j < 0 || j >= arr.length) return;
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t; draw(); lb.selectedIndex = j;
      if (o.onChange) o.onChange();
    }
    const btnAdd = h('button', { type: 'button', class: 'btn', onclick: add }, '추가');
    box.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); add(); } });
    box.setAttribute('data-noenter', '');
    const side = h('div', { class: 'lbtns' },
      h('button', { type: 'button', class: 'btn', onclick: () => { const i = lb.selectedIndex; if (i >= 0) { arr.splice(i, 1); draw(); if (o.onChange) o.onChange(); } } }, '제거'),
      o.order === false ? null : h('button', { type: 'button', class: 'btn', onclick: () => move(-1) }, '위로'),
      o.order === false ? null : h('button', { type: 'button', class: 'btn', onclick: () => move(1) }, '아래로'));
    draw();
    const el = h('div', { class: 'iplist' },
      h('div', { class: 'frow' }, h('span', { class: 'flab' }, o.label ? o.label + ':' : 'IP 주소:'), h('div', { class: 'fin' }, box, btnAdd)),
      h('div', { class: 'lrow' }, lb, side));
    el.box = box;
    return el;
  }

  WS.toolkit = { menubar, split, info, OUT_NODE, ipList };
})(window);
