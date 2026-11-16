/* 서비스: 서비스(로컬) 목록(이름·설명·상태·시작 유형·다음 사용자로 로그온) → 서비스 속성 일반 탭
 * 문제에는 서비스 이름 없이 설명만 나오므로, 왼쪽 설명 칸과 목록의 설명 열로 찾는다. 열 머리글을 누르면 정렬, 목록에서 글자를 치면 그 글자로 시작하는 서비스로 이동.
 * 서비스 상태 단추(시작·중지)는 누르는 즉시 반영되고, 시작 유형은 「확인」 또는 「적용」을 눌러야 저장된다.
 */
(function (G) {
  'use strict';
  const WS = G.WS, M = G.WSModel;
  const { h, icon, menu, dialog, msg, toast, textIn, tabs, tree, select } = WS.ui;
  const TK = WS.toolkit;
  const COLS = [{ key: 'display', label: '이름', w: '31%' }, { key: 'desc', label: '설명', w: '25%' }, { key: 'status', label: '상태', w: '11%' }, { key: 'start', label: '시작 유형', w: '15%' }, { key: 'logon', label: '다음 사용자로 로그온', w: '18%' }];
  const listStatus = s => s === M.SVC_OFF ? '' : s;

  function create(ctx) {
    const ui = { sel: 'local', open: new Set(['local']), row: null, sort: 'display', asc: true };
    const el = h('div', { class: 'tool tool-svc' });
    let typed = '', typedAt = 0;

    function render() {
      el.innerHTML = '';
      el.appendChild(TK.menubar([{ label: '파일', out: true }, { label: '동작', items: () => ui.row ? svcMenu(ui.row) : [{ label: '새로 고침', onClick: render }] }, { label: '보기', out: true }, { label: '도움말', out: true }]));
      const t = tree([{ id: 'local', label: '서비스(로컬)', icon: 'svc' }], ui, { select: () => {}, context: (id, at) => menu(at, [{ label: '새로 고침', onClick: render }, { label: '목록 내보내기', out: true }]), refresh: render });
      el.appendChild(h('div', { class: 'split svc-split' }, h('div', { class: 'pane-l' }, t), h('div', { class: 'pane-r svc-r' }, side(), table())));
    }
    function side() {
      const s = ui.row ? M.svcGet(ctx.st(), ui.row) : null;
      if (!s) return h('div', { class: 'svc-side' }, h('p', { class: 'note' }, '목록에서 서비스를 고르면 설명이 여기에 나옵니다.'));
      const links = [];
      if (s.status === M.SVC_OFF) links.push(h('button', { type: 'button', class: 'linkact', onclick: () => doStart(s.name) }, '서비스 시작'));
      if (s.status !== M.SVC_OFF) links.push(h('button', { type: 'button', class: 'linkact', onclick: () => doStop(s.name) }, '서비스 중지'));
      if (s.status === M.SVC_ON) links.push(h('button', { type: 'button', class: 'linkact', onclick: () => doRestart(s.name) }, '서비스 다시 시작'));
      return h('div', { class: 'svc-side' }, h('h3', {}, s.display), h('div', { class: 'fin' }, links), h('p', { class: 'lab' }, '설명:'), h('p', {}, s.desc));
    }
    function sorted() {
      const list = M.svcList(ctx.st());
      const k = ui.sort, dir = ui.asc ? 1 : -1;
      return list.sort((a, b) => String(a[k]).localeCompare(String(b[k]), 'ko') * dir || a.display.localeCompare(b.display, 'ko'));
    }
    function table() {
      const list = sorted();
      const tb = h('tbody');
      const trs = [];
      const pick = (name, focus) => { ui.row = name; trs.forEach(t => { const on = t.dataset.name === name; t.classList.toggle('sel', on); t.tabIndex = on ? 0 : -1; if (on && focus) { t.focus(); t.scrollIntoView({ block: 'nearest' }); } }); const sd = el.querySelector('.svc-side'); if (sd) sd.replaceWith(side()); };
      list.forEach((s, i) => {
        const tr = h('tr', { class: ui.row === s.name ? 'sel' : '', tabindex: ui.row === s.name || (!ui.row && i === 0) ? 0 : -1, 'data-name': s.name },
          h('td', {}, h('span', { class: 'cellic' }, icon('svc'), s.display)), h('td', { class: 'ellip', title: s.desc }, s.desc), h('td', {}, listStatus(s.status)), h('td', {}, s.start), h('td', {}, s.logon));
        tr.addEventListener('mousedown', e => { if (e.button === 0 || e.button === 2) pick(s.name); });
        tr.addEventListener('dblclick', () => props(s.name));
        tr.addEventListener('contextmenu', e => { e.preventDefault(); menu({ x: e.clientX, y: e.clientY }, svcMenu(s.name)); });
        tr.addEventListener('keydown', e => {
          const idx = trs.indexOf(tr);
          if (e.key === 'Enter') { e.preventDefault(); props(s.name); }
          else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = trs[idx + (e.key === 'ArrowDown' ? 1 : -1)]; if (n) pick(n.dataset.name, true); }
          else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); const r = tr.getBoundingClientRect(); menu({ x: r.left + 40, y: r.bottom }, svcMenu(s.name)); }
          else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {          // 글자를 치면 그 글자로 시작하는 서비스로
            const now = Date.now(); typed = (now - typedAt < 900 ? typed : '') + e.key.toLowerCase(); typedAt = now;
            const hit = list.find(x => x.display.toLowerCase().startsWith(typed));
            if (hit) { e.preventDefault(); pick(hit.name, true); }
          }
        });
        trs.push(tr); tb.appendChild(tr);
      });
      const head = h('tr', {}, COLS.map(c => h('th', { scope: 'col', class: 'sortable', 'aria-sort': ui.sort === c.key ? (ui.asc ? 'ascending' : 'descending') : 'none',
        onclick: () => { if (ui.sort === c.key) ui.asc = !ui.asc; else { ui.sort = c.key; ui.asc = true; } render(); } }, c.label, ui.sort === c.key ? (ui.asc ? ' ▲' : ' ▼') : '')));
      return h('div', { class: 'lvwrap svc-list' }, h('table', { class: 'lv' }, h('colgroup', {}, COLS.map(c => h('col', { style: { width: c.w } }))), h('thead', {}, head), tb));
    }
    function svcMenu(name) {
      const s = M.svcGet(ctx.st(), name);
      return [
        { label: '시작', disabled: s.status !== M.SVC_OFF, onClick: () => doStart(name) },
        { label: '중지', disabled: s.status === M.SVC_OFF, onClick: () => doStop(name) },
        { label: '일시 중지', disabled: !(s.pausable && s.status === M.SVC_ON), onClick: () => { M.svcPause(ctx.st(), name); ctx.commit(); } },
        { label: '계속', disabled: s.status !== M.SVC_PAUSE, onClick: () => { M.svcResume(ctx.st(), name); ctx.commit(); } },
        { label: '다시 시작', disabled: s.status !== M.SVC_ON, onClick: () => doRestart(name) },
        { sep: true }, { label: '모든 작업', out: true }, { sep: true }, { label: '새로 고침', onClick: render }, { sep: true },
        { label: '속성', bold: true, onClick: () => props(name) }, { sep: true }, { label: '도움말', out: true }];
    }
    function doStart(name) { const r = M.svcStart(ctx.st(), name); if (!r.ok) { msg({ title: '서비스', icon: 'err', text: r.error }); return false; } ctx.commit(); return true; }
    function doStop(name) { M.svcStop(ctx.st(), name); ctx.commit(); }
    function doRestart(name) { M.svcStop(ctx.st(), name); doStart(name); }

    function props(name) {
      const s = M.svcGet(ctx.st(), name);
      let start = s.start;
      const st = select(M.START_TYPES, s.start, { label: '시작 유형' });
      st.addEventListener('change', () => { start = st.value; });
      const statusEl = h('b', { class: 'svc-status' });
      const bStart = h('button', { type: 'button', class: 'btn', onclick: () => { if (doStart(name)) sync(); } }, '시작');
      const bStop = h('button', { type: 'button', class: 'btn', onclick: () => { doStop(name); sync(); } }, '중지');
      const bPause = h('button', { type: 'button', class: 'btn', onclick: () => { M.svcPause(ctx.st(), name); ctx.commit(); sync(); } }, '일시 중지');
      const bResume = h('button', { type: 'button', class: 'btn', onclick: () => { M.svcResume(ctx.st(), name); ctx.commit(); sync(); } }, '계속');
      function sync() {
        const cur = M.svcGet(ctx.st(), name);
        statusEl.textContent = cur.status;
        bStart.disabled = cur.status !== M.SVC_OFF;
        bStop.disabled = cur.status === M.SVC_OFF;
        bPause.disabled = !(cur.pausable && cur.status === M.SVC_ON);
        bResume.disabled = cur.status !== M.SVC_PAUSE;
      }
      sync();
      const desc = h('textarea', { class: 'tarea', rows: 3, readOnly: true, 'aria-label': '설명' }); desc.value = s.desc;
      const gen = h('div', { class: 'svcgen' },
        h('div', { class: 'frow' }, h('span', { class: 'flab' }, '서비스 이름:'), h('span', { class: 'mono' }, s.name)),
        h('div', { class: 'frow' }, h('span', { class: 'flab' }, '표시 이름:'), h('span', {}, s.display)),
        h('div', { class: 'frow top' }, h('span', { class: 'flab' }, '설명:'), desc),
        h('p', { class: 'lab' }, '실행 파일 경로:'), h('p', { class: 'mono' }, s.path),
        h('div', { class: 'frow' }, h('label', { class: 'flab' }, '시작 유형:'), st),
        h('hr'),
        h('div', { class: 'frow' }, h('span', { class: 'flab' }, '서비스 상태:'), statusEl),
        h('div', { class: 'brow left' }, bStart, bStop, bPause, bResume),
        h('p', { class: 'note' }, '서비스를 시작할 때 적용할 시작 매개 변수를 지정할 수 있습니다.'),
        h('div', { class: 'frow' }, h('label', { class: 'flab' }, '시작 매개 변수:'), textIn({ label: '시작 매개 변수', width: 18 })));
      function apply() { M.svcSetStart(ctx.st(), name, start); ctx.commit(); }
      dialog({ title: s.display + ' 속성(로컬 컴퓨터)', width: 40, body: tabs([{ id: 'gen', label: '일반', body: gen }, { id: 'logon', label: '로그온', out: true }, { id: 'rec', label: '복구', out: true }, { id: 'dep', label: '종속성', out: true }]),
        buttons: [{ label: '확인', primary: true, onClick: apply }, { label: '취소', cancel: true }, { label: '적용', keep: true, onClick: () => { apply(); sync(); } }] });
    }

    return { el, render };
  }

  WS.tools.svc = { id: 'svc', title: '서비스', icon: 'svc', create };
})(window);
