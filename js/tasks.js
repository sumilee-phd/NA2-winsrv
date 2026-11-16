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
    { id: 'sec', no: 2, name: '로컬 보안 정책', tool: 'sec', desc: '암호 정책 · 계정 잠금 정책' },
    { id: 'dhcp', no: 3, name: 'DHCP', tool: 'dhcp', desc: '새 범위 마법사 · 제외 범위 · 임대 기간 · 옵션' },
    { id: 'dns', no: 4, name: 'DNS', tool: 'dns', desc: '새 영역 · 호스트(A) · 별칭(CNAME) · SOA' },
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

  /* ---------------------------------------------------------- 과제 */
  var L1 = '로컬 영역 연결', L2 = '로컬 영역 연결 2';
  var OPEN_NET = '바탕의 「네트워크 연결」을 엽니다. 대상 연결을 마우스 오른쪽 단추로 누르고 「속성」을 고릅니다.';
  var OPEN_V4 = '목록에서 「Internet Protocol Version 4 (TCP/IPv4)」를 선택하고 「속성」을 누릅니다(항목을 두 번 눌러도 열립니다).';
  var OPEN_SEC = '바탕의 「로컬 보안 정책」을 엽니다. 왼쪽 트리에서 「계정 정책」 아래의 정책 폴더를 선택합니다.';
  var OPEN_DHCP = '바탕의 「DHCP」를 엽니다. 트리에서 서버 아래 「IPv4」를 먼저 왼쪽 단추로 선택한 뒤 마우스 오른쪽 단추로 누르고 「새 범위」를 고릅니다.';
  var OPEN_DNS = '바탕의 「DNS 관리자」를 엽니다. 트리에서 서버 아래 「정방향 조회 영역」을 펼칩니다.';

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
