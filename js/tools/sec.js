/* 로컬 보안 정책: 보안 설정 > 계정 정책 > 암호 정책 · 계정 잠금 정책
 * 정책 속성 창의 「확인」 「적용」은 값 검사 뒤, 다른 항목이 함께 바뀌어야 하면 「제안된 값 변경」 창을 먼저 띄운다.
 */
(function (G) {
  'use strict';
  const WS = G.WS, M = G.WSModel;
  const { h, icon, menu, dialog, msg, spin, radio, tabs, tree, listView } = WS.ui;
  const TK = WS.toolkit;

  const EXPLAIN = {
    complexity: ['「사용」으로 지정하면 새 암호가 다음 조건을 모두 만족해야 합니다.', '사용자 계정 이름이나 전체 이름의 일부를 포함하지 않습니다.', '영어 대문자, 영어 소문자, 숫자, 특수 문자 가운데 세 종류 이상을 섞습니다.', '6자 이상입니다.'],
    history: ['같은 암호를 다시 쓰지 못하도록 기억해 두는 이전 암호의 개수입니다.', '0에서 24까지 지정합니다. 0이면 이전 암호를 기억하지 않습니다.'],
    maxAge: ['암호를 바꾼 뒤 이 기간이 지나면 암호를 바꾸어야 합니다.', '1에서 999일까지 지정합니다. 0이면 암호가 만료되지 않습니다.'],
    minLen: ['암호에 들어가야 하는 최소 글자 수입니다.', '0에서 14까지 지정합니다. 0이면 암호가 없어도 됩니다.'],
    minAge: ['암호를 바꾼 뒤 이 기간이 지나야 다시 바꿀 수 있습니다.', '최대 암호 사용 기간이 0이 아니면 최소 암호 사용 기간은 최대 암호 사용 기간보다 작아야 합니다.'],
    reversible: ['「사용」으로 지정하면 암호를 되돌릴 수 있는 방식으로 저장합니다.', '특정 인증 방식이 요구할 때만 사용합니다. 일반 서버에서는 「사용 안 함」으로 둡니다.'],
    lockDuration: ['잠긴 계정이 자동으로 풀릴 때까지의 시간(분)입니다.', '0이면 관리자가 직접 해제할 때까지 잠긴 상태로 남습니다.', '계정 잠금 임계값이 1 이상일 때만 적용됩니다.'],
    lockThreshold: ['로그온에 이 횟수만큼 실패하면 계정을 잠급니다.', '0이면 계정을 잠그지 않습니다. 0이 아닌 값으로 바꾸면 잠금 기간과 원래대로 설정 시간도 함께 정해집니다.'],
    lockReset: ['로그온 실패 횟수를 0으로 되돌리기까지의 시간(분)입니다.', '계정 잠금 기간이 0이 아니면 이 값은 계정 잠금 기간보다 길 수 없습니다.'],
  };
  const NOTE = {
    maxAge: '0으로 지정하면 암호가 만료되지 않습니다.',
    minLen: '0으로 지정하면 암호가 없어도 됩니다.',
    minAge: '0으로 지정하면 바로 다시 바꿀 수 있습니다.',
    lockDuration: '0으로 지정하면 관리자가 잠금을 해제할 때까지 계정이 잠깁니다.',
    lockThreshold: '0으로 지정하면 계정이 잠기지 않습니다.',
  };
  const NODES = [{ id: 'root', label: '보안 설정', icon: 'sec', kids: [
    { id: 'acct', label: '계정 정책', icon: 'folder', kids: [{ id: 'pw', label: '암호 정책', icon: 'folder' }, { id: 'lock', label: '계정 잠금 정책', icon: 'folder' }] },
    { id: 'local', label: '로컬 정책', icon: 'folder', kids: [{ id: 'audit', label: '감사 정책', icon: 'folder', out: true }, { id: 'rights', label: '사용자 권한 할당', icon: 'folder', out: true }, { id: 'opts', label: '보안 옵션', icon: 'folder' }] },
    { id: 'fw', label: '고급 보안이 포함된 Windows Defender 방화벽', icon: 'folder', out: true },
    { id: 'nlm', label: '네트워크 목록 관리자 정책', icon: 'folder', out: true },
    { id: 'pk', label: '공개 키 정책', icon: 'folder', out: true },
    { id: 'srp', label: '소프트웨어 제한 정책', icon: 'folder', out: true },
    { id: 'acp', label: '응용 프로그램 제어 정책', icon: 'folder', out: true },
    { id: 'ipsec', label: 'IP 보안 정책(위치: 로컬 컴퓨터)', icon: 'folder', out: true },
    { id: 'adv', label: '고급 감사 정책 구성', icon: 'folder', out: true },
  ] }];
  const CHILD = { root: ['계정 정책', '로컬 정책'], acct: ['암호 정책', '계정 잠금 정책'], local: ['감사 정책', '사용자 권한 할당', '보안 옵션'] };
  const OPT_EXPLAIN = {
    adminName: '기본 제공 Administrator 계정의 이름을 바꿉니다. 잘 알려진 이름을 바꾸면 계정 이름을 추측하기 어려워집니다.',
    guestName: '기본 제공 Guest 계정의 이름을 바꿉니다.',
    guestOn: 'Guest 계정을 사용할지 정합니다. 기본값은 「사용 안 함」입니다.',
    blankConsole: '「사용」이면 빈 암호 계정은 콘솔에서만 로그온할 수 있고 네트워크로는 로그온할 수 없습니다.',
    noCAD: '「사용」이면 로그온할 때 Ctrl+Alt+Del을 누르지 않아도 됩니다.',
    msgTitle: '로그온하기 전에 사용자에게 보여 줄 메시지 창의 제목입니다. 메시지 텍스트와 함께 지정합니다.',
    msgText: '로그온하기 전에 사용자에게 보여 줄 메시지 본문입니다. 경고나 사용 규칙을 안내할 때 씁니다.',
    noLastUser: '「사용」이면 로그온 화면에 마지막으로 로그온한 사용자 이름을 보여 주지 않습니다.',
    pwWarn: '암호가 만료되기 며칠 전부터 사용자에게 암호를 바꾸라고 알릴지 정합니다.',
    shutdownNoLogon: '「사용」이면 로그온하지 않고도 로그온 화면에서 시스템을 종료할 수 있습니다.',
    anonSid: '「사용」이면 익명 사용자가 다른 사용자의 SID로 계정 이름을 조회할 수 있습니다.',
    printerDrivers: '「사용」이면 Administrators와 Power Users만 프린터 드라이버를 설치할 수 있습니다.',
  };

  function create(ctx) {
    const ui = { sel: 'root', open: new Set(['root']), row: null };
    const el = h('div', { class: 'tool tool-sec' });

    let rhost = null;
    function render() {
      el.innerHTML = '';
      el.appendChild(TK.menubar([{ label: '파일', out: true }, { label: '동작', items: actionMenu }, { label: '보기', out: true }, { label: '도움말', out: true }]));
      const t = tree(NODES, ui, {
        select: () => { ui.row = null; renderRight(); },
        context: (id, at) => menu(at, nodeMenu(id)),
        refresh: render,
      });
      rhost = h('div', { class: 'rhost' });
      el.appendChild(TK.split(t, rhost));
      renderRight();
    }
    function renderRight() {
      const st = ctx.st();
      rhost.innerHTML = '';
      let right;
      if (ui.sel === 'pw' || ui.sel === 'lock') {
        const rows = M.SEC_ORDER[ui.sel].map(k => ({ key: k, cells: [h('span', { class: 'cellic' }, icon('doc'), M.SEC[k].label), M.secText(st, k)] }));
        right = listView([{ label: '정책', w: '56%' }, { label: '보안 설정' }], rows, ui.row, {
          select: k => { ui.row = k; },
          dbl: k => openPolicy(k),
          context: (k, at) => menu(at, rowMenu(k)),
        });
      } else if (ui.sel === 'opts') {
        const rows = M.CAT.SECOPTS.map(o => ({ key: o.key, cells: [h('span', { class: 'cellic' }, icon('doc'), o.label), M.secoptText(st, o.key)] }));
        right = listView([{ label: '정책', w: '64%' }, { label: '보안 설정' }], rows, ui.row, {
          select: k => { ui.row = k; },
          dbl: k => openOpt(k),
          context: (k, at) => menu(at, [{ label: '속성', bold: true, onClick: () => openOpt(k) }, { sep: true }, { label: '도움말', out: true }]),
        });
      } else if (CHILD[ui.sel]) {
        right = listView([{ label: '이름' }], CHILD[ui.sel].map(n => ({ key: n, cells: [h('span', { class: 'cellic' }, icon('folder'), n)] })), null, {});
      } else right = TK.OUT_NODE();
      rhost.appendChild(right);
    }
    /* 보안 옵션 속성: 글자(제목·이름), 여러 줄 글자(메시지 텍스트), 사용/사용 안 함, 일수 */
    function openOpt(key) {
      const st = ctx.st(), d = M.secoptDef(key), cur = st.secopt[key];
      let val = cur, input = null;
      const head = h('div', { class: 'polhead' }, icon('doc', 'big'), h('b', {}, d.label));
      let body;
      if (d.kind === 'bool') body = h('div', { class: 'polbody' }, head, radio('sov', '사용', !!cur, () => { val = true; }), radio('sov', '사용 안 함', !cur, () => { val = false; }));
      else if (d.kind === 'textarea') { input = h('textarea', { class: 'tarea', rows: 5, 'aria-label': d.label, spellcheck: false }); input.value = cur; body = h('div', { class: 'polbody' }, head, input); }
      else if (d.kind === 'days') { input = spin({ value: cur, min: 0, max: 999, label: d.label, width: 5 }); body = h('div', { class: 'polbody' }, head, h('div', { class: 'fin' }, h('span', {}, '암호 만료 전에 사용자에게 알림:'), input, h('span', {}, '일'))); }
      else { input = h('input', { type: 'text', class: 'tin', value: cur, 'aria-label': d.label, spellcheck: false, style: { width: '100%' } }); body = h('div', { class: 'polbody' }, head, input); }
      let dlg;
      function apply(closeAfter) {
        const v = d.kind === 'bool' ? val : input.value;
        const r = M.secoptSet(ctx.st(), key, v);
        if (!r.ok) { msg({ title: d.label, icon: 'err', text: r.error }); return; }
        ctx.commit();
        if (closeAfter) dlg.close('확인');
      }
      dlg = dialog({ title: d.label, width: 40, body: tabs([{ id: 'set', label: '로컬 보안 설정', body }, { id: 'exp', label: '설명', body: h('div', { class: 'explain' }, h('h4', {}, d.label), h('p', {}, OPT_EXPLAIN[key] || '이 정책의 값을 지정합니다.')) }]),
        buttons: [{ label: '확인', primary: true, keep: true, onClick: () => apply(true) }, { label: '취소', cancel: true }, { label: '적용', keep: true, onClick: () => apply(false) }] });
    }
    function nodeMenu(id) {
      return [{ label: '보기', out: true }, { label: '새로 고침', onClick: renderRight }, { label: '목록 내보내기', out: true }, { sep: true }, { label: '도움말', out: true }];
    }
    function rowMenu(k) { return [{ label: '속성', bold: true, onClick: () => openPolicy(k) }, { sep: true }, { label: '도움말', out: true }]; }
    function actionMenu() {
      if (ui.row && ui.sel === 'opts') return [{ label: '속성', bold: true, onClick: () => openOpt(ui.row) }];
      return ui.row && (ui.sel === 'pw' || ui.sel === 'lock') ? rowMenu(ui.row) : nodeMenu(ui.sel);
    }

    function openPolicy(key) {
      const st = ctx.st(), d = M.SEC[key];
      let boolVal = !!st.sec[key];
      let input = null;
      const na = (key === 'lockDuration' || key === 'lockReset') && !st.sec.lockThreshold;
      const head = h('div', { class: 'polhead' }, icon('doc', 'big'), h('b', {}, d.label));
      let setting;
      if (d.kind === 'bool') {
        setting = h('div', { class: 'polbody' }, head,
          radio('pv', '사용', boolVal, () => { boolVal = true; }),
          radio('pv', '사용 안 함', !boolVal, () => { boolVal = false; }));
      } else {
        input = spin({ value: na ? '' : st.sec[key], min: d.min, max: d.max, label: d.label, width: 5.5, disabled: na });
        setting = h('div', { class: 'polbody' }, head,
          h('p', { class: 'lab' }, d.field),
          h('div', { class: 'fin' }, input, h('span', { class: 'fafter' }, d.unit)),
          na ? h('p', { class: 'note warn' }, '계정 잠금 임계값이 0이므로 이 설정은 「해당 없음」입니다. 계정 잠금 임계값을 먼저 1 이상으로 바꿉니다.')
            : h('p', { class: 'note' }, '입력 범위: ' + d.min + '~' + d.max + (NOTE[key] ? '. ' + NOTE[key] : '')));
      }
      const explain = h('div', { class: 'explain' }, h('h4', {}, d.label), ...EXPLAIN[key].map(t => h('p', {}, t)));
      let dlg;
      function apply(closeAfter) {
        if (na) { if (closeAfter) dlg.close('확인'); return; }
        const value = d.kind === 'bool' ? boolVal : input.value;
        const r = M.secChange(ctx.st(), key, value);
        if (r.error) { msg({ title: d.label + ' 속성', icon: 'err', text: r.error }).then(() => { if (input) { input.input.focus(); input.input.select(); } }); return; }
        if (r.suggest.length) {
          suggest(r, () => { M.secApply(ctx.st(), r.changes); ctx.commit(); if (closeAfter) dlg.close('확인'); });
          return;
        }
        M.secApply(ctx.st(), r.changes); ctx.commit();
        if (closeAfter) dlg.close('확인');
      }
      dlg = dialog({ title: d.label + ' 속성', width: 34,
        body: tabs([{ id: 'set', label: '로컬 보안 설정', body: setting }, { id: 'exp', label: '설명', body: explain }]),
        buttons: [
          { label: '확인', primary: true, keep: true, onClick: () => apply(true) },
          { label: '취소', cancel: true },
          { label: '적용', keep: true, disabled: na, onClick: () => apply(false) },
        ] });
    }
    function suggest(r, onOk) {
      const table = h('table', { class: 'kv wide' },
        h('tr', {}, h('th', {}, '정책'), h('th', {}, '보안 설정'), h('th', {}, '제안된 설정')),
        r.suggest.map(s => h('tr', {}, h('td', {}, M.SEC[s.key].label), h('td', {}, s.from), h('td', { class: 'strong' }, s.to))));
      dialog({ title: '제안된 값 변경', width: 40, body: h('div', {}, h('p', {}, r.message), table),
        buttons: [{ label: '확인', primary: true, onClick: onOk }, { label: '취소', cancel: true }] });
    }
    return { el, render };
  }

  WS.tools.sec = { id: 'sec', title: '로컬 보안 정책', icon: 'sec', create };
})(window);
