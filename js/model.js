/* 윈도우 서버 설정 연습: 상태 모델(DOM 없음). 브라우저와 Node 시험이 같이 읽는다.
 * 네트워크 속성(TCP/IPv4) · 로컬 보안 정책(암호·계정 잠금) · DHCP(새 범위) · DNS(영역·A·CNAME·SOA)
 * 화면 프로그램은 이 파일의 함수로만 상태를 바꾼다. 채점은 최종 상태를 읽는다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./catalog.js'));
  else root.WSModel = factory(root.WSCatalog);
}(typeof self !== 'undefined' ? self : this, function (CAT) {
  'use strict';

  var SERVER = 'LABSRV';

  /* ------------------------------------------------------------ IPv4 계산 */
  function parseIp(s) {
    var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(s == null ? '' : s).trim());
    if (!m) return null;
    var o = [+m[1], +m[2], +m[3], +m[4]];
    for (var i = 0; i < 4; i++) if (o[i] > 255) return null;
    return o;
  }
  function isIp(s) { return !!parseIp(s); }
  function normIp(s) { var o = parseIp(s); return o ? o.join('.') : ''; }
  function ipToInt(s) { var o = parseIp(s); return o ? o[0] * 16777216 + o[1] * 65536 + o[2] * 256 + o[3] : NaN; }
  function intToIp(n) { n = n >>> 0; return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.'); }
  function maskFromLen(len) {
    len = Number(len);
    if (!(len >= 0 && len <= 32) || Math.floor(len) !== len) return '';
    return intToIp(len === 0 ? 0 : (0xFFFFFFFF << (32 - len)) >>> 0);
  }
  function lenFromMask(mask) {
    var n = ipToInt(mask);
    if (isNaN(n)) return -1;
    var len = 0, zero = false;
    for (var i = 31; i >= 0; i--) {
      var b = Math.floor(n / Math.pow(2, i)) % 2;
      if (b) { if (zero) return -1; len++; } else zero = true;
    }
    return len;
  }
  function netOf(ip, mask) { return intToIp((ipToInt(ip) & ipToInt(mask)) >>> 0); }
  function bcastOf(ip, mask) { return intToIp((ipToInt(ip) | (~ipToInt(mask))) >>> 0); }
  function sameNet(a, b, mask) { return netOf(a, mask) === netOf(b, mask); }

  /* DNS 이름: 대소문자와 끝의 점은 같은 이름으로 본다 */
  function normName(s) { return String(s == null ? '' : s).trim().replace(/\.+$/, '').toLowerCase(); }
  function withDot(s) { s = String(s == null ? '' : s).trim(); return s && !/\.$/.test(s) ? s + '.' : s; }
  var LABEL_RE = /^[A-Za-z0-9_]([A-Za-z0-9_-]{0,61}[A-Za-z0-9_])?$/;
  function validDnsName(s) {
    s = String(s == null ? '' : s).trim().replace(/\.$/, '');
    if (!s || s.length > 253) return false;
    return s.split('.').every(function (l) { return LABEL_RE.test(l); });
  }

  /* ------------------------------------------------------------ 초기 상태 */
  function adapter(name) {
    return {
      name: name, device: '가상 네트워크 어댑터', enabled: true,
      items: [
        { id: 'client', label: 'Microsoft 네트워크용 클라이언트', on: true },
        { id: 'share', label: 'Microsoft 네트워크용 파일 및 프린터 공유', on: true },
        { id: 'qos', label: 'QoS 패킷 스케줄러', on: true },
        { id: 'v6', label: 'Internet Protocol Version 6 (TCP/IPv6)', on: true },
        { id: 'v4', label: 'Internet Protocol Version 4 (TCP/IPv4)', on: true },
      ],
      v4: { auto: true, ip: '', mask: '', gw: '', dnsAuto: true, dns1: '', dns2: '', validate: false },
    };
  }
  function create(setup) {
    var st = {
      v: 2,
      server: SERVER,
      net: { adapters: [adapter('로컬 영역 연결')] },
      sec: { complexity: false, history: 0, maxAge: 42, minLen: 0, minAge: 0, reversible: false,
        lockDuration: null, lockThreshold: 0, lockReset: null },
      dhcp: { scopes: [] },
      dns: { zones: [] },
    };
    upgrade(st);
    if (typeof setup === 'function') setup(st, API);
    return st;
  }
  /* 앞 버전에서 저장한 상태에 새 항목을 채운다 */
  function upgrade(st) {
    if (!st.iis) st.iis = { sites: [webSite(1, 'Default Web Site', '%SystemDrive%\\inetpub\\wwwroot', [{ type: 'http', ip: '*', port: 80, host: '' }], true)] };
    if (!st.users) st.users = defaultUsers();
    if (!st.svc) st.svc = {};
    if (!st.secopt) { st.secopt = {}; CAT.SECOPTS.forEach(function (o) { st.secopt[o.key] = o.def; }); }
    st.v = 2;
    return st;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ------------------------------------------------------------ 네트워크 속성 */
  /* 확인 단추를 누를 때 검사. errors가 있으면 저장하지 않는다. warns는 예/아니요로 묻는다. */
  function checkIpv4(v) {
    var errors = [], warns = [];
    if (!v.auto) {
      if (!v.ip) errors.push('IP 주소를 입력합니다.');
      else if (!isIp(v.ip)) errors.push('IP 주소의 네 칸을 모두 0에서 255 사이 숫자로 입력합니다.');
      else {
        var f = parseIp(v.ip)[0];
        if (f < 1 || f > 223 || f === 127) errors.push(normIp(v.ip) + '은(는) 서버에 지정할 수 없는 주소입니다. 첫 칸은 1에서 223 사이(127 제외)여야 합니다.');
      }
      if (!v.mask) errors.push('서브넷 마스크를 입력합니다.');
      else if (lenFromMask(v.mask) < 1) errors.push('서브넷 마스크가 올바르지 않습니다. 앞에서부터 1인 비트가 이어져야 합니다.');
      if (!errors.length) {
        var len = lenFromMask(v.mask);
        if (len < 31) {
          if (normIp(v.ip) === netOf(v.ip, v.mask)) errors.push('IP 주소의 호스트 부분이 모두 0입니다. ' + normIp(v.ip) + '은(는) 네트워크 주소이므로 서버에 지정할 수 없습니다.');
          else if (normIp(v.ip) === bcastOf(v.ip, v.mask)) errors.push('IP 주소의 호스트 부분이 모두 1입니다. ' + normIp(v.ip) + '은(는) 브로드캐스트 주소이므로 서버에 지정할 수 없습니다.');
        }
      }
      if (v.gw && !isIp(v.gw)) errors.push('기본 게이트웨이의 네 칸을 모두 입력합니다.');
      if (!errors.length && v.gw && !sameNet(v.ip, v.gw, v.mask))
        warns.push('기본 게이트웨이 ' + normIp(v.gw) + '이(가) IP 주소와 서브넷 마스크로 정한 네트워크(' + netOf(v.ip, v.mask) + '/' + lenFromMask(v.mask) + ') 밖에 있습니다. 이 구성을 저장하시겠습니까?');
    }
    if (!v.auto || !v.dnsAuto) {
      if (v.dns1 && !isIp(v.dns1)) errors.push('기본 설정 DNS 서버의 네 칸을 모두 입력합니다.');
      if (v.dns2 && !isIp(v.dns2)) errors.push('보조 DNS 서버의 네 칸을 모두 입력합니다.');
    }
    return { errors: errors, warns: warns };
  }
  function setIpv4(st, ai, v) {
    var r = checkIpv4(v);
    if (r.errors.length) return { ok: false, errors: r.errors };
    var a = st.net.adapters[ai];
    var auto = !!v.auto, dnsAuto = auto ? !!v.dnsAuto : false;
    a.v4 = {
      auto: auto,
      ip: auto ? '' : normIp(v.ip), mask: auto ? '' : normIp(v.mask), gw: auto ? '' : normIp(v.gw),
      dnsAuto: dnsAuto,
      dns1: dnsAuto ? '' : normIp(v.dns1), dns2: dnsAuto ? '' : normIp(v.dns2),
      validate: !!v.validate,
    };
    return { ok: true };
  }
  function setAdapterItem(st, ai, id, on) {
    var it = st.net.adapters[ai].items.filter(function (x) { return x.id === id; })[0];
    if (it) it.on = !!on;
  }
  function setAdapterEnabled(st, ai, on) { st.net.adapters[ai].enabled = !!on; }

  /* ------------------------------------------------------------ 로컬 보안 정책 */
  var SEC = {
    complexity: { label: '암호는 복잡성을 만족해야 함', node: 'pw', kind: 'bool' },
    history: { label: '최근 암호 기억', node: 'pw', min: 0, max: 24, unit: '개 암호 기억됨', field: '최근 암호 기억:' },
    maxAge: { label: '최대 암호 사용 기간', node: 'pw', min: 0, max: 999, unit: '일', field: '암호 만료 기간:' },
    minLen: { label: '최소 암호 길이', node: 'pw', min: 0, max: 14, unit: '문자', field: '암호는 최소한 다음 길이여야 함:' },
    minAge: { label: '최소 암호 사용 기간', node: 'pw', min: 0, max: 998, unit: '일', field: '다음 기간 후 암호 변경 가능:' },
    reversible: { label: '해독 가능한 암호화를 사용하여 암호 저장', node: 'pw', kind: 'bool' },
    lockDuration: { label: '계정 잠금 기간', node: 'lock', min: 0, max: 99999, unit: '분', field: '계정 잠금 기간:' },
    lockThreshold: { label: '계정 잠금 임계값', node: 'lock', min: 0, max: 999, unit: '번의 잘못된 로그온 시도', field: '다음 횟수만큼 로그온에 실패하면 계정 잠금:' },
    lockReset: { label: '다음 시간 후 계정 잠금 수를 원래대로 설정', node: 'lock', min: 1, max: 99999, unit: '분', field: '다음 시간 후 계정 잠금 수를 원래대로 설정:' },
  };
  var SEC_ORDER = { pw: ['complexity', 'history', 'maxAge', 'minLen', 'minAge', 'reversible'], lock: ['lockDuration', 'lockThreshold', 'lockReset'] };
  function secValueText(key, v) {
    var d = SEC[key];
    if (d.kind === 'bool') return v ? '사용' : '사용 안 함';
    if (v === null || v === undefined) return '해당 없음';
    return v + ' ' + d.unit;
  }
  function secText(st, key) { return secValueText(key, st.sec[key]); }
  /* 값 하나를 바꿀 때의 결과: 오류, 바뀔 항목, 제안 값 변경 창에 보일 목록 */
  function secChange(st, key, value) {
    var d = SEC[key], s = st.sec, changes = {}, suggest = [];
    if (d.kind === 'bool') { changes[key] = !!value; return { changes: changes, suggest: suggest }; }
    var n = Number(value);
    if (String(value).trim() === '' || !isFinite(n) || Math.floor(n) !== n) return { error: '숫자를 입력합니다.' };
    if (n < d.min || n > d.max) return { error: d.min + '에서 ' + d.max + ' 사이의 값을 입력합니다.' };
    if ((key === 'lockDuration' || key === 'lockReset') && !s.lockThreshold)
      return { error: '계정 잠금 임계값이 0이면 이 설정은 적용되지 않습니다. 계정 잠금 임계값을 먼저 지정합니다.' };
    changes[key] = n;
    function sug(k, to) { suggest.push({ key: k, from: secText(st, k), to: secValueText(k, to) }); changes[k] = to; }
    if (key === 'lockThreshold') {
      if (n > 0) {
        if (s.lockDuration === null) sug('lockDuration', 30);
        if (s.lockReset === null) sug('lockReset', 30);
      } else {
        changes.lockDuration = null; changes.lockReset = null;
      }
    } else if (key === 'lockDuration') {
      if (n !== 0 && s.lockReset !== null && s.lockReset > n) sug('lockReset', n);
    } else if (key === 'lockReset') {
      if (s.lockDuration !== null && s.lockDuration !== 0 && n > s.lockDuration) sug('lockDuration', n);
    } else if (key === 'maxAge') {
      if (n !== 0 && s.minAge >= n) sug('minAge', n - 1);
    } else if (key === 'minAge') {
      if (s.maxAge !== 0 && n >= s.maxAge) sug('maxAge', n + 1);
    }
    var res = { changes: changes, suggest: suggest };
    if (suggest.length) res.message = d.label + ' 값이 이제 ' + secValueText(key, n) + '이므로 다음 항목의 설정이 제안된 값으로 바뀝니다.';
    return res;
  }
  function secApply(st, changes) { for (var k in changes) st.sec[k] = changes[k]; }
  /* 시험과 모범 풀이용: 제안 값까지 받아들여 한 번에 적용 */
  function secSet(st, key, value) {
    var r = secChange(st, key, value);
    if (r.error) return { ok: false, error: r.error };
    secApply(st, r.changes);
    return { ok: true, suggest: r.suggest };
  }

  /* ------------------------------------------------------------ DHCP */
  function scopeLabel(sc) { return '범위 [' + sc.start + '] ' + sc.name; }
  function checkRange(st, w, skipIdx) {
    if (!w.start || !isIp(w.start)) return '시작 IP 주소의 네 칸을 모두 입력합니다.';
    if (!w.end || !isIp(w.end)) return '끝 IP 주소의 네 칸을 모두 입력합니다.';
    var len = lenFromMask(w.mask);
    if (len < 1 || len > 30) return '서브넷 마스크가 올바르지 않습니다. 길이는 1에서 30 사이여야 합니다.';
    if (ipToInt(w.end) < ipToInt(w.start)) return '끝 IP 주소가 시작 IP 주소보다 앞에 있습니다.';
    if (!sameNet(w.start, w.end, w.mask)) return '시작 IP 주소와 끝 IP 주소가 서브넷 마스크로 나눈 같은 서브넷에 있지 않습니다.';
    if (normIp(w.start) === netOf(w.start, w.mask)) return '시작 IP 주소 ' + normIp(w.start) + '은(는) 서브넷의 네트워크 주소이므로 범위에 넣을 수 없습니다.';
    if (normIp(w.end) === bcastOf(w.start, w.mask)) return '끝 IP 주소 ' + normIp(w.end) + '은(는) 서브넷의 브로드캐스트 주소이므로 범위에 넣을 수 없습니다.';
    for (var i = 0; i < st.dhcp.scopes.length; i++) {
      if (i === skipIdx) continue;
      var o = st.dhcp.scopes[i];
      if (netOf(o.start, o.mask) === netOf(w.start, w.mask)) return '같은 서브넷(' + netOf(w.start, w.mask) + ')의 범위가 이미 있습니다.';
    }
    return null;
  }
  function checkExclusion(w, lo, hi) {
    if (!lo || !isIp(lo)) return '제외할 시작 IP 주소의 네 칸을 모두 입력합니다.';
    if (hi && !isIp(hi)) return '제외할 끝 IP 주소의 네 칸을 모두 입력합니다.';
    hi = hi || lo;
    if (ipToInt(hi) < ipToInt(lo)) return '끝 IP 주소가 시작 IP 주소보다 앞에 있습니다.';
    if (ipToInt(lo) < ipToInt(w.start) || ipToInt(hi) > ipToInt(w.end))
      return '제외 범위는 범위의 주소(' + normIp(w.start) + '~' + normIp(w.end) + ') 안에 있어야 합니다.';
    return null;
  }
  function checkLease(l) {
    var d = Number(l.d), h = Number(l.h), m = Number(l.m);
    if ([d, h, m].some(function (x) { return !isFinite(x) || Math.floor(x) !== x || x < 0; })) return '임대 기간은 0 이상의 정수로 입력합니다.';
    if (d > 999) return '일은 0에서 999 사이로 입력합니다.';
    if (h > 23) return '시간은 0에서 23 사이로 입력합니다.';
    if (m > 59) return '분은 0에서 59 사이로 입력합니다.';
    if (d === 0 && h === 0 && m === 0) return '임대 기간은 1분 이상이어야 합니다.';
    return null;
  }
  function leaseText(l) { return l.d + '일 ' + l.h + '시간 ' + l.m + '분'; }
  /* 새 범위 마법사의 마침 */
  function createScope(st, w) {
    if (!String(w.name || '').trim()) return { ok: false, error: '범위 이름을 입력합니다.' };
    var e = checkRange(st, w) || checkLease(w.lease);
    if (e) return { ok: false, error: e };
    var excl = (w.excl || []).map(function (x) { return { lo: normIp(x.lo), hi: normIp(x.hi || x.lo) }; });
    for (var i = 0; i < excl.length; i++) { var ee = checkExclusion(w, excl[i].lo, excl[i].hi); if (ee) return { ok: false, error: ee }; }
    var now = !!w.configNow;
    var sc = {
      name: String(w.name).trim(), desc: String(w.desc || '').trim(),
      start: normIp(w.start), end: normIp(w.end), mask: normIp(w.mask), len: lenFromMask(w.mask),
      excl: excl, delay: Number(w.delay) || 0,
      lease: { d: Number(w.lease.d), h: Number(w.lease.h), m: Number(w.lease.m) },
      opts: {
        router: now ? (w.router || []).map(normIp) : [],
        domain: now ? String(w.domain || '').trim() : '',
        dns: now ? (w.dns || []).map(normIp) : [],
        wins: now ? (w.wins || []).map(normIp) : [],
      },
      active: now && !!w.activate,
    };
    st.dhcp.scopes.push(sc);
    return { ok: true, index: st.dhcp.scopes.length - 1 };
  }
  function scopeSetActive(st, i, on) { st.dhcp.scopes[i].active = !!on; }
  function scopeDelete(st, i) { st.dhcp.scopes.splice(i, 1); }
  function scopeUpdate(st, i, p) {
    var sc = st.dhcp.scopes[i];
    if (!String(p.name || '').trim()) return { ok: false, error: '범위 이름을 입력합니다.' };
    var w = { start: p.start, end: p.end, mask: sc.mask };
    var e = checkRange(st, w, i) || checkLease(p.lease);
    if (e) return { ok: false, error: e };
    for (var k = 0; k < sc.excl.length; k++) {
      var x = sc.excl[k];
      if (ipToInt(x.lo) < ipToInt(w.start) || ipToInt(x.hi) > ipToInt(w.end)) return { ok: false, error: '제외 범위 ' + x.lo + '~' + x.hi + '이(가) 새 주소 범위 밖에 놓입니다. 제외 범위를 먼저 지웁니다.' };
    }
    sc.name = String(p.name).trim(); sc.desc = String(p.desc || '').trim();
    sc.start = normIp(p.start); sc.end = normIp(p.end);
    sc.lease = { d: Number(p.lease.d), h: Number(p.lease.h), m: Number(p.lease.m) };
    return { ok: true };
  }
  function scopeAddExclusion(st, i, lo, hi) {
    var sc = st.dhcp.scopes[i];
    var e = checkExclusion(sc, lo, hi);
    if (e) return { ok: false, error: e };
    sc.excl.push({ lo: normIp(lo), hi: normIp(hi || lo) });
    return { ok: true };
  }
  function scopeRemoveExclusion(st, i, k) { st.dhcp.scopes[i].excl.splice(k, 1); }
  function scopeSetOptions(st, i, o) {
    var bad = [].concat(o.router || [], o.dns || []).filter(function (x) { return !isIp(x); });
    if (bad.length) return { ok: false, error: '주소 ' + bad[0] + '이(가) 올바르지 않습니다.' };
    var sc = st.dhcp.scopes[i];
    sc.opts.router = (o.router || []).map(normIp);
    sc.opts.dns = (o.dns || []).map(normIp);
    sc.opts.domain = String(o.domain || '').trim();
    return { ok: true };
  }
  function scopeFind(st, name) {
    var n = String(name).trim();
    return st.dhcp.scopes.filter(function (s) { return s.name === n; })[0] || null;
  }
  function poolCount(sc) {
    var total = ipToInt(sc.end) - ipToInt(sc.start) + 1, seen = {};
    sc.excl.forEach(function (x) { for (var a = ipToInt(x.lo); a <= ipToInt(x.hi); a++) seen[a] = 1; });
    return total - Object.keys(seen).length;
  }

  /* ------------------------------------------------------------ DNS */
  var UNIT_SEC = { '초': 1, '분': 60, '시간': 3600, '일': 86400 };
  var UNITS = ['초', '분', '시간', '일'];
  function secs(x) { return Number(x.v) * UNIT_SEC[x.u]; }
  function ttlSecs(t) { return ((Number(t.d) * 24 + Number(t.h)) * 60 + Number(t.m)) * 60 + Number(t.s); }
  function checkZoneName(st, name) {
    var n = String(name || '').trim().replace(/\.$/, '');
    if (!n) return '영역 이름을 입력합니다.';
    if (!validDnsName(n)) return '영역 이름 ' + n + '이(가) 올바르지 않습니다. 영문자·숫자·하이픈으로 된 이름을 점으로 이어 씁니다.';
    if (findZone(st, n)) return '영역 ' + n + '이(가) 이미 있습니다.';
    return null;
  }
  function findZone(st, name) {
    var n = normName(name);
    return st.dns.zones.filter(function (z) { return normName(z.name) === n; })[0] || null;
  }
  function zoneIndex(st, name) { return st.dns.zones.indexOf(findZone(st, name)); }
  function createZone(st, w) {
    var e = checkZoneName(st, w.name);
    if (e) return { ok: false, error: e };
    var name = String(w.name).trim().replace(/\.$/, '');
    var type = w.type || 'primary';
    if (type !== 'primary' && !(w.masters || []).length) return { ok: false, error: '마스터 DNS 서버의 IP 주소를 하나 이상 추가합니다.' };
    var host = SERVER.toLowerCase() + '.';
    var z = {
      name: name, type: type,
      file: String(w.file || (name + '.dns')).trim(),
      dyn: type === 'primary' ? (w.dyn || 'none') : 'none',
      masters: type === 'primary' ? [] : (w.masters || []).map(normIp),
      soa: {
        serial: 1, primary: host, resp: 'hostmaster.',
        refresh: { v: 15, u: '분' }, retry: { v: 10, u: '분' }, expire: { v: 1, u: '일' }, minTtl: { v: 1, u: '시간' },
        ttl: { d: 0, h: 1, m: 0, s: 0 },
      },
      ns: [host],
      records: [],
    };
    st.dns.zones.push(z);
    return { ok: true, index: st.dns.zones.length - 1 };
  }
  function zoneDelete(st, zi) { st.dns.zones.splice(zi, 1); }
  function recName(z, name) { return name ? name : ''; }
  function fqdn(z, name) { return (name ? name + '.' : '') + z.name; }
  function namesTaken(z, name, type) {
    var n = normName(name);
    return z.records.filter(function (r) { return normName(r.name) === n && (!type || r.type === type); });
  }
  function addHost(st, zi, p) {
    var z = st.dns.zones[zi], name = String(p.name || '').trim();
    if (name && !LABEL_RE.test(name)) return { ok: false, error: '이름 ' + name + '이(가) 올바르지 않습니다. 영문자·숫자·하이픈으로 입력합니다.' };
    if (!p.ip || !isIp(p.ip)) return { ok: false, error: 'IP 주소의 네 칸을 모두 입력합니다.' };
    if (namesTaken(z, name, 'CNAME').length) return { ok: false, error: fqdn(z, name) + '에는 별칭(CNAME) 레코드가 있어 같은 이름으로 호스트 레코드를 만들 수 없습니다.' };
    if (namesTaken(z, name, 'A').some(function (r) { return r.data === normIp(p.ip); })) return { ok: false, error: '같은 이름과 주소의 호스트 레코드가 이미 있습니다.' };
    z.records.push({ name: recName(z, name), type: 'A', data: normIp(p.ip) });
    return { ok: true, fqdn: fqdn(z, name) };
  }
  function addAlias(st, zi, p) {
    var z = st.dns.zones[zi], name = String(p.name || '').trim(), target = String(p.target || '').trim();
    if (!name) return { ok: false, error: '이 영역의 이름(상위 폴더와 같음)에는 SOA·NS 레코드가 있어 별칭을 만들 수 없습니다. 별칭 이름을 입력합니다.' };
    if (!LABEL_RE.test(name)) return { ok: false, error: '별칭 이름 ' + name + '이(가) 올바르지 않습니다. 영문자·숫자·하이픈으로 입력합니다.' };
    if (!target) return { ok: false, error: '대상 호스트의 정규화된 도메인 이름(FQDN)을 입력합니다.' };
    if (namesTaken(z, name).length) return { ok: false, error: fqdn(z, name) + '에 다른 레코드가 이미 있어 별칭(CNAME)을 만들 수 없습니다.' };
    z.records.push({ name: name, type: 'CNAME', data: withDot(target) });
    return { ok: true, fqdn: fqdn(z, name) };
  }
  function recordDelete(st, zi, ri) { st.dns.zones[zi].records.splice(ri, 1); }
  function checkSoa(s) {
    var serial = Number(s.serial);
    if (String(s.serial).trim() === '' || !isFinite(serial) || Math.floor(serial) !== serial || serial < 0 || serial > 4294967295) return '일련 번호는 0에서 4294967295 사이의 정수입니다.';
    if (!String(s.primary || '').trim()) return '주 서버를 입력합니다.';
    if (!validDnsName(s.primary)) return '주 서버 이름이 올바르지 않습니다.';
    if (!String(s.resp || '').trim()) return '책임자를 입력합니다.';
    if (!validDnsName(s.resp)) return '책임자는 메일 주소의 @를 점으로 바꾼 이름(예: admin.example.test)으로 입력합니다.';
    var names = { refresh: '새로 고침 간격', retry: '다시 시도 간격', expire: '다음 날짜 이후에 만료', minTtl: '최소(기본값) TTL' };
    for (var k in names) {
      var x = s[k], n = Number(x.v);
      if (String(x.v).trim() === '' || !isFinite(n) || Math.floor(n) !== n || n < 0) return names[k] + '은(는) 0 이상의 정수로 입력합니다.';
      if (!UNIT_SEC[x.u]) return names[k] + '의 단위를 고릅니다.';
    }
    var t = s.ttl, parts = [['d', 99999], ['h', 23], ['m', 59], ['s', 59]];
    for (var i = 0; i < parts.length; i++) {
      var v = Number(t[parts[i][0]]);
      if (String(t[parts[i][0]]).trim() === '' || !isFinite(v) || Math.floor(v) !== v || v < 0 || v > parts[i][1]) return '이 레코드의 TTL은 일(0~99999):시(0~23):분(0~59):초(0~59) 형식으로 입력합니다.';
    }
    return null;
  }
  function setSoa(st, zi, s) {
    var e = checkSoa(s);
    if (e) return { ok: false, error: e };
    var z = st.dns.zones[zi];
    function u(x) { return { v: Number(x.v), u: x.u }; }
    z.soa = {
      serial: Number(s.serial), primary: withDot(s.primary), resp: withDot(s.resp),
      refresh: u(s.refresh), retry: u(s.retry), expire: u(s.expire), minTtl: u(s.minTtl),
      ttl: { d: Number(s.ttl.d), h: Number(s.ttl.h), m: Number(s.ttl.m), s: Number(s.ttl.s) },
    };
    if (z.ns.length) z.ns[0] = z.soa.primary;
    return { ok: true };
  }
  function zoneRows(z) {
    var rows = [
      { name: '(상위 폴더와 같음)', type: '권한 시작(SOA)', data: '[' + z.soa.serial + '], ' + z.soa.primary + ', ' + z.soa.resp, fixed: true },
    ].concat(z.ns.map(function (n) { return { name: '(상위 폴더와 같음)', type: '이름 서버(NS)', data: n, fixed: true }; }));
    z.records.forEach(function (r, i) {
      rows.push({ name: r.name || '(상위 폴더와 같음)', type: r.type === 'A' ? '호스트(A)' : '별칭(CNAME)', data: r.data, index: i });
    });
    return rows;
  }
  function findRecord(z, name, type) {
    if (!z) return null;
    return namesTaken(z, name, type)[0] || null;
  }

  /* ------------------------------------------------------------ IIS: 웹 사이트 · FTP 사이트 */
  var UINT_MAX = 4294967295;
  function webSite(id, name, path, bindings, started) {
    return {
      kind: 'web', id: id, name: name, path: path, pool: name === 'Default Web Site' ? 'DefaultAppPool' : name, bindings: bindings, started: !!started, autoStart: true, protocols: 'http',
      adv: { connTimeout: 120, maxBandwidth: UINT_MAX, maxConn: UINT_MAX },
      docs: ['Default.htm', 'Default.asp', 'index.htm', 'index.html', 'iisstart.htm'],
      dirBrowse: false,
      auth: { anon: true, basic: false, windows: false },
      ipRules: [], ipDefault: 'allow',
      errors: [401, 403, 404, 405, 406, 412, 500, 501, 502].map(function (c) { return { code: c, mode: 'file', path: '%SystemDrive%\\inetpub\\custerr\\<LANGUAGE-TAG>\\' + c + '.htm' }; }),
      smtp: { to: '', server: '', localhost: false, port: 25, auth: 'none', pickup: false, pickupDir: '' },
    };
  }
  function ftpSite(id, p) {
    return {
      kind: 'ftp', id: id, name: p.name, path: p.path, bindings: [{ type: 'ftp', ip: p.ip, port: p.port, host: p.host || '' }], started: !!p.started, autoStart: p.autoStart !== false,
      ssl: p.ssl || 'none',
      auth: { anon: !!p.anon, basic: !!p.basic },
      authz: p.authz || [],
      adv: { utf8: true, dataTimeout: 30, backlog: 60, noSocketPool: false, unauthTimeout: 30, maxConn: UINT_MAX, resetOnMax: false, ctrlTimeout: 120, keepPartial: false, allowRead: false, allowReplace: false },
      dirBrowse: { style: 'MS-DOS', virtualDirs: false, bytes: false, year4: false },
      firewall: { extIp: '' },
      msg: { allowVars: false, noBanner: false, detailed: false, banner: '', welcome: '', exit: '', maxConn: '' },
    };
  }
  var ADV = {
    web: [
      { group: '(일반)', key: 'id', label: 'ID', ro: true },
      { group: '(일반)', key: 'binding', label: '바인딩', ro: true },
      { group: '(일반)', key: 'path', label: '실제 경로', kind: 'path' },
      { group: '(일반)', key: 'pool', label: '응용 프로그램 풀', ro: true },
      { group: '(일반)', key: 'name', label: '이름', ro: true },
      { group: '(일반)', key: 'autoStart', label: '자동 시작', kind: 'bool' },
      { group: '동작', key: 'protocols', label: '사용할 수 있는 프로토콜', ro: true },
      { group: '연결 제한', key: 'connTimeout', label: '연결 시간 제한(초)', kind: 'uint', max: 65535, help: '[connectionTimeout] 연결이 비활성 상태일 때 서버가 연결을 끊기 전에 기다리는 시간(초)입니다.' },
      { group: '연결 제한', key: 'maxBandwidth', label: '최대 대역폭(바이트/초)', kind: 'uint', max: UINT_MAX, help: '[maxBandwidth] 이 사이트에 허용하는 최대 네트워크 대역폭(바이트/초)입니다.' },
      { group: '연결 제한', key: 'maxConn', label: '최대 동시 연결', kind: 'uint', max: UINT_MAX, help: '[maxConnections] 이 사이트에서 동시에 허용하는 최대 연결 수입니다. 넘는 연결에는 HTTP 503 오류로 응답합니다.' },
    ],
    ftp: [
      { group: '(일반)', key: 'id', label: 'ID', ro: true },
      { group: '(일반)', key: 'utf8', label: 'UTF8 허용', kind: 'bool' },
      { group: '(일반)', key: 'binding', label: '바인딩', ro: true },
      { group: '(일반)', key: 'path', label: '실제 경로', kind: 'path' },
      { group: '(일반)', key: 'name', label: '이름', ro: true },
      { group: '(일반)', key: 'autoStart', label: '자동으로 시작', kind: 'bool' },
      { group: '연결', key: 'dataTimeout', label: '데이터 채널 시간 제한', kind: 'uint', max: 65535, help: '[dataChannelTimeout] 데이터 채널이 비활성 상태로 유지될 수 있는 시간(초)입니다.' },
      { group: '연결', key: 'backlog', label: '서버 수신 대기 백로그', kind: 'uint', max: 65535, help: '[serverListenBacklog] 대기열에 둘 수 있는 연결 요청 수입니다.' },
      { group: '연결', key: 'noSocketPool', label: '소켓 풀링 사용 안 함', kind: 'bool' },
      { group: '연결', key: 'unauthTimeout', label: '인증되지 않은 시간 제한', kind: 'uint', max: 65535, help: '[unauthenticatedTimeout] 인증되지 않은 연결을 유지하는 시간(초)입니다.' },
      { group: '연결', key: 'maxConn', label: '최대 연결 수', kind: 'uint', max: UINT_MAX, help: '[maxConnections] 이 FTP 사이트에서 동시에 허용하는 최대 연결 수입니다.' },
      { group: '연결', key: 'resetOnMax', label: '최대 연결 수일 때 다시 설정', kind: 'bool' },
      { group: '연결', key: 'ctrlTimeout', label: '컨트롤 채널 시간 제한', kind: 'uint', max: 65535, help: '[controlChannelTimeout] 컨트롤 채널이 비활성 상태로 유지될 수 있는 시간(초)입니다.' },
      { group: '파일 처리', key: 'keepPartial', label: '부분 업로드 유지', kind: 'bool' },
      { group: '파일 처리', key: 'allowRead', label: '업로드하는 동안 파일 읽기 허용', kind: 'bool', help: '[allowReadUploadsInProgress] 업로드 중인 파일을 다른 사용자가 읽을 수 있는지 지정합니다.' },
      { group: '파일 처리', key: 'allowReplace', label: '이름을 바꿀 때 덮어쓰기 허용', kind: 'bool', help: '[allowReplaceOnRename] 파일 이름을 바꿀 때 같은 이름의 다른 파일을 덮어쓸 수 있는지 지정합니다.' },
    ],
  };
  function bindText(b) { return b.type === 'ftp' ? (b.ip + ':' + b.port + ':' + (b.host || '')) : (b.type + ':' + b.ip + ':' + b.port + ':' + (b.host || '')); }
  function bindIpText(ip) { return ip === '*' ? '지정하지 않은 모든 IP' : ip; }
  function advValue(site, key) {
    if (key === 'id') return String(site.id);
    if (key === 'binding') return site.bindings.map(bindText).join(', ');
    if (key === 'path' || key === 'pool' || key === 'name' || key === 'protocols') return String(site[key] == null ? '' : site[key]);
    if (key === 'autoStart') return site.autoStart ? 'True' : 'False';
    var v = site.adv[key];
    return typeof v === 'boolean' ? (v ? 'True' : 'False') : String(v);
  }
  function findSite(st, name) { var n = String(name || '').trim().toLowerCase(); return st.iis.sites.filter(function (s) { return s.name.toLowerCase() === n; })[0] || null; }
  function siteById(st, id) { return st.iis.sites.filter(function (s) { return s.id === id; })[0] || null; }
  function checkSiteName(st, name, skipId) {
    var n = String(name || '').trim();
    if (!n) return '사이트 이름을 입력합니다.';
    if (/[\\\/?;:@&=+$,|"<>*]/.test(n)) return '사이트 이름에 쓸 수 없는 문자(\\ / ? ; : @ & = + $ , | " < > *)가 있습니다.';
    var o = findSite(st, n);
    if (o && o.id !== skipId) return '이름이 같은 사이트가 이미 있습니다. 다른 이름을 입력합니다.';
    return null;
  }
  function checkPath(p) {
    var s = String(p || '').trim();
    if (!s) return '실제 경로를 입력합니다.';
    if (!/^([A-Za-z]:\\|%SystemDrive%\\?|\\\\[^\\]+\\)/i.test(s)) return '실제 경로가 올바르지 않습니다. 드라이브 문자와 \\로 시작합니다(예: C:\\inetpub\\site). \\는 Enter 위의 ₩ 키로 입력합니다.';
    if (/[<>"|?*]/.test(s.slice(2))) return '실제 경로에 쓸 수 없는 문자가 있습니다.';
    return null;
  }
  function normBindIp(ip) {
    var s = String(ip == null ? '' : ip).trim();
    if (!s || s === '*' || s === '지정하지 않은 모든 IP') return '*';
    return isIp(s) ? normIp(s) : null;
  }
  function checkBinding(b) {
    if (normBindIp(b.ip) === null) return 'IP 주소가 올바르지 않습니다. 네 칸을 점(.)으로 구분해 입력하거나 「지정하지 않은 모든 IP」를 고릅니다.';
    var p = Number(b.port);
    if (String(b.port).trim() === '' || !isFinite(p) || Math.floor(p) !== p || p < 1 || p > 65535) return '포트 번호는 1에서 65535 사이의 정수입니다.';
    var hst = String(b.host || '').trim();
    if (hst && !/^(\*\.)?[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*$/.test(hst)) return '호스트 이름이 올바르지 않습니다. 예: www.example.test';
    return null;
  }
  function normBinding(b) { return { type: b.type || 'http', ip: normBindIp(b.ip), port: Number(b.port), host: String(b.host || '').trim() }; }
  function bindingConflict(st, b, skipId) {
    return st.iis.sites.filter(function (s) {
      return s.id !== skipId && s.started && s.bindings.some(function (x) { return x.type === b.type && x.ip === b.ip && x.port === b.port && x.host.toLowerCase() === b.host.toLowerCase(); });
    })[0] || null;
  }
  function nextSiteId(st) { return st.iis.sites.reduce(function (m, s) { return Math.max(m, s.id); }, 0) + 1; }
  /* 웹 사이트 추가: 바인딩이 실행 중인 다른 사이트와 같으면 conflict를 돌려주고, force면 중지 상태로 만든다 */
  function addWebSite(st, p, force) {
    var e = checkSiteName(st, p.name) || checkPath(p.path) || checkBinding(p);
    if (e) return { ok: false, error: e };
    var b = normBinding(p);
    var c = bindingConflict(st, b, null);
    if (c && !force) return { ok: false, conflict: c.name };
    var s = webSite(nextSiteId(st), String(p.name).trim(), String(p.path).trim(), [b], p.start !== false && !c);
    st.iis.sites.push(s);
    return { ok: true, id: s.id, stopped: !s.started };
  }
  function setBindings(st, id, list) {
    var s = siteById(st, id);
    if (!list.length) return { ok: false, error: '바인딩이 하나 이상 있어야 합니다.' };
    for (var i = 0; i < list.length; i++) { var e = checkBinding(list[i]); if (e) return { ok: false, error: e }; }
    s.bindings = list.map(function (b) { var n = normBinding(b); if (s.kind === 'ftp') n.type = 'ftp'; return n; });
    return { ok: true };
  }
  function siteStart(st, id) {
    var s = siteById(st, id);
    for (var i = 0; i < s.bindings.length; i++) {
      var c = bindingConflict(st, s.bindings[i], id);
      if (c) return { ok: false, error: '사이트 ' + c.name + '이(가) 같은 바인딩(' + bindText(s.bindings[i]) + ')을 쓰고 있어 이 사이트를 시작할 수 없습니다.' };
    }
    s.started = true; return { ok: true };
  }
  function siteStop(st, id) { siteById(st, id).started = false; return { ok: true }; }
  function siteRemove(st, id) { st.iis.sites = st.iis.sites.filter(function (s) { return s.id !== id; }); }
  function setAdv(st, id, key, value) {
    var s = siteById(st, id), def = ADV[s.kind].filter(function (d) { return d.key === key; })[0];
    if (!def || def.ro) return { ok: false, error: '이 값은 바꿀 수 없습니다.' };
    var v = String(value == null ? '' : value).trim();
    if (def.kind === 'bool') {
      if (!/^(true|false)$/i.test(v)) return { ok: false, error: def.label + '은(는) True 또는 False입니다.' };
      var b = /^true$/i.test(v);
      if (key === 'autoStart') s.autoStart = b; else s.adv[key] = b;
      return { ok: true };
    }
    if (def.kind === 'path') { var pe = checkPath(v); if (pe) return { ok: false, error: pe }; s.path = v; return { ok: true }; }
    var n = Number(v);
    if (v === '' || !/^\d+$/.test(v) || n > def.max) return { ok: false, error: def.label + '은(는) 0에서 ' + def.max + ' 사이의 정수입니다.' };
    s.adv[key] = n;
    return { ok: true };
  }
  function docAdd(st, id, name) {
    var s = siteById(st, id), n = String(name || '').trim();
    if (!n) return { ok: false, error: '기본 문서 이름을 입력합니다.' };
    if (/[\\\/:*?"<>|]/.test(n)) return { ok: false, error: '기본 문서 이름에 쓸 수 없는 문자가 있습니다.' };
    if (s.docs.some(function (d) { return d.toLowerCase() === n.toLowerCase(); })) return { ok: false, error: '기본 문서 ' + n + '이(가) 이미 목록에 있습니다.' };
    s.docs.unshift(n);
    return { ok: true };
  }
  function docRemove(st, id, i) { siteById(st, id).docs.splice(i, 1); }
  function docMove(st, id, i, d) {
    var a = siteById(st, id).docs, j = i + d;
    if (j < 0 || j >= a.length) return;
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  function setAuth(st, id, kind, on) { siteById(st, id).auth[kind] = !!on; }
  function ipRuleAdd(st, id, r) {
    var s = siteById(st, id);
    if (!isIp(r.ip)) return { ok: false, error: 'IPv4 주소가 올바르지 않습니다.' };
    var mask = '';
    if (r.range) {
      var m = String(r.mask || '').trim();
      if (/^\d{1,2}$/.test(m)) m = maskFromLen(Number(m));
      if (!m || lenFromMask(m) < 0) return { ok: false, error: '마스크 또는 접두사가 올바르지 않습니다. 예: 255.255.255.0 또는 24' };
      mask = normIp(m);
    }
    var ip = normIp(r.ip);
    if (s.ipRules.some(function (x) { return x.ip === ip && x.mask === mask; })) return { ok: false, error: '같은 주소의 항목이 이미 있습니다.' };
    s.ipRules.push({ mode: r.mode === 'deny' ? 'deny' : 'allow', ip: ip, mask: mask });
    return { ok: true };
  }
  function ipRuleRemove(st, id, i) { siteById(st, id).ipRules.splice(i, 1); }
  function ipDefaultSet(st, id, mode) { siteById(st, id).ipDefault = mode === 'deny' ? 'deny' : 'allow'; }
  function errorSet(st, id, code, p) {
    var s = siteById(st, id), c = Number(code);
    if (!(c >= 400 && c <= 999) || Math.floor(c) !== c) return { ok: false, error: '상태 코드는 400에서 999 사이의 정수입니다.' };
    var path = String(p.path || '').trim();
    if (!path) return { ok: false, error: p.mode === 'file' ? '파일 경로를 입력합니다.' : 'URL을 입력합니다.' };
    if (p.mode !== 'file' && p.mode !== 'url' && p.mode !== 'redirect') return { ok: false, error: '응답 동작을 고릅니다.' };
    var e = s.errors.filter(function (x) { return x.code === c; })[0];
    if (e) { e.mode = p.mode; e.path = path; }
    else { s.errors.push({ code: c, mode: p.mode, path: path }); s.errors.sort(function (a, b) { return a.code - b.code; }); }
    return { ok: true };
  }
  function errorRemove(st, id, code) { var s = siteById(st, id); s.errors = s.errors.filter(function (x) { return x.code !== code; }); }
  function smtpSet(st, id, p) {
    var to = String(p.to || '').trim();
    if (to && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { ok: false, error: '전자 메일 주소가 올바르지 않습니다. 예: admin@example.test' };
    var port = Number(p.port);
    if (!p.pickup && (!/^\d+$/.test(String(p.port).trim()) || port < 1 || port > 65535)) return { ok: false, error: '포트 번호는 1에서 65535 사이의 정수입니다.' };
    if (!p.pickup && !p.localhost && to && !String(p.server || '').trim()) return { ok: false, error: 'SMTP 서버를 입력하거나 「localhost 사용」을 고릅니다.' };
    if (p.pickup && !String(p.pickupDir || '').trim()) return { ok: false, error: '픽업 디렉터리를 입력합니다.' };
    siteById(st, id).smtp = { to: to, server: p.localhost ? '' : String(p.server || '').trim(), localhost: !!p.localhost, port: port || 25, auth: p.auth || 'none', pickup: !!p.pickup, pickupDir: String(p.pickupDir || '').trim() };
    return { ok: true };
  }
  function setWebDirBrowse(st, id, on) { siteById(st, id).dirBrowse = !!on; }
  /* FTP 사이트 추가 마법사의 단계별 검사 */
  function checkFtpPage(st, p, page) {
    if (page === 'info') return checkSiteName(st, p.name) || checkPath(p.path);
    if (page === 'bind') {
      var e = checkBinding(p);
      if (e) return e;
      if (p.vhostOn && !String(p.host || '').trim()) return '가상 호스트 이름을 입력합니다.';
      if (p.ssl !== 'none' && !p.cert) return 'SSL을 허용하거나 요구하려면 SSL 인증서를 선택해야 합니다. 이 서버에는 인증서가 없으므로 SSL을 「없음」으로 둡니다.';
      return null;
    }
    if (page === 'auth') {
      if (p.who && !p.read && !p.write) return '사용 권한(읽기 또는 쓰기)을 하나 이상 선택합니다.';
      if ((p.read || p.write) && !p.who) return '액세스 허용 대상을 고릅니다.';
      if ((p.who === 'roles' || p.who === 'users') && !String(p.whoValue || '').trim()) return '역할(그룹) 또는 사용자 이름을 입력합니다.';
      return null;
    }
    return null;
  }
  function addFtpSite(st, p, force) {
    var e = checkFtpPage(st, p, 'info') || checkFtpPage(st, p, 'bind') || checkFtpPage(st, p, 'auth');
    if (e) return { ok: false, error: e };
    var b = { type: 'ftp', ip: normBindIp(p.ip), port: Number(p.port), host: p.vhostOn ? String(p.host || '').trim() : '' };
    var c = bindingConflict(st, b, null);
    if (c && !force) return { ok: false, conflict: c.name };
    var authz = p.who ? [{ mode: 'allow', who: p.who, value: String(p.whoValue || '').trim(), read: !!p.read, write: !!p.write }] : [];
    var s = ftpSite(nextSiteId(st), { name: String(p.name).trim(), path: String(p.path).trim(), ip: b.ip, port: b.port, host: b.host,
      started: p.autoStart !== false && !c, autoStart: p.autoStart !== false, ssl: p.ssl, anon: p.anon, basic: p.basic, authz: authz });
    st.iis.sites.push(s);
    return { ok: true, id: s.id, stopped: !s.started };
  }
  function ftpSetDirBrowse(st, id, p) { siteById(st, id).dirBrowse = { style: p.style === 'UNIX' ? 'UNIX' : 'MS-DOS', virtualDirs: !!p.virtualDirs, bytes: !!p.bytes, year4: !!p.year4 }; return { ok: true }; }
  function ftpSetFirewall(st, id, p) {
    var ip = String(p.extIp || '').trim();
    if (ip && !isIp(ip)) return { ok: false, error: '방화벽의 외부 IP 주소가 올바르지 않습니다. 예: 10.0.0.1' };
    siteById(st, id).firewall = { extIp: ip ? normIp(ip) : '' };
    return { ok: true };
  }
  function ftpSetMsg(st, id, p) {
    var m = siteById(st, id).msg;
    ['allowVars', 'noBanner', 'detailed'].forEach(function (k) { m[k] = !!p[k]; });
    ['banner', 'welcome', 'exit', 'maxConn'].forEach(function (k) { m[k] = String(p[k] == null ? '' : p[k]); });
    return { ok: true };
  }
  function ftpAuthzAdd(st, id, r) {
    if (!r.who) return { ok: false, error: '액세스 허용 대상을 고릅니다.' };
    if ((r.who === 'roles' || r.who === 'users') && !String(r.value || '').trim()) return { ok: false, error: '역할(그룹) 또는 사용자 이름을 입력합니다.' };
    if (!r.read && !r.write) return { ok: false, error: '사용 권한(읽기 또는 쓰기)을 하나 이상 선택합니다.' };
    siteById(st, id).authz.push({ mode: r.mode === 'deny' ? 'deny' : 'allow', who: r.who, value: String(r.value || '').trim(), read: !!r.read, write: !!r.write });
    return { ok: true };
  }
  function ftpAuthzRemove(st, id, i) { siteById(st, id).authz.splice(i, 1); }
  var WHO_TEXT = { all: '모든 사용자', anon: '모든 익명 사용자', roles: '지정한 역할 또는 사용자 그룹', users: '지정한 사용자' };
  function authzText(r) { return (r.who === 'roles' || r.who === 'users') ? r.value : WHO_TEXT[r.who]; }
  function permText(r) { return [r.read ? '읽기' : '', r.write ? '쓰기' : ''].filter(Boolean).join(', '); }

  /* ------------------------------------------------------------ 로컬 사용자 및 그룹 */
  var ST = CAT.SESSION_TIMES;
  function userBase(name, o) {
    var u = { name: name, full: '', desc: '', pw: '', mustChange: true, cantChange: false, neverExpire: false, disabled: false, builtin: false,
      session: { disc: '안 함', active: '안 함', idle: '안 함', onLimit: 'disconnect', reconnect: 'any' },
      remote: { enabled: true, permission: true, level: 'interact' },
      dial: { access: 'nps', callerId: false, callback: 'none' } };
    for (var k in o) u[k] = o[k];
    return u;
  }
  function defaultUsers() {
    return {
      users: [
        userBase('Administrator', { desc: '컴퓨터/도메인 관리용 기본 제공 계정', mustChange: false, builtin: true, builtinKey: 'admin' }),
        userBase('DefaultAccount', { desc: '시스템에서 관리하는 사용자 계정입니다.', mustChange: false, disabled: true, builtin: true }),
        userBase('Guest', { desc: '컴퓨터/도메인 Guest 액세스용 기본 제공 계정', mustChange: false, cantChange: true, neverExpire: true, disabled: true, builtin: true, builtinKey: 'guest' }),
      ],
      groups: CAT.GROUPS.map(function (g) {
        var m = g.name === 'Administrators' ? ['Administrator'] : g.name === 'Guests' ? ['Guest'] : g.name === 'Users' ? ['NT AUTHORITY\\Authenticated Users', 'NT AUTHORITY\\INTERACTIVE'] : [];
        return { name: g.name, desc: g.desc, builtin: true, members: m };
      }),
    };
  }
  function findUser(st, name) { var n = String(name || '').trim().toLowerCase(); return st.users.users.filter(function (u) { return u.name.toLowerCase() === n; })[0] || null; }
  function findGroup(st, name) { var n = String(name || '').trim().toLowerCase(); return st.users.groups.filter(function (g) { return g.name.toLowerCase() === n; })[0] || null; }
  function groupsOf(st, name) {
    var n = String(name).toLowerCase();
    return st.users.groups.filter(function (g) { return g.members.some(function (m) { return m.toLowerCase() === n; }); }).map(function (g) { return g.name; });
  }
  function checkAccountName(st, name, label, skip) {
    var n = String(name || '').trim();
    if (!n) return label + ' 이름을 입력합니다.';
    if (n.length > 20) return label + ' 이름은 20자 이하로 입력합니다.';
    if (/["\/\\\[\]:;|=,+*?<>@]/.test(n)) return label + ' 이름에 쓸 수 없는 문자(" / \\ [ ] : ; | = , + * ? < > @)가 있습니다.';
    var u = findUser(st, n), g = findGroup(st, n);
    if ((u && u !== skip) || (g && g !== skip)) return n + '은(는) 이미 있는 사용자 또는 그룹 이름입니다.';
    return null;
  }
  function pwPolicyError(st, name, pw) {
    var s = st.sec;
    var bad = pw.length < s.minLen;
    if (!bad && s.complexity) {
      var kinds = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(function (r) { return r.test(pw); }).length;
      bad = pw.length < 6 || kinds < 3 || (name.length >= 3 && pw.toLowerCase().indexOf(name.toLowerCase()) >= 0);
    }
    return bad ? '암호가 암호 정책의 요구 사항(최소 암호 길이, 복잡성)을 만족하지 않습니다. 로컬 보안 정책의 암호 정책을 확인합니다.' : null;
  }
  function checkFlags(p) {
    if (p.mustChange && (p.cantChange || p.neverExpire)) return '「다음 로그온할 때 반드시 암호를 변경해야 함」은 「사용자가 암호를 변경할 수 없음」이나 「암호 사용 기간 제한 없음」과 함께 선택할 수 없습니다.';
    return null;
  }
  function createUser(st, p) {
    var e = checkAccountName(st, p.name, '사용자') || checkFlags(p);
    if (e) return { ok: false, error: e };
    var pw = String(p.pw || ''), pw2 = String(p.pw2 == null ? pw : p.pw2);
    if (pw !== pw2) return { ok: false, error: '입력한 암호가 서로 다릅니다. 암호와 암호 확인을 같게 입력합니다.' };
    var pe = pwPolicyError(st, String(p.name).trim(), pw);
    if (pe) return { ok: false, error: pe };
    var u = userBase(String(p.name).trim(), { full: String(p.full || '').trim(), desc: String(p.desc || '').trim(), pw: pw,
      mustChange: !!p.mustChange, cantChange: !!p.cantChange, neverExpire: !!p.neverExpire, disabled: !!p.disabled });
    st.users.users.push(u);
    findGroup(st, 'Users').members.push(u.name);
    return { ok: true };
  }
  function setUserGeneral(st, name, p) {
    var u = findUser(st, name), e = checkFlags(p);
    if (e) return { ok: false, error: e };
    u.full = String(p.full || '').trim(); u.desc = String(p.desc || '').trim();
    u.mustChange = !!p.mustChange; u.cantChange = !!p.cantChange; u.neverExpire = !!p.neverExpire; u.disabled = !!p.disabled;
    if (u.builtinKey === 'guest') st.secopt.guestOn = !u.disabled;
    return { ok: true };
  }
  function setUserSession(st, name, p) {
    if ([p.disc, p.active, p.idle].some(function (x) { return ST.indexOf(x) < 0; })) return { ok: false, error: '세션 시간은 목록에서 고릅니다.' };
    findUser(st, name).session = { disc: p.disc, active: p.active, idle: p.idle, onLimit: p.onLimit === 'end' ? 'end' : 'disconnect', reconnect: p.reconnect === 'orig' ? 'orig' : 'any' };
    return { ok: true };
  }
  function setUserRemote(st, name, p) { findUser(st, name).remote = { enabled: !!p.enabled, permission: !!p.permission, level: p.level === 'view' ? 'view' : 'interact' }; return { ok: true }; }
  function setUserDial(st, name, p) { findUser(st, name).dial = { access: ['allow', 'deny', 'nps'].indexOf(p.access) >= 0 ? p.access : 'nps', callerId: !!p.callerId, callback: ['none', 'caller', 'always'].indexOf(p.callback) >= 0 ? p.callback : 'none' }; return { ok: true }; }
  function addUserToGroups(st, name, groups) {
    var u = findUser(st, name);
    for (var i = 0; i < groups.length; i++) if (!findGroup(st, groups[i])) return { ok: false, error: '그룹 ' + groups[i] + '을(를) 찾을 수 없습니다.' };
    groups.forEach(function (gn) { var g = findGroup(st, gn); if (!g.members.some(function (m) { return m.toLowerCase() === u.name.toLowerCase(); })) g.members.push(u.name); });
    return { ok: true };
  }
  function removeUserFromGroup(st, name, group) {
    var g = findGroup(st, group), n = String(name).toLowerCase();
    if (g) g.members = g.members.filter(function (m) { return m.toLowerCase() !== n; });
  }
  function setPassword(st, name, pw, pw2) {
    if (pw !== pw2) return { ok: false, error: '입력한 암호가 서로 다릅니다.' };
    var pe = pwPolicyError(st, name, pw);
    if (pe) return { ok: false, error: pe };
    findUser(st, name).pw = pw;
    return { ok: true };
  }
  function deleteUser(st, name) {
    var u = findUser(st, name);
    if (u.builtin) return { ok: false, error: '기본 제공 계정은 삭제할 수 없습니다.' };
    st.users.users = st.users.users.filter(function (x) { return x !== u; });
    st.users.groups.forEach(function (g) { g.members = g.members.filter(function (m) { return m.toLowerCase() !== u.name.toLowerCase(); }); });
    return { ok: true };
  }
  function renameUser(st, name, nn) {
    var u = findUser(st, name), e = checkAccountName(st, nn, '사용자', u);
    if (e) return { ok: false, error: e };
    var old = u.name; u.name = String(nn).trim();
    st.users.groups.forEach(function (g) { g.members = g.members.map(function (m) { return m.toLowerCase() === old.toLowerCase() ? u.name : m; }); });
    if (u.builtinKey === 'admin') st.secopt.adminName = u.name;
    if (u.builtinKey === 'guest') st.secopt.guestName = u.name;
    return { ok: true };
  }
  function createGroup(st, p) {
    var e = checkAccountName(st, p.name, '그룹');
    if (e) return { ok: false, error: e };
    var members = (p.members || []).slice();
    for (var i = 0; i < members.length; i++) if (!findUser(st, members[i])) return { ok: false, error: '사용자 ' + members[i] + '을(를) 찾을 수 없습니다.' };
    st.users.groups.push({ name: String(p.name).trim(), desc: String(p.desc || '').trim(), builtin: false, members: members.map(function (m) { return findUser(st, m).name; }) });
    return { ok: true };
  }
  function setGroup(st, name, p) {
    var g = findGroup(st, name);
    for (var i = 0; i < p.members.length; i++) {
      var m = p.members[i];
      if (!findUser(st, m) && m.indexOf('\\') < 0) return { ok: false, error: '사용자 ' + m + '을(를) 찾을 수 없습니다.' };
    }
    g.desc = String(p.desc || '').trim();
    g.members = p.members.map(function (m) { var u = findUser(st, m); return u ? u.name : m; });
    return { ok: true };
  }
  /* 「이름 확인」: 입력한 이름들을 실제 이름으로 바꾼다. 세미콜론으로 여러 개 */
  function resolveNames(st, text, kind) {
    var names = String(text || '').split(';').map(function (s) { return s.trim().replace(/^[^\\]*\\/, ''); }).filter(Boolean);
    var out = [];
    for (var i = 0; i < names.length; i++) {
      var o = kind === 'group' ? findGroup(st, names[i]) : findUser(st, names[i]);
      if (!o) return { ok: false, error: '"' + names[i] + '" 이름의 ' + (kind === 'group' ? '그룹' : '사용자') + '을(를) 찾을 수 없습니다. 이름을 확인하거나 「고급」의 「지금 찾기」로 고릅니다.' };
      out.push(o.name);
    }
    return { ok: true, names: out };
  }

  /* ------------------------------------------------------------ 서비스 */
  var START_TYPES = ['자동(지연된 시작)', '자동', '수동', '사용 안 함'];
  var SVC_ON = '시작됨', SVC_OFF = '중지됨', SVC_PAUSE = '일시 중지됨';
  function svcGet(st, name) {
    var c = CAT.SERVICES.filter(function (s) { return s.name.toLowerCase() === String(name).toLowerCase(); })[0];
    if (!c) return null;
    var o = st.svc[c.name] || {};
    return { display: c.display, name: c.name, desc: c.desc, logon: c.logon, pausable: c.pausable,
      path: 'C:\\Windows\\system32\\svchost.exe -k ' + (c.logon === 'Network Service' ? 'NetworkService' : c.logon === 'Local Service' ? 'LocalService' : 'netsvcs'),
      start: o.start || c.start, status: o.status || c.status };
  }
  function svcList(st) { return CAT.SERVICES.map(function (c) { return svcGet(st, c.name); }); }
  function svcPut(st, name, k, v) { var c = svcGet(st, name); st.svc[c.name] = st.svc[c.name] || {}; st.svc[c.name][k] = v; }
  function svcSetStart(st, name, t) {
    if (START_TYPES.indexOf(t) < 0) return { ok: false, error: '시작 유형을 목록에서 고릅니다.' };
    svcPut(st, name, 'start', t); return { ok: true };
  }
  function svcStart(st, name) {
    var s = svcGet(st, name);
    if (s.start === '사용 안 함') return { ok: false, error: '로컬 컴퓨터에서 ' + s.display + ' 서비스를 시작할 수 없습니다. 시작 유형이 「사용 안 함」이면 서비스를 시작할 수 없습니다. 시작 유형을 먼저 바꾸고 「적용」을 누릅니다.' };
    svcPut(st, name, 'status', SVC_ON); return { ok: true };
  }
  function svcStop(st, name) { svcPut(st, name, 'status', SVC_OFF); return { ok: true }; }
  function svcPause(st, name) { var s = svcGet(st, name); if (!s.pausable || s.status !== SVC_ON) return { ok: false, error: '이 서비스는 일시 중지할 수 없습니다.' }; svcPut(st, name, 'status', SVC_PAUSE); return { ok: true }; }
  function svcResume(st, name) { var s = svcGet(st, name); if (s.status !== SVC_PAUSE) return { ok: false, error: '일시 중지된 서비스만 계속할 수 있습니다.' }; svcPut(st, name, 'status', SVC_ON); return { ok: true }; }

  /* ------------------------------------------------------------ 로컬 보안 정책: 보안 옵션 */
  function secoptDef(key) { return CAT.SECOPTS.filter(function (o) { return o.key === key; })[0]; }
  function secoptValueText(key, v) {
    var d = secoptDef(key);
    if (d.kind === 'bool') return v ? '사용' : '사용 안 함';
    if (d.kind === 'days') return v + ' 일';
    return String(v == null ? '' : v);
  }
  function secoptText(st, key) { return secoptValueText(key, st.secopt[key]); }
  function secoptSet(st, key, value) {
    var d = secoptDef(key);
    if (d.kind === 'bool') {
      st.secopt[key] = !!value;
      if (key === 'guestOn') { var g = st.users.users.filter(function (u) { return u.builtinKey === 'guest'; })[0]; if (g) g.disabled = !value; }
      return { ok: true };
    }
    if (d.kind === 'days') {
      var n = Number(value);
      if (String(value).trim() === '' || !isFinite(n) || Math.floor(n) !== n || n < 0 || n > 999) return { ok: false, error: '0에서 999 사이의 값을 입력합니다.' };
      st.secopt[key] = n; return { ok: true };
    }
    var v = String(value == null ? '' : value);
    if (key === 'adminName' || key === 'guestName') {
      var u = st.users.users.filter(function (x) { return x.builtinKey === (key === 'adminName' ? 'admin' : 'guest'); })[0];
      var e = checkAccountName(st, v, '계정', u);
      if (e) return { ok: false, error: e };
      v = v.trim();
      var old = u.name; u.name = v;
      st.users.groups.forEach(function (g) { g.members = g.members.map(function (m) { return m.toLowerCase() === old.toLowerCase() ? v : m; }); });
    }
    st.secopt[key] = key === 'msgText' ? v : v.trim();
    return { ok: true };
  }

  var API = {
    SERVER: SERVER,
    upgrade: upgrade, UINT_MAX: UINT_MAX, ADV: ADV, bindText: bindText, bindIpText: bindIpText, advValue: advValue,
    findSite: findSite, siteById: siteById, checkSiteName: checkSiteName, checkPath: checkPath, checkBinding: checkBinding, normBindIp: normBindIp,
    addWebSite: addWebSite, setBindings: setBindings, siteStart: siteStart, siteStop: siteStop, siteRemove: siteRemove, setAdv: setAdv,
    docAdd: docAdd, docRemove: docRemove, docMove: docMove, setAuth: setAuth, ipRuleAdd: ipRuleAdd, ipRuleRemove: ipRuleRemove, ipDefaultSet: ipDefaultSet,
    errorSet: errorSet, errorRemove: errorRemove, smtpSet: smtpSet, setWebDirBrowse: setWebDirBrowse,
    checkFtpPage: checkFtpPage, addFtpSite: addFtpSite, ftpSetDirBrowse: ftpSetDirBrowse, ftpSetFirewall: ftpSetFirewall, ftpSetMsg: ftpSetMsg,
    ftpAuthzAdd: ftpAuthzAdd, ftpAuthzRemove: ftpAuthzRemove, WHO_TEXT: WHO_TEXT, authzText: authzText, permText: permText,
    findUser: findUser, findGroup: findGroup, groupsOf: groupsOf, createUser: createUser, setUserGeneral: setUserGeneral, setUserSession: setUserSession,
    setUserRemote: setUserRemote, setUserDial: setUserDial, addUserToGroups: addUserToGroups, removeUserFromGroup: removeUserFromGroup,
    setPassword: setPassword, deleteUser: deleteUser, renameUser: renameUser, createGroup: createGroup, setGroup: setGroup, resolveNames: resolveNames,
    START_TYPES: START_TYPES, SVC_ON: SVC_ON, SVC_OFF: SVC_OFF, SVC_PAUSE: SVC_PAUSE, svcGet: svcGet, svcList: svcList,
    svcSetStart: svcSetStart, svcStart: svcStart, svcStop: svcStop, svcPause: svcPause, svcResume: svcResume,
    secoptDef: secoptDef, secoptText: secoptText, secoptValueText: secoptValueText, secoptSet: secoptSet, CAT: CAT,
    parseIp: parseIp, isIp: isIp, normIp: normIp, ipToInt: ipToInt, intToIp: intToIp,
    maskFromLen: maskFromLen, lenFromMask: lenFromMask, netOf: netOf, bcastOf: bcastOf, sameNet: sameNet,
    normName: normName, withDot: withDot, validDnsName: validDnsName,
    create: create, clone: clone, adapter: adapter,
    checkIpv4: checkIpv4, setIpv4: setIpv4, setAdapterItem: setAdapterItem, setAdapterEnabled: setAdapterEnabled,
    SEC: SEC, SEC_ORDER: SEC_ORDER, secText: secText, secValueText: secValueText, secChange: secChange, secApply: secApply, secSet: secSet,
    scopeLabel: scopeLabel, checkRange: checkRange, checkExclusion: checkExclusion, checkLease: checkLease, leaseText: leaseText,
    createScope: createScope, scopeSetActive: scopeSetActive, scopeDelete: scopeDelete, scopeUpdate: scopeUpdate,
    scopeAddExclusion: scopeAddExclusion, scopeRemoveExclusion: scopeRemoveExclusion, scopeSetOptions: scopeSetOptions,
    scopeFind: scopeFind, poolCount: poolCount,
    UNITS: UNITS, UNIT_SEC: UNIT_SEC, secs: secs, ttlSecs: ttlSecs,
    checkZoneName: checkZoneName, findZone: findZone, zoneIndex: zoneIndex, createZone: createZone, zoneDelete: zoneDelete,
    fqdn: fqdn, addHost: addHost, addAlias: addAlias, recordDelete: recordDelete, checkSoa: checkSoa, setSoa: setSoa,
    zoneRows: zoneRows, findRecord: findRecord,
  };
  return API;
}));
