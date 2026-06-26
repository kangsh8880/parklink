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
  setInterval(refresh, 2500);
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
  const body = `[PARKLINK] ${req.reason} — 주차 차량 연락드립니다 (${req.location})`;
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
    $('#sentInfo').textContent = `${r.reason} · ${r.location} · ${PARKLINK.fmtTime(r.ts)}`;
    setLinks(r);
    // 차주에게 웹푸시 발송 트리거(잠금화면 알림)
    if (window.PARKPUSH) PARKPUSH.notify(token, 'PARKLINK · ' + vehicle.name, `${r.reason} (${r.urgency}) · ${r.location}`);
  } catch (e) { alert('전송 실패: ' + e.message); }
}

async function refresh() {
  if (!myReqId) return;
  const r = await PARKLINK.getRequest(myReqId);
  if (!r) return;
  setLinks(r);
  if (r.status === 'answered') {
    $('#waitingCard').style.display = 'none';
    $('#answerCard').style.display = 'block';
    $('#answerMsg').textContent = r.reply;
    $('#answerTime').textContent = '응답 ' + PARKLINK.timeAgo(r.replyTs);
  }
}

document.addEventListener('click', e => {
  if (e.target && e.target.id === 'againBtn') {
    myReqId = null;
    $('#step-sent').style.display = 'none';
    $('#answerCard').style.display = 'none';
    $('#waitingCard').style.display = 'block';
    $('#step-select').style.display = 'block';
  }
});

let dots = 1;
setInterval(() => { const el = $('#waitDots'); if (el) { dots = (dots % 3) + 1; el.textContent = '●'.repeat(dots); } }, 500);

boot();
