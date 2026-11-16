/* 화면 흐름: 과제 목록 → 과제 화면(왼쪽 문제, 오른쪽 서버 바탕과 관리 도구 창) → 채점(최종 설정값 대조)
 * 실전 세트: 8유형에서 1문항씩, 제한 시간 40분, 문항 사이를 오가며 풀고 끝에 한꺼번에 채점한다.
 * 기록은 이 기기의 브라우저 저장소(localStorage)에만 남는다.
 */
(function (G) {
  'use strict';
  const WS = G.WS, M = G.WSModel, T = G.WSTasks;
  const { h, icon, dialog, msg, toast, closeMenu } = WS.ui;
  const KEY = 'na2-winsrv-v1';
  const FS = [16, 18, 20, 22, 24, 26];
  const TOOL_ORDER = ['net', 'sec', 'dhcp', 'dns', 'iis', 'users', 'svc'];
  const SET_SECONDS = 40 * 60;

  /* ---------------------------------------------------------- 저장소 */
  let store = { fs: 0, steps: true, exam: true, tasks: {}, set: null, lastSet: null };
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && typeof s === 'object') store = Object.assign(store, s); } catch (e) { /* 저장소를 쓸 수 없으면 기록 없이 진행 */ }
  if (!FS.includes(store.fs)) store.fs = innerHeight >= 900 ? 20 : 18;
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* 무시 */ } }
  function rec(id) { return store.tasks[id] || (store.tasks[id] = {}); }

  const app = document.getElementById('app');
  let S = null; // 진행 중 과제 {task, st, sec, open:Map, active, timer, set}

  function fmtTime(s) { s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
  function typeOf(id) { return T.TYPES.find(t => t.id === id); }
  function taskNo(task) { const list = T.TASKS.filter(t => t.type === task.type); return typeOf(task.type).no + '-' + (list.indexOf(task) + 1); }
  function setFs(px) { store.fs = px; persist(); document.documentElement.style.setProperty('--fs', px + 'px'); }
  setFs(store.fs);

  /* ---------------------------------------------------------- 과제 목록 */
  function home() {
    stopTask();
    document.title = '윈도우 서버 설정 연습';
    app.className = 'home';
    app.innerHTML = '';
    const band = h('header', { class: 'band' }, h('div', { class: 'band-in' },
      h('p', { class: 'kicker' }, '네트워크관리사 2급 실기 · 윈도우 서버 설정 8유형'),
      h('h1', {}, '윈도우 서버 ', h('span', { class: 'hl' }, '설정 연습')),
      h('p', { class: 'lead' }, '네트워크 속성 · 로컬 보안 정책 · DHCP · DNS · 웹 · FTP · 로컬 사용자 및 그룹 · 서비스를 큰 글자 화면에서 연습하고, 최종 설정값을 대조해 채점합니다.')));
    const guide = h('section', { class: 'box guide' },
      h('h2', { class: 'tag' }, '사용 방법'),
      h('ol', {},
        h('li', {}, '과제를 고르면 왼쪽에 문제와 조건, 오른쪽에 서버 화면이 열립니다. 시험장 방식이면 해당 설정 창이 바로 열립니다.'),
        h('li', {}, '메뉴는 마우스 오른쪽 단추로 엽니다. 트리에서 항목을 먼저 왼쪽 단추로 선택해야 켜지는 메뉴가 있습니다.'),
        h('li', {}, '「채점」을 누르면 조건과 현재 설정값을 항목별로 대조합니다. 틀린 항목을 고친 뒤 다시 채점할 수 있습니다.'),
        h('li', {}, '「실전 세트」는 8유형에서 1문항씩 40분 안에 풀고 마지막에 한꺼번에 채점합니다. 시험 전 마무리 연습에 씁니다.')));
    const examCb = h('input', { type: 'checkbox', checked: store.exam });
    examCb.addEventListener('change', () => { store.exam = examCb.checked; persist(); });
    const opts = h('div', { class: 'fsrow' }, h('span', {}, '작업 화면 글자 크기'), fsControl(),
      h('label', { class: 'check homecheck' }, examCb, h('span', {}, '시험장 방식: 과제를 열면 해당 설정 창을 바로 엽니다')));
    const setBox = h('section', { class: 'box setbox' }, h('h2', { class: 'tag red' }, '실전 세트'),
      h('p', {}, '윈도우 서버 8유형에서 1문항씩 무작위로 골라 제한 시간 40분 안에 풉니다. 문항 사이를 오갈 수 있고, 채점은 마지막에 한꺼번에 합니다.'),
      store.lastSet ? h('p', { class: 'note' }, '지난 실전 세트: 정답 ' + store.lastSet.correct + ' / ' + store.lastSet.total + ' · 걸린 시간 ' + fmtTime(store.lastSet.used)) : null,
      h('div', { class: 'tact left' },
        store.set ? h('button', { type: 'button', class: 'btn primary', onclick: () => openSet(store.set.idx) }, '이어서 하기 (' + (store.set.idx + 1) + '/' + store.set.ids.length + ', 남은 시간 ' + fmtTime(store.set.left) + ')') : null,
        h('button', { type: 'button', class: 'btn' + (store.set ? '' : ' primary'), onclick: newSet }, store.set ? '새 실전 세트' : '실전 세트 시작')));
    const sections = T.TYPES.map(tp => {
      const list = T.TASKS.filter(t => t.type === tp.id);
      return h('section', { class: 'tsec' },
        h('div', { class: 'tsec-head' }, h('span', { class: 'secno' }, String(tp.no).padStart(2, '0')), icon(WS.tools[tp.tool].icon), h('h2', {}, tp.name), h('span', { class: 'tdesc' }, tp.desc)),
        h('ol', { class: 'tlist' }, list.map(t => {
          const r = store.tasks[t.id] || {};
          const status = r.best ? (r.best.passed === r.best.total ? h('span', { class: 'chip ok' }, '통과') : h('span', { class: 'chip' }, '최고 ' + r.best.passed + '/' + r.best.total)) : null;
          const going = r.st ? h('span', { class: 'chip going' }, '진행 중 ' + fmtTime(r.sec || 0)) : null;
          return h('li', {},
            h('span', { class: 'tno' }, taskNo(t)),
            h('div', { class: 'tmain' }, h('b', {}, t.title), h('span', { class: 'tq' }, t.q)),
            h('div', { class: 'tact' }, status, going,
              r.st ? h('button', { type: 'button', class: 'btn primary', onclick: () => startTask(t, true) }, '이어서 하기') : null,
              h('button', { type: 'button', class: 'btn' + (r.st ? '' : ' primary'), onclick: () => startTask(t, false) }, r.st ? '처음부터' : '시작')));
        })));
    });
    const foot = h('footer', { class: 'foot' },
      h('p', {}, '수업용 연습 도구입니다. 칸 이름과 동작은 실기 시험 연습 프로그램의 한국어 표기를 따랐고, 화면 모양은 읽기 쉽게 새로 만들었습니다. Windows Server 2022(영어판) 화면으로 기본값과 동작을 함께 대조했습니다(2026-11-15).'),
      h('p', {}, '채점은 이 연습기의 기준이라 실제 시험 채점과 다를 수 있습니다. 시험 전 마지막 연습은 협회 자료실의 공식 연습 프로그램으로 합니다. 과제의 주소와 이름은 모두 연습용으로 새로 정한 값입니다.'),
      h('p', {}, h('button', { type: 'button', class: 'linkbtn', onclick: clearAll }, '연습 기록 모두 지우기')),
      h('p', {}, 'ICT폴리텍대학 · 이수미 교수'));
    app.append(band, h('main', { class: 'home-in' }, guide, opts, setBox, ...sections), foot);
  }
  function clearAll() {
    msg({ title: '연습 기록', icon: 'q', text: '이 기기에 저장한 모든 과제의 진행 상태, 채점 기록, 실전 세트를 지우시겠습니까?', buttons: ['예', '아니요'], def: 1 })
      .then(b => { if (b === '예') { store.tasks = {}; store.set = null; store.lastSet = null; persist(); home(); } });
  }
  function fsControl() {
    const out = h('output', { class: 'fsval', 'aria-live': 'polite' }, store.fs + 'px');
    const step = d => { const i = Math.max(0, Math.min(FS.length - 1, FS.indexOf(store.fs) + d)); setFs(FS[i]); out.textContent = store.fs + 'px'; if (S) S.open.forEach(o => o.inst.render()); };
    return h('span', { class: 'fsctl', role: 'group', 'aria-label': '글자 크기' },
      h('button', { type: 'button', class: 'btn sq', title: '글자 작게', 'aria-label': '글자 작게', onclick: () => step(-1) }, '가−'),
      out,
      h('button', { type: 'button', class: 'btn sq', title: '글자 크게', 'aria-label': '글자 크게', onclick: () => step(1) }, '가+'));
  }

  /* ---------------------------------------------------------- 과제 화면 */
  function startTask(task, resume) {
    stopTask();
    const r = rec(task.id);
    const st = M.upgrade(resume && r.st ? r.st : T.fresh(task));
    if (!resume) { r.st = st; r.sec = 0; persist(); }
    openScreen(task, st, { sec: resume ? (r.sec || 0) : 0 });
  }
  function openScreen(task, st, o) {
    const set = !!o.set;
    S = { task, st, sec: o.sec || 0, open: new Map(), active: null, timer: null, set };
    document.title = (set ? '실전 세트 ' + (store.set.idx + 1) + '/' + store.set.ids.length : taskNo(task)) + ' ' + task.title + ' · 윈도우 서버 설정 연습';
    app.className = 'task';
    app.innerHTML = '';
    const clock = h('span', { class: 'clock', 'aria-label': set ? '남은 시간' : '걸린 시간' }, fmtTime(set ? store.set.left : S.sec));
    const stepsBtn = h('button', { type: 'button', class: 'btn', 'aria-pressed': String(store.steps) }, store.steps ? '작업 순서 닫기' : '작업 순서 보기');
    let top;
    if (set) {
      const nav = h('span', { class: 'qnav', role: 'group', 'aria-label': '문항 이동' }, store.set.ids.map((id, i) => h('button', { type: 'button', class: 'btn sq' + (i === store.set.idx ? ' on' : ''), 'aria-current': i === store.set.idx ? 'true' : null, title: typeOf(T.byId(id).type).name, onclick: () => goSet(i) }, String(i + 1))));
      top = h('header', { class: 'topbar' },
        h('button', { type: 'button', class: 'btn', onclick: () => { saveSet(); home(); } }, '← 과제 목록'),
        h('span', { class: 'tchip red' }, '실전 세트 ' + (store.set.idx + 1) + '/' + store.set.ids.length),
        h('h1', { class: 'ttitle' }, typeOf(task.type).name),
        nav, h('span', { class: 'grow' }), clock, fsControl(),
        h('button', { type: 'button', class: 'btn', disabled: store.set.idx === 0, onclick: () => goSet(store.set.idx - 1) }, '◀ 이전'),
        h('button', { type: 'button', class: 'btn', disabled: store.set.idx === store.set.ids.length - 1, onclick: () => goSet(store.set.idx + 1) }, '다음 ▶'),
        h('button', { type: 'button', class: 'btn primary big', onclick: () => confirmFinish() }, '세트 채점'));
    } else {
      top = h('header', { class: 'topbar' },
        h('button', { type: 'button', class: 'btn', onclick: () => home() }, '← 과제 목록'),
        h('span', { class: 'tchip' }, taskNo(task) + ' ' + typeOf(task.type).name),
        h('h1', { class: 'ttitle' }, task.title),
        h('span', { class: 'grow' }),
        clock, fsControl(), stepsBtn,
        h('button', { type: 'button', class: 'btn', onclick: resetTask }, '처음부터'),
        h('button', { type: 'button', class: 'btn primary big', onclick: showGrade }, '채점'));
    }
    const steps = h('section', { class: 'box steps', hidden: set || !store.steps },
      h('h2', { class: 'tag gray' }, '작업 순서'),
      h('ol', {}, task.steps.map(s => h('li', {}, s))));
    stepsBtn.addEventListener('click', () => {
      store.steps = !store.steps; persist();
      steps.hidden = !store.steps;
      stepsBtn.textContent = store.steps ? '작업 순서 닫기' : '작업 순서 보기';
      stepsBtn.setAttribute('aria-pressed', String(store.steps));
    });
    const pane = h('aside', { class: 'taskpane', 'aria-label': '문제' },
      h('section', { class: 'box q' }, h('h2', { class: 'tag' }, set ? '문제 ' + (store.set.idx + 1) : '문제'), h('p', { class: 'qtext' }, task.q)),
      h('section', { class: 'box' }, h('h2', { class: 'tag' }, '조건'),
        h('table', { class: 'given' }, h('tbody', {}, task.given.map(g => h('tr', {}, h('th', { scope: 'row' }, g[0]), h('td', {}, g[1])))))),
      steps,
      h('section', { class: 'box note' }, h('h2', { class: 'tag red' }, '채점 기준'),
        h('p', {}, '최종 설정값만 대조합니다. 조작 순서는 보지 않습니다. 확인·적용으로 저장하지 않고 닫은 창의 값은 반영되지 않습니다.' + (set ? ' 실전 세트는 마지막에 한꺼번에 채점합니다.' : ''))));
    const host = h('div', { class: 'winhost' });
    const launch = h('nav', { class: 'launch', 'aria-label': '관리 도구' }, TOOL_ORDER.map(id => {
      const def = WS.tools[id];
      return h('button', { type: 'button', class: 'lnk', onclick: () => openTool(id), 'data-tool': id }, icon(def.icon, 'big'), h('span', {}, def.title));
    }));
    const taskbar = h('div', { class: 'taskbar', role: 'tablist', 'aria-label': '열린 창' });
    const desk = h('section', { class: 'desk', 'aria-label': '서버 화면' },
      h('div', { class: 'deskarea' }, launch, host, h('p', { class: 'deskhint' }, '바탕의 관리 도구를 눌러 엽니다.')),
      taskbar);
    desk.addEventListener('contextmenu', e => { if (!e.defaultPrevented) e.preventDefault(); });
    app.append(top, h('div', { class: 'tasklayout' }, pane, desk));
    S.host = host; S.taskbar = taskbar; S.clock = clock; S.desk = desk;
    S.timer = setInterval(tick, 1000);
    renderTaskbar();
    if (set || store.exam) openTool(typeOf(task.type).tool);
  }
  function tick() {
    if (document.hidden || !S) return;
    if (S.set) {
      store.set.left = Math.max(0, store.set.left - 1);
      S.clock.textContent = fmtTime(store.set.left);
      S.clock.classList.toggle('late', store.set.left <= 300);
      if (store.set.left % 5 === 0) persist();
      if (store.set.left === 0) { toast('제한 시간이 끝났습니다. 채점합니다.'); finishSet(); }
      return;
    }
    S.sec++; S.clock.textContent = fmtTime(S.sec);
    if (S.sec % 5 === 0) { rec(S.task.id).sec = S.sec; persist(); }
  }
  function stopTask() {
    if (!S) return;
    clearInterval(S.timer);
    if (S.set) saveSet(); else { rec(S.task.id).sec = S.sec; persist(); }
    closeMenu();
    S = null;
  }
  function resetTask() {
    msg({ title: '처음부터', icon: 'q', text: '이 과제의 설정을 처음 상태로 되돌리고 시간을 0으로 맞추시겠습니까?', buttons: ['예', '아니요'], def: 1 })
      .then(b => { if (b === '예') { const t = S.task; stopTask(); const r = rec(t.id); delete r.st; r.sec = 0; persist(); startTask(t, false); } });
  }

  const ctx = {
    st: () => S.st,
    commit: () => {
      if (!S) return;
      if (S.set) { store.set.states[S.task.id] = S.st; persist(); }
      else { const r = rec(S.task.id); r.st = S.st; r.sec = S.sec; persist(); }
      S.open.forEach(o => o.inst.render());
    },
  };
  function openTool(id) {
    if (S.open.has(id)) { activate(id); return; }
    const def = WS.tools[id];
    const inst = def.create(ctx);
    const win = h('section', { class: 'win', 'aria-label': def.title, 'data-tool': id },
      h('div', { class: 'win-title' }, icon(def.icon), h('h2', {}, def.title), h('span', { class: 'grow' }),
        h('button', { type: 'button', class: 'win-x', title: '닫기', 'aria-label': def.title + ' 닫기', onclick: () => closeTool(id) }, '✕')),
      h('div', { class: 'win-body' }, inst.el));
    S.host.appendChild(win);
    S.open.set(id, { win, inst });
    inst.render();
    activate(id);
  }
  function activate(id) {
    S.active = id;
    S.open.forEach((o, k) => { o.win.hidden = k !== id; });
    S.desk.classList.toggle('has-win', S.open.size > 0);
    renderTaskbar();
    const o = S.open.get(id);
    if (o) { const f = o.win.querySelector('.trow.sel, .adapter.sel, .win-x'); if (f) f.focus({ preventScroll: true }); }
  }
  function closeTool(id) {
    const o = S.open.get(id);
    if (!o) return;
    o.win.remove(); S.open.delete(id);
    const rest = [...S.open.keys()];
    if (rest.length) activate(rest[rest.length - 1]);
    else { S.active = null; S.desk.classList.remove('has-win'); renderTaskbar(); const l = S.desk.querySelector('.lnk[data-tool="' + id + '"]'); if (l) l.focus(); }
  }
  function renderTaskbar() {
    S.taskbar.innerHTML = '';
    S.taskbar.appendChild(h('span', { class: 'tb-srv' }, icon('server'), M.SERVER));
    if (S.open.size) S.taskbar.appendChild(h('button', { type: 'button', class: 'tbtn' + (S.active ? '' : ' on'), onclick: () => { S.active = null; S.open.forEach(o => { o.win.hidden = true; }); S.desk.classList.remove('has-win'); renderTaskbar(); } }, '바탕 화면'));
    S.open.forEach((o, id) => {
      const def = WS.tools[id];
      S.taskbar.appendChild(h('button', { type: 'button', class: 'tbtn' + (S.active === id ? ' on' : ''), role: 'tab', 'aria-selected': S.active === id ? 'true' : 'false', onclick: () => activate(id) }, icon(def.icon), def.title));
    });
  }
  function hasPending() { return !!S && [...S.open.values()].some(o => o.inst.pending && o.inst.pending()); }

  /* ---------------------------------------------------------- 채점 */
  function gradeTable(g) {
    return h('table', { class: 'grade' },
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, '번호'), h('th', { scope: 'col' }, '점검 항목'), h('th', { scope: 'col' }, '조건 값'), h('th', { scope: 'col' }, '현재 설정값'), h('th', { scope: 'col' }, '결과'))),
      h('tbody', {}, g.items.map((it, i) => h('tr', { class: it.ok ? 'ok' : 'ng' },
        h('td', { class: 'num' }, String(i + 1)), h('td', {}, it.label), h('td', { class: 'mono' }, it.expect), h('td', { class: 'mono' }, it.actual),
        h('td', {}, h('span', { class: 'chip ' + (it.ok ? 'ok' : 'ng') }, it.ok ? '통과' : '확인 필요'))))));
  }
  function showGrade() {
    const g = T.grade(S.task, S.st);
    const r = rec(S.task.id);
    r.last = { passed: g.passed, total: g.total, at: Date.now() };
    if (!r.best || g.passed > r.best.passed) r.best = { passed: g.passed, total: g.total };
    persist();
    const idx = T.TASKS.indexOf(S.task), nextTask = T.TASKS[idx + 1];
    const head = h('div', { class: 'ghead ' + (g.pass ? 'pass' : 'fail') },
      h('b', { class: 'gscore' }, g.passed + ' / ' + g.total),
      h('span', {}, g.pass ? '모든 항목이 조건과 같습니다.' : '조건과 다른 항목이 있습니다. 「확인 필요」 줄의 현재 설정값을 고친 뒤 다시 채점합니다.'),
      h('span', { class: 'gtime' }, '걸린 시간 ' + fmtTime(S.sec)));
    const warn = hasPending() ? h('p', { class: 'note warn' }, 'IIS 관리자에 저장하지 않은 변경 내용이 있습니다. 기능 페이지에서 「적용」을 누르거나 왼쪽 트리의 사이트를 눌러 「예」로 저장해야 반영됩니다.') : null;
    dialog({ title: '채점 결과 · ' + taskNo(S.task) + ' ' + S.task.title, width: 58, cls: 'gradedlg', body: h('div', {}, head, warn, gradeTable(g)),
      buttons: [
        { label: '계속 작업', primary: !g.pass },
        { label: '처음부터 다시', onClick: () => { setTimeout(resetTask, 0); } },
        nextTask ? { label: '다음 과제', primary: g.pass, onClick: () => { setTimeout(() => startTask(nextTask, !!rec(nextTask.id).st), 0); } } : { label: '과제 목록', primary: g.pass, onClick: () => { setTimeout(home, 0); } },
      ] });
  }

  /* ---------------------------------------------------------- 실전 세트 */
  function newSet() {
    const start = () => {
      const ids = T.TYPES.map(tp => { const list = T.TASKS.filter(t => t.type === tp.id); return list[Math.floor(Math.random() * list.length)].id; });
      store.set = { ids, idx: 0, states: {}, left: SET_SECONDS };
      persist();
      openSet(0);
    };
    if (store.set) msg({ title: '실전 세트', icon: 'q', text: '진행 중인 실전 세트를 버리고 새로 시작하시겠습니까?', buttons: ['예', '아니요'], def: 1 }).then(b => { if (b === '예') start(); });
    else start();
  }
  function openSet(i) {
    stopTask();
    store.set.idx = i; persist();
    const id = store.set.ids[i], task = T.byId(id);
    const st = M.upgrade(store.set.states[id] || T.fresh(task));
    store.set.states[id] = st;
    openScreen(task, st, { set: true });
  }
  function saveSet() { if (S && S.set && store.set) store.set.states[S.task.id] = S.st; persist(); }
  function goSet(i) {
    if (i < 0 || i >= store.set.ids.length) return;
    const go = () => openSet(i);
    if (hasPending()) msg({ title: '실전 세트', icon: 'warn', text: 'IIS 관리자에 저장하지 않은 변경 내용이 있습니다. 이동하면 저장하지 않은 내용은 반영되지 않습니다. 이동하시겠습니까?', buttons: ['예', '아니요'], def: 1 }).then(b => { if (b === '예') go(); });
    else go();
  }
  function confirmFinish() {
    msg({ title: '세트 채점', icon: 'q', text: ['실전 세트를 끝내고 8문항을 한꺼번에 채점하시겠습니까?', '채점한 뒤에는 이 세트를 다시 고칠 수 없습니다.'], buttons: ['예', '아니요'], def: 1 })
      .then(b => { if (b === '예') finishSet(); });
  }
  function finishSet() {
    if (!store.set) return;
    saveSet();
    const set = store.set;
    const rows = set.ids.map((id, i) => {
      const task = T.byId(id), st = M.upgrade(set.states[id] || T.fresh(task));
      const g = T.grade(task, st);
      return { i, task, g };
    });
    const correct = rows.filter(r => r.g.pass).length;
    store.lastSet = { correct, total: rows.length, used: SET_SECONDS - set.left, at: Date.now() };
    store.set = null;
    persist();
    stopTaskQuiet();
    const detail = h('div');
    const table = h('table', { class: 'grade' },
      h('thead', {}, h('tr', {}, h('th', {}, '문항'), h('th', {}, '유형'), h('th', {}, '과제'), h('th', {}, '항목'), h('th', {}, '결과'), h('th', {}, ''))),
      h('tbody', {}, rows.map(r => h('tr', { class: r.g.pass ? 'ok' : 'ng' },
        h('td', { class: 'num' }, String(r.i + 1)), h('td', {}, typeOf(r.task.type).name), h('td', {}, r.task.title), h('td', { class: 'num' }, r.g.passed + '/' + r.g.total),
        h('td', {}, h('span', { class: 'chip ' + (r.g.pass ? 'ok' : 'ng') }, r.g.pass ? '정답' : '오답')),
        h('td', {}, h('button', { type: 'button', class: 'btn sq', onclick: () => { detail.innerHTML = ''; detail.appendChild(h('h3', {}, (r.i + 1) + '번 · ' + r.task.title)); detail.appendChild(gradeTable(r.g)); detail.scrollIntoView({ block: 'nearest' }); } }, '자세히'))))));
    const head = h('div', { class: 'ghead ' + (correct === rows.length ? 'pass' : 'fail') },
      h('b', { class: 'gscore' }, '정답 ' + correct + ' / ' + rows.length),
      h('span', {}, '모든 점검 항목이 맞아야 정답입니다. 틀린 문항은 「자세히」로 현재 설정값을 확인하고, 과제 목록에서 같은 유형을 다시 연습합니다.'),
      h('span', { class: 'gtime' }, '걸린 시간 ' + fmtTime(store.lastSet.used)));
    dialog({ title: '실전 세트 채점 결과', width: 60, cls: 'gradedlg', body: h('div', {}, head, table, detail),
      buttons: [{ label: '과제 목록', primary: true, onClick: () => { setTimeout(home, 0); } }], onClose: () => { if (!S) home(); } });
  }
  function stopTaskQuiet() { if (S) { clearInterval(S.timer); closeMenu(); S = null; } }

  /* ---------------------------------------------------------- 시작 */
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  addEventListener('beforeunload', () => { if (S) { if (S.set) saveSet(); else { rec(S.task.id).sec = S.sec; persist(); } } });
  WS.app = { home, startTask, openTool: id => openTool(id), state: () => S, grade: () => S && T.grade(S.task, S.st), pending: hasPending, newSet, finishSet };
  const q = new URLSearchParams(location.search).get('task');
  const qt = q && T.byId(q);
  if (qt) startTask(qt, !!rec(qt.id).st); else home();
})(window);
