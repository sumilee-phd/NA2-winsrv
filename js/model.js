/* 윈도우 서버 설정 연습: 상태 모델(DOM 없음). 브라우저와 Node 시험이 같이 읽는다.
 * 네트워크 속성(TCP/IPv4) · 로컬 보안 정책(암호·계정 잠금) · DHCP(새 범위) · DNS(영역·A·CNAME·SOA)
 * 화면 프로그램은 이 파일의 함수로만 상태를 바꾼다. 채점은 최종 상태를 읽는다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WSModel = factory();
}(typeof self !== 'undefined' ? self : this, function () {
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
      server: SERVER,
      net: { adapters: [adapter('로컬 영역 연결')] },
      sec: { complexity: false, history: 0, maxAge: 42, minLen: 0, minAge: 0, reversible: false,
        lockDuration: null, lockThreshold: 0, lockReset: null },
      dhcp: { scopes: [] },
      dns: { zones: [] },
    };
    if (typeof setup === 'function') setup(st, API);
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

  var API = {
    SERVER: SERVER,
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
