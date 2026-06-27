/* 차주 화면 — Supabase 연동 + 요청 알림(기본 ON, 토글로 끄기/켜기) */
const $ = s => document.querySelector(s);
const token = PARKLINK.tokenFromUrl();
const OFF_KEY = 'parklink:notifOff:' + token;   // 사용자가 끈 상태 기억
let busy = false;
let phoneInit = false;

/* ---------- 알림 상태 ---------- */
let seenIds = null;
let audioCtx = null;
let alertsEnabled = true;   // 알림 on/off (기본 on)
let pushOn = false;
let pushErr = null;
let vehicleName = '차량';

function initAudio() {
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) {}
}
function beep() {
  if (!audioCtx) return;
  [0, 0.18, 0.36].forEach(t => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime + t);
    g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + t + 0.15);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.16);
  });
}
function flash() { const el = $('#flashOverlay'); el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); }
function vibrate() { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); }

function notifyNew(req) {
  if (!alertsEnabled) return;
  beep(); flash(); vibrate();
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification('PARKLINK · ' + vehicleName, { body: `${req.reason} (${req.urgency}) · ${req.location}`, tag: 'parklink-' + req.id, renotify: true });
      n.onclick = () => { window.focus(); n.close(); };
    } catch (e) {}
  }
}

function updateNotifUI() {
  const st = $('#notifStatus');
  const perm = ('Notification' in window) ? Notification.permission : 'unsupported';
  if (!alertsEnabled) { st.innerHTML = '알림이 <b>꺼져</b> 있습니다. 켜려면 토글을 올리세요.'; return; }
  if (perm === 'denied') { st.innerHTML = '브라우저에서 알림이 차단됨 — 사이트 설정에서 허용해 주세요. (소리·진동·점멸은 동작)'; return; }
  if (perm !== 'granted') { st.innerHTML = '알림 권한이 필요합니다. 토글을 한 번 더 누르거나 화면을 터치하면 허용 창이 뜹니다.'; return; }
  if (pushOn) st.innerHTML = '✓ 켜짐 — 앱/화면을 꺼도 <b>잠금화면 알림</b>이 옵니다.';
  else if (pushErr) st.innerHTML = '소리·진동·알림은 동작합니다. 웹푸시 구독 실패: <span class="muted">' + pushErr + '</span>';
  else st.innerHTML = '✓ 켜짐 — 새 요청 시 소리·진동·알림으로 알려드립니다.';
}

// 알림 켜기: 권한 + 웹푸시 구독
async function enableAlerts(viaGesture) {
  alertsEnabled = true;
  localStorage.removeItem(OFF_KEY);
  if (viaGesture) { initAudio(); beep(); }
  if ('Notification' in window && Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch (e) {}
  }
  if (window.PARKPUSH && Notification.permission === 'granted') {
    try { await PARKPUSH.subscribe(token); pushOn = true; pushErr = null; }
    catch (e) { pushErr = e.message; }
  }
  updateNotifUI();
}

// 알림 끄기: 웹푸시 구독 해제 + 상태 기억
async function disableAlerts() {
  alertsEnabled = false;
  pushOn = false;
  localStorage.setItem(OFF_KEY, '1');
  if (window.PARKPUSH) { try { await PARKPUSH.unsubscribe(); } catch (e) {} }
  updateNotifUI();
}

/* ---------- 부팅 ---------- */
async function boot() {
  let v;
  try { v = await PARKLINK.getVehicle(token); }
  catch (e) { $('#invalid').style.display = 'block'; return; }
  if (!token || !v) { $('#invalid').style.display = 'block'; return; }
  $('#valid').style.display = 'block';
  vehicleName = v.name;
  try { localStorage.setItem('parklink:lastOwnerToken', token); } catch (e) {}

  const toggle = $('#notifToggle');
  const userOff = localStorage.getItem(OFF_KEY) === '1';
  alertsEnabled = !userOff;
  toggle.checked = !userOff;

  // 빠른 회신(상시) 버튼 구성
  const qr = $('#quickReplies');
  if (qr) {
    qr.innerHTML = PARKLINK.REPLIES.map((m, i) =>
      `<button class="btn ${i === 0 ? 'btn-primary full' : 'btn-outline'}" data-qr="${m}">${m}</button>`).join('');
    qr.querySelectorAll('button[data-qr]').forEach(b =>
      b.addEventListener('click', () => quickReply(b.dataset.qr)));
  }

  toggle.addEventListener('change', async () => {
    if (toggle.checked) await enableAlerts(true);
    else await disableAlerts();
  });

  // 첫 사용자 제스처 시 오디오 활성화 + (권한 미허용이면) 재시도
  document.addEventListener('click', function onceGesture() {
    if (!alertsEnabled) return;
    initAudio();
    if ('Notification' in window && Notification.permission === 'default') enableAlerts(true);
  }, { once: true });

  $('#savePhone').addEventListener('click', async () => {
    const val = $('#phoneInput').value.trim();
    if (val) { try { await PARKLINK.setOwnerPhone(token, val); render(); } catch (e) { alert('저장 실패: ' + e.message); } }
  });

  // 기본 ON: 자동으로 알림 활성화 시도(권한이 이미 허용돼 있으면 조용히 구독)
  if (alertsEnabled) await enableAlerts(false);
  else updateNotifUI();

  render();
  setInterval(render, 2000);
  initAssistant();
}

function initAssistant() {
  if (!window.PARKASSIST) return;
  PARKASSIST.init({
    title: 'AI 음성 — 응답하기',
    greet: '응답을 말씀해 주세요. 예를 들어, 삼 분 안에 갈게요, 라고 하시면 돼요.',
    helpText: '이 화면은 차주가 받은 연락 요청에 응답하는 화면입니다.\n마이크(말하기) 버튼을 누르고 응답을 말하면 발신자에게 전송돼요.\n예) "3분 내 갈게요", "곧 갑니다", "양보 부탁해요", "바로 연락드릴게요".',
    interpret: async (t) => {
      const reply = PARKVOICE.matchReply(t, PARKLINK.REPLIES);
      if (!reply) return null;
      const reqs = await PARKLINK.listRequests(token);
      const pend = reqs.find(r => r.status === 'pending');
      if (!pend) return { label: '응답할 요청 없음', confirm: '지금은 응답할 새 요청이 없어요. 그래도 진행할까요?', run: async () => '응답할 새 요청이 없어요.' };
      return {
        label: `“${reply}”로 응답`,
        confirm: `${pend.reason} 요청에, ${reply}. 이렇게 응답할까요?`,
        run: async () => { await PARKLINK.answerRequest(pend.id, reply); render(); return `${reply}, 라고 응답했어요.`; },
      };
    },
  });
}

function replyButtons(id) {
  return `<div class="replies">` +
    PARKLINK.REPLIES.map((m, i) => `<button class="btn ${i === 0 ? 'btn-primary full' : 'btn-outline'}" data-id="${id}" data-msg="${m}">${m}</button>`).join('') +
    `</div>`;
}

// 빠른 회신: 가장 최근 pending 요청에 즉시 응답(없으면 가장 최근 요청에 재응답)
async function quickReply(msg) {
  try {
    const reqs = await PARKLINK.listRequests(token);
    let target = reqs.find(r => r.status === 'pending') || reqs[0];
    if (!target) { setQuickHint('아직 받은 요청이 없습니다.'); return; }
    await PARKLINK.answerRequest(target.id, msg);
    setQuickHint(`✓ '${msg}'로 응답했습니다.`);
    render();
  } catch (e) { setQuickHint('응답 실패: ' + e.message); }
}
function setQuickHint(t) {
  const e = document.querySelector('#quickReplyHint');
  if (!e) return;
  e.textContent = t;
  e.dataset.acted = '1';
  clearTimeout(e._t);
  e._t = setTimeout(() => { delete e.dataset.acted; }, 3000);
}

async function render() {
  if (busy) return; busy = true;
  try {
    const v = await PARKLINK.getVehicle(token);
    if (!v) { $('#valid').style.display = 'none'; $('#invalid').style.display = 'block'; return; }
    const s = PARKLINK.statusOf(v);
    vehicleName = v.name;

    if (!phoneInit) { $('#phoneInput').value = v.ownerPhone; phoneInit = true; }
    $('#vehTitle').textContent = v.name + ' · 실시간 알림';

    const bn = $('#subBanner');
    if (s.expired) bn.innerHTML = `<div class="banner expired"><span>⛔</span><span><b>구독이 만료되었습니다.</b> 갱신 전까지 발신자 연결이 차단됩니다.</span></div>`;
    else if (s.renewDue) bn.innerHTML = `<div class="banner renew"><span>🔔</span><span><b>구독 만료 D-${s.daysLeft}</b> — 곧 만료됩니다. 미리 갱신하세요. (만료 ${PARKLINK.RENEW_DAYS}일 전부터 알림)</span></div>`;
    else bn.innerHTML = '';

    $('#subInfo').innerHTML = `
      <dt>토큰</dt><dd><span class="tokenpill">${v.token}</span></dd>
      <dt>구독</dt><dd>${PARKLINK.subMonths(v)}개월 · ${PARKLINK.statusBadge(s)}</dd>
      <dt>만료일</dt><dd>${PARKLINK.fmtDate(v.expireAt)} ${s.expired ? '(만료)' : '(D-' + s.daysLeft + ')'}</dd>`;

    const shocks = await PARKLINK.listShocks(token);
    $('#shockBox').innerHTML = shocks.length
      ? `<div class="banner expired"><span>⚠️</span><span><b>충격 감지: ${shocks[0].level}</b> · ${PARKLINK.fmtTime(shocks[0].ts)} (${PARKLINK.timeAgo(shocks[0].ts)})</span></div>` : '';

    const reqs = await PARKLINK.listRequests(token);

    const pendingIds = reqs.filter(r => r.status === 'pending').map(r => r.id);
    const qhint = $('#quickReplyHint');
    if (qhint && !qhint.dataset.acted) {
      qhint.textContent = pendingIds.length
        ? `응답 대기 중 ${pendingIds.length}건 — 아래 버튼으로 바로 응답하세요.`
        : '새 요청이 오면 아래 버튼으로 바로 응답할 수 있어요.';
    }
    let freshIds = [];
    if (seenIds === null) { seenIds = new Set(reqs.map(r => r.id)); }
    else { reqs.forEach(r => { if (r.status === 'pending' && !seenIds.has(r.id)) { freshIds.push(r.id); notifyNew(r); } seenIds.add(r.id); }); }

    const list = $('#reqList');
    if (!reqs.length) { list.innerHTML = ''; $('#empty').style.display = 'block'; }
    else {
      $('#empty').style.display = 'none';
      list.innerHTML = reqs.map(r => {
        const fresh = freshIds.includes(r.id) ? ' fresh' : '';
        if (r.status === 'answered') {
          return `<div class="req answered">
            <div class="head"><span class="title">${r.reason}</span>${PARKLINK.urgencyBadge(r.urgency)}</div>
            <div class="meta">${r.location} · ${PARKLINK.fmtTime(r.ts)}</div>
            <div class="answer">✓ 응답함: ${r.reply}</div></div>`;
        }
        return `<div class="req${fresh}">
          <div class="head"><span class="title">${r.reason}</span>${PARKLINK.urgencyBadge(r.urgency)}</div>
          <div class="meta">${r.desc} · ${r.location} · ${PARKLINK.timeAgo(r.ts)}</div>
          ${replyButtons(r.id)}</div>`;
      }).join('');
      list.querySelectorAll('button[data-id]').forEach(b =>
        b.addEventListener('click', async () => { try { await PARKLINK.answerRequest(b.dataset.id, b.dataset.msg); render(); } catch (e) { alert('응답 실패: ' + e.message); } }));
    }
  } catch (e) { console.error(e); }
  finally { busy = false; }
}

boot();
