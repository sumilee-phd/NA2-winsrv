/* DNS 관리자: 서버 > 정방향 조회 영역 > 영역
 * 새 영역 마법사: 시작 → 영역 형식 → 영역 이름 → 영역 파일(주 영역) 또는 마스터 DNS 서버(보조·스텁) → 동적 업데이트(주 영역) → 완료
 * 영역의 오른쪽 단추 메뉴: 새 호스트(A 또는 AAAA) · 새 별칭(CNAME) · 속성(SOA 탭)
 */
(function (G) {
  'use strict';
  const WS = G.WS, M = G.WSModel;
  const { h, icon, menu, dialog, msg, textIn, radio, check, group, tabs, tree, listView, field, select } = WS.ui;
  const TK = WS.toolkit;
  const NEED_SEL = '트리에서 「정방향 조회 영역」을 먼저 왼쪽 단추로 선택한 뒤 다시 엽니다.';
  const ZTYPE = { primary: '표준 주 영역', secondary: '표준 보조 영역', stub: '스텁 영역' };
  const DYN_SEL = { none: '없음', both: '보안 및 비보안' };

  function create(ctx) {
    const ui = { sel: 'srv', open: new Set(['root', 'srv', 'fwd']), row: null };
    const el = h('div', { class: 'tool tool-dns' });
    let rhost = null;
    const zone = i => ctx.st().dns.zones[i];
    function parse(id) { const m = /^z:(\d+)$/.exec(id || ''); return m ? +m[1] : null; }

    function nodes() {
      const st = ctx.st();
      return [{ id: 'root', label: 'DNS', icon: 'dns', kids: [{ id: 'srv', label: st.server, icon: 'server', kids: [
        { id: 'fwd', label: '정방향 조회 영역', icon: 'folder', kids: st.dns.zones.map((z, i) => ({ id: 'z:' + i, label: z.name, icon: 'doc' })) },
        { id: 'rev', label: '역방향 조회 영역', icon: 'folder', out: true },
        { id: 'trust', label: '신뢰 지점', icon: 'folder', out: true },
        { id: 'cond', label: '조건부 전달자', icon: 'folder', out: true },
      ] }] }];
    }
    function render() {
      const zi = parse(ui.sel);
      if (zi !== null && !zone(zi)) ui.sel = 'fwd';
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
      const st = ctx.st(), id = ui.sel, zi = parse(id);
      rhost.innerHTML = '';
      let right;
      if (id === 'root') right = listView([{ label: '이름' }], [{ key: 's', cells: [h('span', { class: 'cellic' }, icon('server'), st.server)] }], null, {});
      else if (id === 'srv') right = listView([{ label: '이름' }], ['정방향 조회 영역', '역방향 조회 영역', '신뢰 지점', '조건부 전달자'].map(n => ({ key: n, cells: [h('span', { class: 'cellic' }, icon('folder'), n)] })), null, {});
      else if (id === 'fwd') {
        if (!st.dns.zones.length) right = TK.info('정방향 조회 영역 추가', '정방향 조회 영역은 이름을 IP 주소로 바꾸는 정보를 담습니다.', '새 영역을 만들려면 「정방향 조회 영역」을 선택한 상태에서 「동작」 메뉴나 오른쪽 단추 메뉴의 「새 영역」을 고릅니다.');
        else right = listView([{ label: '이름', w: '40%' }, { label: '형식', w: '32%' }, { label: '상태' }],
          st.dns.zones.map((z, i) => ({ key: i, cells: [h('span', { class: 'cellic' }, icon('doc'), z.name), ZTYPE[z.type], '실행 중'] })), null,
          { dbl: i => { ui.sel = 'z:' + i; render(); }, context: (i, at) => menu(at, zoneMenu(i)) });
      } else if (zi !== null) {
        const z = zone(zi);
        const rows = M.zoneRows(z).map((r, k) => ({ key: k, cells: [r.name, r.type, r.data], rec: r }));
        right = listView([{ label: '이름', w: '30%' }, { label: '종류', w: '24%' }, { label: '데이터' }], rows, null, {
          dbl: k => { const r = rows[k].rec; if (r.fixed) zoneProps(zi, r.type.indexOf('SOA') >= 0 ? 'soa' : 'ns'); },
          context: (k, at) => {
            const r = rows[k].rec;
            menu(at, r.fixed
              ? [{ label: '속성', bold: true, onClick: () => zoneProps(zi, r.type.indexOf('SOA') >= 0 ? 'soa' : 'ns') }]
              : [{ label: '삭제', onClick: () => delRecord(zi, r.index) }, { label: '속성', out: true }, { sep: true }, { label: '도움말', out: true }]);
          },
        });
      } else right = TK.OUT_NODE();
      rhost.appendChild(right);
    }
    function nodeMenu(id, wasSelected) {
      const zi = parse(id);
      if (id === 'fwd') return [
        { label: '새 영역', disabled: !wasSelected, tip: wasSelected ? '' : NEED_SEL, onClick: newZone }, { sep: true },
        { label: '보기', out: true }, { label: '새로 고침', onClick: render }, { label: '목록 내보내기', out: true }, { sep: true }, { label: '도움말', out: true }];
      if (zi !== null) return zoneMenu(zi);
      if (id === 'srv') return [{ label: '구성', out: true }, { label: '새 영역', out: true }, { sep: true }, { label: '새로 고침', onClick: render }, { label: '속성', out: true }];
      return [{ label: '새로 고침', onClick: render }, { label: '도움말', out: true }];
    }
    function zoneMenu(zi) {
      return [
        { label: '영역 파일 업데이트', out: true }, { label: '다시 로드', out: true }, { sep: true },
        { label: '새 호스트(A 또는 AAAA)', onClick: () => newHost(zi) },
        { label: '새 별칭(CNAME)', onClick: () => newAlias(zi) },
        { label: '새 메일 교환기(MX)', out: true }, { sep: true },
        { label: '새 도메인', out: true }, { label: '새 위임', out: true }, { label: '기타 새 레코드', out: true }, { sep: true },
        { label: '삭제', onClick: () => delZone(zi) }, { label: '새로 고침', onClick: render }, { sep: true },
        { label: '속성', bold: true, onClick: () => zoneProps(zi, 'gen') }, { label: '도움말', out: true }];
    }
    function delZone(zi) {
      msg({ title: 'DNS', icon: 'q', text: '영역 ' + zone(zi).name + '을(를) 삭제하시겠습니까? 영역의 레코드가 모두 지워집니다.', buttons: ['예', '아니요'], def: 1 })
        .then(b => { if (b === '예') { M.zoneDelete(ctx.st(), zi); ui.sel = 'fwd'; ctx.commit(); } });
    }
    function delRecord(zi, ri) {
      const r = zone(zi).records[ri];
      msg({ title: 'DNS', icon: 'q', text: (r.name || '(상위 폴더와 같음)') + ' ' + r.type + ' 레코드를 삭제하시겠습니까?', buttons: ['예', '아니요'] })
        .then(b => { if (b === '예') { M.recordDelete(ctx.st(), zi, ri); ctx.commit(); } });
    }

    /* ---------------------------------------------------- 새 영역 마법사 */
    function newZone() {
      const w = { type: 'primary', name: '', file: '', fileEdited: false, dyn: 'none', masters: [] };
      let page = 'welcome', save = null;
      const box = h('div', { class: 'wiz' });
      const d = dialog({ title: '새 영역 마법사', width: 44, cls: 'wizdlg', body: box, buttons: [] });
      function order() { return w.type === 'primary' ? ['welcome', 'type', 'name', 'file', 'dyn', 'finish'] : ['welcome', 'type', 'name', 'masters', 'finish']; }
      function go(p) { page = p; draw(); }
      function next() {
        if (save) save();
        let err = null;
        if (page === 'name') err = M.checkZoneName(ctx.st(), w.name);
        if (page === 'file' && !w.file.trim()) err = '영역 파일 이름을 입력합니다.';
        if (page === 'masters' && !w.masters.length) err = '마스터 DNS 서버의 IP 주소를 하나 이상 추가합니다.';
        if (err) { msg({ title: '새 영역 마법사', icon: 'err', text: err }); return; }
        const o = order(); go(o[o.indexOf(page) + 1]);
      }
      function back() { if (save) save(); const o = order(); go(o[o.indexOf(page) - 1]); }
      function finish() {
        const r = M.createZone(ctx.st(), { type: w.type, name: w.name, file: w.file, dyn: w.dyn, masters: w.masters });
        if (!r.ok) { msg({ title: '새 영역 마법사', icon: 'err', text: r.error }); return; }
        ui.sel = 'z:' + r.index; ui.open.add('fwd');
        ctx.commit();
        d.close('마침');
      }
      function head(t, sub) { return h('div', { class: 'wiz-head' }, h('h3', {}, t), sub ? h('p', {}, sub) : null); }
      function draw() {
        save = null;
        box.innerHTML = '';
        let body;
        if (page === 'welcome') {
          body = h('div', { class: 'wiz-welcome' }, h('h3', {}, '새 영역 마법사 시작'),
            h('p', {}, '이 마법사는 DNS 서버에 새 영역을 만듭니다. 영역은 DNS 이름 공간의 일부를 맡아 이름과 주소를 바꾸는 정보를 담습니다.'),
            h('p', {}, '계속하려면 「다음」을 누릅니다.'));
        } else if (page === 'type') {
          const opt = (key, label, desc) => h('div', { class: 'ropt' }, radio('zt', label, w.type === key, () => { w.type = key; }), h('p', { class: 'rdesc' }, desc));
          body = h('div', {}, head('영역 형식', 'DNS 서버는 여러 형식의 영역과 저장소를 지원합니다.'),
            h('p', {}, '만들 영역의 형식을 고릅니다.'),
            opt('primary', '주 영역', '직접 업데이트할 수 있는 영역의 원본 사본을 만듭니다.'),
            opt('secondary', '보조 영역', '다른 서버에 있는 영역의 사본을 만듭니다. 주 서버의 부담을 나누고 장애에 대비합니다.'),
            opt('stub', '스텁 영역', '이름 서버(NS)·권한 시작(SOA)·글루 호스트(A) 레코드만 담은 사본을 만듭니다.'),
            check('Active Directory에 영역 저장(DNS 서버가 쓰기 가능한 도메인 컨트롤러인 경우만 사용 가능)', false, null, true));
        } else if (page === 'name') {
          const n = textIn({ value: w.name, label: '영역 이름', width: 22 });
          save = () => { w.name = n.value.trim(); if (!w.fileEdited) w.file = w.name ? w.name.replace(/\.$/, '') + '.dns' : ''; };
          body = h('div', {}, head('영역 이름', '영역 이름을 입력합니다.'),
            h('p', {}, '영역 이름은 이 서버가 권한을 가지는 DNS 이름 공간의 일부입니다. 조직의 도메인 이름(예: example.test)이나 그 아래 이름(예: sales.example.test)을 씁니다. 영역 이름은 DNS 서버의 이름이 아닙니다.'),
            field('영역 이름:', n));
        } else if (page === 'file') {
          const f = textIn({ value: w.file, label: '새 파일 이름', width: 20, onInput: () => { w.fileEdited = true; } });
          save = () => { w.file = f.value.trim(); };
          body = h('div', {}, head('영역 파일', '새 영역 파일을 만들거나 다른 DNS 서버에서 복사한 파일을 씁니다.'),
            h('p', {}, '새 영역 파일을 만들지, 다른 DNS 서버에서 복사한 기존 파일을 쓸지 고릅니다.'),
            radio('zf', '다음 이름으로 새 파일 만들기:', true, null), h('div', { class: 'indent' }, f),
            radio('zf', '기존 파일 사용:', false, null, true), h('div', { class: 'indent' }, textIn({ label: '기존 파일 이름', width: 20, disabled: true })));
        } else if (page === 'masters') {
          body = h('div', {}, head('마스터 DNS 서버', '영역을 복사해 올 DNS 서버를 지정합니다.'),
            h('p', {}, '영역을 복사해 올 마스터 서버의 IP 주소를 입력하고 「추가」를 누릅니다.'),
            TK.ipList(w.masters, { label: 'IP 주소' }));
        } else if (page === 'dyn') {
          const opt = (key, label, desc, dis) => h('div', { class: 'ropt' }, radio('zd', label, w.dyn === key, () => { w.dyn = key; }, dis), h('p', { class: 'rdesc' }, desc));
          body = h('div', {}, head('동적 업데이트', '이 DNS 영역이 보안, 비보안 또는 동적 업데이트를 허용하지 않도록 지정합니다.'),
            h('p', {}, '동적 업데이트를 허용하면 클라이언트 컴퓨터가 레코드를 직접 등록하고 바꿀 수 있습니다.'),
            opt('secure', '보안 동적 업데이트만 허용(Active Directory 통합 영역에만 권장)', 'Active Directory 통합 영역에서만 쓸 수 있습니다.', true),
            opt('both', '보안 및 비보안 동적 업데이트 허용', '모든 클라이언트의 업데이트를 받습니다. 신뢰할 수 없는 곳의 업데이트도 받으므로 보안에 취약합니다.'),
            opt('none', '동적 업데이트 허용 안 함', '이 영역은 동적 업데이트를 받지 않습니다. 레코드는 직접 등록하고 고칩니다.'));
        } else if (page === 'finish') {
          const rows = [['이름', w.name], ['형식', w.type === 'primary' ? '표준 주 영역' : w.type === 'secondary' ? '표준 보조 영역' : '스텁 영역'], ['조회 형식', '정방향']]
            .concat(w.type === 'primary' ? [['파일 이름', w.file]] : [['마스터 서버', w.masters.join(', ')]]);
          body = h('div', { class: 'wiz-welcome' }, h('h3', {}, '새 영역 마법사 완료'),
            h('p', {}, '새 영역 마법사를 완료했습니다. 지정한 설정은 다음과 같습니다.'),
            h('table', { class: 'kv' }, rows.map(r => h('tr', {}, h('th', {}, r[0]), h('td', {}, r[1])))),
            h('p', {}, '마법사를 닫고 새 영역을 만들려면 「마침」을 누릅니다.'));
        }
        box.appendChild(body);
        d.setButtons([
          { label: '< 뒤로', keep: true, disabled: page === 'welcome', onClick: back },
          page === 'finish' ? { label: '마침', primary: true, keep: true, onClick: finish } : { label: '다음 >', primary: true, keep: true, onClick: next },
          { label: '취소', cancel: true },
        ]);
        setTimeout(() => {
          const f = box.querySelector('input.tin:not([disabled])') || box.querySelector('input[type=radio]:checked') || d.foot.querySelector('.db.primary');
          if (f) { f.focus({ preventScroll: true }); if (f.select && f.type === 'text') f.select(); }
        }, 0);
        d.place();
      }
      draw();
    }

    /* ---------------------------------------------------- 새 호스트 · 새 별칭 */
    function newHost(zi) {
      const z = zone(zi);
      const fq = textIn({ label: '정규화된 도메인 이름(FQDN)', readonly: true, value: z.name + '.' });
      const n = textIn({ label: '이름', width: 18, onInput: v => { fq.value = (v.trim() ? v.trim() + '.' : '') + z.name + '.'; } });
      const ip = textIn({ label: 'IP 주소', width: 14 });
      const ptr = check('연결된 PTR(포인터) 레코드 만들기', false, null);
      let added = 0;
      const d = dialog({ title: '새 호스트', width: 34,
        body: h('div', { class: 'stack' },
          h('label', { class: 'flab' }, '이름(입력하지 않으면 부모 도메인 이름 사용):'), n,
          h('label', { class: 'flab' }, '정규화된 도메인 이름(FQDN):'), fq,
          h('label', { class: 'flab' }, 'IP 주소:'), ip,
          ptr),
        buttons: [
          { label: '호스트 추가', primary: true, keep: true, onClick: () => {
            const r = M.addHost(ctx.st(), zi, { name: n.value, ip: ip.value.trim() });
            if (!r.ok) { msg({ title: 'DNS', icon: 'err', text: r.error }); return; }
            added++;
            ctx.commit();
            const tail = ptr.input.checked ? ['역방향 조회 영역이 없어 연결된 PTR 레코드는 만들지 못했습니다.'] : [];
            msg({ title: 'DNS', icon: 'info', text: ['호스트 레코드 ' + r.fqdn + '을(를) 만들었습니다.'].concat(tail) }).then(() => {
              n.value = ''; ip.value = ''; fq.value = z.name + '.'; n.focus();
              d.buttons['취소'].textContent = '완료';
            });
          } },
          { label: '취소', cancel: true },
        ] });
      return d;
    }
    function newAlias(zi) {
      const z = zone(zi);
      const fq = textIn({ label: '정규화된 도메인 이름(FQDN)', readonly: true, value: z.name + '.' });
      const n = textIn({ label: '별칭 이름', width: 18, onInput: v => { fq.value = (v.trim() ? v.trim() + '.' : '') + z.name + '.'; } });
      const tg = textIn({ label: '대상 호스트의 정규화된 도메인 이름(FQDN)', width: 22 });
      const al = h('div', { class: 'stack' },
        h('label', { class: 'flab' }, '별칭 이름(입력하지 않으면 부모 도메인 사용):'), n,
        h('label', { class: 'flab' }, '정규화된 도메인 이름(FQDN):'), fq,
        h('label', { class: 'flab' }, '대상 호스트의 정규화된 도메인 이름(FQDN):'),
        h('div', { class: 'fin' }, tg, h('button', { type: 'button', class: 'btn', disabled: true, title: WS.ui.OUT_TIP }, '찾아보기')));
      dialog({ title: '새 리소스 레코드', width: 36, body: tabs([{ id: 'cname', label: '별칭(CNAME)', body: al }]),
        buttons: [
          { label: '확인', primary: true, onClick: () => {
            const r = M.addAlias(ctx.st(), zi, { name: n.value, target: tg.value });
            if (!r.ok) { msg({ title: 'DNS', icon: 'err', text: r.error }); return false; }
            ctx.commit();
          } },
          { label: '취소', cancel: true },
        ] });
    }

    /* ---------------------------------------------------- 영역 속성(일반 · SOA · 이름 서버) */
    function zoneProps(zi, tab) {
      const z = zone(zi), s = z.soa;
      const dyn = select(['없음', '보안 및 비보안'], DYN_SEL[z.dyn], { label: '동적 업데이트' });
      dyn.disabled = z.type !== 'primary';
      const gen = h('div', {},
        h('table', { class: 'kv' }, h('tr', {}, h('th', {}, '상태:'), h('td', {}, '실행 중')), h('tr', {}, h('th', {}, '형식:'), h('td', {}, ZTYPE[z.type])),
          h('tr', {}, h('th', {}, '영역 파일 이름:'), h('td', { class: 'mono' }, z.type === 'primary' ? z.file : '-'))),
        field('동적 업데이트:', dyn),
        h('p', { class: 'note' }, '「보안 및 비보안」은 신뢰할 수 없는 곳의 업데이트도 받으므로 보안에 취약합니다.'));
      const serial = textIn({ value: String(s.serial), label: '일련 번호', width: 14 });
      const prim = textIn({ value: s.primary, label: '주 서버', width: 18 }), resp = textIn({ value: s.resp, label: '책임자', width: 18 });
      const iv = {};
      const ivRow = (key, label) => {
        const num = textIn({ value: String(s[key].v), label: label + ' 수', width: 5 });
        const un = select(M.UNITS, s[key].u, { label: label + ' 단위' });
        iv[key] = { num, un };
        return h('div', { class: 'frow' }, h('label', { class: 'flab wide' }, label + ':'), h('div', { class: 'fin' }, num, un));
      };
      const ttl = ['d', 'h', 'm', 's'].map((k, i) => textIn({ value: String(s.ttl[k]), label: '이 레코드의 TTL ' + ['일', '시', '분', '초'][i], width: i ? 2.6 : 4 }));
      const soa = h('div', { class: 'soa' },
        h('label', { class: 'flab' }, '일련 번호:'),
        h('div', { class: 'fin' }, serial, h('button', { type: 'button', class: 'btn', onclick: () => {
          const n = Number(serial.value); if (isFinite(n) && Math.floor(n) === n) serial.value = String(n + 1);
        } }, '증가')),
        h('label', { class: 'flab' }, '주 서버:'),
        h('div', { class: 'fin' }, prim, h('button', { type: 'button', class: 'btn', disabled: true, title: WS.ui.OUT_TIP }, '찾아보기')),
        h('label', { class: 'flab' }, '책임자:'),
        h('div', { class: 'fin' }, resp, h('button', { type: 'button', class: 'btn', disabled: true, title: WS.ui.OUT_TIP }, '찾아보기')),
        ivRow('refresh', '새로 고침 간격'), ivRow('retry', '다시 시도 간격'), ivRow('expire', '다음 날짜 이후에 만료'), ivRow('minTtl', '최소(기본값) TTL'),
        h('div', { class: 'frow ttl' }, h('label', { class: 'flab wide' }, '이 레코드의 TTL:'),
          h('div', { class: 'fin' }, ttl[0], h('span', { class: 'colon' }, ':'), ttl[1], h('span', { class: 'colon' }, ':'), ttl[2], h('span', { class: 'colon' }, ':'), ttl[3], h('span', { class: 'fafter' }, '(일:시:분:초)'))));
      const ns = listView([{ label: '서버 FQDN', w: '55%' }, { label: 'IP 주소' }], z.ns.map((n, k) => ({ key: k, cells: [n, '알 수 없음'] })), null, {});
      const nsTab = h('div', {}, h('p', {}, '이 영역의 이름 서버입니다. 첫 번째 줄은 SOA의 주 서버와 같습니다.'), ns,
        h('div', { class: 'brow' }, ['추가', '편집', '제거'].map(l => h('button', { type: 'button', class: 'btn', disabled: true, title: WS.ui.OUT_TIP }, l))));
      const tb = tabs([{ id: 'gen', label: '일반', body: gen }, { id: 'soa', label: 'SOA(권한 시작)', body: soa }, { id: 'ns', label: '이름 서버', body: nsTab },
        { id: 'wins', label: 'WINS', out: true }, { id: 'xfr', label: '영역 전송', out: true }], tab || 'gen');
      function apply() {
        const v = {
          serial: serial.value.trim(), primary: prim.value, resp: resp.value,
          refresh: { v: iv.refresh.num.value.trim(), u: iv.refresh.un.value }, retry: { v: iv.retry.num.value.trim(), u: iv.retry.un.value },
          expire: { v: iv.expire.num.value.trim(), u: iv.expire.un.value }, minTtl: { v: iv.minTtl.num.value.trim(), u: iv.minTtl.un.value },
          ttl: { d: ttl[0].value.trim(), h: ttl[1].value.trim(), m: ttl[2].value.trim(), s: ttl[3].value.trim() },
        };
        const r = M.setSoa(ctx.st(), zi, v);
        if (!r.ok) { tb.show('soa'); msg({ title: z.name + ' 속성', icon: 'err', text: r.error }); return false; }
        if (z.type === 'primary') ctx.st().dns.zones[zi].dyn = dyn.value === '없음' ? 'none' : 'both';
        ctx.commit();
        prim.value = ctx.st().dns.zones[zi].soa.primary; resp.value = ctx.st().dns.zones[zi].soa.resp;
        return true;
      }
      dialog({ title: z.name + ' 속성', width: 42, body: tb,
        buttons: [
          { label: '확인', primary: true, onClick: () => apply() ? undefined : false },
          { label: '취소', cancel: true },
          { label: '적용', keep: true, onClick: () => { apply(); } },
        ] });
    }

    return { el, render };
  }

  WS.tools.dns = { id: 'dns', title: 'DNS 관리자', icon: 'dns', create };
})(window);
