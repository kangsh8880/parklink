/* 관리 대시보드 */
const $ = s => document.querySelector(s);

function render() {
  const st = PARKLINK.load();
  const ans = st.requests.filter(r => r.status === 'answered').length;
  const pend = st.requests.length - ans;

  $('#kReq').textContent = st.requests.length;
  $('#kAns').textContent = ans;
  $('#kPend').textContent = pend;
  $('#kShock').textContent = st.shocks.length;

  // 충격 로그
  const sb = $('#shockTable tbody');
  sb.innerHTML = st.shocks.map(s =>
    `<tr><td>${PARKLINK.fmtTime(s.ts)}</td><td>${s.level}</td><td>${PARKLINK.timeAgo(s.ts)}</td></tr>`).join('');
  $('#shockEmpty').style.display = st.shocks.length ? 'none' : 'block';

  // 연락 이력
  const rb = $('#reqTable tbody');
  rb.innerHTML = st.requests.map(r =>
    `<tr>
      <td>${PARKLINK.fmtTime(r.ts)}</td>
      <td>${r.reason}</td>
      <td>${PARKLINK.urgencyBadge(r.urgency)}</td>
      <td>${r.location}</td>
      <td>${r.status === 'answered' ? '<span style="color:var(--blue);font-weight:700">' + r.reply + '</span>' : '<span class="muted">대기</span>'}</td>
    </tr>`).join('');
  $('#reqEmpty').style.display = st.requests.length ? 'none' : 'block';
}

$('#shockBtn').addEventListener('click', () => PARKLINK.logShock());
$('#resetBtn').addEventListener('click', () => {
  if (confirm('데모 데이터를 모두 비울까요?')) PARKLINK.reset();
});

PARKLINK.onUpdate(render);
setInterval(render, 1000);
render();
