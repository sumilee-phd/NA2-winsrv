/* 컴퓨터 관리 > 시스템 도구 > 로컬 사용자 및 그룹 > 사용자 · 그룹
 * 새 사용자(만든 뒤에도 창이 열려 있음), 사용자 속성(일반 · 소속 그룹 · 세션 · 원격 제어 · 전화 접속 로그인),
 * 그룹 선택(이름 확인, 고급 > 지금 찾기), 새 그룹, 그룹 속성, 암호 설정, 이름 바꾸기, 삭제
 */
(function (G) {
  'use strict';
  const WS = G.WS, M = G.WSModel;
  const { h, icon, menu, dialog, msg, textIn, radio, check, group, tabs, tree, listView, field, select } = WS.ui;
  const TK = WS.toolkit;
  const ST = () => M.CAT.SESSION_TIMES;

  /* 사용자 또는 그룹 선택 창. 고른 이름 배열을 넘긴다 */
  function selectObjects(ctx, kind, onOk) {
    const label = kind === 'group' ? '그룹' : '사용자';
    const ta = h('textarea', { class: 'tarea', rows: 3, 'aria-label': '선택할 개체 이름', spellcheck: false });
    function check() {
      const r = M.resolveNames(ctx.st(), ta.value, kind);
      if (!r.ok) { msg({ title: '이름을 찾을 수 없음', icon: 'err', text: r.error }); return null; }
      ta.value = r.names.join('; ');
      return r.names;
    }
    function advanced() {
      let sel = new Set();
      const host = h('div');
      const draw = list => {
        host.innerHTML = '';
        const rows = list.map(o => ({ key: o.name, cells: [h('span', { class: 'cellic' }, icon(kind === 'group' ? 'group' : 'user'), o.name), ctx.st().server] }));
        host.appendChild(listView([{ label: '이름(RDN)', w: '60%' }, { label: '폴더 내' }], rows, null, { select: n => { sel = new Set([n]); }, dbl: n => { sel = new Set([n]); d2.buttons['확인'].click(); } }, '「지금 찾기」를 누르면 결과가 나옵니다.'));
      };
      draw([]);
      const d2 = dialog({ title: label + ' 선택', width: 40, body: h('div', {},
        h('label', { class: 'flab' }, '개체 유형을 선택하십시오.'), h('div', { class: 'fin' }, textIn({ value: label, label: '개체 유형', width: 16, readonly: true }), h('button', { type: 'button', class: 'btn', disabled: true, title: WS.ui.OUT_TIP }, '개체 유형')),
        h('label', { class: 'flab' }, '찾을 위치를 선택하십시오.'), h('div', { class: 'fin' }, textIn({ value: ctx.st().server, label: '위치', width: 16, readonly: true }), h('button', { type: 'button', class: 'btn', disabled: true, title: WS.ui.OUT_TIP }, '위치')),
        h('div', { class: 'brow spread' }, h('span', { class: 'note' }, '일반 쿼리는 이 연습에서 다루지 않습니다.'),
          h('button', { type: 'button', class: 'btn primary', onclick: () => draw(kind === 'group' ? ctx.st().users.groups : ctx.st().users.users) }, '지금 찾기')),
        h('label', { class: 'flab' }, '검색 결과:'), host),
        buttons: [{ label: '확인', primary: true, onClick: () => { if (!sel.size) return; ta.value = [...sel].join('; '); } }, { label: '취소', cancel: true }] });
    }
    dialog({ title: label + ' 선택', width: 38, body: h('div', {},
      h('label', { class: 'flab' }, '개체 유형을 선택하십시오.'), h('div', { class: 'fin' }, textIn({ value: label, label: '개체 유형', width: 16, readonly: true }), h('button', { type: 'button', class: 'btn', disabled: true, title: WS.ui.OUT_TIP }, '개체 유형')),
      h('label', { class: 'flab' }, '찾을 위치를 선택하십시오.'), h('div', { class: 'fin' }, textIn({ value: ctx.st().server, label: '위치', width: 16, readonly: true }), h('button', { type: 'button', class: 'btn', disabled: true, title: WS.ui.OUT_TIP }, '위치')),
      h('label', { class: 'flab' }, '선택할 개체 이름을 입력하십시오(예):'),
      h('div', { class: 'lrow' }, ta, h('div', { class: 'lbtns' }, h('button', { type: 'button', class: 'btn', onclick: check }, '이름 확인'))),
      h('div', { class: 'brow' }, h('button', { type: 'button', class: 'btn', onclick: advanced }, '고급'))),
      buttons: [{ label: '확인', primary: true, onClick: () => { if (!ta.value.trim()) return; const n = check(); if (!n) return false; onOk(n); } }, { label: '취소', cancel: true }] });
  }

  function create(ctx) {
    const ui = { sel: 'comp', open: new Set(['comp', 'tools']), row: null };
    const el = h('div', { class: 'tool tool-users' });
    let rhost = null;
    const NODES = [{ id: 'comp', label: '컴퓨터 관리(로컬)', icon: 'comp', kids: [
      { id: 'tools', label: '시스템 도구', icon: 'folder', kids: [
        { id: 'task', label: '작업 스케줄러', icon: 'folder', out: true },
        { id: 'ev', label: '이벤트 뷰어', icon: 'folder', out: true },
        { id: 'share', label: '공유 폴더', icon: 'folder', out: true },
        { id: 'lug', label: '로컬 사용자 및 그룹', icon: 'group', kids: [{ id: 'users', label: '사용자', icon: 'folder' }, { id: 'groups', label: '그룹', icon: 'folder' }] },
        { id: 'perf', label: '성능', icon: 'folder', out: true },
        { id: 'dev', label: '장치 관리자', icon: 'folder', out: true },
      ] },
      { id: 'stor', label: '저장소', icon: 'folder', out: true },
      { id: 'sa', label: '서비스 및 응용 프로그램', icon: 'folder', out: true },
    ] }];
    const CHILD = { comp: ['시스템 도구', '저장소', '서비스 및 응용 프로그램'], tools: ['작업 스케줄러', '이벤트 뷰어', '공유 폴더', '로컬 사용자 및 그룹', '성능', '장치 관리자'], lug: ['사용자', '그룹'] };

    function render() {
      el.innerHTML = '';
      el.appendChild(TK.menubar([{ label: '파일', out: true }, { label: '동작', items: () => nodeMenu(ui.sel) }, { label: '보기', out: true }, { label: '도움말', out: true }]));
      const t = tree(NODES, ui, { select: () => { ui.row = null; renderRight(); }, context: (id, at) => menu(at, nodeMenu(id)), refresh: render });
      rhost = h('div', { class: 'rhost' });
      el.appendChild(TK.split(t, rhost));
      renderRight();
    }
    function renderRight() {
      const st = ctx.st();
      rhost.innerHTML = '';
      let right;
      if (ui.sel === 'users') {
        right = listView([{ label: '이름', w: '30%' }, { label: '전체 이름', w: '28%' }, { label: '설명' }],
          st.users.users.map(u => ({ key: u.name, cells: [h('span', { class: 'cellic' }, icon('user'), u.name, u.disabled ? h('span', { class: 'mtag' }, '사용 안 함') : null), u.full, u.desc] })), ui.row, {
            select: n => { ui.row = n; }, dbl: n => userProps(n), context: (n, at) => menu(at, userMenu(n)) });
      } else if (ui.sel === 'groups') {
        right = listView([{ label: '이름', w: '38%' }, { label: '설명' }],
          st.users.groups.map(g => ({ key: g.name, cells: [h('span', { class: 'cellic' }, icon('group'), g.name), g.desc] })), ui.row, {
            select: n => { ui.row = n; }, dbl: n => groupProps(n), context: (n, at) => menu(at, groupMenu(n)) });
      } else if (CHILD[ui.sel]) {
        right = listView([{ label: '이름' }], CHILD[ui.sel].map(n => ({ key: n, cells: [h('span', { class: 'cellic' }, icon('folder'), n)] })), null, {});
      } else right = TK.OUT_NODE();
      rhost.appendChild(right);
    }
    function nodeMenu(id) {
      if (id === 'users') return [{ label: '새 사용자...', onClick: newUser }, { sep: true }, { label: '보기', out: true }, { label: '새로 고침', onClick: renderRight }, { label: '목록 내보내기...', out: true }];
      if (id === 'groups') return [{ label: '새 그룹...', onClick: newGroup }, { sep: true }, { label: '보기', out: true }, { label: '새로 고침', onClick: renderRight }, { label: '목록 내보내기...', out: true }];
      if (ui.row && ui.sel === 'users') return userMenu(ui.row);
      if (ui.row && ui.sel === 'groups') return groupMenu(ui.row);
      return [{ label: '새로 고침', onClick: renderRight }, { label: '도움말', out: true }];
    }
    function userMenu(n) {
      return [{ label: '암호 설정...', onClick: () => setPw(n) }, { label: '모든 작업', out: true }, { sep: true },
        { label: '삭제', onClick: () => delUser(n) }, { label: '이름 바꾸기', onClick: () => rename(n) }, { sep: true }, { label: '속성', bold: true, onClick: () => userProps(n) }, { label: '도움말', out: true }];
    }
    function groupMenu(n) { return [{ label: '그룹에 추가...', onClick: () => groupProps(n) }, { label: '모든 작업', out: true }, { sep: true }, { label: '삭제', out: true }, { label: '이름 바꾸기', out: true }, { sep: true }, { label: '속성', bold: true, onClick: () => groupProps(n) }]; }

    /* ------------------------------------------------ 새 사용자 */
    function newUser() {
      const nm = textIn({ label: '사용자 이름', width: 18 }), full = textIn({ label: '전체 이름', width: 18 }), desc = textIn({ label: '설명', width: 18 });
      const pw = h('input', { type: 'password', class: 'tin', 'aria-label': '암호', autocomplete: 'new-password', style: { width: '18em' } });
      const pw2 = h('input', { type: 'password', class: 'tin', 'aria-label': '암호 확인', autocomplete: 'new-password', style: { width: '18em' } });
      const f = { mustChange: true, cantChange: false, neverExpire: false, disabled: false };
      const cMust = check('다음 로그온할 때 사용자가 반드시 암호를 변경해야 함', true, c => { f.mustChange = c; sync(); });
      const cCant = check('사용자가 암호를 변경할 수 없음', false, c => { f.cantChange = c; sync(); });
      const cNever = check('암호 사용 기간 제한 없음', false, c => { f.neverExpire = c; sync(); });
      const cDis = check('계정 사용 안 함', false, c => { f.disabled = c; });
      function sync() {
        const lockOthers = f.mustChange, lockMust = f.cantChange || f.neverExpire;
        cCant.input.disabled = cNever.input.disabled = lockOthers; cCant.classList.toggle('dis', lockOthers); cNever.classList.toggle('dis', lockOthers);
        cMust.input.disabled = lockMust; cMust.classList.toggle('dis', lockMust);
      }
      sync();
      function reset() {
        [nm, full, desc, pw, pw2].forEach(x => { x.value = ''; });
        Object.assign(f, { mustChange: true, cantChange: false, neverExpire: false, disabled: false });
        cMust.input.checked = true; cCant.input.checked = cNever.input.checked = cDis.input.checked = false; sync(); nm.focus();
      }
      dialog({ title: '새 사용자', width: 36, body: h('div', { class: 'newuser' },
        field('사용자 이름:', nm), field('전체 이름:', full), field('설명:', desc), h('hr'),
        field('암호:', pw), field('암호 확인:', pw2),
        cMust, cCant, cNever, cDis),
        buttons: [
          { label: '도움말', left: true, disabled: true, out: true },
          { label: '만들기', primary: true, keep: true, onClick: () => {
            const r = M.createUser(ctx.st(), Object.assign({ name: nm.value, full: full.value, desc: desc.value, pw: pw.value, pw2: pw2.value }, f));
            if (!r.ok) { msg({ title: '로컬 사용자 및 그룹', icon: 'err', text: r.error }); return; }
            ctx.commit(); reset();
          } },
          { label: '닫기', cancel: true },
        ] });
    }
    function setPw(n) {
      const pw = h('input', { type: 'password', class: 'tin', 'aria-label': '새 암호', style: { width: '16em' } }), pw2 = h('input', { type: 'password', class: 'tin', 'aria-label': '암호 확인', style: { width: '16em' } });
      dialog({ title: n + ' 암호 설정', width: 34, body: h('div', {}, h('p', { class: 'note warn' }, '암호를 다시 설정하면 이 사용자의 암호화된 파일이나 저장된 자격 증명에 접근하지 못할 수 있습니다.'), field('새 암호:', pw), field('암호 확인:', pw2)),
        buttons: [{ label: '확인', primary: true, onClick: () => { const r = M.setPassword(ctx.st(), n, pw.value, pw2.value); if (!r.ok) { msg({ title: '로컬 사용자 및 그룹', icon: 'err', text: r.error }); return false; } ctx.commit(); msg({ title: '로컬 사용자 및 그룹', icon: 'info', text: '암호를 설정했습니다.' }); } }, { label: '취소', cancel: true }] });
    }
    function delUser(n) {
      msg({ title: '로컬 사용자 및 그룹', icon: 'q', text: ['사용자 계정 ' + n + '을(를) 삭제하시겠습니까?', '삭제한 계정은 같은 이름으로 다시 만들어도 이전 권한이 되살아나지 않습니다.'], buttons: ['예', '아니요'], def: 1 })
        .then(b => { if (b !== '예') return; const r = M.deleteUser(ctx.st(), n); if (!r.ok) { msg({ title: '로컬 사용자 및 그룹', icon: 'err', text: r.error }); return; } ui.row = null; ctx.commit(); });
    }
    function rename(n) {
      const t = textIn({ value: n, label: '새 이름', width: 18 });
      dialog({ title: '이름 바꾸기', width: 28, body: field('새 이름:', t), buttons: [{ label: '확인', primary: true, onClick: () => { const r = M.renameUser(ctx.st(), n, t.value); if (!r.ok) { msg({ title: '로컬 사용자 및 그룹', icon: 'err', text: r.error }); return false; } ui.row = t.value.trim(); ctx.commit(); } }, { label: '취소', cancel: true }] });
    }

    /* ------------------------------------------------ 사용자 속성 */
    function userProps(n) {
      const st = ctx.st(), u = M.findUser(st, n);
      const d = { full: u.full, desc: u.desc, mustChange: u.mustChange, cantChange: u.cantChange, neverExpire: u.neverExpire, disabled: u.disabled,
        groups: M.groupsOf(st, u.name), session: M.clone(u.session), remote: M.clone(u.remote), dial: M.clone(u.dial) };
      // 일반
      const full = textIn({ value: d.full, label: '전체 이름', width: 20, onInput: v => { d.full = v; } }), desc = textIn({ value: d.desc, label: '설명', width: 20, onInput: v => { d.desc = v; } });
      const cMust = check('다음 로그온할 때 사용자가 반드시 암호를 변경해야 함', d.mustChange, c => { d.mustChange = c; sync(); });
      const cCant = check('사용자가 암호를 변경할 수 없음', d.cantChange, c => { d.cantChange = c; sync(); });
      const cNever = check('암호 사용 기간 제한 없음', d.neverExpire, c => { d.neverExpire = c; sync(); });
      const cDis = check('계정 사용 안 함', d.disabled, c => { d.disabled = c; });
      const cLock = check('계정 잠금 해제', false, null, true);
      function sync() {
        const lockOthers = d.mustChange, lockMust = d.cantChange || d.neverExpire;
        cCant.input.disabled = cNever.input.disabled = lockOthers; cCant.classList.toggle('dis', lockOthers); cNever.classList.toggle('dis', lockOthers);
        cMust.input.disabled = lockMust; cMust.classList.toggle('dis', lockMust);
      }
      sync();
      const gen = h('div', {}, h('div', { class: 'polhead' }, icon('user', 'big'), h('b', {}, u.name)), field('전체 이름:', full), field('설명:', desc), cMust, cCant, cNever, cDis, cLock);
      // 소속 그룹
      const glist = h('div');
      let gsel = null;
      const drawG = () => { glist.innerHTML = ''; glist.appendChild(listView([{ label: '소속 그룹' }], d.groups.map(g => ({ key: g, cells: [h('span', { class: 'cellic' }, icon('group'), g)] })), gsel, { select: g => { gsel = g; } }, '소속 그룹이 없습니다.')); };
      drawG();
      const mem = h('div', {}, h('p', {}, '소속 그룹:'), glist,
        h('div', { class: 'brow spread' }, h('div', { class: 'fin' },
          h('button', { type: 'button', class: 'btn', onclick: () => selectObjects(ctx, 'group', names => { names.forEach(nm => { if (!d.groups.includes(nm)) d.groups.push(nm); }); drawG(); }) }, '추가'),
          h('button', { type: 'button', class: 'btn', onclick: () => { if (gsel) { d.groups = d.groups.filter(g => g !== gsel); gsel = null; drawG(); } } }, '제거'))),
        h('p', { class: 'note' }, '사용자의 그룹 구성원 자격 변경 내용은 사용자가 다음에 로그온할 때 적용됩니다.'));
      // 세션
      const sSel = (key, label) => { const s = select(ST(), d.session[key], { label }); s.addEventListener('change', () => { d.session[key] = s.value; }); return h('div', { class: 'frow' }, h('label', { class: 'flab wide' }, label + ':'), s); };
      const ses = h('div', {}, h('p', {}, '원격 데스크톱 서비스의 시간 제한과 다시 연결 설정입니다.'), h('hr'),
        sSel('disc', '연결 끊긴 세션 끝내기'), h('hr'), sSel('active', '활성 세션 제한'), sSel('idle', '유휴 세션 제한'),
        h('p', { class: 'lab' }, '세션 제한에 도달하거나 연결이 끊어지면:'),
        radio('sol', '세션과의 연결 끊기', d.session.onLimit === 'disconnect', () => { d.session.onLimit = 'disconnect'; }), radio('sol', '세션 끝내기', d.session.onLimit === 'end', () => { d.session.onLimit = 'end'; }),
        h('hr'), h('p', { class: 'lab' }, '다시 연결 허용:'),
        radio('src', '모든 클라이언트로부터', d.session.reconnect === 'any', () => { d.session.reconnect = 'any'; }), radio('src', '원래 클라이언트로부터만', d.session.reconnect === 'orig', () => { d.session.reconnect = 'orig'; }));
      // 원격 제어
      const rPerm = check('사용자의 허가 필요', d.remote.permission, c => { d.remote.permission = c; });
      const rView = radio('rlv', '사용자 세션 보기', d.remote.level === 'view', () => { d.remote.level = 'view'; });
      const rInt = radio('rlv', '세션과 상호 작용', d.remote.level === 'interact', () => { d.remote.level = 'interact'; });
      const syncR = () => { [rPerm, rView, rInt].forEach(x => { x.input.disabled = !d.remote.enabled; x.classList.toggle('dis', !d.remote.enabled); }); };
      const rEn = check('원격 제어 가능', d.remote.enabled, c => { d.remote.enabled = c; syncR(); });
      syncR();
      const rem = h('div', {}, h('p', {}, '원격 데스크톱 서비스의 원격 제어 설정입니다.'), h('p', {}, '사용자 세션을 원격으로 제어하거나 관찰하려면 다음 확인란을 선택합니다.'),
        rEn, h('div', { class: 'indent' }, h('p', { class: 'note' }, '세션을 관찰하거나 제어할 때 사용자의 허가를 받으려면 다음 확인란을 선택합니다.'), rPerm,
          group('제어 수준', h('p', {}, '사용자 세션에 대한 제어 수준을 지정합니다.'), rView, rInt)));
      // 전화 접속 로그인
      const dial = h('div', {},
        group('네트워크 액세스 권한', radio('dna', '액세스 허용', d.dial.access === 'allow', () => { d.dial.access = 'allow'; }), radio('dna', '액세스 거부', d.dial.access === 'deny', () => { d.dial.access = 'deny'; }),
          radio('dna', 'NPS 네트워크 정책을 통해 액세스 제어', d.dial.access === 'nps', () => { d.dial.access = 'nps'; })),
        check('호출자 ID 확인', d.dial.callerId, c => { d.dial.callerId = c; }),
        group('콜백 옵션', radio('dcb', '콜백 안 함', d.dial.callback === 'none', () => { d.dial.callback = 'none'; }), radio('dcb', '호출자가 설정(라우팅 및 원격 액세스 서비스만)', d.dial.callback === 'caller', () => { d.dial.callback = 'caller'; }),
          radio('dcb', '항상 콜백', d.dial.callback === 'always', () => { d.dial.callback = 'always'; })),
        check('고정 IP 주소 할당', false, null, true), check('고정 경로 적용', false, null, true));
      function apply() {
        const s = ctx.st();
        const r = M.setUserGeneral(s, u.name, d);
        if (!r.ok) { msg({ title: u.name + ' 속성', icon: 'err', text: r.error }); return false; }
        const cur = M.groupsOf(s, u.name);
        cur.filter(g => !d.groups.includes(g)).forEach(g => M.removeUserFromGroup(s, u.name, g));
        M.addUserToGroups(s, u.name, d.groups.filter(g => !cur.includes(g)));
        M.setUserSession(s, u.name, d.session); M.setUserRemote(s, u.name, d.remote); M.setUserDial(s, u.name, d.dial);
        ctx.commit();
        return true;
      }
      dialog({ title: u.name + ' 속성', width: 42, body: tabs([
        { id: 'gen', label: '일반', body: gen }, { id: 'mem', label: '소속 그룹', body: mem }, { id: 'prof', label: '프로필', out: true }, { id: 'env', label: '환경', out: true },
        { id: 'ses', label: '세션', body: ses }, { id: 'rem', label: '원격 제어', body: rem }, { id: 'rdsp', label: '원격 데스크톱 서비스 프로필', out: true },
        { id: 'vd', label: '개인용 가상 데스크톱', out: true }, { id: 'dial', label: '전화 접속 로그인', body: dial }]),
        buttons: [{ label: '확인', primary: true, onClick: () => apply() ? undefined : false }, { label: '취소', cancel: true }, { label: '적용', keep: true, onClick: () => { apply(); } }] });
    }

    /* ------------------------------------------------ 그룹 */
    function memberEditor(members) {
      const host = h('div');
      let sel = null;
      const draw = () => { host.innerHTML = ''; host.appendChild(listView([{ label: '구성원' }], members.map(m => ({ key: m, cells: [h('span', { class: 'cellic' }, icon('user'), m)] })), sel, { select: m => { sel = m; } }, '구성원이 없습니다.')); };
      draw();
      return h('div', {}, h('p', {}, '구성원:'), host, h('div', { class: 'brow spread' }, h('div', { class: 'fin' },
        h('button', { type: 'button', class: 'btn', onclick: () => selectObjects(ctx, 'user', names => { names.forEach(n => { if (!members.includes(n)) members.push(n); }); draw(); }) }, '추가'),
        h('button', { type: 'button', class: 'btn', onclick: () => { if (sel) { members.splice(members.indexOf(sel), 1); sel = null; draw(); } } }, '제거'))));
    }
    function newGroup() {
      const members = [];
      const nm = textIn({ label: '그룹 이름', width: 20 }), desc = textIn({ label: '설명', width: 20 });
      let ed = memberEditor(members);
      const holder = h('div', {}, ed);
      dialog({ title: '새 그룹', width: 36, body: h('div', {}, field('그룹 이름:', nm), field('설명:', desc), holder),
        buttons: [{ label: '만들기', primary: true, keep: true, onClick: () => {
          const r = M.createGroup(ctx.st(), { name: nm.value, desc: desc.value, members });
          if (!r.ok) { msg({ title: '로컬 사용자 및 그룹', icon: 'err', text: r.error }); return; }
          ctx.commit(); nm.value = ''; desc.value = ''; members.length = 0; holder.innerHTML = ''; holder.appendChild(memberEditor(members)); nm.focus();
        } }, { label: '닫기', cancel: true }] });
    }
    function groupProps(n) {
      const g = M.findGroup(ctx.st(), n), members = g.members.slice();
      const desc = textIn({ value: g.desc, label: '설명', width: 24 });
      dialog({ title: g.name + ' 속성', width: 38, body: tabs([{ id: 'gen', label: '일반', body: h('div', {},
        h('div', { class: 'polhead' }, icon('group', 'big'), h('b', {}, g.name)), field('설명:', desc), memberEditor(members),
        h('p', { class: 'note' }, '사용자의 그룹 구성원 자격 변경 내용은 사용자가 다음에 로그온할 때 적용됩니다.')) }]),
        buttons: [{ label: '확인', primary: true, onClick: () => { const r = M.setGroup(ctx.st(), g.name, { desc: desc.value, members }); if (!r.ok) { msg({ title: '로컬 사용자 및 그룹', icon: 'err', text: r.error }); return false; } ctx.commit(); } }, { label: '취소', cancel: true }] });
    }

    return { el, render };
  }

  WS.tools.users = { id: 'users', title: '컴퓨터 관리', icon: 'comp', create };
})(window);
