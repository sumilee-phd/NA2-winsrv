// 윈도우 서버 설정 연습 대조 시험: node test/verify.js
// 1) 과제마다 모범 풀이를 상태 모델로 실행해 채점이 모두 통과하는지, 처음 상태는 통과하지 않는지
// 2) 일부러 틀린 풀이가 해당 항목만 불합격으로 채점되는지
// 3) 모델 동작이 확인 기준(Windows Server 2022 화면 캡처 2026-11-15, NA2-study windows-labs 에뮬레이터 기록 2026-10-23)과 같은지
// 4) 과제 자료에 협회 자료의 값(이름·주소)이 들어가지 않았는지
'use strict';
const path = require('path');
const fs = require('fs');
const M = require(path.join(__dirname, '..', 'js', 'model.js'));
const T = require(path.join(__dirname, '..', 'js', 'tasks.js'));

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) pass++; else { fail++; console.log('  실패: ' + name); } }
function eq(a, b, name) { ok(JSON.stringify(a) === JSON.stringify(b), name + ' (기대 ' + JSON.stringify(b) + ', 실제 ' + JSON.stringify(a) + ')'); }
function failedLabels(task, st) { return T.grade(task, st).items.filter(x => !x.ok).map(x => x.label); }

console.log('1. 모범 풀이');
const perType = {};
T.TASKS.forEach(task => {
  perType[task.type] = (perType[task.type] || 0) + 1;
  const st0 = T.fresh(task);
  ok(!T.grade(task, st0).pass, task.id + ' 처음 상태는 불합격');
  const st = T.fresh(task);
  const r = task.solve(st);
  ok(r && r.ok !== false, task.id + ' 모범 풀이 실행 오류 없음 ' + JSON.stringify(r));
  const g = T.grade(task, st);
  ok(g.pass, task.id + ' 모범 풀이 채점 통과 ' + JSON.stringify(g.items.filter(x => !x.ok)));
  ok(task.checks.length >= 2 && task.steps.length >= 3 && task.given.length >= 1, task.id + ' 채점 항목·작업 순서·조건 표 있음');
  // 상태를 JSON으로 저장했다가 되살려도 채점이 같다(브라우저 저장소)
  ok(T.grade(task, JSON.parse(JSON.stringify(st))).pass, task.id + ' 저장 후 복원해도 통과');
});
T.TYPES.forEach(t => ok((perType[t.id] || 0) >= 3, t.name + ' 과제 3개 이상(' + (perType[t.id] || 0) + '개)'));
ok(new Set(T.TASKS.map(t => t.id)).size === T.TASKS.length, '과제 id 중복 없음');

console.log('2. 틀린 풀이');
(function () {
  let t = T.byId('net-1'), st = T.fresh(t);
  M.setIpv4(st, 0, { auto: false, ip: '172.16.40.66', mask: '255.255.255.0', gw: '172.16.40.65', dnsAuto: false, dns1: '172.16.40.70' });
  eq(failedLabels(t, st), ['로컬 영역 연결 · 서브넷 마스크'], 'net-1 마스크를 /24로 입력');
  st = T.fresh(t);
  M.setIpv4(st, 0, { auto: false, ip: '172.16.40.70', mask: '255.255.255.192', gw: '172.16.40.65', dnsAuto: false, dns1: '172.16.40.66' });
  eq(failedLabels(t, st), ['로컬 영역 연결 · IP 주소', '로컬 영역 연결 · 기본 설정 DNS 서버'], 'net-1 IP와 DNS를 바꿔 입력');

  t = T.byId('net-2'); st = T.fresh(t);
  M.setIpv4(st, 0, { auto: false, ip: '10.24.8.130', mask: '255.255.255.128', gw: '10.24.8.255', dnsAuto: false, dns1: '10.24.1.10', dns2: '10.24.1.11' });
  eq(failedLabels(t, st), ['로컬 영역 연결 · 기본 게이트웨이'], 'net-2 게이트웨이에 브로드캐스트 주소');

  t = T.byId('net-3'); st = T.fresh(t);
  M.setIpv4(st, 0, { auto: false, ip: '192.168.205.9', mask: '255.255.255.240', gw: '192.168.205.1', dnsAuto: false, dns1: '192.168.205.2' });
  ok(failedLabels(t, st).includes('로컬 영역 연결 · IP 주소 지정 방식') && failedLabels(t, st).includes('로컬 영역 연결 2 · IP 주소'), 'net-3 첫 번째 연결에 잘못 설정');

  t = T.byId('net-4'); st = T.fresh(t);
  st.net.adapters[0].v4.auto = true; // IP만 자동, DNS는 수동으로 남음
  eq(failedLabels(t, st), ['로컬 영역 연결 · DNS 서버 지정 방식'], 'net-4 DNS를 수동으로 둠');

  t = T.byId('sec-3'); st = T.fresh(t);
  M.secSet(st, 'lockThreshold', 5);
  eq(failedLabels(t, st), ['계정 잠금 기간', '다음 시간 후 계정 잠금 수를 원래대로 설정'], 'sec-3 제안 값 30분을 그대로 둠');
  t = T.byId('sec-1'); st = T.fresh(t);
  M.secSet(st, 'minLen', 8); M.secSet(st, 'history', 5);
  eq(failedLabels(t, st), ['암호는 복잡성을 만족해야 함'], 'sec-1 복잡성 빠뜨림');

  t = T.byId('dhcp-1'); st = T.fresh(t);
  M.createScope(st, { name: 'ROOM-301', start: '192.168.30.1', end: '192.168.30.254', mask: '255.255.255.0', excl: [], lease: { d: 8, h: 4, m: 0 }, configNow: false });
  eq(failedLabels(t, st), ['범위 ROOM-301 · 제외 범위 192.168.30.1 ~ 192.168.30.20', '범위 ROOM-301 · 임대 기간'], 'dhcp-1 제외 범위 추가 안 함, 일 8을 그대로 둠');
  t = T.byId('dhcp-2'); st = T.fresh(t);
  M.createScope(st, { name: 'OFFICE-B', start: '172.20.5.65', end: '172.20.5.126', mask: '255.255.255.192', excl: [{ lo: '172.20.5.65', hi: '172.20.5.70' }],
    lease: { d: 2, h: 12, m: 0 }, configNow: true, router: ['172.20.5.65'], domain: 'office.test', dns: ['172.20.5.66'], activate: false });
  eq(failedLabels(t, st), ['범위 OFFICE-B · 상태'], 'dhcp-2 나중에 활성화를 고름');
  t = T.byId('dhcp-3'); st = T.fresh(t);
  M.createScope(st, { name: 'WIFI-GUEST', start: '10.77.16.1', end: '10.77.31.254', mask: '255.255.240.0', excl: [{ lo: '10.77.31.250', hi: '10.77.31.254' }], lease: { d: 0, h: 1, m: 30 } });
  eq(failedLabels(t, st), ['범위 WIFI-GUEST · 제외 범위 10.77.16.1 ~ 10.77.16.1', '범위 WIFI-GUEST · 제외 범위 개수'], 'dhcp-3 단일 주소 제외 빠뜨림');

  t = T.byId('dns-2'); st = T.fresh(t);
  let zi = M.zoneIndex(st, 'netlab.test');
  M.addHost(st, zi, { name: 'srv01', ip: '192.168.60.31' });
  M.addAlias(st, zi, { name: 'www', target: '192.168.60.31' });
  M.addAlias(st, zi, { name: 'ftp', target: 'srv01.netlab.test.' });
  eq(failedLabels(t, st), ['영역 netlab.test · 별칭(CNAME) www.netlab.test'], 'dns-2 CNAME 대상에 IP 주소 입력, 끝 점은 통과');
  t = T.byId('dns-3'); st = T.fresh(t);
  zi = M.zoneIndex(st, 'office.test');
  M.setSoa(st, zi, { serial: 2026111501, primary: 'NS1.OFFICE.TEST.', resp: 'admin.office.test', refresh: { v: 7200, u: '초' }, retry: { v: 1200, u: '분' },
    expire: { v: 604800, u: '초' }, minTtl: { v: 1800, u: '초' }, ttl: { d: 0, h: 1, m: 0, s: 0 } });
  eq(failedLabels(t, st), ['영역 office.test · 다시 시도 간격', '영역 office.test · 이 레코드의 TTL'], 'dns-3 초 값을 분 칸에 입력, TTL 기본값 둠, 대문자·끝 점은 통과');
  t = T.byId('dns-1'); st = T.fresh(t);
  const r = M.createZone(st, { type: 'primary', name: 'campus.test', dyn: 'both' });
  M.addHost(st, r.index, { name: 'web', ip: '10.30.1.20' });
  eq(failedLabels(t, st), ['영역 campus.test · 동적 업데이트'], 'dns-1 동적 업데이트 허용');
})();

console.log('3. 모델 동작');
// IPv4 계산
for (let n = 0; n <= 32; n++) ok(M.lenFromMask(M.maskFromLen(n)) === n, '길이 ' + n + ' ↔ 마스크 왕복');
eq([M.maskFromLen(25), M.maskFromLen(26), M.maskFromLen(28), M.maskFromLen(20)], ['255.255.255.128', '255.255.255.192', '255.255.255.240', '255.255.240.0'], '대표 마스크');
ok(M.lenFromMask('255.255.0.255') === -1, '이어지지 않는 마스크 거부');
eq([M.netOf('10.24.8.130', '255.255.255.128'), M.bcastOf('10.24.8.130', '255.255.255.128')], ['10.24.8.128', '10.24.8.255'], '네트워크·브로드캐스트 주소');
// 네트워크 속성 확인 단추 검사
let c = M.checkIpv4({ auto: false, ip: '192.168.50.18', mask: '', gw: '' });
ok(c.errors.some(e => e.includes('서브넷 마스크')), '마스크를 비우면 오류(에뮬레이터는 마스크를 자동으로 채우지 않음)');
c = M.checkIpv4({ auto: false, ip: '192.168.50.16', mask: '255.255.255.248' });
ok(c.errors.some(e => e.includes('네트워크 주소')), '네트워크 주소를 서버에 지정하면 오류');
c = M.checkIpv4({ auto: false, ip: '192.168.50.23', mask: '255.255.255.248' });
ok(c.errors.some(e => e.includes('브로드캐스트')), '브로드캐스트 주소를 서버에 지정하면 오류');
c = M.checkIpv4({ auto: false, ip: '192.168.50.18', mask: '255.255.255.248', gw: '192.168.50.1' });
ok(!c.errors.length && c.warns.length === 1, '게이트웨이가 서브넷 밖이면 경고(저장 여부를 물음)');
let st = M.create();
M.setIpv4(st, 0, { auto: false, ip: '192.168.50.18', mask: '255.255.255.248', gw: '192.168.50.17', dnsAuto: true, dns1: '192.168.50.19' });
ok(st.net.adapters[0].v4.dnsAuto === false && st.net.adapters[0].v4.dns1 === '192.168.50.19', '다음 IP 주소 사용이면 DNS도 수동 지정');
ok(M.setIpv4(st, 0, { auto: false, ip: '192.168.50.300', mask: '255.255.255.0' }).ok === false, '255를 넘는 칸은 저장하지 않음');

// 로컬 보안 정책: WS2022 캡처 02a·02e·02f·02g
st = M.create();
eq(['history', 'maxAge', 'minLen', 'minAge', 'lockDuration', 'lockThreshold', 'lockReset'].map(k => M.secText(st, k)),
  ['0 개 암호 기억됨', '42 일', '0 문자', '0 일', '해당 없음', '0 번의 잘못된 로그온 시도', '해당 없음'], '보안 정책 기본값 표시');
let ch = M.secChange(st, 'lockDuration', 20);
ok(!!ch.error, '임계값 0이면 잠금 기간을 바꿀 수 없음');
ch = M.secChange(st, 'lockThreshold', 3);
eq(ch.suggest.map(s => [s.key, s.from, s.to]), [['lockDuration', '해당 없음', '30 분'], ['lockReset', '해당 없음', '30 분']], '임계값 3 → 제안 값 30분·30분(02e)');
ok(/이제 3 번의 잘못된 로그온 시도이므로/.test(ch.message), '제안 창 문구');
M.secApply(st, ch.changes);
ch = M.secChange(st, 'lockDuration', 20);
eq(ch.suggest.map(s => [s.key, s.to]), [['lockReset', '20 분']], '잠금 기간 20 → 원래대로 설정 20분 제안(02g)');
M.secApply(st, ch.changes);
eq([st.sec.lockDuration, st.sec.lockThreshold, st.sec.lockReset], [20, 3, 20], '02g 최종 20분·3회·20분');
ch = M.secChange(st, 'lockReset', 45);
eq(ch.suggest.map(s => [s.key, s.to]), [['lockDuration', '45 분']], '원래대로 설정이 잠금 기간보다 길면 잠금 기간 제안');
ch = M.secChange(st, 'lockThreshold', 0);
ok(ch.changes.lockDuration === null && ch.changes.lockReset === null && !ch.suggest.length, '임계값 0 → 두 항목 해당 없음');
ch = M.secChange(st, 'minLen', 15);
ok(!!ch.error, '최소 암호 길이 15는 범위 밖');
st = M.create(); M.secSet(st, 'minAge', 10);
ch = M.secChange(st, 'maxAge', 5);
eq(ch.suggest.map(s => [s.key, s.to]), [['minAge', '4 일']], '최대 사용 기간 < 최소 사용 기간 → 최소 사용 기간 제안');

// DHCP: WS2022 캡처 03c·03e·03l·03m, 에뮬레이터 기록
st = M.create();
ok(/같은 서브넷/.test(M.checkRange(st, { start: '192.168.100.1', end: '192.168.101.10', mask: '255.255.255.0' })), '서로 다른 서브넷이면 오류');
ok(/네트워크 주소/.test(M.checkRange(st, { start: '192.168.100.0', end: '192.168.100.10', mask: '255.255.255.0' })), '네트워크 주소로 시작하면 오류');
ok(/앞에/.test(M.checkRange(st, { start: '192.168.100.20', end: '192.168.100.10', mask: '255.255.255.0' })), '끝이 시작보다 앞이면 오류');
ok(M.checkRange(st, { start: '192.168.100.1', end: '192.168.100.126', mask: M.maskFromLen(25) }) === null, '.1~.126 /25는 통과');
ok(/안에/.test(M.checkExclusion({ start: '192.168.100.1', end: '192.168.100.126' }, '192.168.100.120', '192.168.100.130')), '제외 범위가 범위 밖이면 오류');
ok(M.checkExclusion({ start: '192.168.100.1', end: '192.168.100.126' }, '192.168.100.5', '') === null, '단일 주소 제외는 끝 주소를 비워도 됨');
ok(/1분/.test(M.checkLease({ d: 0, h: 0, m: 0 })), '임대 기간 0은 오류');
let res = M.createScope(st, { name: 'AI-LAB', start: '192.168.100.1', end: '192.168.100.126', mask: '255.255.255.128', excl: [{ lo: '192.168.100.1', hi: '192.168.100.10' }],
  lease: { d: 0, h: 6, m: 0 }, configNow: false, router: ['192.168.100.1'], activate: true });
ok(res.ok && st.dhcp.scopes[0].active === false && st.dhcp.scopes[0].opts.router.length === 0, '옵션을 나중에 구성하면 비활성·옵션 없음(03l)');
ok(M.poolCount(st.dhcp.scopes[0]) === 116, '배포 후보 116개');
eq(M.scopeLabel(st.dhcp.scopes[0]), '범위 [192.168.100.1] AI-LAB', '범위 표시(에뮬레이터 표기)');
ok(/이미/.test(M.checkRange(st, { start: '192.168.100.30', end: '192.168.100.40', mask: '255.255.255.128' })), '같은 서브넷 범위 중복 거부');
ok(M.scopeAddExclusion(st, 0, '192.168.100.200', '').ok === false, '범위 밖 제외 거부');

// DNS: WS2022 캡처 04d·04m·04n, 에뮬레이터 기록
st = M.create();
ok(/올바르지/.test(M.checkZoneName(st, 'bad_zone..test')), '잘못된 영역 이름 거부');
res = M.createZone(st, { type: 'primary', name: 'lab.test' });
const z = st.dns.zones[0];
eq([z.file, z.dyn, z.soa.serial, z.soa.resp, z.soa.refresh, z.soa.retry, z.soa.expire, z.soa.minTtl, z.soa.ttl],
  ['lab.test.dns', 'none', 1, 'hostmaster.', { v: 15, u: '분' }, { v: 10, u: '분' }, { v: 1, u: '일' }, { v: 1, u: '시간' }, { d: 0, h: 1, m: 0, s: 0 }], '새 영역 기본값(04d·04e·04m)');
ok(/이미/.test(M.checkZoneName(st, 'LAB.TEST.')), '같은 영역 이름(대소문자·끝 점 무시) 거부');
ok(M.addHost(st, 0, { name: 'web01', ip: '192.168.60.20' }).fqdn === 'web01.lab.test', '호스트 FQDN');
ok(M.addAlias(st, 0, { name: 'web01', target: 'x.lab.test' }).ok === false, '같은 이름에 CNAME 거부');
ok(M.addAlias(st, 0, { name: 'www', target: 'web01.lab.test' }).ok, 'CNAME 추가');
ok(M.addHost(st, 0, { name: 'www', ip: '192.168.60.21' }).ok === false, 'CNAME 이름에 A 거부');
ok(M.addAlias(st, 0, { name: '', target: 'web01.lab.test' }).ok === false, '상위 폴더 이름에 CNAME 거부');
eq(M.zoneRows(z).map(r => r.type), ['권한 시작(SOA)', '이름 서버(NS)', '호스트(A)', '별칭(CNAME)'], '레코드 목록 순서(04o)');
res = M.setSoa(st, 0, { serial: 2026102301, primary: 'ns1.lab.test', resp: 'hostmaster.lab.test', refresh: { v: 3600, u: '초' }, retry: { v: 900, u: '초' },
  expire: { v: 86400, u: '초' }, minTtl: { v: 600, u: '초' }, ttl: { d: 0, h: 1, m: 0, s: 0 } });
eq([M.secs(z.soa.refresh), M.secs(z.soa.retry), M.secs(z.soa.expire), M.secs(z.soa.minTtl), M.ttlSecs(z.soa.ttl), z.soa.primary], [3600, 900, 86400, 600, 3600, 'ns1.lab.test.'], '초 단위 입력(04n)');
ok(M.setSoa(st, 0, Object.assign(M.clone(z.soa), { ttl: { d: 0, h: 24, m: 0, s: 0 } })).ok === false, 'TTL 시 칸 24 거부');
ok(M.setSoa(st, 0, Object.assign(M.clone(z.soa), { resp: 'admin@lab.test' })).ok === false, '책임자에 @ 거부');

console.log('4. 자료 점검');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'tasks.js'), 'utf8') + fs.readFileSync(path.join(__dirname, '..', 'js', 'model.js'), 'utf8');
['icqa', 'ICQAServer', '211.111.100', '192.168.100.14'].forEach(w => ok(!src.toLowerCase().includes(w.toLowerCase()), '협회 자료 값 없음: ' + w));

console.log('\n통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
