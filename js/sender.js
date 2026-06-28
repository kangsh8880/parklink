/* 발신자 화면 — 토큰(차량) 기반, Supabase 연동 */
const $ = s => document.querySelector(s);
const token = PARKLINK.tokenFromUrl();
let myReqId = null;
let vehicle = null;

async function boot() {
  try {
    vehicle = await PARKLINK.getVehicle(token);
  } catch (e) {
    $('#invalid').style.display = 'block';
    $('#invalidMsg').innerHTML = '연결 오류가 발생했습니다.<br><span class="muted">' + e.message + '</span>';
    return;
  }
  if (!token || !vehicle) {
    $('#invalid').style.display = 'block';
    $('#invalidMsg').innerHTML = '유효하지 않은 QR입니다.<br><span class="muted">등록되지 않은 차량이거나 잘못된 링크입니다.</span>';
    return;
  }
  const s = PARKLINK.statusOf(vehicle);
  if (s.expired) {
    $('#invalid').style.display = 'block';
    $('#invalidMsg').innerHTML = '이 차량의 PARKLINK 구독이 만료되었습니다.<br><span class="muted">차주에게 갱신이 필요합니다.</span>';
    return;
  }
  $('#valid').style.display = 'block';
  $('#vehLead').textContent = `${vehicle.name} · 전화번호 없이 차주에게 안심 연결됩니다.`;
  renderReasons();
  PARKLINK.liveRequests(token, refresh, 3000);  // 실시간 구독(폴백: 폴링)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  initAssistant();
}

function initAssistant() {
  if (!window.PARKASSIST) return;
  PARKASSIST.init({
    title: 'AI 음성 — 연락하기',
    greet: '어떤 일로 연락할지 말씀해 주세요. 예를 들어, 차 좀 빼 주세요, 라고 하시면 돼요.',
    helpText: '이 화면은 주차된 차량의 차주에게 연락하는 화면입니다.\n마이크(말하기) 버튼을 누르고 상황을 말하면 차주에게 전달돼요.\n예) "차 좀 빼주세요", "문콕 났어요", "견인될 것 같아요", "라이트가 켜져 있어요".',
    interpret: async (t) => {
      const key = PARKVOICE.matchReason(t);
      if (!key) return null;
      const r = PARKLINK.REASONS.find(x => x.key === key);
      return {
        label: r.label,
        confirm: `${r.label}. 이 내용으로 차주에게 보낼까요?`,
        run: async () => { await send(key); return `${r.label}, 차주에게 전달했어요.`; },
      };
    },
  });
}

function renderReasons() {
  $('#reasonList').innerHTML = PARKLINK.REASONS.map(r => `
    <div class="reason" data-key="${r.key}">
      <div class="dot ${r.cls}">!</div>
      <div class="txt"><b>${r.label}</b><small>${r.desc} · ${r.urgency}</small></div>
      <span class="muted">›</span>
    </div>`).join('');
  document.querySelectorAll('.reason').forEach(el => el.addEventListener('click', () => send(el.dataset.key)));
}

function setLinks(req) {
  const digits = PARKLINK.telDigits(vehicle.ownerPhone);
  const body = `[PARKLINK] ${req.reason} — 주차 차량 연락드립니다`;
  $('#callBtn').setAttribute('href', 'tel:' + digits);
  $('#smsBtn').setAttribute('href', 'sms:' + digits + '?body=' + encodeURIComponent(body));
  $('#privNote').innerHTML = `테스트 모드: 차주 번호(<b>${vehicle.ownerPhone}</b>)로 직접 연결됩니다.<br>실제 서비스에서는 050 안심번호로 비공개 중계됩니다.`;
}

async function send(key) {
  try {
    myReqId = await PARKLINK.sendRequest(token, key);
    const r = await PARKLINK.getRequest(myReqId);
    $('#step-select').style.display = 'none';
    $('#step-sent').style.display = 'block';
    $('#sentInfo').textContent = `${r.reason} · ${PARKLINK.fmtTime(r.ts)}`;
    // 대기 상태로 초기화
    $('#waitingCard').style.display = 'block';
    $('#answerCard').style.display = 'none';
    $('#keepBanner').style.display = 'flex';
    $('#actionBtns').style.display = 'none';
    waitingSince = Date.now();
    fallbackShown = false;
    setLinks(r);
    armUnloadGuard();
    // "이 화면을 닫지 마세요" 확인 모달 노출(확인을 눌러야 대기 진행)
    $('#keepOpenModal').style.display = 'flex';
    // 차주에게 웹푸시 발송 트리거(잠금화면 알림)
    if (window.PARKPUSH) PARKPUSH.notify(token, 'PARKLINK · ' + vehicle.name, `${r.reason} (${r.urgency})`);
  } catch (e) {
    let m = '전송에 실패했어요. 잠시 후 다시 시도해 주세요.';
    if (/rate_limited/.test(e.message)) m = '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.';
    else if (/expired/.test(e.message)) m = '이 차량의 PARKLINK 구독이 만료되었습니다.';
    else if (/invalid_token|invalid_reason/.test(e.message)) m = '유효하지 않은 요청입니다.';
    alert(m);
  }
}

// 닫기 경고: 회신 대기 중에는 화면 이탈 시 브라우저 경고
let unloadGuard = null, waitingSince = 0, fallbackShown = false;
function armUnloadGuard() {
  if (unloadGuard) return;
  unloadGuard = (e) => { e.preventDefault(); e.returnValue = ''; return ''; };
  window.addEventListener('beforeunload', unloadGuard);
}
function disarmUnloadGuard() {
  if (unloadGuard) { window.removeEventListener('beforeunload', unloadGuard); unloadGuard = null; }
}
function replyArrived() {
  try { if (navigator.vibrate) navigator.vibrate([200, 80, 200]); } catch (_) {}
}

async function refresh() {
  if (!myReqId || document.hidden) return;
  const r = await PARKLINK.getRequest(myReqId);
  if (!r) return;
  setLinks(r);
  if (r.status === 'answered') {
    $('#waitingCard').style.display = 'none';
    $('#answerCard').style.display = 'block';
    $('#answerMsg').textContent = r.reply;
    $('#answerTime').textContent = '응답 ' + PARKLINK.timeAgo(r.replyTs);
    // 회신 도착 → 닫기 경고 해제, 조치 버튼 노출, 배너 정리, 진동 환기
    if ($('#keepBanner').style.display !== 'none') replyArrived();
    $('#keepBanner').style.display = 'none';
    $('#actionBtns').style.display = 'block';
    disarmUnloadGuard();
  } else if (!fallbackShown && waitingSince && Date.now() - waitingSince > 60000) {
    // 응답이 늦어지면(60초 경과) 직접 연락 폴백 노출
    fallbackShown = true;
    $('#actionBtns').style.display = 'block';
    $('#keepBanner').innerHTML = '<span class="blink">🔔</span><span>아직 회신을 기다리는 중이에요. 급하면 아래로 <b>직접 연락</b>할 수 있어요.</span>';
  }
}

document.addEventListener('click', e => {
  if (!e.target) return;
  // "확인 — 회신을 기다릴게요"
  if (e.target.id === 'keepOpenOk') {
    $('#keepOpenModal').style.display = 'none';
    return;
  }
  if (e.target.id === 'againBtn') {
    myReqId = null;
    disarmUnloadGuard();
    waitingSince = 0; fallbackShown = false;
    $('#keepOpenModal').style.display = 'none';
    $('#step-sent').style.display = 'none';
    $('#answerCard').style.display = 'none';
    $('#waitingCard').style.display = 'block';
    $('#keepBanner').style.display = 'flex';
    $('#actionBtns').style.display = 'none';
    $('#step-select').style.display = 'block';
  }
});

let dots = 1;
setInterval(() => { const el = $('#waitDots'); if (el) { dots = (dots % 3) + 1; el.textContent = '●'.repeat(dots); } }, 500);

boot();
