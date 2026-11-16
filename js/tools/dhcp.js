/* DHCP: 서버 > IPv4 > 범위(주소 풀 · 주소 임대 · 범위 옵션)
 * 새 범위 마법사: 시작 → 범위 이름 → IP 주소 범위 → 제외 주소 및 지연 추가 → 임대 기간 → DHCP 옵션 구성
 *   → (예) 라우터 → 도메인 이름 및 DNS 서버 → WINS 서버 → 범위 활성화 → 완료 / (아니요) 완료
 * 제외 범위는 「추가」를 눌러 목록에 올린 것만 반영한다(입력 칸에만 남긴 값은 버린다).
 */
(function (G) {
  'use strict';
  const WS = G.WS, M = G.WSModel;
  const { h, icon, menu, dialog, msg, toast, ipBox, spin, textIn, radio, group, tabs, tree, listView, field } = WS.ui;
  const TK = WS.toolkit;
  const NEED_SEL = '트리에서 IPv4를 먼저 왼쪽 단추로 선택한 뒤 다시 엽니다.';

  function create(ctx) {
    const ui = { sel: 'srv', open: new Set(['root', 'srv', 'v4']), row: null };
    const el = h('div', { class: 'tool tool-dhcp' });
    let rhost = null;
    const sc = i => ctx.st().dhcp.scopes[i];
    function parse(id) { const m = /^sc:(\d+)(?::(\w+))?$/.exec(id || ''); return m ? { i: +m[1], part: m[2] || '' } : null; }

    function nodes() {
      const st = ctx.st();
      return [{ id: 'root', label: 'DHCP', icon: 'dhcp', kids: [{ id: 'srv', label: st.server.toLowerCase(), icon: 'server', kids: [
        { id: 'v4', label: 'IPv4', icon: 'folder', kids: st.dhcp.scopes.map((s, i) => ({ id: 'sc:' + i, label: M.scopeLabel(s), icon: 'folder', dim: !s.active, kids: [
          { id: 'sc:' + i + ':pool', label: '주소 풀', icon: 'doc' },
          { id: 'sc:' + i + ':lease', label: '주소 임대', icon: 'doc' },
          { id: 'sc:' + i + ':resv', label: '예약', icon: 'folder', out: true },
          { id: 'sc:' + i + ':opt', label: '범위 옵션', icon: 'doc' },
          { id: 'sc:' + i + ':pol', label: '정책', icon: 'folder', out: true },
        ] })).concat([
          { id: 'v4opt', label: '서버 옵션', icon: 'doc', out: true },
          { id: 'v4pol', label: '정책', icon: 'folder', out: true },
          { id: 'v4flt', label: '필터', icon: 'folder', out: true },
        ]) },
        { id: 'v6', label: 'IPv6', icon: 'folder', out: true },
      ] }] }];
    }
    function validSel() {
      const p = parse(ui.sel);
      if (p && !sc(p.i)) ui.sel = 'v4';
    }
    function render() {
      validSel();
      el.innerHTML = '';
      el.appendChild(TK.menubar([{ label: '파일', out: true }, { label: '동작', items: () => nodeMenu(ui.sel, true) }, { label: '보기', out: true }, { label: '도움말', out: true }]));
      const t = tree(nodes(), ui, {
        select: () => { ui.row = null; renderRight(); },
        context: (id, at, was) => menu(at, nodeMenu(id, was)),
        refresh: render,
      });
      rhost = h('div', { class: 'rhost' });
      el.appendChild(TK.split(t, rhost));
      renderRight();
    }
    function renderRight() {
      const st = ctx.st(), id = ui.sel, p = parse(id);
      rhost.innerHTML = '';
      let right;
      if (id === 'root') right = TK.info('DHCP', 'DHCP 서버는 네트워크의 컴퓨터에 IP 주소와 구성 옵션을 자동으로 나눠 줍니다. 서버 아래 IPv4에서 범위를 관리합니다.');
      else if (id === 'srv') right = listView([{ label: '내용' }], [{ key: 'v4', cells: ['IPv4'] }, { key: 'v6', cells: ['IPv6'] }], null, {});
      else if (id === 'v4') {
        if (!st.dhcp.scopes.length) right = TK.info('범위 추가', '범위는 클라이언트 컴퓨터에 임대할 IP 주소의 집합입니다. 서버가 주소를 나눠 주려면 범위를 하나 이상 만들어야 합니다.', '새 범위를 만들려면 IPv4를 선택한 상태에서 「동작」 메뉴나 IPv4의 오른쪽 단추 메뉴에서 「새 범위」를 고릅니다.');
        else right = listView([{ label: 'IPv4 내용', w: '50%' }, { label: '상태', w: '18%' }, { label: '설명' }],
          st.dhcp.scopes.map((s, i) => ({ key: i, cells: [h('span', { class: 'cellic' }, icon('folder'), M.scopeLabel(s)), s.active ? '활성' : h('b', { class: 'inact' }, '비활성'), s.desc] })), null,
          { dbl: i => { ui.sel = 'sc:' + i; ui.open.add('sc:' + i); render(); }, context: (i, at) => menu(at, scopeMenu(i)) });
      } else if (p && !p.part) {
        right = listView([{ label: '이름' }], ['주소 풀', '주소 임대', '예약', '범위 옵션', '정책'].map(n => ({ key: n, cells: [h('span', { class: 'cellic' }, icon('folder'), n)] })), null, {});
      } else if (p && p.part === 'pool') {
        const s = sc(p.i);
        const rows = [{ key: 'range', cells: [s.start, s.end, '배포할 주소 범위'] }]
          .concat(s.excl.map((x, k) => ({ key: 'x' + k, cells: [x.lo, x.hi, '배포에서 제외된 IP 주소'] })));
        right = listView([{ label: '시작 IP 주소', w: '30%' }, { label: '끝 IP 주소', w: '30%' }, { label: '설명' }], rows, null, {
          context: (k, at) => menu(at, k === 'range' ? poolMenu(p.i) : [{ label: '삭제', onClick: () => delExcl(p.i, +k.slice(1)) }, { sep: true }, { label: '도움말', out: true }]),
        });
      } else if (p && p.part === 'lease') {
        right = listView([{ label: '클라이언트 IP 주소', w: '34%' }, { label: '이름', w: '33%' }, { label: '임대 만료' }], [], null, {}, '임대한 주소가 없습니다. 이 연습 서버에는 접속한 클라이언트가 없습니다.');
      } else if (p && p.part === 'opt') {
        const o = sc(p.i).opts, rows = [];
        if (o.router.length) rows.push({ key: '003', cells: ['003 라우터', '표준', o.router.join(', ')] });
        if (o.dns.length) rows.push({ key: '006', cells: ['006 DNS 서버', '표준', o.dns.join(', ')] });
        if (o.domain) rows.push({ key: '015', cells: ['015 DNS 도메인 이름', '표준', o.domain] });
        right = listView([{ label: '옵션 이름', w: '34%' }, { label: '공급업체', w: '16%' }, { label: '값' }], rows, null, { context: (k, at) => menu(at, optMenu(p.i)) },
          '구성한 범위 옵션이 없습니다. 「범위 옵션」의 오른쪽 단추 메뉴에서 「옵션 구성」을 고릅니다.');
      } else right = TK.OUT_NODE();
      rhost.appendChild(right);
    }

    function nodeMenu(id, wasSelected) {
      const p = parse(id);
      if (id === 'v4') return [
        { label: '표시 통계', out: true }, { sep: true },
        { label: '새 범위', disabled: !wasSelected, tip: wasSelected ? '' : NEED_SEL, onClick: newScope },
        { label: '새 수퍼 범위', out: true }, { label: '새 멀티캐스트 범위', out: true }, { sep: true },
        { label: '장애 조치 구성', out: true }, { label: '범위 가져오기', out: true }, { sep: true },
        { label: '새로 고침', onClick: render }, { label: '속성', out: true }, { label: '도움말', out: true }];
      if (p && !p.part) return scopeMenu(p.i);
      if (p && p.part === 'pool') return poolMenu(p.i);
      if (p && p.part === 'opt') return optMenu(p.i);
      if (id === 'srv') return [{ label: '서버 추가/제거', out: true }, { label: '백업', out: true }, { label: '복원', out: true }, { sep: true }, { label: '새로 고침', onClick: render }, { label: '속성', out: true }];
      return [{ label: '새로 고침', onClick: render }, { label: '도움말', out: true }];
    }
    function scopeMenu(i) {
      const s = sc(i);
      return [
        { label: '표시 통계', out: true }, { sep: true },
        s.active ? { label: '비활성화', onClick: () => deactivate(i) } : { label: '활성화', onClick: () => { M.scopeSetActive(ctx.st(), i, true); ctx.commit(); toast(M.scopeLabel(s) + ' 범위를 활성화했습니다.'); } },
        { sep: true }, { label: '조정', out: true }, { label: '삭제', onClick: () => delScope(i) }, { label: '새로 고침', onClick: render }, { sep: true },
        { label: '속성', bold: true, onClick: () => scopeProps(i) }, { label: '도움말', out: true }];
    }
    function poolMenu(i) { return [{ label: '새 제외 범위', onClick: () => newExclusion(i) }, { label: '새로 고침', onClick: render }, { label: '목록 내보내기', out: true }, { label: '도움말', out: true }]; }
    function optMenu(i) { return [{ label: '옵션 구성', onClick: () => optDialog(i) }, { label: '새로 고침', onClick: render }, { label: '목록 내보내기', out: true }, { label: '도움말', out: true }]; }

    function deactivate(i) {
      msg({ title: 'DHCP', icon: 'q', text: '이 범위를 비활성화하면 클라이언트가 이 범위에서 주소를 받지 못합니다. 비활성화하시겠습니까?', buttons: ['예', '아니요'] })
        .then(b => { if (b === '예') { M.scopeSetActive(ctx.st(), i, false); ctx.commit(); } });
    }
    function delScope(i) {
      msg({ title: 'DHCP', icon: 'q', text: M.scopeLabel(sc(i)) + ' 범위를 삭제하시겠습니까? 범위의 주소 풀·제외 범위·옵션이 모두 지워집니다.', buttons: ['예', '아니요'], def: 1 })
        .then(b => { if (b === '예') { M.scopeDelete(ctx.st(), i); ui.sel = 'v4'; ctx.commit(); } });
    }
    function delExcl(i, k) {
      const x = sc(i).excl[k];
      msg({ title: 'DHCP', icon: 'q', text: '제외 범위 ' + x.lo + ' ~ ' + x.hi + '을(를) 삭제하시겠습니까?', buttons: ['예', '아니요'] })
        .then(b => { if (b === '예') { M.scopeRemoveExclusion(ctx.st(), i, k); ctx.commit(); } });
    }

    /* ---------------------------------------------------- 새 범위 마법사 */
    function newScope() {
      const st = ctx.st(), a0 = st.net.adapters[0].v4;
      const w = { name: '', desc: '', start: '', end: '', len: 24, mask: '255.255.255.0', excl: [], delay: 0, lease: { d: 8, h: 0, m: 0 },
        configNow: true, router: [], domain: '', dns: a0.dnsAuto ? [] : [a0.dns1, a0.dns2].filter(Boolean), wins: [], activate: true };
      const ORDER = ['welcome', 'name', 'range', 'excl', 'lease', 'opts', 'router', 'dns', 'wins', 'activate', 'finish'];
      let page = 'welcome', save = null;
      const box = h('div', { class: 'wiz' });
      const d = dialog({ title: '새 범위 마법사', width: 44, cls: 'wizdlg', body: box, buttons: [] });
      function go(p) { if (save) save(); page = p; draw(); }
      function next() {
        if (save) save();
        const err = validate(page);
        if (err) { msg({ title: '새 범위 마법사', icon: 'err', text: err }); return; }
        let i = ORDER.indexOf(page) + 1;
        if (page === 'opts' && !w.configNow) i = ORDER.indexOf('finish');
        go(ORDER[i]);
      }
      function back() {
        let i = ORDER.indexOf(page) - 1;
        if (page === 'finish' && !w.configNow) i = ORDER.indexOf('opts');
        go(ORDER[i]);
      }
      function validate(p) {
        if (p === 'name' && !w.name.trim()) return '범위 이름을 입력합니다.';
        if (p === 'range') return M.checkRange(ctx.st(), w);
        if (p === 'lease') return M.checkLease(w.lease);
        return null;
      }
      function finish() {
        if (save) save();
        const r = M.createScope(ctx.st(), w);
        if (!r.ok) { msg({ title: '새 범위 마법사', icon: 'err', text: r.error }); return; }
        ui.sel = 'sc:' + r.index; ui.open.add('v4');
        ctx.commit();
        d.close('마침');
      }
      function head(t, sub) { return h('div', { class: 'wiz-head' }, h('h3', {}, t), sub ? h('p', {}, sub) : null); }
      function draw() {
        save = null;
        box.innerHTML = '';
        let body;
        if (page === 'welcome') {
          body = h('div', { class: 'wiz-welcome' }, h('h3', {}, '새 범위 마법사 시작'),
            h('p', {}, '이 마법사는 DHCP 서버에 범위를 만듭니다. 범위는 네트워크의 컴퓨터에 나눠 줄 IP 주소의 집합입니다.'),
            h('p', {}, '계속하려면 「다음」을 누릅니다.'));
        } else if (page === 'name') {
          const n = textIn({ value: w.name, label: '이름', width: 22 }), ds = textIn({ value: w.desc, label: '설명', width: 22 });
          save = () => { w.name = n.value; w.desc = ds.value; };
          body = h('div', {}, head('범위 이름', '범위를 구별할 이름과 설명을 입력합니다.'),
            h('p', {}, '이 범위가 네트워크에서 어떻게 쓰이는지 알아볼 수 있는 이름을 입력합니다.'),
            field('이름:', n), field('설명:', ds));
        } else if (page === 'range') {
          const s = ipBox({ value: w.start, label: '시작 IP 주소' }), e = ipBox({ value: w.end, label: '끝 IP 주소' });
          const mk = ipBox({ value: w.mask, label: '서브넷 마스크' });
          const ln = spin({ value: w.len, min: 0, max: 32, label: '길이', width: 3.5, onChange: v => { const m = M.maskFromLen(v); if (m) mk.value = m; } });
          mk.addEventListener('input', () => { const l = M.lenFromMask(mk.value); if (M.isIp(mk.value) && l >= 0) ln.value = l; });
          save = () => { w.start = s.value; w.end = e.value; w.mask = mk.value; w.len = Number(ln.value); };
          body = h('div', {}, head('IP 주소 범위', '범위에 넣을 연속된 IP 주소를 정합니다.'),
            group('DHCP 서버 구성 설정', h('p', {}, '분배할 주소 범위를 입력합니다.'), field('시작 IP 주소:', s), field('끝 IP 주소:', e)),
            group('DHCP 클라이언트로 전파되는 구성 설정', field('길이:', ln), field('서브넷 마스크:', mk)));
        } else if (page === 'excl') {
          const lo = ipBox({ label: '제외할 시작 IP 주소' }), hi = ipBox({ label: '제외할 끝 IP 주소' });
          const lb = h('select', { class: 'lbox', size: 5, 'aria-label': '제외된 주소 범위' });
          const dl = spin({ value: w.delay, min: 0, max: 1000, label: '서브넷 지연(밀리초)', width: 4 });
          const drawList = () => { lb.innerHTML = ''; w.excl.forEach(x => lb.appendChild(h('option', {}, x.lo === x.hi ? '주소 ' + x.lo : x.lo + '에서 ' + x.hi + '까지'))); };
          const add = () => {
            const e = M.checkExclusion(w, lo.value, hi.value);
            if (e) { msg({ title: '새 범위 마법사', icon: 'err', text: e }); return; }
            w.excl.push({ lo: M.normIp(lo.value), hi: M.normIp(hi.value || lo.value) });
            lo.value = ''; hi.value = ''; drawList(); lo.focusFirst();
          };
          [lo, hi].forEach(b => { b.setAttribute('data-noenter', ''); b.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); add(); } }); });
          drawList();
          save = () => { w.delay = Number(dl.value) || 0; };
          body = h('div', {}, head('제외 주소 및 지연 추가', '제외 주소는 서버가 나눠 주지 않는 주소 또는 주소 범위입니다. 지연은 서버가 응답(DHCPOFFER)을 보내기 전에 기다리는 시간입니다.'),
            h('p', {}, '제외할 IP 주소 범위를 입력합니다. 단일 주소를 제외하려면 「시작 IP 주소」에만 입력합니다.'),
            h('div', { class: 'exrow' },
              h('div', {}, h('label', { class: 'flab' }, '시작 IP 주소:'), lo),
              h('div', {}, h('label', { class: 'flab' }, '끝 IP 주소:'), hi),
              h('button', { type: 'button', class: 'btn', onclick: add }, '추가')),
            h('p', { class: 'lab' }, '제외된 주소 범위:'),
            h('div', { class: 'lrow' }, lb, h('div', { class: 'lbtns' }, h('button', { type: 'button', class: 'btn', onclick: () => { const k = lb.selectedIndex; if (k >= 0) { w.excl.splice(k, 1); drawList(); } } }, '제거'))),
            field('서브넷 지연(밀리초):', dl));
        } else if (page === 'lease') {
          const dd = spin({ value: w.lease.d, min: 0, max: 999, label: '일', width: 3.5 }), hh = spin({ value: w.lease.h, min: 0, max: 23, label: '시간', width: 3 }), mm = spin({ value: w.lease.m, min: 0, max: 59, label: '분', width: 3 });
          save = () => { w.lease = { d: dd.value, h: hh.value, m: mm.value }; };
          body = h('div', {}, head('임대 기간', '임대 기간은 클라이언트가 범위의 IP 주소를 쓸 수 있는 시간입니다.'),
            h('p', {}, '자주 옮겨 다니는 기기가 많은 네트워크는 임대 기간을 짧게, 한 자리에 고정된 컴퓨터가 많은 네트워크는 길게 정합니다.'),
            h('p', { class: 'lab' }, '기간'),
            h('div', { class: 'lease' }, h('label', {}, h('span', {}, '일:'), dd), h('label', {}, h('span', {}, '시간:'), hh), h('label', {}, h('span', {}, '분:'), mm)));
        } else if (page === 'opts') {
          body = h('div', {}, head('DHCP 옵션 구성', '클라이언트가 범위를 쓰려면 가장 일반적인 DHCP 옵션을 구성해야 합니다.'),
            h('p', {}, '클라이언트는 주소를 받을 때 라우터(기본 게이트웨이), DNS 서버 같은 옵션도 함께 받습니다. 지금 이 범위의 옵션을 구성하시겠습니까?'),
            radio('cfg', '예, 지금 옵션을 구성합니다', w.configNow, () => { w.configNow = true; }),
            radio('cfg', '아니요, 나중에 옵션을 구성합니다', !w.configNow, () => { w.configNow = false; }));
        } else if (page === 'router') {
          body = h('div', {}, head('라우터(기본 게이트웨이)', '이 범위의 클라이언트가 쓸 라우터(기본 게이트웨이)를 지정합니다.'),
            h('p', {}, '클라이언트가 쓸 라우터의 IP 주소를 입력하고 「추가」를 누릅니다.'),
            TK.ipList(w.router, { label: 'IP 주소' }));
        } else if (page === 'dns') {
          const dom = textIn({ value: w.domain, label: '부모 도메인', width: 18 });
          save = () => { w.domain = dom.value; };
          body = h('div', {}, head('도메인 이름 및 DNS 서버', 'DNS는 클라이언트가 이름으로 컴퓨터를 찾을 때 쓰는 서비스입니다.'),
            field('부모 도메인:', dom),
            h('p', {}, '클라이언트가 쓸 DNS 서버의 IP 주소를 입력하고 「추가」를 누릅니다.'),
            field('서버 이름:', textIn({ label: '서버 이름', width: 14, disabled: true }), { after: h('button', { type: 'button', class: 'btn', disabled: true, title: WS.ui.OUT_TIP }, '확인') }),
            TK.ipList(w.dns, { label: 'IP 주소' }));
        } else if (page === 'wins') {
          body = h('div', {}, head('WINS 서버', 'WINS 서버는 NetBIOS 이름을 IP 주소로 바꿔 줍니다.'),
            h('p', {}, 'WINS 서버를 쓰지 않으면 비워 두고 「다음」을 누릅니다.'),
            TK.ipList(w.wins, { label: 'IP 주소' }));
        } else if (page === 'activate') {
          body = h('div', {}, head('범위 활성화', '범위를 활성화해야 클라이언트가 주소를 받을 수 있습니다.'),
            h('p', {}, '지금 이 범위를 활성화하시겠습니까?'),
            radio('act', '예, 지금 범위를 활성화합니다', w.activate, () => { w.activate = true; }),
            radio('act', '아니요, 나중에 범위를 활성화합니다', !w.activate, () => { w.activate = false; }));
        } else if (page === 'finish') {
          body = h('div', { class: 'wiz-welcome' }, h('h3', {}, '새 범위 마법사 완료'),
            h('p', {}, '새 범위 마법사를 완료했습니다.'), h('p', {}, '마법사를 닫으려면 「마침」을 누릅니다.'));
        }
        box.appendChild(body);
        const isFirst = page === 'welcome', isLast = page === 'finish';
        d.setButtons([
          { label: '< 뒤로', keep: true, disabled: isFirst, onClick: back },
          isLast ? { label: '마침', primary: true, keep: true, onClick: finish } : { label: '다음 >', primary: true, keep: true, onClick: next },
          { label: '취소', cancel: true },
        ]);
        setTimeout(() => {
          const f = box.querySelector('input:not([disabled]):not([type=radio]), select') || box.querySelector('input[type=radio]:checked') || d.foot.querySelector('.db.primary');
          if (f) { f.focus({ preventScroll: true }); if (f.select && f.type === 'text') f.select(); }
        }, 0);
        d.place();
      }
      draw();
    }

    /* ---------------------------------------------------- 범위 속성 · 제외 범위 · 옵션 */
    function scopeProps(i) {
      const s = sc(i);
      const n = textIn({ value: s.name, label: '범위 이름', width: 18 }), ds = textIn({ value: s.desc, label: '설명', width: 18 });
      const a = ipBox({ value: s.start, label: '시작 IP 주소' }), b = ipBox({ value: s.end, label: '끝 IP 주소' });
      const ln = spin({ value: s.len, label: '길이', width: 3.5, disabled: true }), mk = ipBox({ value: s.mask, label: '서브넷 마스크', disabled: true });
      const dd = spin({ value: s.lease.d, min: 0, max: 999, label: '일', width: 3.5 }), hh = spin({ value: s.lease.h, min: 0, max: 23, label: '시간', width: 3 }), mm = spin({ value: s.lease.m, min: 0, max: 59, label: '분', width: 3 });
      const gen = h('div', {},
        field('범위 이름:', n), field('시작 IP 주소:', a), field('끝 IP 주소:', b), field('길이:', ln), field('서브넷 마스크:', mk),
        group('DHCP 클라이언트의 임대 기간',
          radio('lim', '제한', true, null),
          h('div', { class: 'lease' }, h('label', {}, h('span', {}, '일:'), dd), h('label', {}, h('span', {}, '시간:'), hh), h('label', {}, h('span', {}, '분:'), mm)),
          radio('lim', '무제한', false, null, true)),
        field('설명:', ds),
        h('p', { class: 'note' }, '서브넷 마스크는 범위를 만든 뒤에는 바꿀 수 없습니다. 바꾸려면 범위를 지우고 다시 만듭니다.'));
      function apply() {
        const r = M.scopeUpdate(ctx.st(), i, { name: n.value, desc: ds.value, start: a.value, end: b.value, lease: { d: dd.value, h: hh.value, m: mm.value } });
        if (!r.ok) { msg({ title: '범위 속성', icon: 'err', text: r.error }); return false; }
        ctx.commit();
        return true;
      }
      const d = dialog({ title: M.scopeLabel(s) + ' 속성', width: 40,
        body: tabs([{ id: 'gen', label: '일반', body: gen }, { id: 'dns', label: 'DNS', out: true }, { id: 'nap', label: '네트워크 액세스 보호', out: true }, { id: 'adv', label: '고급', out: true }]),
        buttons: [
          { label: '확인', primary: true, onClick: () => apply() ? undefined : false },
          { label: '취소', cancel: true },
          { label: '적용', keep: true, onClick: () => { apply(); } },
        ] });
      return d;
    }
    function newExclusion(i) {
      const s = sc(i);
      const lo = ipBox({ label: '제외할 시작 IP 주소' }), hi = ipBox({ label: '제외할 끝 IP 주소' });
      const done = h('p', { class: 'note', role: 'status' });
      const d = dialog({ title: '제외 범위 추가', width: 32,
        body: h('div', {}, h('p', {}, '제외할 IP 주소 범위를 입력합니다. 단일 주소를 제외하려면 「시작 IP 주소」에만 입력합니다.'),
          h('p', { class: 'note' }, '범위의 주소: ' + s.start + ' ~ ' + s.end),
          field('시작 IP 주소:', lo), field('끝 IP 주소:', hi), done),
        buttons: [
          { label: '추가', primary: true, keep: true, onClick: () => {
            const r = M.scopeAddExclusion(ctx.st(), i, lo.value, hi.value);
            if (!r.ok) { msg({ title: '제외 범위 추가', icon: 'err', text: r.error }); return; }
            const x = sc(i).excl[sc(i).excl.length - 1];
            done.textContent = '추가했습니다: ' + x.lo + ' ~ ' + x.hi;
            lo.value = ''; hi.value = ''; lo.focusFirst();
            ctx.commit();
          } },
          { label: '닫기', cancel: true },
        ] });
      return d;
    }
    function optDialog(i) {
      const s = sc(i);
      const o = { router: s.opts.router.slice(), dns: s.opts.dns.slice(), domain: s.opts.domain };
      const on = { router: !!o.router.length, dns: !!o.dns.length, domain: !!o.domain };
      const dom = textIn({ value: o.domain, label: '015 DNS 도메인 이름 문자열 값', width: 18 });
      const sec = (key, title, inner) => {
        const cb = h('input', { type: 'checkbox', checked: on[key] });
        const wrap = h('div', { class: 'optbody' + (on[key] ? '' : ' off') }, inner);
        cb.addEventListener('change', () => { on[key] = cb.checked; wrap.classList.toggle('off', !cb.checked); });
        return h('fieldset', { class: 'grp' }, h('legend', {}, h('label', { class: 'check' }, cb, h('span', {}, title))), wrap);
      };
      const body = h('div', { class: 'optdlg' },
        h('p', {}, '사용할 옵션을 확인란으로 고르고 값을 입력합니다.'),
        sec('router', '003 라우터', TK.ipList(o.router, { label: 'IP 주소' })),
        sec('dns', '006 DNS 서버', TK.ipList(o.dns, { label: 'IP 주소' })),
        sec('domain', '015 DNS 도메인 이름', field('문자열 값:', dom)));
      dialog({ title: '범위 옵션', width: 40, body: tabs([{ id: 'gen', label: '일반', body }, { id: 'adv', label: '고급', out: true }]),
        buttons: [
          { label: '확인', primary: true, onClick: () => {
            const r = M.scopeSetOptions(ctx.st(), i, { router: on.router ? o.router : [], dns: on.dns ? o.dns : [], domain: on.domain ? dom.value : '' });
            if (!r.ok) { msg({ title: '범위 옵션', icon: 'err', text: r.error }); return false; }
            ctx.commit();
          } },
          { label: '취소', cancel: true },
        ] });
    }

    return { el, render };
  }

  WS.tools.dhcp = { id: 'dhcp', title: 'DHCP', icon: 'dhcp', create };
})(window);
