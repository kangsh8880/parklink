/* 발신자 화면 */
let myReqId = null;

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

function send(key) {
  myReqId = PARKLINK.sendRequest(key);
  const r = PARKLINK.getRequest(myReqId);
  $('#step-select').style.display = 'none';
  $('#step-sent').style.display = 'block';
  $('#sentInfo').textContent = `${r.reason} · ${r.location} · ${PARKLINK.fmtTime(r.ts)}`;
  refresh();
}

function refresh() {
  if (!myReqId) return;
  const r = PARKLINK.getRequest(myReqId);
  if (r && r.status === 'answered') {
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

$('#callBtn').addEventListener('click', () => {
  alert('데모: 실제 서비스에서는 050 안심번호로 연결되어 양측 번호가 비공개로 통화됩니다.');
});

// 대기 점 애니메이션
let dots = 1;
setInterval(() => {
  const el = $('#waitDots');
  if (el) { dots = (dots % 3) + 1; el.textContent = '●'.repeat(dots); }
}, 500);

PARKLINK.onUpdate(refresh);
renderReasons();
