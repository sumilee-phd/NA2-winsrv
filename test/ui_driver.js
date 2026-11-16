/* 화면 조작 시험(브라우저에서 실행): 16개 과제를 화면 조작만으로 풀고 채점한다.
 * 마우스 누르기·두 번 누르기·오른쪽 단추 메뉴, 입력 칸에 글자 넣기(input 이벤트)만 쓰고 모델 함수는 부르지 않는다.
 * 쓰는 법(로컬 서버에서 연 index.html의 개발자 도구 콘솔 또는 자동화 도구):
 *   eval(await (await fetch('test/ui_driver.js', {cache: 'reload'})).text());
 *   await __UI.runAll();          // 과제마다 [id, 통과 수/전체, 오류]
 *   await __UI.run('dhcp-2');     // 과제 하나
 */
(function () {
  'use strict';
  const wait = ms => new Promise(r => setTimeout(r, ms == null ? 40 : ms));
  const top = () => [...document.querySelectorAll('.dlg')].pop() || null;
  const titleOf = d => d ? d.querySelector('.dlg-title span').textContent : '';
  function fail(m) { throw new Error(m); }
  async function checkMsg() {
    const d = top();
    if (d && d.classList.contains('msgdlg') && !/만들었습니다/.test(d.textContent)) fail('메시지 상자: ' + d.querySelector('.mtext').textContent);
  }
  async function click(el) {
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
    el.click(); await wait();
  }
  async function dbl(el) { await click(el); el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); await wait(); }
  async function rclick(el) {
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 2 }));
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 20, clientY: r.top + 8 }));
    await wait();
  }
  async function pick(label) {
    const b = [...document.querySelectorAll('.menu .mi')].find(x => x.querySelector('.ml').textContent === label);
    if (!b) fail('메뉴 항목 없음: ' + label);
    if (b.disabled) fail('메뉴 항목 비활성: ' + label);
    b.click(); await wait(80);
  }
  const win = () => document.querySelector('.win:not([hidden])');
  function row(label) {
    const r = [...win().querySelectorAll('.trow')].find(x => x.querySelector('.tl').textContent === label);
    if (!r) fail('트리 항목 없음: ' + label);
    return r;
  }
  async function expand(label) { const r = row(label); if (r.getAttribute('aria-expanded') === 'false') { r.querySelector('.tog').click(); await wait(); } }
  async function sel(label) { await click(row(label)); }
  function lvRow(text) {
    const r = [...win().querySelectorAll('.lv tbody tr')].find(x => x.cells[0] && x.cells[0].textContent.trim() === text);
    if (!r) fail('목록 줄 없음: ' + text);
    return r;
  }
  async function press(label, root) {
    const d = root || top();
    const b = [...d.querySelectorAll('button')].find(x => x.textContent.trim() === label);
    if (!b) fail('단추 없음: ' + label + ' @' + titleOf(d));
    if (b.disabled) fail('단추 비활성: ' + label);
    b.click(); await wait(80); await checkMsg();
  }
  async function set(label, value) {
    const d = top();
    const el = d.querySelector('[aria-label="' + label + '"]');
    if (!el) fail('입력 칸 없음: ' + label + ' @' + titleOf(d));
    if (el.classList.contains('ipbox')) {
      el.parts.forEach(p => { p.value = ''; });
      const p = el.parts[0]; p.focus(); p.value = value; p.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (el.tagName === 'SELECT') {
      el.value = value; el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      el.focus(); el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    await wait(20);
  }
  async function radio(label) {
    const l = [...top().querySelectorAll('label.radio')].find(x => x.textContent.trim() === label);
    if (!l) fail('선택 단추 없음: ' + label);
    l.querySelector('input').click(); await wait(20);
  }
  async function tab(label) { await press(label); }
  async function addIp(value) {             // 마법사의 IP 목록(추가 단추)
    const list = top().querySelector('.iplist');
    const box = list.querySelector('.ipbox');
    box.parts.forEach(p => { p.value = ''; });
    box.parts[0].value = value; box.parts[0].dispatchEvent(new Event('input', { bubbles: true }));
    await press('추가', list);
  }
  async function open(id) { await click(document.querySelector('.lnk[data-tool="' + id + '"]')); await wait(60); }
  async function wizNext(n) { for (let i = 0; i < (n || 1); i++) await press('다음 >'); }

  /* ---------------------------------------------------- 유형별 조작 */
  async function ipv4(adapterName, v) {
    await open('net');
    const tile = [...win().querySelectorAll('.adapter')].find(t => t.dataset.name === adapterName);
    await rclick(tile); await pick('속성');
    await dbl(top().querySelector('.irow[data-id="v4"]'));
    if (v.auto) { await radio('자동으로 IP 주소 받기'); await radio('자동으로 DNS 서버 주소 받기'); }
    else {
      await radio('다음 IP 주소 사용');
      await set('IP 주소', v.ip); await set('서브넷 마스크', v.mask); await set('기본 게이트웨이', v.gw || '');
      await set('기본 설정 DNS 서버', v.dns1 || ''); await set('보조 DNS 서버', v.dns2 || '');
    }
    await press('확인');
    if (titleOf(top()) !== adapterName + ' 속성') fail('IPv4 창이 닫히지 않음: ' + titleOf(top()));
    await press('확인');
  }
  async function policy(folder, name, value, acceptSuggest) {
    await open('sec');
    if (row('계정 정책').getAttribute('aria-expanded') === 'false') await expand('계정 정책');
    await sel(folder);
    await dbl(lvRow(name));
    if (typeof value === 'boolean') await radio(value ? '사용' : '사용 안 함');
    else { const inp = top().querySelector('.spin-in'); inp.value = String(value); inp.dispatchEvent(new Event('input', { bubbles: true })); }
    await press('확인');
    if (titleOf(top()) === '제안된 값 변경') { if (!acceptSuggest) fail('예상하지 않은 제안 창'); await press('확인'); }
    else if (acceptSuggest) fail('제안 창이 나오지 않음: ' + name);
    if (top()) fail('창이 남아 있음: ' + titleOf(top()));
  }
  async function newScope(w) {
    await open('dhcp');
    await rclick(row('IPv4'));                // 선택하지 않고 오른쪽 단추: 새 범위가 비활성이어야 한다
    const b = [...document.querySelectorAll('.menu .mi')].find(x => x.querySelector('.ml').textContent === '새 범위');
    if (!b || !b.disabled) fail('IPv4를 선택하지 않았는데 새 범위가 활성');
    WS.ui.closeMenu();
    await sel('IPv4'); await rclick(row('IPv4')); await pick('새 범위');
    await wizNext();
    await set('이름', w.name); if (w.desc) await set('설명', w.desc); await wizNext();
    await set('시작 IP 주소', w.start); await set('끝 IP 주소', w.end); await set('길이', String(w.len)); await wizNext();
    for (const x of w.excl || []) { await set('제외할 시작 IP 주소', x[0]); await set('제외할 끝 IP 주소', x[1] || ''); await press('추가'); }
    await wizNext();
    await set('일', String(w.lease[0])); await set('시간', String(w.lease[1])); await set('분', String(w.lease[2])); await wizNext();
    if (!w.now) { await radio('아니요, 나중에 옵션을 구성합니다'); await wizNext(); }
    else {
      await radio('예, 지금 옵션을 구성합니다'); await wizNext();
      for (const r of w.router || []) await addIp(r);
      await wizNext();
      await set('부모 도메인', w.domain || '');
      for (const r of w.dns || []) await addIp(r);
      await wizNext(); await wizNext();
      await radio(w.activate ? '예, 지금 범위를 활성화합니다' : '아니요, 나중에 범위를 활성화합니다'); await wizNext();
    }
    await press('마침');
    if (top()) fail('마법사가 닫히지 않음');
  }
  async function newZone(name, dyn) {
    await open('dns');
    await sel('정방향 조회 영역'); await rclick(row('정방향 조회 영역')); await pick('새 영역');
    await wizNext(); await radio('주 영역'); await wizNext();
    await set('영역 이름', name); await wizNext();
    const f = top().querySelector('[aria-label="새 파일 이름"]').value;
    if (f !== name + '.dns') fail('영역 파일 자동 이름 ' + f);
    await wizNext();
    await radio(dyn === 'both' ? '보안 및 비보안 동적 업데이트 허용' : '동적 업데이트 허용 안 함'); await wizNext();
    await press('마침');
  }
  async function zoneMenu(zone, item) { await open('dns'); await expand('정방향 조회 영역'); await sel(zone); await rclick(row(zone)); await pick(item); }
  async function addHost(zone, name, ip) {
    await zoneMenu(zone, '새 호스트(A 또는 AAAA)');
    await set('이름', name); await set('IP 주소', ip);
    await press('호스트 추가');
    if (!/만들었습니다/.test(top().textContent)) fail('호스트 생성 알림 없음');
    await press('확인'); await press('완료');
  }
  async function addAlias(zone, name, target) {
    await zoneMenu(zone, '새 별칭(CNAME)');
    await set('별칭 이름', name); await set('대상 호스트의 정규화된 도메인 이름(FQDN)', target);
    await press('확인');
  }
  async function soa(zone, f) {
    await zoneMenu(zone, '속성');
    await tab('SOA(권한 시작)');
    await f();
    await press('확인');
    if (top()) fail('영역 속성 창이 닫히지 않음');
  }

  const SC = {
    'net-1': () => ipv4('로컬 영역 연결', { ip: '172.16.40.66', mask: '255.255.255.192', gw: '172.16.40.65', dns1: '172.16.40.70' }),
    'net-2': () => ipv4('로컬 영역 연결', { ip: '10.24.8.130', mask: '255.255.255.128', gw: '10.24.8.254', dns1: '10.24.1.10', dns2: '10.24.1.11' }),
    'net-3': () => ipv4('로컬 영역 연결 2', { ip: '192.168.205.9', mask: '255.255.255.240', gw: '192.168.205.1', dns1: '192.168.205.2' }),
    'net-4': () => ipv4('로컬 영역 연결', { auto: true }),
    'sec-1': async () => { await policy('암호 정책', '최소 암호 길이', 8); await policy('암호 정책', '최근 암호 기억', 5); await policy('암호 정책', '암호는 복잡성을 만족해야 함', true); },
    'sec-2': async () => { await policy('암호 정책', '최대 암호 사용 기간', 60); await policy('암호 정책', '최소 암호 사용 기간', 3); await policy('암호 정책', '해독 가능한 암호화를 사용하여 암호 저장', false); },
    'sec-3': async () => { await policy('계정 잠금 정책', '계정 잠금 임계값', 5, true); await policy('계정 잠금 정책', '계정 잠금 기간', 15, true); },
    'sec-4': async () => { await policy('암호 정책', '최소 암호 길이', 10); await policy('계정 잠금 정책', '계정 잠금 임계값', 3, true); await policy('계정 잠금 정책', '계정 잠금 기간', 0); await policy('계정 잠금 정책', '다음 시간 후 계정 잠금 수를 원래대로 설정', 20); },
    'dhcp-1': () => newScope({ name: 'ROOM-301', desc: '3층 실습실', start: '192.168.30.1', end: '192.168.30.254', len: 24, excl: [['192.168.30.1', '192.168.30.20']], lease: [0, 4, 0] }),
    'dhcp-2': () => newScope({ name: 'OFFICE-B', start: '172.20.5.65', end: '172.20.5.126', len: 26, excl: [['172.20.5.65', '172.20.5.70']], lease: [2, 12, 0], now: true,
      router: ['172.20.5.65'], domain: 'office.test', dns: ['172.20.5.66'], activate: true }),
    'dhcp-3': () => newScope({ name: 'WIFI-GUEST', start: '10.77.16.1', end: '10.77.31.254', len: 20, excl: [['10.77.16.1', ''], ['10.77.31.250', '10.77.31.254']], lease: [0, 1, 30] }),
    'dhcp-4': async () => {
      await open('dhcp');
      const label = '범위 [192.168.31.1] ROOM-302';
      await sel(label); await rclick(row(label)); await pick('속성');
      await set('일', '0'); await set('시간', '6'); await set('분', '0'); await press('확인');
      await expand(label); await rclick(row('주소 풀')); await pick('새 제외 범위');
      await set('제외할 시작 IP 주소', '192.168.31.240'); await set('제외할 끝 IP 주소', '192.168.31.254'); await press('추가'); await press('닫기');
      await rclick(row(label)); await pick('활성화');
    },
    'dns-1': async () => { await newZone('campus.test', 'none'); await addHost('campus.test', 'web', '10.30.1.20'); },
    'dns-2': async () => { await addHost('netlab.test', 'srv01', '192.168.60.31'); await addAlias('netlab.test', 'www', 'srv01.netlab.test'); await addAlias('netlab.test', 'ftp', 'srv01.netlab.test'); },
    'dns-3': () => soa('office.test', async () => {
      await set('일련 번호', '2026111501'); await set('주 서버', 'ns1.office.test'); await set('책임자', 'admin.office.test');
      await set('새로 고침 간격 수', '7200'); await set('새로 고침 간격 단위', '초');
      await set('다시 시도 간격 수', '20'); await set('다시 시도 간격 단위', '분');
      await set('다음 날짜 이후에 만료 수', '7'); await set('다음 날짜 이후에 만료 단위', '일');
      await set('최소(기본값) TTL 수', '30'); await set('최소(기본값) TTL 단위', '분');
      await set('이 레코드의 TTL 시', '2');
    }),
    'dns-4': async () => {
      await newZone('branch.test', 'both'); await addHost('branch.test', 'ns1', '172.31.0.2');
      await soa('branch.test', async () => { await press('증가'); await set('주 서버', 'ns1.branch.test'); await set('다시 시도 간격 수', '5'); await set('다시 시도 간격 단위', '분'); });
    },
  };

  async function run(id) {
    const task = WSTasks.byId(id);
    WS.app.startTask(task, false); await wait(60);
    let err = '';
    try { await SC[id](); } catch (e) { err = e.message; }
    while (top()) { const d = top(); const x = d.querySelector('.dlg-x'); x.click(); await wait(20); if (top() === d) break; }
    WS.ui.closeMenu();
    const g = WS.app.grade();
    return { id, result: g.passed + '/' + g.total, pass: g.pass && !err, err, fails: g.items.filter(i => !i.ok).map(i => i.label + ' = ' + i.actual) };
  }
  async function runAll() {
    const out = [];
    for (const t of WSTasks.TASKS) out.push(await run(t.id));
    return { passed: out.filter(r => r.pass).length, total: out.length, rows: out };
  }
  window.__UI = { run, runAll };
})();
