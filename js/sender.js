/* 발신자 화면 */
let myReqId = null;
let myReason = '';

const $ = s => document.querySelector(s);

function renderReasons() {
  const box = $('#reasonList');
  box.innerHTML = PARKLINK.REASONS.map(r => `
    <div class="reason" data-key="${r.key}">
      <div class="dot ${r.cls}">!</div>
      <div class="txt"><b>${r.label}</b><small>${r.desc} · ${r.urgency}</small></div>
      <span class="muted">›</span>
    </div>`).join('');
  box.querySelectorAll('.reason').forEach(el => {
    el.addEventListener('click', () => send(el.dataset.key));
  });
}

function setContactLinks(req) {
  const phone = PARKLINK.getOwnerPhone();
  const digits = PARKLINK.telDigits(phone);
  const body = `[PARKLINK] ${req.reason} — 주차 차량 연락드립니다 (${req.location})`;
  $('#callBtn').setAttribute('href', 'tel:' + digits);
  $('#smsBtn').setAttribute('href', 'sms:' + digits + '?body=' + encodeURIComponent(body));
  $('#privNote').innerHTML =
    `테스트 모드: 차주 번호(<b>${phone}</b>)로 직접 연결됩니다.<br>실제 서비스에서는 050 안심번호로 비공개 중계됩니다.`;
}

function send(key) {
  myReqId = PARKLINK.sendRequest(key);
  const r = PARKLINK.getRequest(myReqId);
  myReason = r.reason;
  $('#step-select').style.display = 'none';
  $('#step-sent').style.display = 'block';
  $('#sentInfo').textContent = `${r.reason} · ${r.location} · ${PARKLINK.fmtTime(r.ts)}`;
  setContactLinks(r);
  refresh();
}

function refresh() {
  if (!myReqId) return;
  const r = PARKLINK.getRequest(myReqId);
  if (!r) return;
  setContactLinks(r);              // 차주가 번호를 바꿔도 즉시 반영
  if (r.status === 'answered') {
    $('#waitingCard').style.display = 'none';
    $('#answerCard').style.display = 'block';
    $('#answerMsg').textContent = r.reply;
    $('#answerTime').textContent = '응답 ' + PARKLINK.timeAgo(r.replyTs);
  }
}

$('#againBtn').addEventListener('click', () => {
  myReqId = null;
  $('#step-sent').style.display = 'none';
  $('#answerCard').style.display = 'none';
  $('#waitingCard').style.display = 'block';
  $('#step-select').style.display = 'block';
});

// 대기 점 애니메이션
let dots = 1;
setInterval(() => {
  const el = $('#waitDots');
  if (el) { dots = (dots % 3) + 1; el.textContent = '●'.repeat(dots); }
}, 500);

PARKLINK.onUpdate(refresh);
renderReasons();
