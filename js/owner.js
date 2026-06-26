/* 차주 화면 — 토큰(차량) 기반, Supabase 연동 + 요청 알림(1단계) */
const $ = s => document.querySelector(s);
const token = PARKLINK.tokenFromUrl();
let busy = false;
let phoneInit = false;

/* ---------- 알림 상태 ---------- */
let seenIds = null;       // 이미 본 요청 id 집합(null=초기화 전)
let audioCtx = null;
let notifReady = false;   // 알림 권한 + 오디오 활성화 여부
let vehicleName = '차량';

function initAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) {}
}
function beep() {
  if (!audioCtx) return;
  const seq = [0, 0.18, 0.36];
  seq.forEach(t => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime + t);
    g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + t + 0.15);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.16);
  });
}
function flash() {
  const el = $('#flashOverlay');
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
}
function vibrate() { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); }

function notifyNew(req) {
  beep(); flash(); vibrate();
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification('PARKLINK · ' + vehicleName, {
        body: `${req.reason} (${req.urgency}) · ${req.location}`,
        tag: 'parklink-' + req.id, renotify: true,
      });
      n.onclick = () => { window.focus(); n.close(); };
    } catch (e) {}
  }
}

function updateNotifUI() {
  const perm = ('Notification' in window) ? Notification.permission : 'unsupported';
  const btn = $('#notifBtn'), st = $('#notifStatus');
  if (perm === 'granted' && notifReady) {
    btn.textContent = '✓ 알림 켜짐'; btn.disabled = true; btn.classList.remove('btn-primary'); btn.classList.add('btn-outline');
    st.innerHTML = '새 요청이 오면 <b>소리·진동·알림</b>으로 알려드립니다.';
  } else if (perm === 'denied') {
    st.innerHTML = '브라우저에서 알림이 차단되어 있습니다. 사이트 설정에서 알림을 허용해 주세요. (차단 시에도 소리·진동·화면 점멸은 동작)';
  }
}

async function enableNotif() {
  initAudio(); beep();           // 사용자 제스처로 오디오 활성화 + 테스트음
  if ('Notification' in window && Notification.permission !== 'granted') {
    try { await Notification.requestPermission(); } catch (e) {}
  }
  notifReady = true;
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

  $('#notifBtn').addEventListener('click', enableNotif);
  $('#savePhone').addEventListener('click', async () => {
    const val = $('#phoneInput').value.trim();
    if (val) { try { await PARKLINK.setOwnerPhone(token, val); render(); } catch (e) { alert('저장 실패: ' + e.message); } }
  });
  updateNotifUI();
  render();
  setInterval(render, 2000);
}

function replyButtons(id) {
  return `<div class="replies">` +
    PARKLINK.REPLIES.map((m, i) => `<button class="btn ${i === 0 ? 'btn-primary full' : 'btn-outline'}" data-id="${id}" data-msg="${m}">${m}</button>`).join('') +
    `</div>`;
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
      <dt>구독</dt><dd>${v.months}개월 · ${PARKLINK.statusBadge(s)}</dd>
      <dt>만료일</dt><dd>${PARKLINK.fmtDate(v.expireAt)} ${s.expired ? '(만료)' : '(D-' + s.daysLeft + ')'}</dd>`;

    const shocks = await PARKLINK.listShocks(token);
    $('#shockBox').innerHTML = shocks.length
      ? `<div class="banner expired"><span>⚠️</span><span><b>충격 감지: ${shocks[0].level}</b> · ${PARKLINK.fmtTime(shocks[0].ts)} (${PARKLINK.timeAgo(shocks[0].ts)})</span></div>` : '';

    const reqs = await PARKLINK.listRequests(token);

    // ---- 신규 미응답 요청 감지 → 알림 ----
    const pendingIds = reqs.filter(r => r.status === 'pending').map(r => r.id);
    let freshIds = [];
    if (seenIds === null) {
      seenIds = new Set(reqs.map(r => r.id));   // 초기 로드: 알림 없이 기준만 저장
    } else {
      reqs.forEach(r => {
        if (r.status === 'pending' && !seenIds.has(r.id)) { freshIds.push(r.id); notifyNew(r); }
        seenIds.add(r.id);
      });
    }

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
