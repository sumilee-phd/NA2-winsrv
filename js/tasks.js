/* 윈도우 서버 설정 연습 과제
 * 네트워크관리사 2급 실기의 윈도우 서버 설정 유형(네트워크 속성, 로컬 보안 정책, DHCP, DNS)에 맞춰 새로 만든 과제다.
 * 주소·이름·수치는 모두 연습용으로 새로 정했다. 기출 지문과 수치, 협회 자료의 값은 쓰지 않는다.
 * 채점은 최종 설정값만 본다. 조작 순서는 보지 않는다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./model.js'));
  else root.WSTasks = factory(root.WSModel);
}(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';

  var TYPES = [
    { id: 'net', no: 1, name: '네트워크 속성', tool: 'net', desc: 'TCP/IPv4 주소 · 서브넷 마스크 · 게이트웨이 · DNS 서버' },
    { id: 'sec', no: 2, name: '로컬 보안 정책', tool: 'sec', desc: '암호 정책 · 계정 잠금 정책 · 보안 옵션(로그온 메시지·계정 이름)' },
    { id: 'dhcp', no: 3, name: 'DHCP', tool: 'dhcp', desc: '새 범위 마법사 · 제외 범위 · 임대 기간 · 옵션' },
    { id: 'dns', no: 4, name: 'DNS', tool: 'dns', desc: '새 영역 · 호스트(A) · 별칭(CNAME) · SOA · 영어형 문제' },
    { id: 'web', no: 5, name: '웹(IIS)', tool: 'iis', desc: '웹 사이트 추가 · 고급 설정 · 기본 문서 · 인증 · IP 제한 · 오류 페이지 · SMTP' },
    { id: 'ftp', no: 6, name: 'FTP', tool: 'iis', desc: 'FTP 사이트 추가 · 고급 설정 · 디렉터리 검색 · 방화벽 지원 · 메시지 · 저장 확인' },
    { id: 'user', no: 7, name: '로컬 사용자 및 그룹', tool: 'users', desc: '새 사용자 · 소속 그룹 · 세션 · 원격 제어 · 전화 접속 로그인 · 새 그룹' },
    { id: 'svc', no: 8, name: '서비스', tool: 'svc', desc: '설명으로 서비스 찾기 · 시작 유형 · 서비스 상태' },
  ];
  var NONE = '(비어 있음)', MISSING = '(없음)';

  /* ---------------------------------------------------------- 채점 항목 도우미 */
  function C(label, expect, get, ok) {
    return { label: label, expect: expect, get: get, ok: ok || function (st) { return get(st) === expect; } };
  }
  // 네트워크 속성
  function ad(st, name) { return st.net.adapters.filter(function (a) { return a.name === name; })[0]; }
  function netMode(name, manual) {
    var want = manual ? '다음 IP 주소 사용' : '자동으로 IP 주소 받기';
    return C(name + ' · IP 주소 지정 방식', want, function (st) { return ad(st, name).v4.auto ? '자동으로 IP 주소 받기' : '다음 IP 주소 사용'; });
  }
  function netDnsMode(name, manual) {
    var want = manual ? '다음 DNS 서버 주소 사용' : '자동으로 DNS 서버 주소 받기';
    return C(name + ' · DNS 서버 지정 방식', want, function (st) { return ad(st, name).v4.dnsAuto ? '자동으로 DNS 서버 주소 받기' : '다음 DNS 서버 주소 사용'; });
  }
  var NET_LABEL = { ip: 'IP 주소', mask: '서브넷 마스크', gw: '기본 게이트웨이', dns1: '기본 설정 DNS 서버', dns2: '보조 DNS 서버' };
  function netField(name, key, expect) {
    return C(name + ' · ' + NET_LABEL[key], expect || NONE, function (st) { return ad(st, name).v4[key] || NONE; });
  }
  // 로컬 보안 정책
  function sec(key, value) {
    return C(M.SEC[key].label, M.secValueText(key, value), function (st) { return M.secText(st, key); });
  }
  // DHCP
  function scopeC(name, label, expect, fn) {
    return C('범위 ' + name + ' · ' + label, expect, function (st) { var sc = M.scopeFind(st, name); return sc ? fn(sc) : '(범위 없음)'; });
  }
  function scopeExists(name) {
    return C('범위 이름', name, function (st) { return M.scopeFind(st, name) ? name : (st.dhcp.scopes.map(function (s) { return s.name; }).join(', ') || MISSING); });
  }
  function scopeRange(name, a, b) { return scopeC(name, '배포할 주소 범위', a + ' ~ ' + b, function (sc) { return sc.start + ' ~ ' + sc.end; }); }
  function scopeMask(name, mask) { return scopeC(name, '서브넷 마스크', mask + ' (길이 ' + M.lenFromMask(mask) + ')', function (sc) { return sc.mask + ' (길이 ' + sc.len + ')'; }); }
  function scopeExcl(name, lo, hi) {
    var want = lo + ' ~ ' + (hi || lo);
    return scopeC(name, '제외 범위 ' + want, want, function (sc) {
      var hit = sc.excl.filter(function (x) { return x.lo === lo && x.hi === (hi || lo); })[0];
      return hit ? want : (sc.excl.map(function (x) { return x.lo + ' ~ ' + x.hi; }).join(', ') || MISSING);
    });
  }
  function scopeExclCount(name, n) { return scopeC(name, '제외 범위 개수', n + '개', function (sc) { return sc.excl.length + '개'; }); }
  function scopeLease(name, d, h, m) { return scopeC(name, '임대 기간', M.leaseText({ d: d, h: h, m: m }), function (sc) { return M.leaseText(sc.lease); }); }
  function scopeActive(name, on) { return scopeC(name, '상태', on ? '활성' : '비활성', function (sc) { return sc.active ? '활성' : '비활성'; }); }
  function scopeOpt(name, key, list) {
    var lab = { router: '003 라우터', dns: '006 DNS 서버', domain: '015 DNS 도메인 이름' }[key];
    var want = (key === 'domain' ? list : list.join(', ')) || NONE;
    return scopeC(name, '범위 옵션 ' + lab, want, function (sc) { var v = sc.opts[key]; return (key === 'domain' ? v : v.join(', ')) || NONE; });
  }
  function scopeNoOpts(name) {
    return scopeC(name, '범위 옵션', '구성하지 않음', function (sc) { var o = sc.opts; return (o.router.length || o.dns.length || o.domain) ? '구성됨' : '구성하지 않음'; });
  }
  // DNS
  function zoneC(zone, label, expect, fn, ok) {
    return C('영역 ' + zone + ' · ' + label, expect, function (st) { var z = M.findZone(st, zone); return z ? fn(z) : '(영역 없음)'; }, ok);
  }
  function zoneExists(zone) {
    return C('정방향 조회 영역', zone, function (st) { var z = M.findZone(st, zone); return z ? z.name : (st.dns.zones.map(function (x) { return x.name; }).join(', ') || MISSING); },
      function (st) { return !!M.findZone(st, zone); });
  }
  var ZTYPE = { primary: '주 영역', secondary: '보조 영역', stub: '스텁 영역' };
  var DYN = { none: '동적 업데이트 허용 안 함', both: '보안 및 비보안 동적 업데이트 허용', secure: '보안 동적 업데이트만 허용' };
  function zoneType(zone) { return zoneC(zone, '영역 형식', '주 영역', function (z) { return ZTYPE[z.type]; }); }
  function zoneFile(zone, file) { return zoneC(zone, '영역 파일', file, function (z) { return z.file; }, function (st) { var z = M.findZone(st, zone); return !!z && z.file.toLowerCase() === file.toLowerCase(); }); }
  function zoneDyn(zone, key) { return zoneC(zone, '동적 업데이트', DYN[key], function (z) { return DYN[z.dyn]; }); }
  function recA(zone, host, ip) {
    return zoneC(zone, '호스트(A) ' + host + '.' + zone, ip, function (z) {
      var rs = z.records.filter(function (r) { return r.type === 'A' && M.normName(r.name) === M.normName(host); });
      return rs.length ? rs.map(function (r) { return r.data; }).join(', ') : MISSING;
    }, function (st) {
      var z = M.findZone(st, zone);
      return !!z && z.records.some(function (r) { return r.type === 'A' && M.normName(r.name) === M.normName(host) && r.data === ip; });
    });
  }
  function recCname(zone, alias, target) {
    return zoneC(zone, '별칭(CNAME) ' + alias + '.' + zone, M.withDot(target), function (z) {
      var r = M.findRecord(z, alias, 'CNAME');
      return r ? r.data : MISSING;
    }, function (st) {
      var r = M.findRecord(M.findZone(st, zone), alias, 'CNAME');
      return !!r && M.normName(r.data) === M.normName(target);
    });
  }
  function soaName(zone, key, name) {
    var lab = { primary: 'SOA 주 서버', resp: 'SOA 책임자' }[key];
    return zoneC(zone, lab, M.withDot(name), function (z) { return z.soa[key]; }, function (st) { var z = M.findZone(st, zone); return !!z && M.normName(z.soa[key]) === M.normName(name); });
  }
  function soaSerial(zone, n) { return zoneC(zone, 'SOA 일련 번호', String(n), function (z) { return String(z.soa.serial); }); }
  function unitText(sec) {
    var parts = [['일', 86400], ['시간', 3600], ['분', 60]];
    for (var i = 0; i < parts.length; i++) if (sec >= parts[i][1] && sec % parts[i][1] === 0) return sec / parts[i][1] + parts[i][0];
    return sec + '초';
  }
  function soaTime(zone, key, sec) {
    var lab = { refresh: '새로 고침 간격', retry: '다시 시도 간격', expire: '다음 날짜 이후에 만료', minTtl: '최소(기본값) TTL' }[key];
    return zoneC(zone, lab, sec + '초 (' + unitText(sec) + ')', function (z) { var s = M.secs(z.soa[key]); return s + '초 (' + z.soa[key].v + z.soa[key].u + ')'; },
      function (st) { var z = M.findZone(st, zone); return !!z && M.secs(z.soa[key]) === sec; });
  }
  function soaTtl(zone, sec) {
    var d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return zoneC(zone, '이 레코드의 TTL', d + ':' + h + ':' + m + ':' + s, function (z) { var t = z.soa.ttl; return t.d + ':' + t.h + ':' + t.m + ':' + t.s; },
      function (st) { var z = M.findZone(st, zone); return !!z && M.ttlSecs(z.soa.ttl) === sec; });
  }

  // 보안 옵션
  function secopt(key, value) {
    return C(M.secoptDef(key).label, M.secoptValueText(key, value) || NONE, function (st) { return M.secoptText(st, key) || NONE; });
  }
  // IIS 공통
  function siteC(name, label, expect, fn, ok) {
    return C('사이트 ' + name + ' · ' + label, expect, function (st) { var s = M.findSite(st, name); return s ? fn(s) : '(사이트 없음)'; }, ok);
  }
  function siteExists(name, kind) {
    return C(kind === 'ftp' ? 'FTP 사이트 이름' : '웹 사이트 이름', name, function (st) {
      var s = M.findSite(st, name);
      return s ? s.name + (s.kind !== kind ? ' (' + (s.kind === 'ftp' ? 'FTP 사이트' : '웹 사이트') + ')' : '') : (st.iis.sites.filter(function (x) { return x.kind === kind; }).map(function (x) { return x.name; }).join(', ') || MISSING);
    });
  }
  function sitePath(name, path) { return siteC(name, '실제 경로', path, function (s) { return s.path; }); }
  function siteIp(name, ip) { return siteC(name, '바인딩 IP 주소', M.bindIpText(ip), function (s) { return M.bindIpText(s.bindings[0].ip); }); }
  function sitePort(name, port) { return siteC(name, '바인딩 포트', String(port), function (s) { return String(s.bindings[0].port); }); }
  function siteHost(name, host) { return siteC(name, '바인딩 호스트 이름', host || NONE, function (s) { return s.bindings[0].host || NONE; }); }
  function siteStarted(name) { return siteC(name, '상태', '시작됨', function (s) { return s.started ? '시작됨' : '중지됨'; }); }
  function siteAdv(name, key, value) {
    var def = null;
    ['web', 'ftp'].forEach(function (k) { M.ADV[k].forEach(function (d) { if (d.key === key && !def) def = d; }); });
    return siteC(name, '고급 설정 ' + def.label, String(value), function (s) { return M.advValue(s, key); });
  }
  function siteDocs(name, docs) { return siteC(name, '기본 문서', docs.join(', '), function (s) { return s.docs.join(', ') || NONE; }); }
  function siteAuth(name, kind, on) {
    var lab = { anon: '익명 인증', basic: '기본 인증', windows: 'Windows 인증' }[kind];
    return siteC(name, lab, on ? '사용' : '사용 안 함', function (s) { return s.auth[kind] ? '사용' : '사용 안 함'; });
  }
  function siteIpRule(name, mode, ip, mask) {
    var want = (mode === 'allow' ? '허용 ' : '거부 ') + ip + (mask ? ' (' + mask + ')' : '');
    return siteC(name, 'IP 주소 및 도메인 제한 항목', want, function (s) {
      var hit = s.ipRules.filter(function (r) { return r.mode === mode && r.ip === ip && r.mask === (mask || ''); })[0];
      return hit ? want : (s.ipRules.map(function (r) { return (r.mode === 'allow' ? '허용 ' : '거부 ') + r.ip + (r.mask ? ' (' + r.mask + ')' : ''); }).join(', ') || MISSING);
    });
  }
  function siteIpDefault(name, mode) { return siteC(name, '지정되지 않은 클라이언트에 대한 액세스', mode === 'allow' ? '허용' : '거부', function (s) { return s.ipDefault === 'allow' ? '허용' : '거부'; }); }
  function siteError(name, code, mode, path) {
    var mt = { file: '파일', url: 'URL 실행', redirect: '리디렉션' };
    return siteC(name, '오류 페이지 ' + code, mt[mode] + ' ' + path, function (s) { var e = s.errors.filter(function (x) { return x.code === code; })[0]; return e ? mt[e.mode] + ' ' + e.path : MISSING; });
  }
  function siteSmtp(name, key, value) {
    var lab = { to: 'SMTP 전자 메일 주소', server: 'SMTP 서버', port: 'SMTP 포트' }[key];
    return siteC(name, lab, String(value), function (s) { return String(s.smtp[key]) || NONE; });
  }
  // FTP
  function ftpSsl(name, v) { var t = { none: '없음', allow: '허용', require: '필요' }; return siteC(name, 'SSL', t[v], function (s) { return t[s.ssl]; }); }
  function ftpAuth(name, kind, on) { return siteC(name, kind === 'anon' ? 'FTP 익명 인증' : 'FTP 기본 인증', on ? '사용' : '사용 안 함', function (s) { return s.auth[kind] ? '사용' : '사용 안 함'; }); }
  function ftpRule(name, who, value, read, write) {
    var want = '허용 · ' + M.authzText({ who: who, value: value }) + ' · ' + M.permText({ read: read, write: write });
    return siteC(name, 'FTP 권한 부여 규칙', want, function (s) {
      var hit = s.authz.filter(function (r) { return r.mode === 'allow' && r.who === who && (r.value || '').toLowerCase() === (value || '').toLowerCase() && r.read === read && r.write === write; })[0];
      return hit ? want : (s.authz.map(function (r) { return (r.mode === 'allow' ? '허용' : '거부') + ' · ' + M.authzText(r) + ' · ' + M.permText(r); }).join(' / ') || MISSING);
    });
  }
  function ftpDir(name, style, opt) {
    return siteC(name, 'FTP 디렉터리 목록 스타일', style, function (s) { return s.dirBrowse.style; });
  }
  function ftpDirOpt(name, key, on) {
    var lab = { virtualDirs: '가상 디렉터리', bytes: '사용 가능한 바이트 수', year4: '4자리 연도' }[key];
    return siteC(name, '디렉터리 목록 옵션 ' + lab, on ? '선택' : '선택 안 함', function (s) { return s.dirBrowse[key] ? '선택' : '선택 안 함'; });
  }
  function ftpFw(name, ip) { return siteC(name, 'FTP 방화벽의 외부 IP 주소', ip, function (s) { return s.firewall.extIp || NONE; }); }
  function ftpMsg(name, key, text) {
    var lab = { banner: 'FTP 메시지 배너', welcome: 'FTP 메시지 시작', exit: 'FTP 메시지 끝내기', maxConn: 'FTP 메시지 최대 연결 수' }[key];
    return siteC(name, lab, text, function (s) { return s.msg[key] || NONE; }, function (st) { var s = M.findSite(st, name); return !!s && s.msg[key].trim() === text; });
  }
  // 로컬 사용자 및 그룹
  function userC(name, label, expect, fn) {
    return C('사용자 ' + name + ' · ' + label, expect, function (st) { var u = M.findUser(st, name); return u ? fn(u) : '(사용자 없음)'; });
  }
  function userExists(name) { return C('사용자 이름', name, function (st) { var u = M.findUser(st, name); return u ? u.name : MISSING; }); }
  function userField(name, key, value) {
    var lab = { full: '전체 이름', desc: '설명', pw: '암호' }[key];
    return userC(name, lab, value, function (u) { return u[key] || NONE; });
  }
  function userFlag(name, key, on) {
    var lab = { mustChange: '다음 로그온할 때 반드시 암호 변경', cantChange: '사용자가 암호를 변경할 수 없음', neverExpire: '암호 사용 기간 제한 없음', disabled: '계정 사용 안 함' }[key];
    return userC(name, lab, on ? '선택' : '선택 안 함', function (u) { return u[key] ? '선택' : '선택 안 함'; });
  }
  function userGroup(name, groupName) {
    return C('사용자 ' + name + ' · 소속 그룹', groupName + ' 포함', function (st) {
      var u = M.findUser(st, name); if (!u) return '(사용자 없음)';
      var gs = M.groupsOf(st, u.name); return gs.indexOf(groupName) >= 0 ? groupName + ' 포함' : (gs.join(', ') || MISSING);
    });
  }
  function userSession(name, key, value) {
    var lab = { disc: '연결 끊긴 세션 끝내기', active: '활성 세션 제한', idle: '유휴 세션 제한' }[key];
    return userC(name, '세션 ' + lab, value, function (u) { return u.session[key]; });
  }
  function userRemote(name, on) { return userC(name, '원격 제어 가능', on ? '선택' : '선택 안 함', function (u) { return u.remote.enabled ? '선택' : '선택 안 함'; }); }
  function userRemoteLevel(name, level) { var t = { view: '사용자 세션 보기', interact: '세션과 상호 작용' }; return userC(name, '원격 제어 수준', t[level], function (u) { return t[u.remote.level]; }); }
  function userDial(name, access) {
    var t = { allow: '액세스 허용', deny: '액세스 거부', nps: 'NPS 네트워크 정책을 통해 액세스 제어' };
    return userC(name, '네트워크 액세스 권한', t[access], function (u) { return t[u.dial.access]; });
  }
  function groupMember(group, user) {
    return C('그룹 ' + group + ' · 구성원', user + ' 포함', function (st) {
      var g = M.findGroup(st, group); if (!g) return '(그룹 없음)';
      return g.members.some(function (m) { return m.toLowerCase() === user.toLowerCase(); }) ? user + ' 포함' : (g.members.join(', ') || MISSING);
    });
  }
  function groupExists(name) { return C('그룹 이름', name, function (st) { var g = M.findGroup(st, name); return g ? g.name : MISSING; }); }
  function groupDesc(name, desc) { return C('그룹 ' + name + ' · 설명', desc, function (st) { var g = M.findGroup(st, name); return g ? (g.desc || NONE) : '(그룹 없음)'; }); }
  // 서비스
  function svcName(svc) { return M.CAT.SERVICES.filter(function (s) { return s.name === svc; })[0].display; }
  function svcStart(svc, start) { return C(svcName(svc) + ' · 시작 유형', start, function (st) { return M.svcGet(st, svc).start; }); }
  function svcStatus(svc, status) { return C(svcName(svc) + ' · 서비스 상태', status, function (st) { return M.svcGet(st, svc).status; }); }

  /* ---------------------------------------------------------- 과제 */
  var L1 = '로컬 영역 연결', L2 = '로컬 영역 연결 2';
  var OPEN_NET = '바탕의 「네트워크 연결」을 엽니다. 대상 연결을 마우스 오른쪽 단추로 누르고 「속성」을 고릅니다.';
  var OPEN_V4 = '목록에서 「Internet Protocol Version 4 (TCP/IPv4)」를 선택하고 「속성」을 누릅니다(항목을 두 번 눌러도 열립니다).';
  var OPEN_SEC = '바탕의 「로컬 보안 정책」을 엽니다. 왼쪽 트리에서 「계정 정책」 아래의 정책 폴더를 선택합니다.';
  var OPEN_DHCP = '바탕의 「DHCP」를 엽니다. 트리에서 서버 아래 「IPv4」를 먼저 왼쪽 단추로 선택한 뒤 마우스 오른쪽 단추로 누르고 「새 범위」를 고릅니다.';
  var OPEN_DNS = '바탕의 「DNS 관리자」를 엽니다. 트리에서 서버 아래 「정방향 조회 영역」을 펼칩니다.';
  var OPEN_IIS = '바탕의 「IIS 관리자」를 엽니다. 왼쪽 연결 트리에서 서버 아래 「사이트」를 펼칩니다.';
  var OPEN_USERS = '바탕의 「컴퓨터 관리」를 엽니다. 「시스템 도구」 > 「로컬 사용자 및 그룹」을 펼칩니다.';
  var OPEN_SVC = '바탕의 「서비스」를 엽니다. 이름 열을 기준으로 정렬되어 있고, 목록에서 글자를 치면 그 글자로 시작하는 서비스로 이동합니다.';

  var TASKS = [
    /* ===================== 1. 네트워크 속성 ===================== */
    {
      id: 'net-1', type: 'net', title: '고정 IP 주소와 DNS 서버 지정',
      q: '서버의 「로컬 영역 연결」에 다음 IPv4 설정을 지정하십시오. 보조 DNS 서버는 지정하지 않습니다.',
      given: [['IP 주소', '172.16.40.66'], ['서브넷 마스크', '255.255.255.192'], ['기본 게이트웨이', '172.16.40.65'], ['기본 설정 DNS 서버', '172.16.40.70']],
      steps: [OPEN_NET, OPEN_V4, '「다음 IP 주소 사용」을 고르면 DNS도 「다음 DNS 서버 주소 사용」으로 바뀝니다.',
        'IP 주소 칸은 네 칸으로 나뉩니다. 숫자 세 자리를 치거나 점(.)을 누르면 다음 칸으로 넘어갑니다.',
        '서브넷 마스크는 자동으로 채워지지 않습니다. 255.255.255.192를 직접 입력합니다.',
        '「확인」을 누르고 연결 속성 창도 「확인」으로 닫습니다. 다시 열어 값을 대조합니다.'],
      checks: [netMode(L1, true), netField(L1, 'ip', '172.16.40.66'), netField(L1, 'mask', '255.255.255.192'),
        netField(L1, 'gw', '172.16.40.65'), netDnsMode(L1, true), netField(L1, 'dns1', '172.16.40.70'), netField(L1, 'dns2', '')],
      solve: function (st) { return M.setIpv4(st, 0, { auto: false, ip: '172.16.40.66', mask: '255.255.255.192', gw: '172.16.40.65', dnsAuto: false, dns1: '172.16.40.70', dns2: '' }); },
    },
    {
      id: 'net-2', type: 'net', title: '접두 길이를 서브넷 마스크로 바꿔 입력',
      q: '「로컬 영역 연결」에 10.24.8.130/25를 지정하십시오. 기본 게이트웨이는 이 서브넷에서 서버에 지정할 수 있는 마지막 주소입니다. DNS 서버는 기본 10.24.1.10, 보조 10.24.1.11입니다.',
      given: [['IP 주소 / 접두 길이', '10.24.8.130 / 25'], ['기본 게이트웨이', '이 서브넷의 마지막 사용 가능 주소'], ['기본 설정 DNS 서버', '10.24.1.10'], ['보조 DNS 서버', '10.24.1.11']],
      steps: [OPEN_NET, OPEN_V4,
        '/25는 앞 25비트가 1이므로 서브넷 마스크는 255.255.255.128입니다.',
        '130이 속한 블록은 128~255입니다. 네트워크 주소 .128과 브로드캐스트 주소 .255를 빼면 마지막 사용 가능 주소는 .254입니다.',
        '「다음 IP 주소 사용」을 고르고 네 값을 입력한 뒤 DNS 두 칸을 채우고 「확인」을 누릅니다.'],
      checks: [netMode(L1, true), netField(L1, 'ip', '10.24.8.130'), netField(L1, 'mask', '255.255.255.128'),
        netField(L1, 'gw', '10.24.8.254'), netDnsMode(L1, true), netField(L1, 'dns1', '10.24.1.10'), netField(L1, 'dns2', '10.24.1.11')],
      solve: function (st) { return M.setIpv4(st, 0, { auto: false, ip: '10.24.8.130', mask: '255.255.255.128', gw: '10.24.8.254', dnsAuto: false, dns1: '10.24.1.10', dns2: '10.24.1.11' }); },
    },
    {
      id: 'net-3', type: 'net', title: '두 번째 연결에만 고정 IP 지정',
      q: '서버에는 연결이 두 개 있습니다. 「로컬 영역 연결 2」에만 다음 설정을 지정하십시오. 「로컬 영역 연결」은 자동으로 받기 상태를 그대로 둡니다.',
      given: [['대상 연결', '로컬 영역 연결 2'], ['IP 주소 / 접두 길이', '192.168.205.9 / 28'], ['기본 게이트웨이', '192.168.205.1'], ['기본 설정 DNS 서버', '192.168.205.2']],
      setup: function (st) { st.net.adapters.push(M.adapter(L2)); },
      steps: ['바탕의 「네트워크 연결」을 엽니다. 연결 두 개 가운데 「로컬 영역 연결 2」를 마우스 오른쪽 단추로 누르고 「속성」을 고릅니다.', OPEN_V4,
        '/28의 서브넷 마스크는 255.255.255.240입니다(마지막 옥텟 11110000).',
        '값을 입력하고 「확인」을 누릅니다. 「로컬 영역 연결」은 열지 않습니다.'],
      checks: [netMode(L2, true), netField(L2, 'ip', '192.168.205.9'), netField(L2, 'mask', '255.255.255.240'),
        netField(L2, 'gw', '192.168.205.1'), netField(L2, 'dns1', '192.168.205.2'), netMode(L1, false)],
      solve: function (st) { return M.setIpv4(st, 1, { auto: false, ip: '192.168.205.9', mask: '255.255.255.240', gw: '192.168.205.1', dnsAuto: false, dns1: '192.168.205.2', dns2: '' }); },
    },
    {
      id: 'net-4', type: 'net', title: '고정 설정을 자동 받기로 되돌리기',
      q: '「로컬 영역 연결」에 고정 IP 설정이 들어 있습니다. IP 주소와 DNS 서버 주소를 모두 자동으로 받도록 바꾸십시오.',
      given: [['IP 주소', '자동으로 IP 주소 받기'], ['DNS 서버', '자동으로 DNS 서버 주소 받기']],
      setup: function (st) { M.setIpv4(st, 0, { auto: false, ip: '192.168.88.15', mask: '255.255.255.0', gw: '192.168.88.1', dnsAuto: false, dns1: '192.168.88.1', dns2: '' }); },
      steps: [OPEN_NET, OPEN_V4,
        '「자동으로 IP 주소 받기」를 고르면 「자동으로 DNS 서버 주소 받기」를 고를 수 있게 됩니다.',
        'DNS도 「자동으로 DNS 서버 주소 받기」로 바꿉니다. IP만 바꾸면 DNS는 수동 지정으로 남습니다.',
        '「확인」을 누르고 다시 열어 두 항목을 대조합니다.'],
      checks: [netMode(L1, false), netDnsMode(L1, false)],
      solve: function (st) { return M.setIpv4(st, 0, { auto: true, dnsAuto: true }); },
    },
    {
      id: 'net-5', type: 'net', title: '부서별 서브넷 계산 후 입력',
      q: '192.168.150.0/24를 부서별로 나눕니다. 필요한 호스트 수가 많은 부서부터 앞쪽 주소를 줍니다(영업 50대, 개발 30대, 관리 10대). 서버는 개발 부서 서브넷에 속합니다. 서버 IP는 그 서브넷의 첫 번째 사용 가능 주소, 기본 게이트웨이는 마지막 사용 가능 주소입니다. DNS 서버는 192.168.150.2입니다.',
      given: [['전체 네트워크', '192.168.150.0/24'], ['부서별 호스트 수', '영업 50 · 개발 30 · 관리 10 (큰 부서부터 앞쪽)'], ['서버 IP', '개발 서브넷의 첫 번째 사용 가능 주소'], ['기본 게이트웨이', '개발 서브넷의 마지막 사용 가능 주소'], ['기본 설정 DNS 서버', '192.168.150.2']],
      steps: ['호스트 50대는 64개 블록(/26), 30대는 32개 블록(/27), 10대는 16개 블록(/28)이 필요합니다(블록 크기 - 2 ≥ 호스트 수).',
        '영업 .0~.63, 개발 .64~.95, 관리 .96~.111입니다. 개발 서브넷의 마스크는 255.255.255.224입니다.',
        '첫 번째 사용 가능 주소는 .65, 마지막 사용 가능 주소는 .94입니다(네트워크 주소 .64와 브로드캐스트 .95 제외).',
        OPEN_NET, OPEN_V4],
      checks: [netMode(L1, true), netField(L1, 'ip', '192.168.150.65'), netField(L1, 'mask', '255.255.255.224'), netField(L1, 'gw', '192.168.150.94'), netField(L1, 'dns1', '192.168.150.2')],
      solve: function (st) { return M.setIpv4(st, 0, { auto: false, ip: '192.168.150.65', mask: '255.255.255.224', gw: '192.168.150.94', dnsAuto: false, dns1: '192.168.150.2' }); },
    },

    /* ===================== 2. 로컬 보안 정책 ===================== */
    {
      id: 'sec-1', type: 'sec', title: '암호 길이 · 기억 개수 · 복잡성',
      q: '로컬 보안 정책의 암호 정책을 다음과 같이 설정하십시오.',
      given: [['최소 암호 길이', '8문자'], ['최근 암호 기억', '5개'], ['암호는 복잡성을 만족해야 함', '사용']],
      steps: [OPEN_SEC + ' 이 과제는 「암호 정책」입니다.',
        '오른쪽 목록에서 정책을 두 번 누르거나, 선택한 뒤 마우스 오른쪽 단추 > 「속성」을 고릅니다.',
        '숫자 칸에 값을 입력하고 「확인」을 누릅니다. 목록의 「보안 설정」 열이 바뀌었는지 봅니다.',
        '복잡성은 「사용」 단추를 고르고 「확인」을 누릅니다.'],
      checks: [sec('minLen', 8), sec('history', 5), sec('complexity', true)],
      solve: function (st) { M.secSet(st, 'minLen', 8); M.secSet(st, 'history', 5); return M.secSet(st, 'complexity', true); },
    },
    {
      id: 'sec-2', type: 'sec', title: '암호 사용 기간과 저장 방식',
      q: '암호를 60일마다 바꾸게 하고, 바꾼 뒤 3일이 지나야 다시 바꿀 수 있게 하십시오. 「해독 가능한 암호화를 사용하여 암호 저장」은 사용하지 않도록 바꾸십시오.',
      given: [['최대 암호 사용 기간', '60일'], ['최소 암호 사용 기간', '3일'], ['해독 가능한 암호화를 사용하여 암호 저장', '사용 안 함']],
      setup: function (st) { st.sec.reversible = true; },
      steps: [OPEN_SEC + ' 이 과제는 「암호 정책」입니다.',
        '「최대 암호 사용 기간」은 암호를 바꿔야 하는 주기, 「최소 암호 사용 기간」은 바꾼 뒤 다시 바꿀 수 있을 때까지의 기간입니다.',
        '최소 사용 기간은 최대 사용 기간보다 작아야 합니다. 어긋나면 「제안된 값 변경」 창이 나옵니다.',
        '「해독 가능한 암호화를 사용하여 암호 저장」은 현재 「사용」입니다. 「사용 안 함」으로 바꿉니다.'],
      checks: [sec('maxAge', 60), sec('minAge', 3), sec('reversible', false)],
      solve: function (st) { M.secSet(st, 'maxAge', 60); M.secSet(st, 'minAge', 3); return M.secSet(st, 'reversible', false); },
    },
    {
      id: 'sec-3', type: 'sec', title: '계정 잠금 임계값과 잠금 기간',
      q: '로그온에 5번 실패하면 계정을 15분 동안 잠그고, 실패 횟수는 15분이 지나면 0으로 되돌리도록 설정하십시오.',
      given: [['계정 잠금 임계값', '5번의 잘못된 로그온 시도'], ['계정 잠금 기간', '15분'], ['다음 시간 후 계정 잠금 수를 원래대로 설정', '15분']],
      steps: [OPEN_SEC + ' 이 과제는 「계정 잠금 정책」입니다.',
        '임계값이 0이면 잠금 기간과 원래대로 설정 시간은 「해당 없음」이고 바꿀 수 없습니다. 「계정 잠금 임계값」부터 5로 바꿉니다.',
        '임계값을 바꾸면 「제안된 값 변경」 창이 잠금 기간과 원래대로 설정 시간을 30분으로 제안합니다. 「확인」으로 받아들입니다.',
        '「계정 잠금 기간」을 15분으로 바꿉니다. 원래대로 설정 시간(30분)이 잠금 기간보다 길면 15분으로 맞추자는 제안이 나옵니다.',
        '목록에서 세 값을 모두 대조합니다.'],
      checks: [sec('lockThreshold', 5), sec('lockDuration', 15), sec('lockReset', 15)],
      solve: function (st) { M.secSet(st, 'lockThreshold', 5); M.secSet(st, 'lockDuration', 15); return M.secSet(st, 'lockReset', 15); },
    },
    {
      id: 'sec-4', type: 'sec', title: '관리자가 해제할 때까지 잠그기',
      q: '다음 조건으로 암호 정책과 계정 잠금 정책을 설정하십시오. 잠긴 계정은 관리자가 직접 해제할 때까지 잠긴 상태로 둡니다.',
      given: [['최소 암호 길이', '10문자'], ['계정 잠금 임계값', '3번의 잘못된 로그온 시도'], ['계정 잠금 기간', '0분(관리자가 해제할 때까지)'], ['다음 시간 후 계정 잠금 수를 원래대로 설정', '20분']],
      steps: [OPEN_SEC,
        '「암호 정책」에서 최소 암호 길이를 10문자로 바꿉니다.',
        '「계정 잠금 정책」에서 임계값을 3으로 바꾸고 제안 값을 받아들입니다.',
        '계정 잠금 기간을 0으로 입력합니다. 0은 관리자가 잠금을 해제할 때까지 잠근다는 뜻입니다.',
        '원래대로 설정 시간을 20분으로 바꿉니다.'],
      checks: [sec('minLen', 10), sec('lockThreshold', 3), sec('lockDuration', 0), sec('lockReset', 20)],
      solve: function (st) { M.secSet(st, 'minLen', 10); M.secSet(st, 'lockThreshold', 3); M.secSet(st, 'lockDuration', 0); return M.secSet(st, 'lockReset', 20); },
    },
    {
      id: 'sec-5', type: 'sec', title: '보안 옵션: 로그온 메시지',
      q: '사용자가 로그온할 때 다음 제목과 내용의 메시지가 나오도록 로컬 보안 정책의 보안 옵션을 설정하십시오.',
      given: [['메시지 제목', '보안 안내'], ['메시지 텍스트', '인가된 사용자만 로그온할 수 있습니다.']],
      steps: ['바탕의 「로컬 보안 정책」을 엽니다. 「로컬 정책」 > 「보안 옵션」을 선택합니다.',
        '「대화형 로그온: 로그온을 시도하는 사용자에 대한 메시지 제목」을 두 번 눌러 제목을 입력하고 「확인」을 누릅니다.',
        '바로 아래 「…메시지 텍스트」에 내용을 입력합니다. 글자, 띄어쓰기, 마침표까지 문제와 같게 씁니다.'],
      checks: [secopt('msgTitle', '보안 안내'), secopt('msgText', '인가된 사용자만 로그온할 수 있습니다.')],
      solve: function (st) { M.secoptSet(st, 'msgTitle', '보안 안내'); return M.secoptSet(st, 'msgText', '인가된 사용자만 로그온할 수 있습니다.'); },
    },
    {
      id: 'sec-6', type: 'sec', title: '보안 옵션: 계정 이름과 Guest · 암호 만료',
      q: '기본 제공 Administrator 계정의 이름을 srvadmin으로 바꾸고 Guest 계정을 사용하지 않도록 하십시오. 최대 암호 사용 기간은 30일입니다.',
      given: [['계정: Administrator 계정 이름 바꾸기', 'srvadmin'], ['계정: Guest 계정 상태', '사용 안 함'], ['최대 암호 사용 기간', '30일']],
      setup: function (st) { M.secoptSet(st, 'guestOn', true); },
      steps: ['바탕의 「로컬 보안 정책」을 엽니다. 「로컬 정책」 > 「보안 옵션」에서 「계정:」으로 시작하는 정책을 찾습니다.',
        'Guest 계정 상태는 현재 「사용」입니다. 「사용 안 함」으로 바꿉니다.',
        '「계정 정책」 > 「암호 정책」의 최대 암호 사용 기간을 30일로 바꿉니다.'],
      checks: [secopt('adminName', 'srvadmin'), secopt('guestOn', false), sec('maxAge', 30)],
      solve: function (st) { M.secoptSet(st, 'adminName', 'srvadmin'); M.secoptSet(st, 'guestOn', false); return M.secSet(st, 'maxAge', 30); },
    },

    /* ===================== 3. DHCP ===================== */
    {
      id: 'dhcp-1', type: 'dhcp', title: '새 범위 · 제외 범위 · 임대 기간',
      q: 'DHCP 서버에 다음 범위를 만드십시오. DHCP 옵션은 나중에 구성하므로 범위는 비활성 상태로 남습니다.',
      given: [['범위 이름', 'ROOM-301'], ['설명', '3층 실습실'], ['주소 범위', '192.168.30.1 ~ 192.168.30.254'], ['길이(서브넷 마스크)', '24 (255.255.255.0)'],
        ['제외 범위', '192.168.30.1 ~ 192.168.30.20'], ['임대 기간', '4시간'], ['DHCP 옵션', '나중에 구성']],
      steps: [OPEN_DHCP, '시작 화면에서 「다음」을 누르고 범위 이름과 설명을 입력합니다.',
        '「IP 주소 범위」에 시작·끝 주소를 입력합니다. 길이를 바꾸면 서브넷 마스크가 같이 바뀝니다.',
        '「제외 주소 및 지연 추가」에서 시작·끝 주소를 입력하고 반드시 「추가」를 누릅니다. 목록에 올라가야 반영됩니다.',
        '「임대 기간」의 기본값은 8일입니다. 일을 0, 시간을 4로 바꿉니다.',
        '「DHCP 옵션 구성」에서 「아니요, 나중에 옵션을 구성합니다」를 고르고 「마침」을 누릅니다.',
        '범위의 「주소 풀」에서 배포 범위와 제외 범위를 대조합니다.'],
      checks: [scopeExists('ROOM-301'), scopeRange('ROOM-301', '192.168.30.1', '192.168.30.254'), scopeMask('ROOM-301', '255.255.255.0'),
        scopeExcl('ROOM-301', '192.168.30.1', '192.168.30.20'), scopeLease('ROOM-301', 0, 4, 0), scopeNoOpts('ROOM-301'), scopeActive('ROOM-301', false)],
      solve: function (st) {
        return M.createScope(st, { name: 'ROOM-301', desc: '3층 실습실', start: '192.168.30.1', end: '192.168.30.254', mask: '255.255.255.0',
          excl: [{ lo: '192.168.30.1', hi: '192.168.30.20' }], lease: { d: 0, h: 4, m: 0 }, configNow: false });
      },
    },
    {
      id: 'dhcp-2', type: 'dhcp', title: '/26 범위와 라우터 · DNS 옵션',
      q: '다음 범위를 만들고 마법사에서 DHCP 옵션까지 구성한 뒤 범위를 바로 활성화하십시오. WINS 서버는 지정하지 않습니다.',
      given: [['범위 이름', 'OFFICE-B'], ['주소 범위', '172.20.5.65 ~ 172.20.5.126'], ['길이', '26'], ['제외 범위', '172.20.5.65 ~ 172.20.5.70'],
        ['임대 기간', '2일 12시간'], ['라우터(기본 게이트웨이)', '172.20.5.65'], ['부모 도메인', 'office.test'], ['DNS 서버', '172.20.5.66'], ['범위 활성화', '지금 활성화']],
      steps: [OPEN_DHCP, '범위 이름을 입력하고 주소 범위를 넣습니다. 길이를 26으로 바꾸면 서브넷 마스크가 255.255.255.192가 됩니다.',
        '제외 범위를 입력하고 「추가」를 누릅니다. 라우터와 DNS 서버의 고정 주소가 이 범위에 들어 있습니다.',
        '임대 기간은 일 2, 시간 12, 분 0입니다.',
        '「예, 지금 옵션을 구성합니다」를 고릅니다. 라우터 주소를 입력하고 「추가」를 누릅니다.',
        '「도메인 이름 및 DNS 서버」에서 부모 도메인을 입력하고, IP 주소 칸에 DNS 서버를 넣고 「추가」를 누릅니다.',
        'WINS 서버는 비워 두고, 「예, 지금 범위를 활성화합니다」를 고른 뒤 「마침」을 누릅니다.'],
      checks: [scopeExists('OFFICE-B'), scopeRange('OFFICE-B', '172.20.5.65', '172.20.5.126'), scopeMask('OFFICE-B', '255.255.255.192'),
        scopeExcl('OFFICE-B', '172.20.5.65', '172.20.5.70'), scopeLease('OFFICE-B', 2, 12, 0),
        scopeOpt('OFFICE-B', 'router', ['172.20.5.65']), scopeOpt('OFFICE-B', 'domain', 'office.test'), scopeOpt('OFFICE-B', 'dns', ['172.20.5.66']), scopeActive('OFFICE-B', true)],
      solve: function (st) {
        return M.createScope(st, { name: 'OFFICE-B', start: '172.20.5.65', end: '172.20.5.126', mask: '255.255.255.192',
          excl: [{ lo: '172.20.5.65', hi: '172.20.5.70' }], lease: { d: 2, h: 12, m: 0 }, configNow: true,
          router: ['172.20.5.65'], domain: 'office.test', dns: ['172.20.5.66'], wins: [], activate: true });
      },
    },
    {
      id: 'dhcp-3', type: 'dhcp', title: '/20 범위와 제외 주소 두 개',
      q: '무선 손님용 범위를 만드십시오. 제외할 주소는 단일 주소 하나와 주소 범위 하나입니다. DHCP 옵션은 나중에 구성합니다.',
      given: [['범위 이름', 'WIFI-GUEST'], ['주소 범위', '10.77.16.1 ~ 10.77.31.254'], ['길이', '20'], ['제외 주소 1', '10.77.16.1 (단일 주소)'],
        ['제외 주소 2', '10.77.31.250 ~ 10.77.31.254'], ['임대 기간', '1시간 30분'], ['DHCP 옵션', '나중에 구성']],
      steps: [OPEN_DHCP, '/20의 서브넷 마스크는 255.255.240.0입니다. 10.77.16.0~10.77.31.255가 한 서브넷입니다.',
        '단일 주소를 제외할 때는 「시작 IP 주소」에만 입력하고 「추가」를 누릅니다.',
        '두 번째 제외 범위를 입력하고 다시 「추가」를 누릅니다. 목록에 두 줄이 있어야 합니다.',
        '임대 기간은 일 0, 시간 1, 분 30입니다.', '옵션은 「아니요, 나중에 옵션을 구성합니다」입니다.'],
      checks: [scopeExists('WIFI-GUEST'), scopeRange('WIFI-GUEST', '10.77.16.1', '10.77.31.254'), scopeMask('WIFI-GUEST', '255.255.240.0'),
        scopeExcl('WIFI-GUEST', '10.77.16.1'), scopeExcl('WIFI-GUEST', '10.77.31.250', '10.77.31.254'), scopeExclCount('WIFI-GUEST', 2),
        scopeLease('WIFI-GUEST', 0, 1, 30), scopeActive('WIFI-GUEST', false)],
      solve: function (st) {
        return M.createScope(st, { name: 'WIFI-GUEST', start: '10.77.16.1', end: '10.77.31.254', mask: '255.255.240.0',
          excl: [{ lo: '10.77.16.1', hi: '' }, { lo: '10.77.31.250', hi: '10.77.31.254' }], lease: { d: 0, h: 1, m: 30 }, configNow: false });
      },
    },
    {
      id: 'dhcp-4', type: 'dhcp', title: '만든 범위의 속성 고치기와 활성화',
      q: '범위 ROOM-302가 이미 있습니다. 임대 기간을 6시간으로 바꾸고, 제외 범위 192.168.31.240 ~ 192.168.31.254를 추가한 뒤 범위를 활성화하십시오.',
      given: [['대상 범위', 'ROOM-302 (이미 있음)'], ['임대 기간', '6시간'], ['추가할 제외 범위', '192.168.31.240 ~ 192.168.31.254'], ['상태', '활성']],
      setup: function (st) {
        M.createScope(st, { name: 'ROOM-302', desc: '3층 실습실 2', start: '192.168.31.1', end: '192.168.31.254', mask: '255.255.255.0',
          excl: [{ lo: '192.168.31.1', hi: '192.168.31.10' }], lease: { d: 8, h: 0, m: 0 }, configNow: true,
          router: ['192.168.31.1'], dns: ['192.168.31.2'], domain: '', activate: false });
      },
      steps: ['바탕의 「DHCP」를 엽니다. 서버 > IPv4 아래 「범위 [192.168.31.1] ROOM-302」를 선택합니다.',
        '범위를 마우스 오른쪽 단추로 누르고 「속성」을 고릅니다. 임대 기간을 일 0, 시간 6, 분 0으로 바꾸고 「확인」을 누릅니다.',
        '범위 아래 「주소 풀」을 마우스 오른쪽 단추로 누르고 「새 제외 범위」를 고릅니다. 시작·끝 주소를 넣고 「추가」를 누릅니다.',
        '범위를 마우스 오른쪽 단추로 누르고 「활성화」를 고릅니다.',
        '주소 풀에 제외 범위 두 줄(.1~.10, .240~.254)이 있는지 대조합니다.'],
      checks: [scopeLease('ROOM-302', 0, 6, 0), scopeExcl('ROOM-302', '192.168.31.1', '192.168.31.10'), scopeExcl('ROOM-302', '192.168.31.240', '192.168.31.254'),
        scopeActive('ROOM-302', true), scopeRange('ROOM-302', '192.168.31.1', '192.168.31.254')],
      solve: function (st) {
        var i = st.dhcp.scopes.indexOf(M.scopeFind(st, 'ROOM-302')), sc = st.dhcp.scopes[i];
        M.scopeUpdate(st, i, { name: sc.name, desc: sc.desc, start: sc.start, end: sc.end, lease: { d: 0, h: 6, m: 0 } });
        M.scopeAddExclusion(st, i, '192.168.31.240', '192.168.31.254');
        M.scopeSetActive(st, i, true);
        return { ok: true };
      },
    },

    /* ===================== 4. DNS ===================== */
    {
      id: 'dns-1', type: 'dns', title: '새 주 영역과 호스트(A) 레코드',
      q: 'DNS 서버에 정방향 조회 주 영역 campus.test를 만들고, 호스트 web의 IPv4 주소를 10.30.1.20으로 등록하십시오.',
      given: [['영역 형식', '주 영역'], ['영역 이름', 'campus.test'], ['영역 파일', 'campus.test.dns (새 파일)'], ['동적 업데이트', '동적 업데이트 허용 안 함'],
        ['호스트 이름', 'web'], ['IP 주소', '10.30.1.20']],
      steps: [OPEN_DNS + ' 「정방향 조회 영역」을 선택한 뒤 마우스 오른쪽 단추로 누르고 「새 영역」을 고릅니다.',
        '「영역 형식」은 「주 영역」입니다. 「영역 이름」에 campus.test를 입력합니다.',
        '「영역 파일」은 「다음 이름으로 새 파일 만들기」이고 이름이 campus.test.dns로 채워집니다.',
        '「동적 업데이트」는 「동적 업데이트 허용 안 함」을 고르고 「마침」을 누릅니다.',
        '새 영역 campus.test를 선택하고 마우스 오른쪽 단추 > 「새 호스트(A 또는 AAAA)」를 고릅니다.',
        '이름에 web, IP 주소에 10.30.1.20을 입력하고 「호스트 추가」를 누릅니다. 정규화된 도메인 이름이 web.campus.test.인지 봅니다.'],
      checks: [zoneExists('campus.test'), zoneType('campus.test'), zoneFile('campus.test', 'campus.test.dns'), zoneDyn('campus.test', 'none'), recA('campus.test', 'web', '10.30.1.20')],
      solve: function (st) {
        var r = M.createZone(st, { type: 'primary', name: 'campus.test', file: 'campus.test.dns', dyn: 'none' });
        return M.addHost(st, r.index, { name: 'web', ip: '10.30.1.20' });
      },
    },
    {
      id: 'dns-2', type: 'dns', title: '호스트 하나에 별칭(CNAME) 두 개',
      q: '영역 netlab.test에 호스트 srv01(192.168.60.31)을 등록하고, 별칭 www와 ftp가 모두 srv01.netlab.test를 가리키도록 하십시오.',
      given: [['대상 영역', 'netlab.test (이미 있음)'], ['호스트(A)', 'srv01 → 192.168.60.31'], ['별칭(CNAME)', 'www → srv01.netlab.test'], ['별칭(CNAME)', 'ftp → srv01.netlab.test']],
      setup: function (st) { M.createZone(st, { type: 'primary', name: 'netlab.test', dyn: 'none' }); },
      steps: [OPEN_DNS + ' 영역 netlab.test를 선택합니다.',
        '영역을 마우스 오른쪽 단추로 누르고 「새 호스트(A 또는 AAAA)」로 srv01을 만듭니다.',
        '영역을 마우스 오른쪽 단추로 누르고 「새 별칭(CNAME)」을 고릅니다. 별칭 이름에 www를 넣습니다.',
        '「대상 호스트의 정규화된 도메인 이름(FQDN)」에는 IP 주소가 아니라 srv01.netlab.test를 입력합니다.',
        '같은 방법으로 ftp 별칭을 만들고 레코드 목록에서 종류와 데이터를 대조합니다.'],
      checks: [recA('netlab.test', 'srv01', '192.168.60.31'), recCname('netlab.test', 'www', 'srv01.netlab.test'), recCname('netlab.test', 'ftp', 'srv01.netlab.test')],
      solve: function (st) {
        var zi = M.zoneIndex(st, 'netlab.test');
        M.addHost(st, zi, { name: 'srv01', ip: '192.168.60.31' });
        M.addAlias(st, zi, { name: 'www', target: 'srv01.netlab.test' });
        return M.addAlias(st, zi, { name: 'ftp', target: 'srv01.netlab.test' });
      },
    },
    {
      id: 'dns-3', type: 'dns', title: 'SOA 일련 번호 · 주 서버 · 시간 값',
      q: '영역 office.test의 SOA(권한 시작)를 다음과 같이 설정하십시오. 시간 값은 초로 제시했습니다. 화면의 단위를 골라 같은 시간이 되도록 입력합니다.',
      given: [['대상 영역', 'office.test (이미 있음)'], ['일련 번호', '2026111501'], ['주 서버', 'ns1.office.test'], ['책임자', 'admin.office.test'],
        ['새로 고침 간격', '7200초'], ['다시 시도 간격', '1200초'], ['다음 날짜 이후에 만료', '604800초'], ['최소(기본값) TTL', '1800초'], ['이 레코드의 TTL', '7200초']],
      setup: function (st) { M.createZone(st, { type: 'primary', name: 'office.test', dyn: 'none' }); },
      steps: [OPEN_DNS + ' 영역 office.test를 마우스 오른쪽 단추로 누르고 「속성」을 고릅니다.',
        '「SOA(권한 시작)」 탭을 엽니다. 일련 번호, 주 서버, 책임자를 입력합니다.',
        '7200초 = 120분 = 2시간, 1200초 = 20분, 604800초 = 7일, 1800초 = 30분입니다. 단위 목록에서 단위를 바꾼 뒤 수를 입력합니다.',
        '「이 레코드의 TTL」은 일:시:분:초 네 칸입니다. 7200초는 0:2:0:0입니다.',
        '「확인」을 누르고 속성을 다시 열어 값을 대조합니다.'],
      checks: [soaSerial('office.test', 2026111501), soaName('office.test', 'primary', 'ns1.office.test'), soaName('office.test', 'resp', 'admin.office.test'),
        soaTime('office.test', 'refresh', 7200), soaTime('office.test', 'retry', 1200), soaTime('office.test', 'expire', 604800), soaTime('office.test', 'minTtl', 1800), soaTtl('office.test', 7200)],
      solve: function (st) {
        return M.setSoa(st, M.zoneIndex(st, 'office.test'), { serial: 2026111501, primary: 'ns1.office.test', resp: 'admin.office.test',
          refresh: { v: 2, u: '시간' }, retry: { v: 20, u: '분' }, expire: { v: 7, u: '일' }, minTtl: { v: 30, u: '분' }, ttl: { d: 0, h: 2, m: 0, s: 0 } });
      },
    },
    {
      id: 'dns-4', type: 'dns', title: '영역 만들기부터 SOA까지',
      q: '주 영역 branch.test를 만들고 이름 서버 호스트를 등록한 뒤 SOA를 고치십시오. 동적 업데이트는 보안 및 비보안 업데이트를 모두 허용합니다.',
      given: [['영역 이름', 'branch.test (주 영역, 새 파일)'], ['동적 업데이트', '보안 및 비보안 동적 업데이트 허용'], ['호스트(A)', 'ns1 → 172.31.0.2'],
        ['SOA 주 서버', 'ns1.branch.test'], ['SOA 일련 번호', '「증가」 단추로 1 올림'], ['다시 시도 간격', '5분']],
      steps: [OPEN_DNS + ' 「정방향 조회 영역」을 선택한 뒤 마우스 오른쪽 단추로 누르고 「새 영역」을 고릅니다.',
        '주 영역 branch.test를 만듭니다. 동적 업데이트는 「보안 및 비보안 동적 업데이트 허용」입니다.',
        '새 영역에 호스트 ns1(172.31.0.2)을 추가합니다.',
        '영역 속성 > 「SOA(권한 시작)」 탭에서 「증가」를 한 번 누르면 일련 번호가 1 올라갑니다.',
        '주 서버를 ns1.branch.test로 바꾸고, 다시 시도 간격을 5분으로 바꾼 뒤 「확인」을 누릅니다.'],
      checks: [zoneExists('branch.test'), zoneType('branch.test'), zoneDyn('branch.test', 'both'), recA('branch.test', 'ns1', '172.31.0.2'),
        soaSerial('branch.test', 2), soaName('branch.test', 'primary', 'ns1.branch.test'), soaTime('branch.test', 'retry', 300)],
      solve: function (st) {
        var r = M.createZone(st, { type: 'primary', name: 'branch.test', dyn: 'both' });
        M.addHost(st, r.index, { name: 'ns1', ip: '172.31.0.2' });
        var s = M.clone(st.dns.zones[r.index].soa);
        s.serial += 1; s.primary = 'ns1.branch.test'; s.retry = { v: 5, u: '분' };
        return M.setSoa(st, r.index, s);
      },
    },
    {
      id: 'dns-5', type: 'dns', title: '영어형 문제: 영역 · 메일 호스트 · SOA(초)',
      q: 'Create a primary forward lookup zone named corp.test with a new zone file and no dynamic updates. Add a host (A) record named mail with the IPv4 address 10.40.0.25. Then set the SOA refresh interval to 1800 and the retry interval to 300 (unit: seconds).',
      given: [['Zone type / name', 'Primary zone · corp.test'], ['Dynamic update', 'Do not allow dynamic updates'], ['Host (A)', 'mail → 10.40.0.25'], ['Refresh interval', '1800 (unit: seconds)'], ['Retry interval', '300 (unit: seconds)']],
      steps: ['영어형 문제도 화면은 한국어입니다. primary zone = 주 영역, forward lookup zone = 정방향 조회 영역, dynamic update = 동적 업데이트입니다.',
        OPEN_DNS + ' 「정방향 조회 영역」을 선택한 뒤 마우스 오른쪽 단추 > 「새 영역」으로 corp.test를 만듭니다.',
        'host (A) record는 「새 호스트(A 또는 AAAA)」입니다. 이름 mail, IP 주소 10.40.0.25를 넣고 「호스트 추가」를 누릅니다.',
        '영역 속성 > 「SOA(권한 시작)」에서 refresh interval = 새로 고침 간격, retry interval = 다시 시도 간격입니다. 단위 상자를 「초」로 바꾸고 1800, 300을 넣습니다.'],
      checks: [zoneExists('corp.test'), zoneType('corp.test'), zoneDyn('corp.test', 'none'), recA('corp.test', 'mail', '10.40.0.25'), soaTime('corp.test', 'refresh', 1800), soaTime('corp.test', 'retry', 300)],
      solve: function (st) {
        var r = M.createZone(st, { type: 'primary', name: 'corp.test', dyn: 'none' });
        M.addHost(st, r.index, { name: 'mail', ip: '10.40.0.25' });
        var s = M.clone(st.dns.zones[r.index].soa); s.refresh = { v: 1800, u: '초' }; s.retry = { v: 300, u: '초' };
        return M.setSoa(st, r.index, s);
      },
    },
    {
      id: 'dns-6', type: 'dns', title: '영어형 문제: 호스트와 별칭',
      q: 'In the existing zone sales.test, add a host (A) record named www with the IP address 10.41.0.80, and an alias (CNAME) record named portal that points to www.sales.test.',
      given: [['Zone', 'sales.test (already exists)'], ['Host (A)', 'www → 10.41.0.80'], ['Alias (CNAME)', 'portal → www.sales.test']],
      setup: function (st) { M.createZone(st, { type: 'primary', name: 'sales.test', dyn: 'none' }); },
      steps: [OPEN_DNS + ' 영역 sales.test를 선택합니다.', 'alias (CNAME) record = 「새 별칭(CNAME)」, points to = 「대상 호스트의 정규화된 도메인 이름(FQDN)」입니다.',
        '호스트 www를 먼저 만들고, 별칭 portal의 대상에 www.sales.test를 입력합니다.'],
      checks: [recA('sales.test', 'www', '10.41.0.80'), recCname('sales.test', 'portal', 'www.sales.test')],
      solve: function (st) { var zi = M.zoneIndex(st, 'sales.test'); M.addHost(st, zi, { name: 'www', ip: '10.41.0.80' }); return M.addAlias(st, zi, { name: 'portal', target: 'www.sales.test' }); },
    },

    /* ===================== 5. 웹(IIS) ===================== */
    {
      id: 'web-1', type: 'web', title: '웹 사이트 추가와 바인딩',
      q: 'IIS 관리자에서 다음 웹 사이트를 추가하십시오. 사이트는 바로 시작합니다.',
      given: [['사이트 이름', 'CAMPUS-WEB'], ['실제 경로', 'C:\\inetpub\\campus'], ['IP 주소', '172.16.10.10'], ['포트', '8080'], ['호스트 이름', 'www.campus.test']],
      steps: [OPEN_IIS, '「사이트」를 마우스 오른쪽 단추로 누르고 「웹 사이트 추가」를 고릅니다.',
        '사이트 이름과 실제 경로는 대소문자와 \\까지 그대로 입력합니다. \\는 Enter 위의 ₩ 키입니다.',
        'IP 주소 칸은 목록에서 고르거나 직접 입력합니다. 포트와 호스트 이름을 넣고 「웹 사이트 즉시 시작」을 확인한 뒤 「확인」을 누릅니다.'],
      checks: [siteExists('CAMPUS-WEB', 'web'), sitePath('CAMPUS-WEB', 'C:\\inetpub\\campus'), siteIp('CAMPUS-WEB', '172.16.10.10'), sitePort('CAMPUS-WEB', 8080), siteHost('CAMPUS-WEB', 'www.campus.test'), siteStarted('CAMPUS-WEB')],
      solve: function (st) { return M.addWebSite(st, { name: 'CAMPUS-WEB', path: 'C:\\inetpub\\campus', ip: '172.16.10.10', port: 8080, host: 'www.campus.test' }); },
    },
    {
      id: 'web-2', type: 'web', title: '연결 제한과 기본 문서',
      q: '웹 사이트 LIB-WEB을 추가하고 고급 설정의 연결 제한과 기본 문서를 다음과 같이 설정하십시오.',
      given: [['사이트 이름', 'LIB-WEB'], ['실제 경로', 'C:\\web\\library'], ['IP 주소', '지정하지 않은 모든 IP'], ['포트', '8088'], ['연결 시간 제한(초)', '240'], ['최대 동시 연결', '100'], ['기본 문서', 'index.html만 남김']],
      steps: [OPEN_IIS, '사이트를 추가합니다. 호스트 이름은 비워 둡니다.',
        '만든 사이트를 마우스 오른쪽 단추로 누르고 「웹 사이트 관리」 ▶ 「고급 설정」을 엽니다. 「연결 제한」 묶음의 두 값을 고칩니다.',
        '사이트를 선택한 뒤 가운데의 「기본 문서」를 두 번 누릅니다. index.html을 뺀 나머지를 하나씩 선택해 「제거」합니다.'],
      checks: [siteExists('LIB-WEB', 'web'), sitePath('LIB-WEB', 'C:\\web\\library'), sitePort('LIB-WEB', 8088), siteAdv('LIB-WEB', 'connTimeout', 240), siteAdv('LIB-WEB', 'maxConn', 100), siteDocs('LIB-WEB', ['index.html'])],
      solve: function (st) {
        var r = M.addWebSite(st, { name: 'LIB-WEB', path: 'C:\\web\\library', ip: '*', port: 8088, host: '' });
        M.setAdv(st, r.id, 'connTimeout', '240'); M.setAdv(st, r.id, 'maxConn', '100');
        var s = M.siteById(st, r.id); s.docs.slice().forEach(function (d) { if (d !== 'index.html') M.docRemove(st, r.id, s.docs.indexOf(d)); });
        return { ok: true };
      },
    },
    {
      id: 'web-3', type: 'web', title: '인증과 IP 주소 제한',
      q: '이미 있는 웹 사이트 SHOP-WEB의 익명 인증을 사용하지 않고 기본 인증을 사용하도록 하십시오. 192.168.70.25에서 오는 요청만 허용하고 지정되지 않은 클라이언트는 거부합니다.',
      given: [['대상 사이트', 'SHOP-WEB (이미 있음)'], ['익명 인증', '사용 안 함'], ['기본 인증', '사용'], ['허용 항목', '특정 IPv4 주소 192.168.70.25'], ['지정되지 않은 클라이언트', '거부']],
      setup: function (st) { M.addWebSite(st, { name: 'SHOP-WEB', path: 'C:\\web\\shop', ip: '*', port: 8090, host: '' }); },
      steps: [OPEN_IIS + ' 「사이트」 아래 SHOP-WEB을 선택합니다.', '「인증」을 두 번 눌러 익명 인증을 선택하고 오른쪽 작업 창의 「사용 안 함」, 기본 인증은 「사용」을 누릅니다.',
        '「기능 보기로 돌아가기」를 누르고 「IP 주소 및 도메인 제한」을 엽니다. 「허용 항목 추가」에 192.168.70.25를 넣습니다.',
        '「기능 설정 편집」에서 지정되지 않은 클라이언트에 대한 액세스를 「거부」로 바꿉니다.'],
      checks: [siteAuth('SHOP-WEB', 'anon', false), siteAuth('SHOP-WEB', 'basic', true), siteIpRule('SHOP-WEB', 'allow', '192.168.70.25'), siteIpDefault('SHOP-WEB', 'deny')],
      solve: function (st) { var id = M.findSite(st, 'SHOP-WEB').id; M.setAuth(st, id, 'anon', false); M.setAuth(st, id, 'basic', true); M.ipRuleAdd(st, id, { mode: 'allow', ip: '192.168.70.25' }); M.ipDefaultSet(st, id, 'deny'); return { ok: true }; },
    },
    {
      id: 'web-4', type: 'web', title: '오류 페이지와 SMTP 전자 메일',
      q: '웹 사이트 HELP-WEB에서 404 오류가 나면 정적 파일 C:\\inetpub\\help\\notfound.htm의 내용을 보내도록 하십시오. SMTP 전자 메일은 주소 webmaster@campus.test, SMTP 서버 smtp.campus.test, 포트 25로 설정합니다.',
      given: [['대상 사이트', 'HELP-WEB (이미 있음)'], ['오류 페이지 404', '정적 파일 C:\\inetpub\\help\\notfound.htm'], ['전자 메일 주소', 'webmaster@campus.test'], ['SMTP 서버', 'smtp.campus.test'], ['포트', '25']],
      setup: function (st) { M.addWebSite(st, { name: 'HELP-WEB', path: 'C:\\inetpub\\help', ip: '*', port: 8081, host: '' }); },
      steps: [OPEN_IIS + ' HELP-WEB을 선택합니다.', '「오류 페이지」에서 404를 두 번 눌러 「정적 파일의 콘텐츠를 오류 응답에 삽입」의 경로를 바꿉니다.',
        '「SMTP 전자 메일」에서 주소와 서버를 입력한 뒤 오른쪽 「적용」을 누릅니다. 적용하지 않고 다른 곳을 누르면 저장 여부를 묻습니다.'],
      checks: [siteError('HELP-WEB', 404, 'file', 'C:\\inetpub\\help\\notfound.htm'), siteSmtp('HELP-WEB', 'to', 'webmaster@campus.test'), siteSmtp('HELP-WEB', 'server', 'smtp.campus.test'), siteSmtp('HELP-WEB', 'port', 25)],
      solve: function (st) { var id = M.findSite(st, 'HELP-WEB').id; M.errorSet(st, id, 404, { mode: 'file', path: 'C:\\inetpub\\help\\notfound.htm' }); return M.smtpSet(st, id, { to: 'webmaster@campus.test', server: 'smtp.campus.test', port: 25 }); },
    },

    /* ===================== 6. FTP ===================== */
    {
      id: 'ftp-1', type: 'ftp', title: 'FTP 사이트 추가(SSL 없음)',
      q: '다음 FTP 사이트를 추가하십시오. 인증서가 없으므로 SSL은 사용하지 않습니다. 모든 사용자에게 읽기 권한만 줍니다.',
      given: [['FTP 사이트 이름', 'CAMPUS-FTP'], ['실제 경로', 'C:\\inetpub\\ftproot\\campus'], ['IP 주소 / 포트', '172.16.10.10 / 21'], ['SSL', '없음'], ['인증', '익명, 기본'], ['액세스 허용 대상', '모든 사용자'], ['사용 권한', '읽기']],
      steps: [OPEN_IIS, '「사이트」를 마우스 오른쪽 단추로 누르고 「FTP 사이트 추가」를 고릅니다.',
        '「바인딩 및 SSL 설정」의 SSL 기본값은 「필요」입니다. 반드시 「없음」으로 바꿉니다.',
        '「인증 및 권한 부여 정보」에서 익명·기본을 고르고, 액세스 허용 대상과 읽기 권한을 지정한 뒤 「마침」을 누릅니다.'],
      checks: [siteExists('CAMPUS-FTP', 'ftp'), sitePath('CAMPUS-FTP', 'C:\\inetpub\\ftproot\\campus'), siteIp('CAMPUS-FTP', '172.16.10.10'), sitePort('CAMPUS-FTP', 21), ftpSsl('CAMPUS-FTP', 'none'),
        ftpAuth('CAMPUS-FTP', 'anon', true), ftpAuth('CAMPUS-FTP', 'basic', true), ftpRule('CAMPUS-FTP', 'all', '', true, false)],
      solve: function (st) { return M.addFtpSite(st, { name: 'CAMPUS-FTP', path: 'C:\\inetpub\\ftproot\\campus', ip: '172.16.10.10', port: 21, ssl: 'none', anon: true, basic: true, who: 'all', read: true }); },
    },
    {
      id: 'ftp-2', type: 'ftp', title: 'FTP 고급 설정: 최대 연결 수 · 덮어쓰기',
      q: 'FTP 사이트 DATA-FTP를 추가한 뒤 고급 설정에서 최대 연결 수와 이름을 바꿀 때 덮어쓰기 허용을 설정하십시오. Users 그룹에 읽기·쓰기 권한을 줍니다.',
      given: [['FTP 사이트 이름', 'DATA-FTP'], ['실제 경로', 'C:\\ftp\\data'], ['IP 주소 / 포트', '지정하지 않은 모든 IP / 2100'], ['SSL', '없음'], ['인증', '기본'],
        ['권한 부여', '지정한 역할 또는 사용자 그룹: Users, 읽기·쓰기'], ['최대 연결 수', '20'], ['이름을 바꿀 때 덮어쓰기 허용', 'True']],
      steps: [OPEN_IIS, 'FTP 사이트를 추가합니다. 액세스 허용 대상은 「지정한 역할 또는 사용자 그룹」을 고르고 아래 칸에 Users를 입력합니다.',
        '만든 사이트를 마우스 오른쪽 단추로 누르고 「FTP 사이트 관리」 ▶ 「고급 설정」을 엽니다.',
        '「연결」의 최대 연결 수를 20으로, 「파일 처리」의 이름을 바꿀 때 덮어쓰기 허용을 True로 바꿉니다(값을 두 번 누르면 바뀝니다).'],
      checks: [siteExists('DATA-FTP', 'ftp'), sitePath('DATA-FTP', 'C:\\ftp\\data'), siteIp('DATA-FTP', '*'), sitePort('DATA-FTP', 2100), ftpSsl('DATA-FTP', 'none'), ftpAuth('DATA-FTP', 'basic', true),
        ftpRule('DATA-FTP', 'roles', 'Users', true, true), siteAdv('DATA-FTP', 'maxConn', 20), siteAdv('DATA-FTP', 'allowReplace', 'True')],
      solve: function (st) {
        var r = M.addFtpSite(st, { name: 'DATA-FTP', path: 'C:\\ftp\\data', ip: '*', port: 2100, ssl: 'none', basic: true, who: 'roles', whoValue: 'Users', read: true, write: true });
        M.setAdv(st, r.id, 'maxConn', '20'); return M.setAdv(st, r.id, 'allowReplace', 'True');
      },
    },
    {
      id: 'ftp-3', type: 'ftp', title: 'FTP 디렉터리 검색 · 방화벽 지원(저장 확인)',
      q: '이미 있는 FTP 사이트 PUB-FTP의 디렉터리 목록 스타일을 UNIX로 바꾸고 4자리 연도를 표시하십시오. 방화벽의 외부 IP 주소는 203.0.113.50입니다.',
      given: [['대상 사이트', 'PUB-FTP (이미 있음)'], ['디렉터리 목록 스타일', 'UNIX'], ['디렉터리 목록 옵션', '4자리 연도'], ['방화벽의 외부 IP 주소', '203.0.113.50']],
      setup: function (st) { M.addFtpSite(st, { name: 'PUB-FTP', path: 'C:\\ftp\\pub', ip: '*', port: 21, ssl: 'none', anon: true, who: 'all', read: true }); },
      steps: [OPEN_IIS + ' PUB-FTP를 선택하고 「FTP 디렉터리 검색」을 두 번 누릅니다.',
        'UNIX와 4자리 연도를 고른 뒤 왼쪽 트리의 PUB-FTP를 누릅니다. 「변경 내용을 저장하시겠습니까?」에서 「예」를 눌러야 저장됩니다.',
        '「FTP 방화벽 지원」도 같은 방법으로 외부 IP 주소를 입력하고 사이트를 눌러 「예」로 저장합니다. 창을 그냥 닫으면 저장되지 않습니다.'],
      checks: [ftpDir('PUB-FTP', 'UNIX'), ftpDirOpt('PUB-FTP', 'year4', true), ftpFw('PUB-FTP', '203.0.113.50')],
      solve: function (st) { var id = M.findSite(st, 'PUB-FTP').id; M.ftpSetDirBrowse(st, id, { style: 'UNIX', year4: true }); return M.ftpSetFirewall(st, id, { extIp: '203.0.113.50' }); },
    },
    {
      id: 'ftp-4', type: 'ftp', title: 'FTP 메시지와 시간 제한',
      q: 'FTP 사이트 ARCHIVE-FTP의 배너 메시지와 최대 연결 수 메시지를 지정하고, 고급 설정의 컨트롤 채널 시간 제한과 업로드하는 동안 파일 읽기 허용을 바꾸십시오.',
      given: [['대상 사이트', 'ARCHIVE-FTP (이미 있음)'], ['배너', 'ARCHIVE FTP 서버'], ['최대 연결 수 메시지', '최대 연결 수에 도달했습니다.'], ['컨트롤 채널 시간 제한', '300'], ['업로드하는 동안 파일 읽기 허용', 'True']],
      setup: function (st) { M.addFtpSite(st, { name: 'ARCHIVE-FTP', path: 'C:\\ftp\\archive', ip: '*', port: 2200, ssl: 'none', basic: true, who: 'all', read: true }); },
      steps: [OPEN_IIS + ' ARCHIVE-FTP를 선택하고 「FTP 메시지」를 엽니다.', '배너와 최대 연결 수 칸에 메시지를 입력하고 오른쪽 「적용」을 누르거나, 트리의 사이트를 눌러 「예」로 저장합니다.',
        '사이트를 마우스 오른쪽 단추로 누르고 「FTP 사이트 관리」 ▶ 「고급 설정」에서 두 값을 바꿉니다.'],
      checks: [ftpMsg('ARCHIVE-FTP', 'banner', 'ARCHIVE FTP 서버'), ftpMsg('ARCHIVE-FTP', 'maxConn', '최대 연결 수에 도달했습니다.'), siteAdv('ARCHIVE-FTP', 'ctrlTimeout', 300), siteAdv('ARCHIVE-FTP', 'allowRead', 'True')],
      solve: function (st) {
        var id = M.findSite(st, 'ARCHIVE-FTP').id, m = M.clone(M.siteById(st, id).msg);
        m.banner = 'ARCHIVE FTP 서버'; m.maxConn = '최대 연결 수에 도달했습니다.'; M.ftpSetMsg(st, id, m);
        M.setAdv(st, id, 'ctrlTimeout', '300'); return M.setAdv(st, id, 'allowRead', 'True');
      },
    },

    /* ===================== 7. 로컬 사용자 및 그룹 ===================== */
    {
      id: 'user-1', type: 'user', title: '새 사용자와 암호 옵션',
      q: '다음 로컬 사용자를 만드십시오. 사용자가 암호를 바꿀 수 없고 암호가 만료되지 않게 합니다.',
      given: [['사용자 이름', 'student01'], ['전체 이름', '김하늘'], ['설명', '실습 계정'], ['암호', 'Lab#2026a'], ['다음 로그온할 때 암호 변경', '해제'], ['사용자가 암호를 변경할 수 없음', '선택'], ['암호 사용 기간 제한 없음', '선택']],
      steps: [OPEN_USERS, '「사용자」를 마우스 오른쪽 단추로 누르고 「새 사용자」를 고릅니다. 이름·암호는 대소문자를 구분합니다.',
        '「다음 로그온할 때 사용자가 반드시 암호를 변경해야 함」이 선택되어 있으면 아래 두 항목을 고를 수 없습니다. 먼저 해제합니다.',
        '「만들기」를 누르면 창이 비워진 채 열려 있습니다. 「닫기」로 닫고 목록에서 확인합니다.'],
      checks: [userExists('student01'), userField('student01', 'full', '김하늘'), userField('student01', 'desc', '실습 계정'), userField('student01', 'pw', 'Lab#2026a'),
        userFlag('student01', 'mustChange', false), userFlag('student01', 'cantChange', true), userFlag('student01', 'neverExpire', true)],
      solve: function (st) { return M.createUser(st, { name: 'student01', full: '김하늘', desc: '실습 계정', pw: 'Lab#2026a', mustChange: false, cantChange: true, neverExpire: true }); },
    },
    {
      id: 'user-2', type: 'user', title: '설명으로 제시한 그룹에 추가',
      q: '사용자 printadm(암호 Prt!2026b)을 만들고, 도메인 프린터를 관리할 수 있는 그룹의 구성원이 되게 하십시오. 다음 로그온할 때 암호를 바꾸지 않아도 됩니다.',
      given: [['사용자 이름', 'printadm'], ['암호', 'Prt!2026b'], ['다음 로그온할 때 암호 변경', '해제'], ['소속 그룹', '도메인 프린터를 관리할 수 있는 그룹']],
      steps: [OPEN_USERS, '새 사용자를 만든 뒤 사용자를 두 번 눌러 「소속 그룹」 탭을 엽니다.',
        '「추가」 > 「고급」 > 「지금 찾기」에서 목록으로 그룹을 고르면 철자를 틀리지 않습니다. 도메인 프린터 관리 그룹은 Print Operators입니다.',
        '「확인」을 눌러 그룹 선택 창을 닫고, 속성 창도 「확인」으로 닫습니다.'],
      checks: [userExists('printadm'), userField('printadm', 'pw', 'Prt!2026b'), userFlag('printadm', 'mustChange', false), userGroup('printadm', 'Print Operators')],
      solve: function (st) { M.createUser(st, { name: 'printadm', pw: 'Prt!2026b', mustChange: false }); return M.addUserToGroups(st, 'printadm', ['Print Operators']); },
    },
    {
      id: 'user-3', type: 'user', title: '세션 시간 제한과 원격 제어',
      q: '사용자 operator1의 연결 끊긴 세션은 5분 뒤에 끝내고 유휴 세션 제한은 30분으로 하십시오. 원격 제어는 사용하지 않습니다.',
      given: [['대상 사용자', 'operator1 (이미 있음)'], ['연결 끊긴 세션 끝내기', '5분'], ['유휴 세션 제한', '30분'], ['원격 제어', '사용 안 함(원격 제어 가능 해제)']],
      setup: function (st) { M.createUser(st, { name: 'operator1', pw: 'Op#2026c', mustChange: false }); },
      steps: [OPEN_USERS + ' 「사용자」에서 operator1을 두 번 누릅니다.', '「세션」 탭에서 두 목록을 고릅니다.',
        '「원격 제어」 탭의 「원격 제어 가능」은 기본으로 선택되어 있습니다. 해제한 뒤 「확인」을 누릅니다.'],
      checks: [userSession('operator1', 'disc', '5분'), userSession('operator1', 'idle', '30분'), userSession('operator1', 'active', '안 함'), userRemote('operator1', false)],
      solve: function (st) { var u = M.findUser(st, 'operator1'); var s = M.clone(u.session); s.disc = '5분'; s.idle = '30분'; M.setUserSession(st, 'operator1', s); return M.setUserRemote(st, 'operator1', { enabled: false, permission: true, level: 'interact' }); },
    },
    {
      id: 'user-4', type: 'user', title: '계정 사용 · 전화 접속 · 그룹',
      q: '사용 안 함 상태인 사용자 netadm을 사용하도록 바꾸고, 전화 접속 로그인의 네트워크 액세스를 허용하십시오. Administrators를 제외하고 관리자 권한을 가진 그룹에 넣습니다.',
      given: [['대상 사용자', 'netadm (이미 있음, 사용 안 함)'], ['계정 사용 안 함', '해제'], ['네트워크 액세스 권한', '액세스 허용'], ['소속 그룹', 'Administrators를 제외하고 관리자 권한을 가진 그룹']],
      setup: function (st) { M.createUser(st, { name: 'netadm', pw: 'Net#2026d', mustChange: false, disabled: true }); },
      steps: [OPEN_USERS + ' netadm을 두 번 누릅니다.', '「일반」 탭에서 「계정 사용 안 함」을 해제합니다.', '「전화 접속 로그인」 탭에서 「액세스 허용」을 고릅니다.',
        '「소속 그룹」 탭에서 Power Users를 추가하고 「확인」을 누릅니다.'],
      checks: [userFlag('netadm', 'disabled', false), userDial('netadm', 'allow'), userGroup('netadm', 'Power Users')],
      solve: function (st) { var u = M.findUser(st, 'netadm'); M.setUserGeneral(st, 'netadm', { full: u.full, desc: u.desc, mustChange: false, cantChange: false, neverExpire: false, disabled: false }); M.setUserDial(st, 'netadm', { access: 'allow' }); return M.addUserToGroups(st, 'netadm', ['Power Users']); },
    },
    {
      id: 'user-5', type: 'user', title: '새 그룹과 구성원',
      q: '로컬 그룹 LabStaff를 만들고 설명을 「실습실 관리 담당」으로 하십시오. 구성원은 student01, student02입니다.',
      given: [['그룹 이름', 'LabStaff'], ['설명', '실습실 관리 담당'], ['구성원', 'student01, student02 (사용자는 이미 있음)']],
      setup: function (st) { M.createUser(st, { name: 'student01', pw: 'Lab#2026a', mustChange: false }); M.createUser(st, { name: 'student02', pw: 'Lab#2026e', mustChange: false }); },
      steps: [OPEN_USERS + ' 「그룹」을 마우스 오른쪽 단추로 누르고 「새 그룹」을 고릅니다.', '그룹 이름과 설명을 넣고 「추가」로 사용자 두 명을 고릅니다. 이름을 세미콜론(;)으로 이어 입력하고 「이름 확인」을 눌러도 됩니다.',
        '「만들기」를 누른 뒤 「닫기」로 닫습니다.'],
      checks: [groupExists('LabStaff'), groupDesc('LabStaff', '실습실 관리 담당'), groupMember('LabStaff', 'student01'), groupMember('LabStaff', 'student02')],
      solve: function (st) { return M.createGroup(st, { name: 'LabStaff', desc: '실습실 관리 담당', members: ['student01', 'student02'] }); },
    },

    /* ===================== 8. 서비스 ===================== */
    {
      id: 'svc-1', type: 'svc', title: 'IPv6 전환 기술 서비스 끄기',
      q: '6to4, ISATAP, Port Proxy, Teredo 같은 IPv6 전환 기술과 IP-HTTPS로 터널 연결을 제공하는 서비스를 재부팅 후에도 사용하지 않도록 설정하십시오.',
      given: [['서비스 설명', 'IPv6 전환 기술(6to4, ISATAP, Port Proxy, Teredo)과 IP-HTTPS로 터널 연결 제공'], ['시작 유형', '사용 안 함'], ['서비스 상태', '중지']],
      steps: [OPEN_SVC, '목록의 「설명」 열이나 왼쪽 설명 칸에서 문제의 핵심어(6to4, Teredo)를 찾습니다. 이 서비스는 IP Helper입니다.',
        '두 번 눌러 속성을 열고 「중지」를 누른 뒤 시작 유형을 「사용 안 함」으로 바꾸고 「확인」을 누릅니다.'],
      checks: [svcStart('iphlpsvc', '사용 안 함'), svcStatus('iphlpsvc', '중지됨')],
      solve: function (st) { M.svcStop(st, 'iphlpsvc'); return M.svcSetStart(st, 'iphlpsvc', '사용 안 함'); },
    },
    {
      id: 'svc-2', type: 'svc', title: '가상 컴퓨터 상태 모니터링 서비스 켜기',
      q: '정기적으로 하트비트를 보고해 가상 컴퓨터의 상태를 모니터링하는 서비스를 재부팅 후에도 계속 실행되도록 설정하십시오.',
      given: [['서비스 설명', '하트비트를 보고해 가상 컴퓨터 상태를 모니터링'], ['시작 유형', '자동'], ['서비스 상태', '시작']],
      steps: [OPEN_SVC, 'Hyper-V로 시작하는 서비스가 여러 개입니다. 설명이 문제와 같은지 확인합니다.', '속성에서 시작 유형을 「자동」으로 바꾸고 「시작」을 누른 뒤 「확인」을 누릅니다.'],
      checks: [svcStart('vmicheartbeat', '자동'), svcStatus('vmicheartbeat', '시작됨')],
      solve: function (st) { M.svcSetStart(st, 'vmicheartbeat', '자동'); return M.svcStart(st, 'vmicheartbeat'); },
    },
    {
      id: 'svc-3', type: 'svc', title: 'WNS 연결 서비스 끄기',
      q: '세션 0에서 실행되며 알림 플랫폼과 연결 공급자를 호스팅해 디바이스와 WNS 서버 사이의 연결을 처리하는 서비스를 재부팅 후에도 사용하지 않도록 설정하십시오.',
      given: [['서비스 설명', '세션 0에서 실행, 디바이스와 WNS 서버 사이의 연결 처리'], ['시작 유형', '사용 안 함'], ['서비스 상태', '중지']],
      steps: [OPEN_SVC, '「Windows 푸시 알림」으로 시작하는 서비스가 두 개입니다. 「세션 0」 「WNS 서버」가 있는 설명을 고릅니다.', '중지한 뒤 시작 유형을 「사용 안 함」으로 바꿉니다.'],
      checks: [svcStart('WpnService', '사용 안 함'), svcStatus('WpnService', '중지됨'), svcStatus('WpnUserService', '시작됨')],
      solve: function (st) { M.svcStop(st, 'WpnService'); return M.svcSetStart(st, 'WpnService', '사용 안 함'); },
    },
    {
      id: 'svc-4', type: 'svc', title: '성능 로그 서비스 켜기',
      q: '미리 정한 일정에 따라 성능 데이터를 수집해 로그에 기록하거나 경고를 발생시키는 서비스를 재부팅 후에도 계속 실행되도록 설정하십시오.',
      given: [['서비스 설명', '성능 데이터를 수집해 로그 기록·경고 발생'], ['시작 유형', '자동'], ['서비스 상태', '시작']],
      steps: [OPEN_SVC, '설명의 핵심어는 「성능 데이터」 「경고」입니다. 이 서비스는 Performance Logs & Alerts입니다.', '시작 유형을 「자동」으로 바꾸고 「시작」을 누른 뒤 「확인」을 누릅니다.'],
      checks: [svcStart('pla', '자동'), svcStatus('pla', '시작됨')],
      solve: function (st) { M.svcSetStart(st, 'pla', '자동'); return M.svcStart(st, 'pla'); },
    },
    {
      id: 'svc-5', type: 'svc', title: '사용 안 함 서비스를 자동으로 시작',
      q: '근거리 및 광역 네트워크 환경의 기업에 라우팅 서비스를 제공하는 서비스를 재부팅 후에도 계속 실행되도록 설정하십시오. 이 서비스는 현재 사용 안 함 상태입니다.',
      given: [['서비스 설명', '근거리 및 광역 네트워크 환경의 기업에 라우팅 서비스 제공'], ['시작 유형', '자동'], ['서비스 상태', '시작']],
      steps: [OPEN_SVC, '이 서비스는 Routing and Remote Access입니다. 시작 유형이 「사용 안 함」이면 「시작」 단추를 눌러도 시작되지 않습니다.',
        '시작 유형을 「자동」으로 바꾸고 「적용」을 누른 뒤 「시작」을 누르고 「확인」을 누릅니다.'],
      checks: [svcStart('RemoteAccess', '자동'), svcStatus('RemoteAccess', '시작됨')],
      solve: function (st) { M.svcSetStart(st, 'RemoteAccess', '자동'); return M.svcStart(st, 'RemoteAccess'); },
    },
  ];

  function byId(id) { return TASKS.filter(function (t) { return t.id === id; })[0] || null; }
  function fresh(task) { return M.create(task.setup); }
  function grade(task, st) {
    var items = task.checks.map(function (c) { return { label: c.label, expect: c.expect, actual: c.get(st), ok: !!c.ok(st) }; });
    var n = items.filter(function (x) { return x.ok; }).length;
    return { items: items, passed: n, total: items.length, pass: n === items.length };
  }

  return { TYPES: TYPES, TASKS: TASKS, byId: byId, fresh: fresh, grade: grade, NONE: NONE };
}));
