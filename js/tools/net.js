/* 네트워크 연결 → 연결 속성 → Internet Protocol Version 4 (TCP/IPv4) 속성
 * IPv4 창의 「확인」은 값을 검사해 연결 속성 창에 넘기고, 연결 속성 창의 「확인」이 저장한다.
 */
(function (G) {
  'use strict';
  const WS = G.WS, M = G.WSModel;
  const { h, icon, menu, dialog, msg, ipBox, radio, check, group, tabs, field } = WS.ui;

  const ITEM_DESC = {
    client: '이 컴퓨터가 Microsoft 네트워크의 자원(공유 폴더 등)에 연결할 수 있게 합니다.',
    share: '다른 컴퓨터가 Microsoft 네트워크를 통해 이 컴퓨터의 파일과 프린터를 쓸 수 있게 합니다.',
    qos: '네트워크 트래픽의 전송 순서와 서비스 품질을 관리합니다.',
    v6: '차세대 인터넷 프로토콜입니다. 이 연습에서는 속성을 다루지 않습니다.',
    v4: '전송 제어 프로토콜/인터넷 프로토콜(TCP/IP)입니다. 서로 다른 네트워크를 연결하는 기본 프로토콜입니다. IP 주소·서브넷 마스크·기본 게이트웨이·DNS 서버를 이 항목의 속성에서 지정합니다.',
  };

  function create(ctx) {
    let sel = 0;
    const el = h('div', { class: 'tool tool-net' });

    function render() {
      const st = ctx.st();
      if (sel >= st.net.adapters.length) sel = 0;
      el.innerHTML = '';
      el.appendChild(WS.toolkit.menubar([
        { label: '구성', items: () => adapterMenu(sel) },
      ]));
      const grid = h('div', { class: 'adapters', role: 'listbox', 'aria-label': '네트워크 연결 목록' });
      st.net.adapters.forEach((a, i) => {
        const tile = h('div', { class: 'adapter' + (i === sel ? ' sel' : '') + (a.enabled ? '' : ' off'), role: 'option', tabindex: 0, 'aria-selected': i === sel ? 'true' : 'false', 'data-name': a.name },
          icon('net', 'big'),
          h('div', { class: 'ad-t' }, h('b', {}, a.name), h('span', {}, a.enabled ? '사용' : '사용 안 함'), h('span', { class: 'sub' }, a.device)));
        tile.addEventListener('mousedown', e => { if (e.button === 0 || e.button === 2) { sel = i; mark(); } });
        tile.addEventListener('dblclick', () => openStatus(i));
        tile.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); openStatus(i); }
          else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); const r = tile.getBoundingClientRect(); menu({ x: r.left + 30, y: r.bottom - 10 }, adapterMenu(i)); }
          else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); const n = grid.children[i + 1]; if (n) { sel = i + 1; mark(); n.focus(); } }
          else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); const n = grid.children[i - 1]; if (n) { sel = i - 1; mark(); n.focus(); } }
        });
        tile.addEventListener('contextmenu', e => { e.preventDefault(); sel = i; mark(); menu({ x: e.clientX, y: e.clientY }, adapterMenu(i)); });
        grid.appendChild(tile);
      });
      el.appendChild(grid);
      el.appendChild(h('p', { class: 'tool-hint' }, '연결을 마우스 오른쪽 단추로 누르면 메뉴가 열립니다. 두 번 누르면 상태 창이 열립니다.'));
      function mark() { [...grid.children].forEach((t, k) => { t.classList.toggle('sel', k === sel); t.setAttribute('aria-selected', k === sel ? 'true' : 'false'); }); }
    }

    function adapterMenu(i) {
      const a = ctx.st().net.adapters[i];
      return [
        { label: a.enabled ? '사용 안 함' : '사용', onClick: () => { M.setAdapterEnabled(ctx.st(), i, !a.enabled); ctx.commit(); } },
        { label: '상태', onClick: () => openStatus(i) },
        { label: '진단', out: true },
        { sep: true },
        { label: '연결 브리지', out: true },
        { sep: true },
        { label: '바로 가기 만들기', out: true },
        { label: '삭제', out: true },
        { label: '이름 바꾸기', out: true },
        { sep: true },
        { label: '속성', bold: true, onClick: () => openProps(i) },
      ];
    }

    function openStatus(i) {
      const a = ctx.st().net.adapters[i];
      const rows = [['IPv4 연결', a.enabled ? (a.v4.auto ? '자동 주소 받기' : '고정 주소') : '사용 안 함'], ['미디어 상태', a.enabled ? '사용' : '사용 안 함'], ['속도', '1.0Gbps']];
      const d = dialog({ title: a.name + ' 상태', width: 30,
        body: h('div', {}, group('연결', h('table', { class: 'kv' }, rows.map(r => h('tr', {}, h('th', {}, r[0]), h('td', {}, r[1])))))),
        buttons: [
          { label: '자세히', left: true, keep: true, onClick: () => openDetail(i) },
          { label: '속성', left: true, onClick: () => { setTimeout(() => openProps(i), 0); } },
          { label: '닫기', primary: true },
        ] });
      return d;
    }
    function openDetail(i) {
      const v = ctx.st().net.adapters[i].v4;
      const rows = [
        ['DHCP 사용', v.auto ? '예' : '아니요'],
        ['IPv4 주소', v.auto ? '-' : v.ip],
        ['IPv4 서브넷 마스크', v.auto ? '-' : v.mask],
        ['IPv4 기본 게이트웨이', v.auto ? '-' : (v.gw || '-')],
        ['IPv4 DNS 서버', v.dnsAuto ? '-' : ([v.dns1, v.dns2].filter(Boolean).join(', ') || '-')],
      ];
      dialog({ title: '네트워크 연결 세부 정보', width: 32,
        body: h('table', { class: 'kv wide' }, h('tr', {}, h('th', {}, '속성'), h('th', {}, '값')), rows.map(r => h('tr', {}, h('td', {}, r[0]), h('td', { class: 'mono' }, r[1])))),
        buttons: [{ label: '닫기', primary: true }] });
    }

    function openProps(i) {
      const a = ctx.st().net.adapters[i];
      const draft = { v4: M.clone(a.v4), items: M.clone(a.items), v4Touched: false };
      let cur = 'v4';
      const desc = h('p', { class: 'desc' });
      const list = h('div', { class: 'itemlist', role: 'listbox', 'aria-label': '이 연결에 다음 항목 사용' });
      const btnProp = h('button', { type: 'button', class: 'btn', onclick: () => openItem() }, '속성');
      function drawList() {
        list.innerHTML = '';
        draft.items.forEach(it => {
          const cb = h('input', { type: 'checkbox', checked: it.on, 'aria-label': it.label + ' 사용' });
          cb.addEventListener('change', () => { it.on = cb.checked; });
          const row = h('div', { class: 'irow' + (it.id === cur ? ' sel' : ''), role: 'option', tabindex: it.id === cur ? 0 : -1, 'aria-selected': it.id === cur ? 'true' : 'false', 'data-id': it.id }, cb, h('span', {}, it.label));
          row.addEventListener('mousedown', e => { if (e.target !== cb) { cur = it.id; drawList(); } });
          row.addEventListener('dblclick', e => { if (e.target !== cb) openItem(); });
          row.addEventListener('keydown', e => {
            if (e.key === ' ' && e.target !== cb) { e.preventDefault(); cb.click(); }   // Enter는 대화상자의 「확인」으로 간다(Windows와 같음)
            else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              const k = draft.items.indexOf(it) + (e.key === 'ArrowDown' ? 1 : -1);
              if (draft.items[k]) { cur = draft.items[k].id; drawList(); list.querySelector('.irow.sel').focus(); }
            }
          });
          list.appendChild(row);
        });
        desc.textContent = ITEM_DESC[cur] || '';
        btnProp.disabled = !(cur === 'v4' || cur === 'v6');
      }
      function openItem() {
        if (cur === 'v6') { msg({ title: '연습 범위 밖', icon: 'info', text: 'IPv6 속성은 이 연습에서 다루지 않습니다.' }); return; }
        if (cur !== 'v4') return;
        openV4(draft.v4, v => { draft.v4 = v; draft.v4Touched = true; });
      }
      drawList();
      const net = h('div', {},
        h('p', { class: 'lab' }, '연결에 사용할 장치:'),
        h('div', { class: 'devbox' }, icon('net'), h('span', {}, a.device), h('button', { type: 'button', class: 'btn', disabled: true, title: WS.ui.OUT_TIP }, '구성')),
        h('p', { class: 'lab' }, '이 연결에 다음 항목 사용:'),
        list,
        h('div', { class: 'brow' }, h('button', { type: 'button', class: 'btn', disabled: true, title: WS.ui.OUT_TIP }, '설치'), h('button', { type: 'button', class: 'btn', disabled: true, title: WS.ui.OUT_TIP }, '제거'), btnProp),
        group('설명', desc));
      const d = dialog({ title: a.name + ' 속성', width: 36,
        body: tabs([{ id: 'net', label: '네트워킹', body: net }, { id: 'share', label: '공유', out: true }]),
        buttons: [
          { label: '확인', primary: true, onClick: () => {
            const st = ctx.st();
            const r = M.setIpv4(st, i, draft.v4);
            if (!r.ok) { msg({ title: 'TCP/IP', icon: 'err', text: r.errors }); return false; }
            draft.items.forEach(it => M.setAdapterItem(st, i, it.id, it.on));
            ctx.commit();
          } },
          { label: '취소', cancel: true },
        ] });
      setTimeout(() => { const r = list.querySelector('.irow.sel'); if (r) r.focus(); }, 0);
      return d;
    }

    /* Internet Protocol Version 4 (TCP/IPv4) 속성 */
    function openV4(src, onOk) {
      const v = M.clone(src);
      const ip = ipBox({ value: v.ip, label: 'IP 주소' }), mask = ipBox({ value: v.mask, label: '서브넷 마스크' }), gw = ipBox({ value: v.gw, label: '기본 게이트웨이' });
      const d1 = ipBox({ value: v.dns1, label: '기본 설정 DNS 서버' }), d2 = ipBox({ value: v.dns2, label: '보조 DNS 서버' });
      const rA = radio('ipmode', '자동으로 IP 주소 받기', v.auto, () => { v.auto = true; sync(); });
      const rM = radio('ipmode', '다음 IP 주소 사용', !v.auto, () => { v.auto = false; v.dnsAuto = false; sync(); ip.focusFirst(); });
      const rDA = radio('dnsmode', '자동으로 DNS 서버 주소 받기', v.dnsAuto, () => { v.dnsAuto = true; sync(); });
      const rDM = radio('dnsmode', '다음 DNS 서버 주소 사용', !v.dnsAuto, () => { v.dnsAuto = false; sync(); d1.focusFirst(); });
      const val = check('끝날 때 설정 유효성 검사', v.validate, c => { v.validate = c; });
      function sync() {
        if (!v.auto) v.dnsAuto = false;
        rA.input.checked = v.auto; rM.input.checked = !v.auto;
        rDA.input.checked = v.dnsAuto; rDM.input.checked = !v.dnsAuto;
        [ip, mask, gw].forEach(b => b.setDisabled(v.auto));
        rDA.input.disabled = !v.auto; rDA.classList.toggle('dis', !v.auto);
        [d1, d2].forEach(b => b.setDisabled(v.dnsAuto));
      }
      const general = h('div', { class: 'v4' },
        h('p', { class: 'intro' }, '네트워크가 자동 설정을 지원하면 IP 설정을 자동으로 받을 수 있습니다. 지원하지 않으면 네트워크 관리자가 정한 값을 입력합니다.'),
        rA,
        group(null, rM, field('IP 주소:', ip), field('서브넷 마스크:', mask), field('기본 게이트웨이:', gw)),
        rDA,
        group(null, rDM, field('기본 설정 DNS 서버:', d1), field('보조 DNS 서버:', d2)),
        h('div', { class: 'brow spread' }, val, h('button', { type: 'button', class: 'btn', disabled: true, title: WS.ui.OUT_TIP }, '고급')));
      sync();
      const d = dialog({ title: 'Internet Protocol Version 4 (TCP/IPv4) 속성', width: 38, cls: 'v4dlg',
        body: tabs([{ id: 'gen', label: '일반', body: general }, { id: 'alt', label: '대체 구성', out: true }]),
        buttons: [
          { label: '확인', primary: true, onClick: () => {
            const out = { auto: v.auto, ip: ip.value, mask: mask.value, gw: gw.value, dnsAuto: v.dnsAuto, dns1: d1.value, dns2: d2.value, validate: v.validate };
            const r = M.checkIpv4(out);
            if (r.errors.length) { msg({ title: 'TCP/IP', icon: 'err', text: r.errors[0] }); return false; }
            if (r.warns.length) {
              msg({ title: 'TCP/IP 경고', icon: 'q', text: r.warns[0], buttons: ['예', '아니요'], def: 1 }).then(b => { if (b === '예') { onOk(out); d.close('확인'); } });
              return false;
            }
            onOk(out);
          } },
          { label: '취소', cancel: true },
        ] });
      setTimeout(() => { (v.auto ? rA.input : (ip.parts[0])).focus(); }, 0);
      return d;
    }

    return { el, render };
  }

  WS.tools.net = { id: 'net', title: '네트워크 연결', icon: 'net', create };
})(window);
