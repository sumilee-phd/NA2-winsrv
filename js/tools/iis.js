/* IIS(인터넷 정보 서비스) 관리자: 연결 트리 | 기능 보기·기능 페이지 | 작업 창
 * 웹 사이트 추가 · 바인딩 · 고급 설정 · 기본 문서 · 디렉터리 검색 · 오류 페이지 · 인증 · IP 주소 및 도메인 제한 · SMTP 전자 메일
 * FTP 사이트 추가 마법사 · 고급 설정 · FTP 디렉터리 검색 · FTP 방화벽 지원 · FTP 메시지 · FTP 인증 · FTP 권한 부여 규칙
 * 입력형 기능 페이지(FTP 디렉터리 검색·방화벽 지원·메시지, SMTP 전자 메일)는 「적용」을 누르거나, 다른 항목으로 옮길 때 뜨는
 * 「변경 내용을 저장하시겠습니까?」에서 「예」를 눌러야 저장된다. 창을 그냥 닫으면 저장되지 않는다.
 */
(function (G) {
  'use strict';
  const WS = G.WS, M = G.WSModel;
  const { h, icon, menu, dialog, msg, toast, textIn, radio, check, group, tabs, tree, listView, field, select } = WS.ui;
  const TK = WS.toolkit;

  const WEB_FEATS = [
    { key: 'docs', label: '기본 문서' }, { key: 'dirb', label: '디렉터리 검색' }, { key: 'errors', label: '오류 페이지' },
    { key: 'auth', label: '인증' }, { key: 'ipr', label: 'IP 주소 및 도메인 제한' }, { key: 'smtp', label: 'SMTP 전자 메일' },
    { key: 'x1', label: 'HTTP 응답 헤더', out: true }, { key: 'x2', label: 'MIME 형식', out: true }, { key: 'x3', label: '로깅', out: true },
    { key: 'x4', label: '압축', out: true }, { key: 'x5', label: '처리기 매핑', out: true }, { key: 'x6', label: 'SSL 설정', out: true }, { key: 'x7', label: '요청 필터링', out: true },
  ];
  const FTP_FEATS = [
    { key: 'fdir', label: 'FTP 디렉터리 검색' }, { key: 'fmsg', label: 'FTP 메시지' }, { key: 'ffw', label: 'FTP 방화벽 지원' },
    { key: 'fauth', label: 'FTP 인증' }, { key: 'fauthz', label: 'FTP 권한 부여 규칙' },
    { key: 'y1', label: 'FTP IP 주소 및 도메인 제한', out: true }, { key: 'y2', label: 'FTP SSL 설정', out: true }, { key: 'y3', label: 'FTP 로깅', out: true },
    { key: 'y4', label: 'FTP 사용자 격리', out: true }, { key: 'y5', label: 'FTP 요청 필터링', out: true }, { key: 'y6', label: 'FTP 현재 세션', out: true },
  ];
  const FORM_FEATS = { fdir: 1, fmsg: 1, ffw: 1, smtp: 1 };
  const featLabel = k => (WEB_FEATS.concat(FTP_FEATS).find(f => f.key === k) || {}).label;

  function create(ctx) {
    const ui = { sel: 'srv', open: new Set(['srv', 'sites']), feat: null, row: null };
    let pending = null;      // {siteId, feat, draft, base, save()}
    const el = h('div', { class: 'tool tool-iis' });
    let center = null, actions = null;
    const site = () => { const m = /^s:(\d+)$/.exec(ui.sel || ''); return m ? M.siteById(ctx.st(), +m[1]) : null; };
    const dirty = () => pending && JSON.stringify(pending.draft) !== JSON.stringify(pending.base);

    function nodes() {
      const st = ctx.st();
      return [{ id: 'srv', label: st.server, icon: 'server', kids: [
        { id: 'pools', label: '응용 프로그램 풀', icon: 'folder' },
        { id: 'sites', label: '사이트', icon: 'folder', kids: st.iis.sites.map(s => ({ id: 's:' + s.id, label: s.name, icon: s.kind === 'ftp' ? 'ftp' : 'site', dim2: !s.started })) },
      ] }];
    }
    /* 저장 확인: 입력형 기능 페이지에서 벗어날 때 */
    function leave(then) {
      if (!dirty()) { pending = null; then(); return; }
      msg({ title: '메시지', icon: 'warn', text: '변경 내용이 손실됩니다. 변경 내용을 저장하시겠습니까?', buttons: ['예', '아니요'] }).then(b => {
        if (b === '예') {
          const r = pending.save();
          if (r && r.ok === false) { msg({ title: 'IIS 관리자', icon: 'err', text: r.error }); return; }
          ctx.commit();
        }
        pending = null;
        then();
      });
    }
    function render() {
      if (ui.sel && /^s:/.test(ui.sel) && !site()) { ui.sel = 'sites'; ui.feat = null; }
      el.innerHTML = '';
      el.appendChild(TK.menubar([{ label: '파일', out: true }, { label: '보기', out: true }, { label: '도움말', out: true }]));
      const t = tree(nodes(), ui, {
        reselect: true,
        select: () => leave(() => { ui.feat = null; ui.row = null; renderCenter(); }),
        context: (id, at) => menu(at, nodeMenu(id)),
        refresh: render,
      });
      center = h('div', { class: 'iis-center' });
      actions = h('aside', { class: 'iis-actions', 'aria-label': '작업' });
      el.appendChild(h('div', { class: 'split3' }, h('div', { class: 'pane-l' }, h('div', { class: 'pane-cap' }, '연결'), t), center, actions));
      renderCenter();
    }
    function act(title, items) {
      actions.appendChild(h('div', { class: 'act-h' }, title));
      items.forEach(it => {
        if (!it) return;
        const b = h('button', { type: 'button', class: 'act' + (it.out ? ' out' : ''), disabled: !!(it.out || it.disabled), title: it.out ? WS.ui.OUT_TIP : '', onclick: it.onClick }, it.label);
        actions.appendChild(b);
      });
    }
    function renderCenter() {
      const st = ctx.st(), s = site();
      center.innerHTML = ''; actions.innerHTML = '';
      if (ui.sel === 'srv') {
        center.appendChild(h('div', { class: 'iis-head' }, icon('server', 'big'), h('h3', {}, st.server + ' 홈')));
        center.appendChild(TK.info(null, '서버 수준 기능은 이 연습에서 다루지 않습니다.', '왼쪽 「사이트」를 마우스 오른쪽 단추로 누르면 「웹 사이트 추가」와 「FTP 사이트 추가」가 있습니다.'));
        act('작업', [{ label: '관리: 다시 시작', out: true }, { label: '시작', out: true }, { label: '중지', out: true }]);
        return;
      }
      if (ui.sel === 'pools') {
        const pools = ['DefaultAppPool'].concat(st.iis.sites.filter(x => x.kind === 'web' && x.pool !== 'DefaultAppPool').map(x => x.pool));
        center.appendChild(h('div', { class: 'iis-head' }, icon('folder', 'big'), h('h3', {}, '응용 프로그램 풀')));
        center.appendChild(listView([{ label: '이름', w: '40%' }, { label: '상태', w: '20%' }, { label: '.NET CLR 버전' }], pools.map(p => ({ key: p, cells: [p, '시작됨', 'v4.0'] })), null, {}));
        act('작업', [{ label: '응용 프로그램 풀 추가', out: true }]);
        return;
      }
      if (ui.sel === 'sites') {
        center.appendChild(h('div', { class: 'iis-head' }, icon('folder', 'big'), h('h3', {}, '사이트')));
        center.appendChild(listView([{ label: '이름', w: '24%' }, { label: 'ID', w: '7%' }, { label: '상태', w: '13%' }, { label: '바인딩', w: '34%' }, { label: '경로' }],
          st.iis.sites.map(x => ({ key: x.id, cells: [h('span', { class: 'cellic' }, icon(x.kind === 'ftp' ? 'ftp' : 'site'), x.name), String(x.id), x.started ? '시작됨' + (x.kind === 'ftp' ? '(ftp)' : '(http)') : '중지됨', x.bindings.map(M.bindText).join(', '), x.path] })),
          null, { dbl: id => { ui.sel = 's:' + id; render(); }, context: (id, at) => menu(at, siteMenu(M.siteById(ctx.st(), id))) }));
        act('작업', [{ label: '웹 사이트 추가...', onClick: addWeb }, { label: 'FTP 사이트 추가...', onClick: addFtp }, { label: '웹 사이트 기본값 설정...', out: true }]);
        return;
      }
      if (s && !ui.feat) { featureView(s); return; }
      if (s && ui.feat) { featurePage(s); return; }
      center.appendChild(TK.OUT_NODE());
    }

    /* ------------------------------------------------ 기능 보기 */
    function featureView(s) {
      const feats = s.kind === 'ftp' ? FTP_FEATS : WEB_FEATS;
      center.appendChild(h('div', { class: 'iis-head' }, icon(s.kind === 'ftp' ? 'ftp' : 'site', 'big'), h('h3', {}, s.name + ' 홈')));
      center.appendChild(h('p', { class: 'tool-hint' }, '기능 아이콘을 두 번 누르면 기능 페이지가 열립니다.'));
      const grid = h('div', { class: 'feats', role: 'listbox', 'aria-label': '기능' });
      feats.forEach(f => {
        const b = h('div', { class: 'feat' + (f.out ? ' out' : ''), role: 'option', tabindex: 0, title: f.out ? WS.ui.OUT_TIP : '', 'data-feat': f.key }, icon(f.key.startsWith('f') || f.key === 'docs' || f.key === 'errors' ? 'doc' : 'feat', 'big'), h('span', {}, f.label));
        const openF = () => { if (f.out) { toast(f.label + ': ' + WS.ui.OUT_TIP); return; } ui.feat = f.key; ui.row = null; renderCenter(); };
        b.addEventListener('mousedown', () => { grid.querySelectorAll('.feat.sel').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); });
        b.addEventListener('dblclick', openF);
        b.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); openF(); } });
        grid.appendChild(b);
      });
      center.appendChild(grid);
      siteActions(s);
    }
    function siteActions(s) {
      const web = s.kind === 'web';
      act('작업', [{ label: '탐색', out: true }, { label: '사용 권한 편집...', out: true }]);
      act('사이트 편집', [{ label: '바인딩...', onClick: () => bindings(s.id) }, { label: '기본 설정...', out: true }]);
      act(web ? '웹 사이트 관리' : 'FTP 사이트 관리', [
        { label: '다시 시작', onClick: () => restart(s.id) },
        { label: '시작', disabled: s.started, onClick: () => start(s.id) },
        { label: '중지', disabled: !s.started, onClick: () => stop(s.id) },
        web ? { label: '찾아보기', out: true } : null,
        { label: '고급 설정...', onClick: () => advanced(s.id) },
      ]);
    }
    function nodeMenu(id) {
      if (id === 'sites') return [{ label: '웹 사이트 추가...', onClick: () => leave(addWeb) }, { label: 'FTP 사이트 추가...', onClick: () => leave(addFtp) }, { sep: true }, { label: '새로 고침', onClick: render }];
      const m = /^s:(\d+)$/.exec(id);
      if (m) return siteMenu(M.siteById(ctx.st(), +m[1]));
      if (id === 'srv') return [{ label: '시작', out: true }, { label: '중지', out: true }, { sep: true }, { label: '새로 고침', onClick: render }];
      return [{ label: '새로 고침', onClick: render }];
    }
    function siteMenu(s) {
      const web = s.kind === 'web';
      return [
        { label: '탐색', out: true }, { label: '사용 권한 편집...', out: true }, { sep: true },
        web ? { label: '응용 프로그램 추가...', out: true } : null, { label: '가상 디렉터리 추가...', out: true },
        { label: '바인딩 편집...', onClick: () => bindings(s.id) },
        { label: web ? '웹 사이트 관리' : 'FTP 사이트 관리', sub: [
          { label: '다시 시작', onClick: () => restart(s.id) },
          { label: '시작', disabled: s.started, onClick: () => start(s.id) },
          { label: '중지', disabled: !s.started, onClick: () => stop(s.id) },
          web ? { sep: true } : null, web ? { label: '찾아보기', out: true } : null,
          { sep: true }, { label: '고급 설정...', onClick: () => advanced(s.id) },
        ] },
        { sep: true }, { label: '새로 고침', onClick: render }, { label: '제거', onClick: () => remove(s.id) }, { sep: true }, { label: '이름 바꾸기', out: true },
      ];
    }
    function start(id) { const r = M.siteStart(ctx.st(), id); if (!r.ok) { msg({ title: 'IIS 관리자', icon: 'err', text: r.error }); return; } ctx.commit(); }
    function stop(id) { M.siteStop(ctx.st(), id); ctx.commit(); }
    function restart(id) { M.siteStop(ctx.st(), id); start(id); }
    function remove(id) {
      const s = M.siteById(ctx.st(), id);
      msg({ title: '제거 확인', icon: 'q', text: '사이트 ' + s.name + '을(를) 제거하시겠습니까?', buttons: ['예', '아니요'], def: 1 })
        .then(b => { if (b === '예') { M.siteRemove(ctx.st(), id); ui.sel = 'sites'; ui.feat = null; pending = null; ctx.commit(); } });
    }

    /* ------------------------------------------------ 기능 페이지 */
    function pageHead(s, title) {
      center.appendChild(h('div', { class: 'iis-head' }, icon('doc', 'big'), h('h3', {}, title)));
    }
    function formPage(s, key, base, build, save) {
      if (!pending || pending.siteId !== s.id || pending.feat !== key) pending = { siteId: s.id, feat: key, base: M.clone(base), draft: M.clone(base), save: () => save(pending.draft) };
      const d = pending.draft;
      center.appendChild(build(d));
      act('작업', [
        { label: '적용', onClick: () => { const r = pending.save(); if (r && r.ok === false) { msg({ title: 'IIS 관리자', icon: 'err', text: r.error }); return; } pending.base = M.clone(pending.draft); ctx.commit(); toast('변경 내용을 저장했습니다.'); } },
        { label: '취소', onClick: () => { pending = null; renderCenter(); } },
        { label: '기능 보기로 돌아가기', onClick: () => leave(() => { ui.feat = null; renderCenter(); }) },
      ]);
    }
    function featurePage(s) {
      const id = s.id, k = ui.feat;
      pageHead(s, featLabel(k));
      const back = { label: '기능 보기로 돌아가기', onClick: () => leave(() => { ui.feat = null; renderCenter(); }) };
      if (k === 'docs') {
        center.appendChild(h('p', { class: 'tool-hint' }, '클라이언트가 파일 이름 없이 요청할 때 보낼 기본 파일입니다. 위에 있는 파일부터 찾습니다.'));
        center.appendChild(listView([{ label: '이름', w: '60%' }, { label: '항목 유형' }], s.docs.map((d, i) => ({ key: i, cells: [d, '로컬'] })), ui.row, {
          select: i => { ui.row = i; drawDocActs(); }, context: (i, at) => { ui.row = i; menu(at, docMenu(i)); } }, '기본 문서가 없습니다.'));
        const drawDocActs = () => { actions.innerHTML = ''; act('작업', [{ label: '추가...', onClick: () => addDoc(id) }, { label: '제거', disabled: ui.row == null, onClick: () => delDoc(id, ui.row) },
          { label: '위로 이동', disabled: ui.row == null || ui.row === 0, onClick: () => moveDoc(id, ui.row, -1) }, { label: '아래로 이동', disabled: ui.row == null || ui.row >= M.siteById(ctx.st(), id).docs.length - 1, onClick: () => moveDoc(id, ui.row, 1) }, back]); };
        drawDocActs();
        return;
      }
      if (k === 'dirb') {
        center.appendChild(h('p', {}, '디렉터리 검색 상태: ', h('b', {}, s.dirBrowse ? '사용' : '사용 안 함')));
        center.appendChild(h('p', { class: 'tool-hint' }, '사용하면 기본 문서가 없을 때 디렉터리의 파일 목록을 보여 줍니다.'));
        act('작업', [{ label: '사용', disabled: s.dirBrowse, onClick: () => { M.setWebDirBrowse(ctx.st(), id, true); ctx.commit(); } }, { label: '사용 안 함', disabled: !s.dirBrowse, onClick: () => { M.setWebDirBrowse(ctx.st(), id, false); ctx.commit(); } }, back]);
        return;
      }
      if (k === 'auth' || k === 'fauth') {
        const rows = k === 'auth'
          ? [['anon', '익명 인증'], ['basic', '기본 인증'], ['windows', 'Windows 인증'], ['x', 'ASP.NET 가장'], ['y', '폼 인증']]
          : [['anon', '익명 인증'], ['basic', '기본 인증'], ['x', 'ASP.NET 인증'], ['y', '사용자 지정 인증']];
        center.appendChild(listView([{ label: '이름', w: '50%' }, { label: '상태' }],
          rows.map(r => ({ key: r[0], cells: [r[1], r[0] in s.auth ? (s.auth[r[0]] ? '사용' : '사용 안 함') : '사용 안 함'], cls: r[0] in s.auth ? '' : 'dimrow' })), ui.row, {
            select: key => { ui.row = key; drawAuthActs(); }, context: (key, at) => { ui.row = key; menu(at, authMenu(key)); } }));
        const authMenu = key => {
          if (!(key in s.auth)) return [{ label: '사용', out: true }];
          const on = M.siteById(ctx.st(), id).auth[key];
          return [{ label: on ? '사용 안 함' : '사용', onClick: () => { M.setAuth(ctx.st(), id, key, !on); ctx.commit(); } }, { label: '편집...', out: true }];
        };
        const drawAuthActs = () => { actions.innerHTML = ''; const key = ui.row; act('작업', key && key in s.auth ? authMenu(key).concat([back]) : [back]); };
        drawAuthActs();
        return;
      }
      if (k === 'ipr') {
        center.appendChild(h('p', { class: 'tool-hint' }, '지정되지 않은 클라이언트에 대한 액세스: ' + (s.ipDefault === 'allow' ? '허용' : '거부')));
        center.appendChild(listView([{ label: '모드', w: '18%' }, { label: '요청자', w: '50%' }, { label: '항목 유형' }],
          s.ipRules.map((r, i) => ({ key: i, cells: [r.mode === 'allow' ? '허용' : '거부', r.ip + (r.mask ? ' (' + r.mask + ')' : ''), '로컬'] })), ui.row, {
            select: i => { ui.row = i; drawIpActs(); }, context: (i, at) => { ui.row = i; menu(at, [{ label: '제거', onClick: () => delIp(id, i) }]); } }, '등록한 항목이 없습니다.'));
        const drawIpActs = () => { actions.innerHTML = ''; act('작업', [{ label: '허용 항목 추가...', onClick: () => addIp(id, 'allow') }, { label: '거부 항목 추가...', onClick: () => addIp(id, 'deny') },
          { label: '제거', disabled: ui.row == null, onClick: () => delIp(id, ui.row) }, { label: '기능 설정 편집...', onClick: () => ipSettings(id) }, back]); };
        drawIpActs();
        return;
      }
      if (k === 'errors') {
        const typeText = { file: '파일', url: 'URL 실행', redirect: '리디렉션' };
        center.appendChild(listView([{ label: '상태 코드', w: '14%' }, { label: '경로', w: '60%' }, { label: '형식' }],
          s.errors.map(e => ({ key: e.code, cells: [String(e.code), e.path, typeText[e.mode]] })), ui.row, {
            select: c => { ui.row = c; drawErrActs(); }, dbl: c => editError(id, c), context: (c, at) => { ui.row = c; menu(at, [{ label: '편집...', onClick: () => editError(id, c) }, { label: '제거', onClick: () => { M.errorRemove(ctx.st(), id, c); ui.row = null; ctx.commit(); } }]); } }));
        const drawErrActs = () => { actions.innerHTML = ''; act('작업', [{ label: '추가...', onClick: () => editError(id, null) }, { label: '편집...', disabled: ui.row == null, onClick: () => editError(id, ui.row) },
          { label: '제거', disabled: ui.row == null, onClick: () => { M.errorRemove(ctx.st(), id, ui.row); ui.row = null; ctx.commit(); } }, { label: '기능 설정 편집...', out: true }, back]); };
        drawErrActs();
        return;
      }
      if (k === 'fauthz') {
        center.appendChild(listView([{ label: '모드', w: '14%' }, { label: '사용자', w: '28%' }, { label: '역할', w: '28%' }, { label: '사용 권한' }],
          s.authz.map((r, i) => ({ key: i, cells: [r.mode === 'allow' ? '허용' : '거부', r.who === 'roles' ? '' : M.authzText(r), r.who === 'roles' ? r.value : '', M.permText(r)] })), ui.row, {
            select: i => { ui.row = i; drawAzActs(); }, context: (i, at) => { ui.row = i; menu(at, [{ label: '제거', onClick: () => { M.ftpAuthzRemove(ctx.st(), id, i); ui.row = null; ctx.commit(); } }]); } }, '권한 부여 규칙이 없습니다.'));
        const drawAzActs = () => { actions.innerHTML = ''; act('작업', [{ label: '허용 규칙 추가...', onClick: () => addAuthz(id, 'allow') }, { label: '거부 규칙 추가...', onClick: () => addAuthz(id, 'deny') },
          { label: '제거', disabled: ui.row == null, onClick: () => { M.ftpAuthzRemove(ctx.st(), id, ui.row); ui.row = null; ctx.commit(); } }, back]); };
        drawAzActs();
        return;
      }
      if (k === 'fdir') {
        formPage(s, k, s.dirBrowse, d => h('div', { class: 'formpage' },
          group('디렉터리 목록 스타일', radio('fds', 'MS-DOS', d.style === 'MS-DOS', () => { d.style = 'MS-DOS'; }), radio('fds', 'UNIX', d.style === 'UNIX', () => { d.style = 'UNIX'; })),
          group('디렉터리 목록 옵션', h('p', {}, '디렉터리 목록에 다음 정보 표시:'),
            check('가상 디렉터리', d.virtualDirs, c => { d.virtualDirs = c; }), check('사용 가능한 바이트 수', d.bytes, c => { d.bytes = c; }), check('4자리 연도', d.year4, c => { d.year4 = c; }))),
          d => M.ftpSetDirBrowse(ctx.st(), id, d));
        return;
      }
      if (k === 'ffw') {
        formPage(s, k, s.firewall, d => {
          const ip = textIn({ value: d.extIp, label: '방화벽의 외부 IP 주소', width: 16, onInput: v => { d.extIp = v; } });
          return h('div', { class: 'formpage' },
            h('p', {}, '외부 방화벽 뒤의 FTP 서버가 수동(PASV) 연결을 받도록 설정합니다.'),
            h('label', { class: 'flab' }, '데이터 채널 포트 범위:'), textIn({ value: '0-0', label: '데이터 채널 포트 범위', width: 10, disabled: true }),
            h('p', { class: 'note' }, '예: 5000-6000. 포트 범위는 서버 수준에서만 바꿀 수 있습니다.'),
            h('label', { class: 'flab' }, '방화벽의 외부 IP 주소:'), ip, h('p', { class: 'note' }, '예: 10.0.0.1'));
        }, d => M.ftpSetFirewall(ctx.st(), id, d));
        return;
      }
      if (k === 'fmsg') {
        formPage(s, k, s.msg, d => {
          const ta = (key, label) => { const t = h('textarea', { class: 'tarea', rows: 2, 'aria-label': label }); t.value = d[key]; t.addEventListener('input', () => { d[key] = t.value; }); return h('div', {}, h('label', { class: 'flab' }, label + ':'), t); };
          return h('div', { class: 'formpage' },
            group('메시지 동작', check('기본 배너 표시 안 함', d.noBanner, c => { d.noBanner = c; }), check('사용자 변수 지원', d.allowVars, c => { d.allowVars = c; }), check('로컬 요청에 대한 자세한 메시지 표시', d.detailed, c => { d.detailed = c; })),
            group('메시지 텍스트', ta('banner', '배너'), ta('welcome', '시작'), ta('exit', '끝내기'), ta('maxConn', '최대 연결 수')));
        }, d => M.ftpSetMsg(ctx.st(), id, d));
        return;
      }
      if (k === 'smtp') {
        formPage(s, k, s.smtp, d => {
          const to = textIn({ value: d.to, label: '전자 메일 주소', width: 20, onInput: v => { d.to = v; } });
          const srv = textIn({ value: d.server, label: 'SMTP 서버', width: 18, onInput: v => { d.server = v; }, disabled: d.localhost || d.pickup });
          const lh = check('localhost 사용', d.localhost, c => { d.localhost = c; srv.disabled = c; }, d.pickup);
          const port = textIn({ value: String(d.port), label: '포트', width: 5, onInput: v => { d.port = v; } });
          const dir = textIn({ value: d.pickupDir, label: '픽업 디렉터리', width: 20, onInput: v => { d.pickupDir = v; }, disabled: !d.pickup });
          return h('div', { class: 'formpage' },
            h('p', {}, 'System.Net.Mail API로 전자 메일을 보낼 때 쓰는 설정입니다.'),
            h('label', { class: 'flab' }, '전자 메일 주소:'), to,
            radio('smtpm', 'SMTP 서버로 전자 메일 보내기', !d.pickup, () => { d.pickup = false; renderCenter(); }),
            h('div', { class: 'indent' }, h('label', { class: 'flab' }, 'SMTP 서버:'), srv, lh, h('label', { class: 'flab' }, '포트:'), port,
              group('인증 설정', radio('smtpa', '인증이 필요하지 않음', true, null), radio('smtpa', 'Windows', false, null, true), radio('smtpa', '자격 증명 지정', false, null, true))),
            radio('smtpm', '픽업 디렉터리에 전자 메일 저장', d.pickup, () => { d.pickup = true; renderCenter(); }),
            h('div', { class: 'indent' }, dir));
        }, d => M.smtpSet(ctx.st(), id, d));
        return;
      }
      center.appendChild(TK.OUT_NODE());
    }
    function docMenu(i) { const id = site().id; return [{ label: '제거', onClick: () => delDoc(id, i) }, { label: '위로 이동', onClick: () => moveDoc(id, i, -1) }, { label: '아래로 이동', onClick: () => moveDoc(id, i, 1) }]; }
    function addDoc(id) {
      const n = textIn({ label: '이름', width: 18 });
      dialog({ title: '기본 문서 추가', width: 28, body: h('div', {}, field('이름:', n), h('p', { class: 'note' }, '예: index.html')),
        buttons: [{ label: '확인', primary: true, onClick: () => { const r = M.docAdd(ctx.st(), id, n.value); if (!r.ok) { msg({ title: '기본 문서 추가', icon: 'err', text: r.error }); return false; } ui.row = 0; ctx.commit(); } }, { label: '취소', cancel: true }] });
    }
    function delDoc(id, i) {
      if (i == null) return;
      msg({ title: '제거 확인', icon: 'q', text: '선택한 항목(' + M.siteById(ctx.st(), id).docs[i] + ')을 제거하시겠습니까?', buttons: ['예', '아니요'] })
        .then(b => { if (b === '예') { M.docRemove(ctx.st(), id, i); ui.row = null; ctx.commit(); } });
    }
    function moveDoc(id, i, d) { if (i == null) return; M.docMove(ctx.st(), id, i, d); ui.row = Math.max(0, Math.min(M.siteById(ctx.st(), id).docs.length - 1, i + d)); ctx.commit(); }
    function addIp(id, mode) {
      let range = false;
      const ip1 = textIn({ label: '특정 IPv4 주소', width: 16 }), ip2 = textIn({ label: 'IPv4 주소 범위', width: 16, disabled: true }), mk = textIn({ label: '마스크 또는 접두사', width: 16, disabled: true });
      const sync = () => { ip1.disabled = range; ip2.disabled = mk.disabled = !range; };
      dialog({ title: (mode === 'allow' ? '허용' : '거부') + ' 제한 규칙 추가', width: 30, body: h('div', { class: 'stack' },
        h('p', {}, (mode === 'allow' ? '다음 IPv4 주소 또는 도메인 이름에 대한 액세스 허용:' : '다음 IPv4 주소 또는 도메인 이름에 대한 액세스 거부:')),
        radio('ipm', '특정 IPv4 주소', true, () => { range = false; sync(); }), h('div', { class: 'indent' }, ip1),
        radio('ipm', 'IPv4 주소 범위', false, () => { range = true; sync(); }), h('div', { class: 'indent' }, ip2, h('label', { class: 'flab' }, '마스크 또는 접두사:'), mk)),
        buttons: [{ label: '확인', primary: true, onClick: () => {
          const r = M.ipRuleAdd(ctx.st(), id, { mode, range, ip: range ? ip2.value : ip1.value, mask: mk.value });
          if (!r.ok) { msg({ title: 'IP 주소 및 도메인 제한', icon: 'err', text: r.error }); return false; }
          ctx.commit();
        } }, { label: '취소', cancel: true }] });
    }
    function delIp(id, i) { if (i == null) return; M.ipRuleRemove(ctx.st(), id, i); ui.row = null; ctx.commit(); }
    function ipSettings(id) {
      const s = M.siteById(ctx.st(), id);
      const sel = select(['허용', '거부'], s.ipDefault === 'allow' ? '허용' : '거부', { label: '지정되지 않은 클라이언트에 대한 액세스' });
      dialog({ title: 'IP 및 도메인 제한 설정 편집', width: 30, body: h('div', {}, field('지정되지 않은 클라이언트에 대한 액세스:', sel)),
        buttons: [{ label: '확인', primary: true, onClick: () => { M.ipDefaultSet(ctx.st(), id, sel.value === '허용' ? 'allow' : 'deny'); ctx.commit(); } }, { label: '취소', cancel: true }] });
    }
    function editError(id, code) {
      const s = M.siteById(ctx.st(), id), e = code != null ? s.errors.find(x => x.code === code) : null;
      let mode = e ? e.mode : 'file';
      const cd = textIn({ value: e ? String(e.code) : '', label: '상태 코드', width: 6, readonly: !!e });
      const p1 = textIn({ value: e && e.mode === 'file' ? e.path : '', label: '파일 경로', width: 24 });
      const p2 = textIn({ value: e && e.mode === 'url' ? e.path : '', label: '이 사이트에서 실행할 URL', width: 24 });
      const p3 = textIn({ value: e && e.mode === 'redirect' ? e.path : '', label: '절대 URL', width: 24 });
      const sync = () => { p1.disabled = mode !== 'file'; p2.disabled = mode !== 'url'; p3.disabled = mode !== 'redirect'; };
      sync();
      dialog({ title: e ? '사용자 지정 오류 페이지 편집' : '사용자 지정 오류 페이지 추가', width: 36, body: h('div', { class: 'stack' },
        h('label', { class: 'flab' }, '상태 코드:'), cd, h('p', { class: 'note' }, '예: 404'),
        h('b', {}, '응답 동작'),
        radio('erm', '정적 파일의 콘텐츠를 오류 응답에 삽입', mode === 'file', () => { mode = 'file'; sync(); }), h('div', { class: 'indent' }, h('label', { class: 'flab' }, '파일 경로:'), p1),
        radio('erm', '이 사이트에서 URL 실행', mode === 'url', () => { mode = 'url'; sync(); }), h('div', { class: 'indent' }, h('label', { class: 'flab' }, 'URL(사이트 루트 기준):'), p2, h('p', { class: 'note' }, '예: /ErrorPages/404.aspx')),
        radio('erm', '302 리디렉션으로 응답', mode === 'redirect', () => { mode = 'redirect'; sync(); }), h('div', { class: 'indent' }, h('label', { class: 'flab' }, '절대 URL:'), p3, h('p', { class: 'note' }, '예: http://www.example.test/404.htm'))),
        buttons: [{ label: '확인', primary: true, onClick: () => {
          const r = M.errorSet(ctx.st(), id, cd.value, { mode, path: mode === 'file' ? p1.value : mode === 'url' ? p2.value : p3.value });
          if (!r.ok) { msg({ title: '오류 페이지', icon: 'err', text: r.error }); return false; }
          ctx.commit();
        } }, { label: '취소', cancel: true }] });
    }
    function addAuthz(id, mode) {
      let who = 'all', read = false, write = false;
      const rv = textIn({ label: '역할 또는 사용자 그룹', width: 18, disabled: true }), uv = textIn({ label: '사용자', width: 18, disabled: true });
      const sync = () => { rv.disabled = who !== 'roles'; uv.disabled = who !== 'users'; };
      dialog({ title: (mode === 'allow' ? '허용' : '거부') + ' 권한 부여 규칙 추가', width: 32, body: h('div', { class: 'stack' },
        h('b', {}, '다음 사용자에게 이 규칙 적용:'),
        radio('azw', '모든 사용자', true, () => { who = 'all'; sync(); }), radio('azw', '모든 익명 사용자', false, () => { who = 'anon'; sync(); }),
        radio('azw', '지정한 역할 또는 사용자 그룹', false, () => { who = 'roles'; sync(); }), h('div', { class: 'indent' }, rv),
        radio('azw', '지정한 사용자', false, () => { who = 'users'; sync(); }), h('div', { class: 'indent' }, uv),
        group('사용 권한', check('읽기', false, c => { read = c; }), check('쓰기', false, c => { write = c; }))),
        buttons: [{ label: '확인', primary: true, onClick: () => {
          const r = M.ftpAuthzAdd(ctx.st(), id, { mode, who, value: who === 'roles' ? rv.value : uv.value, read, write });
          if (!r.ok) { msg({ title: 'FTP 권한 부여 규칙', icon: 'err', text: r.error }); return false; }
          ctx.commit();
        } }, { label: '취소', cancel: true }] });
    }

    /* ------------------------------------------------ 웹 사이트 추가 */
    function ipOptions() {
      const st = ctx.st();
      return ['지정하지 않은 모든 IP'].concat(st.net.adapters.filter(a => !a.v4.auto && a.v4.ip).map(a => a.v4.ip));
    }
    function ipCombo(value, label) {
      const id = 'dl' + Math.random().toString(36).slice(2, 7);
      const inp = h('input', { type: 'text', class: 'tin', list: id, value: value, 'aria-label': label, autocomplete: 'off', spellcheck: false, style: { width: '14em' } });
      return h('span', { class: 'combo' }, inp, h('datalist', { id }, ipOptions().map(o => h('option', { value: o }))));
    }
    function addWeb() {
      const name = textIn({ label: '사이트 이름', width: 14 });
      const pool = textIn({ label: '응용 프로그램 풀', width: 14, readonly: true });
      name.addEventListener('input', () => { pool.value = name.value; });
      const path = textIn({ label: '실제 경로', width: 24 });
      const type = select(['http', 'https'], 'http', { label: '종류' });
      const ipc = ipCombo('지정하지 않은 모든 IP', 'IP 주소'), ip = ipc.querySelector('input');
      const port = textIn({ value: '80', label: '포트', width: 5 });
      type.addEventListener('change', () => { if (type.value === 'https' && port.value === '80') port.value = '443'; else if (type.value === 'http' && port.value === '443') port.value = '80'; });
      const host = textIn({ label: '호스트 이름', width: 22 });
      const startNow = check('웹 사이트 즉시 시작', true, null);
      const body = h('div', { class: 'addweb' },
        h('div', { class: 'row2' }, h('div', {}, h('label', { class: 'flab' }, '사이트 이름:'), name), h('div', {}, h('label', { class: 'flab' }, '응용 프로그램 풀:'), h('div', { class: 'fin' }, pool, h('button', { type: 'button', class: 'btn', disabled: true, title: WS.ui.OUT_TIP }, '선택')))),
        group('콘텐츠 디렉터리', h('label', { class: 'flab' }, '실제 경로:'), h('div', { class: 'fin' }, path, h('button', { type: 'button', class: 'btn', disabled: true, title: WS.ui.OUT_TIP }, '...')),
          h('div', { class: 'fin' }, h('span', {}, '통과 인증'), h('button', { type: 'button', class: 'btn', disabled: true, title: WS.ui.OUT_TIP }, '연결 계정'), h('button', { type: 'button', class: 'btn', disabled: true, title: WS.ui.OUT_TIP }, '설정 테스트'))),
        group('바인딩',
          h('div', { class: 'row3' }, h('div', {}, h('label', { class: 'flab' }, '종류:'), type), h('div', {}, h('label', { class: 'flab' }, 'IP 주소:'), ipc), h('div', {}, h('label', { class: 'flab' }, '포트:'), port)),
          h('label', { class: 'flab' }, '호스트 이름:'), host, h('p', { class: 'note' }, '예: www.example.test 또는 sales.example.test')),
        startNow);
      const p = () => ({ name: name.value, path: path.value, type: type.value, ip: ip.value, port: port.value.trim(), host: host.value, start: startNow.input.checked });
      const d = dialog({ title: '웹 사이트 추가', width: 40, body, buttons: [
        { label: '확인', primary: true, onClick: () => {
          const r = M.addWebSite(ctx.st(), p());
          if (r.error) { msg({ title: '웹 사이트 추가', icon: 'err', text: r.error }); return false; }
          if (r.conflict) {
            msg({ title: '웹 사이트 추가', icon: 'warn', text: ['이 웹 사이트의 바인딩이 실행 중인 사이트 「' + r.conflict + '」의 바인딩과 같습니다.', '계속하면 이 사이트는 중지된 상태로 만들어집니다. 계속하시겠습니까?'], buttons: ['예', '아니요'], def: 1 })
              .then(b => { if (b === '예') { const r2 = M.addWebSite(ctx.st(), p(), true); done(r2); d.close('확인'); } });
            return false;
          }
          done(r);
        } }, { label: '취소', cancel: true }] });
      function done(r) { ui.sel = 's:' + r.id; ui.feat = null; ui.open.add('sites'); ctx.commit(); }
    }

    /* ------------------------------------------------ FTP 사이트 추가 마법사 */
    function addFtp() {
      const w = { name: '', path: '', ip: '지정하지 않은 모든 IP', port: '21', vhostOn: false, host: '', autoStart: true, ssl: 'require', cert: '', anon: false, basic: false, who: '', whoValue: '', read: false, write: false };
      const ORDER = ['info', 'bind', 'auth'];
      let page = 'info', save = null;
      const box = h('div', { class: 'wiz' });
      const d = dialog({ title: 'FTP 사이트 추가', width: 44, cls: 'wizdlg', body: box, buttons: [] });
      function head(t) { return h('div', { class: 'wiz-head' }, h('h3', {}, t)); }
      function go(dir) {
        if (save) save();
        if (dir > 0) { const e = M.checkFtpPage(ctx.st(), w, page); if (e) { msg({ title: 'FTP 사이트 추가', icon: 'err', text: e }); return; } }
        page = ORDER[ORDER.indexOf(page) + dir]; draw();
      }
      function finish() {
        if (save) save();
        const e = M.checkFtpPage(ctx.st(), w, 'auth');
        if (e) { msg({ title: 'FTP 사이트 추가', icon: 'err', text: e }); return; }
        const r = M.addFtpSite(ctx.st(), w);
        if (r.error) { msg({ title: 'FTP 사이트 추가', icon: 'err', text: r.error }); return; }
        if (r.conflict) {
          msg({ title: 'FTP 사이트 추가', icon: 'warn', text: ['이 FTP 사이트의 바인딩이 실행 중인 사이트 「' + r.conflict + '」의 바인딩과 같습니다.', '계속하면 이 사이트는 중지된 상태로 만들어집니다. 계속하시겠습니까?'], buttons: ['예', '아니요'], def: 1 })
            .then(b => { if (b === '예') { const r2 = M.addFtpSite(ctx.st(), w, true); doneF(r2); } });
          return;
        }
        doneF(r);
      }
      function doneF(r) { ui.sel = 's:' + r.id; ui.feat = null; ui.open.add('sites'); ctx.commit(); d.close('마침'); }
      function draw() {
        save = null; box.innerHTML = '';
        let body;
        if (page === 'info') {
          const n = textIn({ value: w.name, label: 'FTP 사이트 이름', width: 18 }), p = textIn({ value: w.path, label: '실제 경로', width: 24 });
          save = () => { w.name = n.value; w.path = p.value; };
          body = h('div', {}, head('사이트 정보'), h('label', { class: 'flab' }, 'FTP 사이트 이름:'), n,
            group('콘텐츠 디렉터리', h('label', { class: 'flab' }, '실제 경로:'), h('div', { class: 'fin' }, p, h('button', { type: 'button', class: 'btn', disabled: true, title: WS.ui.OUT_TIP }, '...'))));
        } else if (page === 'bind') {
          const ipc = ipCombo(w.ip, 'IP 주소'), ip = ipc.querySelector('input');
          const port = textIn({ value: w.port, label: '포트', width: 5 });
          const vh = textIn({ value: w.host, label: '가상 호스트', width: 18, disabled: !w.vhostOn });
          const vhc = check('가상 호스트 이름 사용', w.vhostOn, c => { w.vhostOn = c; vh.disabled = !c; });
          const auto = check('자동으로 FTP 사이트 시작', w.autoStart, c => { w.autoStart = c; });
          const cert = select(['선택되지 않음'], '선택되지 않음', { label: 'SSL 인증서' });
          cert.disabled = w.ssl === 'none';
          const sslR = (k, l) => radio('ssl', l, w.ssl === k, () => { w.ssl = k; cert.disabled = k === 'none'; });
          save = () => { w.ip = ip.value; w.port = port.value.trim(); w.host = vh.value; };
          body = h('div', {}, head('바인딩 및 SSL 설정'),
            group('바인딩', h('div', { class: 'row3' }, h('div', {}, h('label', { class: 'flab' }, 'IP 주소:'), ipc), h('div', {}, h('label', { class: 'flab' }, '포트:'), port)),
              vhc, h('div', { class: 'indent' }, h('label', { class: 'flab' }, '가상 호스트(예: ftp.example.test):'), vh)),
            auto,
            group('SSL', sslR('none', '없음'), sslR('allow', '허용'), sslR('require', '필요'), h('label', { class: 'flab' }, 'SSL 인증서:'), h('div', { class: 'fin' }, cert, h('button', { type: 'button', class: 'btn', disabled: true, title: WS.ui.OUT_TIP }, '보기'))));
        } else {
          const val = textIn({ value: w.whoValue, label: '역할 또는 사용자 이름', width: 18, disabled: !(w.who === 'roles' || w.who === 'users') });
          const opts = [['', ''], ['all', '모든 사용자'], ['anon', '익명 사용자'], ['roles', '지정한 역할 또는 사용자 그룹'], ['users', '지정한 사용자']];
          const who = h('select', { class: 'dsel', 'aria-label': '액세스 허용 대상' }, opts.map(o => h('option', { value: o[0], selected: o[0] === w.who }, o[1] || '(선택하지 않음)')));
          who.addEventListener('change', () => { w.who = who.value; val.disabled = !(w.who === 'roles' || w.who === 'users'); });
          save = () => { w.whoValue = val.value; };
          body = h('div', {}, head('인증 및 권한 부여 정보'),
            group('인증', check('익명', w.anon, c => { w.anon = c; }), check('기본', w.basic, c => { w.basic = c; })),
            group('권한 부여', h('label', { class: 'flab' }, '액세스 허용 대상:'), who, val),
            group('사용 권한', check('읽기', w.read, c => { w.read = c; }), check('쓰기', w.write, c => { w.write = c; })));
        }
        box.appendChild(body);
        d.setButtons([
          { label: '이전', keep: true, disabled: page === 'info', onClick: () => go(-1) },
          { label: '다음', keep: true, primary: page !== 'auth', disabled: page === 'auth', onClick: () => go(1) },
          { label: '마침', keep: true, primary: page === 'auth', disabled: page !== 'auth', onClick: finish },
          { label: '취소', cancel: true },
        ]);
        setTimeout(() => { const f = box.querySelector('input.tin:not([disabled]):not([readonly])') || d.foot.querySelector('.db.primary'); if (f) { f.focus({ preventScroll: true }); if (f.select) f.select(); } }, 0);
        d.place();
      }
      draw();
    }

    /* ------------------------------------------------ 바인딩 · 고급 설정 */
    function bindings(id) {
      const s = M.siteById(ctx.st(), id);
      const list = s.bindings.map(b => Object.assign({}, b));
      let sel = 0;
      const host = h('div');
      function draw() {
        host.innerHTML = '';
        host.appendChild(listView([{ label: '종류', w: '12%' }, { label: '호스트 이름', w: '30%' }, { label: '포트', w: '12%' }, { label: 'IP 주소', w: '24%' }, { label: '바인딩 정보' }],
          list.map((b, i) => ({ key: i, cells: [b.type, b.host, String(b.port), b.ip, ''] })), sel, { select: i => { sel = i; }, dbl: i => { sel = i; edit(i); } }));
      }
      function edit(i) {
        const b = i == null ? { type: s.kind === 'ftp' ? 'ftp' : 'http', ip: '*', port: s.kind === 'ftp' ? 21 : 80, host: '' } : list[i];
        const type = select(s.kind === 'ftp' ? ['ftp'] : ['http', 'https'], b.type, { label: '종류' });
        const ipc = ipCombo(M.bindIpText(b.ip), 'IP 주소'), ip = ipc.querySelector('input');
        const port = textIn({ value: String(b.port), label: '포트', width: 5 }), hn = textIn({ value: b.host, label: '호스트 이름', width: 22 });
        dialog({ title: i == null ? '사이트 바인딩 추가' : '사이트 바인딩 편집', width: 36, body: h('div', {},
          h('div', { class: 'row3' }, h('div', {}, h('label', { class: 'flab' }, '종류:'), type), h('div', {}, h('label', { class: 'flab' }, 'IP 주소:'), ipc), h('div', {}, h('label', { class: 'flab' }, '포트:'), port)),
          h('label', { class: 'flab' }, '호스트 이름:'), hn),
          buttons: [{ label: '확인', primary: true, onClick: () => {
            const nb = { type: type.value, ip: ip.value, port: port.value.trim(), host: hn.value };
            const e = M.checkBinding(nb);
            if (e) { msg({ title: '사이트 바인딩', icon: 'err', text: e }); return false; }
            nb.ip = M.normBindIp(nb.ip); nb.port = Number(nb.port); nb.host = nb.host.trim();
            if (i == null) list.push(nb); else list[i] = nb;
            draw();
          } }, { label: '취소', cancel: true }] });
      }
      draw();
      dialog({ title: '사이트 바인딩', width: 44, body: h('div', {}, host, h('div', { class: 'brow' },
        h('button', { type: 'button', class: 'btn', onclick: () => edit(null) }, '추가'),
        h('button', { type: 'button', class: 'btn', onclick: () => edit(sel) }, '편집'),
        h('button', { type: 'button', class: 'btn', onclick: () => { if (list.length > 1) { list.splice(sel, 1); sel = 0; draw(); } else msg({ title: '사이트 바인딩', icon: 'warn', text: '바인딩이 하나 이상 있어야 합니다.' }); } }, '제거'),
        h('button', { type: 'button', class: 'btn', disabled: true, title: WS.ui.OUT_TIP }, '찾아보기'))),
        buttons: [{ label: '닫기', primary: true, onClick: () => { const r = M.setBindings(ctx.st(), id, list); if (!r.ok) { msg({ title: '사이트 바인딩', icon: 'err', text: r.error }); return false; } ctx.commit(); } }] });
    }
    /* 고급 설정: 속성 표. 값을 누르면 고칠 수 있고, True/False는 두 번 누르면 바뀐다 */
    function advanced(id) {
      const s = M.siteById(ctx.st(), id), defs = M.ADV[s.kind];
      const vals = {};
      defs.forEach(dd => { vals[dd.key] = M.advValue(s, dd.key); });
      const help = h('div', { class: 'pg-help' });
      const table = h('table', { class: 'pg' });
      let lastGroup = null;
      const showHelp = dd => { help.innerHTML = ''; help.appendChild(h('b', {}, dd.label)); help.appendChild(h('p', {}, dd.help || (dd.ro ? '이 값은 여기에서 바꿀 수 없습니다.' : '값을 눌러 고칩니다.'))); };
      defs.forEach(dd => {
        if (dd.group !== lastGroup) { table.appendChild(h('tr', { class: 'pg-g' }, h('td', { colspan: 2 }, '⊟ ' + dd.group))); lastGroup = dd.group; }
        let cell;
        if (dd.ro) cell = h('span', { class: 'pg-ro' }, vals[dd.key]);
        else if (dd.kind === 'bool') {
          cell = h('select', { class: 'pg-in', 'aria-label': dd.label }, ['True', 'False'].map(v => h('option', { value: v, selected: vals[dd.key] === v }, v)));
          cell.addEventListener('change', () => { vals[dd.key] = cell.value; });
          cell.addEventListener('dblclick', () => { cell.value = cell.value === 'True' ? 'False' : 'True'; vals[dd.key] = cell.value; });
        } else {
          cell = h('input', { type: 'text', class: 'pg-in', value: vals[dd.key], 'aria-label': dd.label, autocomplete: 'off', spellcheck: false });
          cell.addEventListener('input', () => { vals[dd.key] = cell.value; });
          cell.addEventListener('focus', () => cell.select());
        }
        const tr = h('tr', { class: dd.ro ? 'ro' : '' }, h('th', { scope: 'row' }, dd.label), h('td', {}, cell));
        tr.addEventListener('mousedown', () => { table.querySelectorAll('tr.sel').forEach(x => x.classList.remove('sel')); tr.classList.add('sel'); showHelp(dd); });
        cell.addEventListener('focus', () => { table.querySelectorAll('tr.sel').forEach(x => x.classList.remove('sel')); tr.classList.add('sel'); showHelp(dd); });
        table.appendChild(tr);
      });
      showHelp(defs[0]);
      dialog({ title: '고급 설정', width: 40, cls: 'pgdlg', body: h('div', {}, h('div', { class: 'pg-wrap' }, table), help),
        buttons: [{ label: '확인', primary: true, onClick: () => {
          const test = M.clone(ctx.st());
          const changed = defs.filter(dd => !dd.ro && vals[dd.key].trim() !== M.advValue(s, dd.key));
          for (const dd of changed) { const r = M.setAdv(test, id, dd.key, vals[dd.key]); if (!r.ok) { msg({ title: '고급 설정', icon: 'err', text: r.error }); return false; } }
          changed.forEach(dd => M.setAdv(ctx.st(), id, dd.key, vals[dd.key]));
          ctx.commit();
        } }, { label: '취소', cancel: true }] });
    }

    return { el, render, pending: () => dirty() };
  }

  WS.tools.iis = { id: 'iis', title: 'IIS 관리자', icon: 'site', create };
})(window);
