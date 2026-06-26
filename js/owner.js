/* 차주 화면 — 토큰(차량) 기반 */
const $ = s => document.querySelector(s);
const token = PARKLINK.tokenFromUrl();

function boot() {
  const v = PARKLINK.getVehicle(token);
  if (!token || !v) { $('#invalid').style.display = 'block'; return; }
  $('#valid').style.display = 'block';
  $('#phoneInput').value = v.ownerPhone;
  $('#savePhone').addEventListener('click', () => {
    const val = $('#phoneInput').value.trim();
    if (val) { PARKLINK.setOwnerPhone(token, val); }
  });
  render();
}

function replyButtons(id) {
  return `<div class="replies">` +
    PARKLINK.REPLIES.map((m, i) =>
      `<button class="btn ${i === 0 ? 'btn-primary full' : 'btn-outline'}" data-id="${id}" data-msg="${m}">${m}</button>`
    ).join('') + `</div>`;
}

function render() {
  const v = PARKLINK.getVehicle(token);
  if (!v) { $('#valid').style.display = 'none'; $('#invalid').style.display = 'block'; return; }
  const s = PARKLINK.statusOf(v);

  $('#vehTitle').textContent = v.name + ' · 실시간 알림';

  // 구독/갱신 배너
  const bn = $('#subBanner');
  if (s.expired) {
    bn.innerHTML = `<div class="banner expired"><span>⛔</span><span><b>구독이 만료되었습니다.</b> 갱신 전까지 발신자 연결이 차단됩니다. 관리자 또는 구독 신청에서 연장하세요.</span></div>`;
  } else if (s.renewDue) {
    bn.innerHTML = `<div class="banner renew"><span>🔔</span><span><b>구독 만료 D-${s.daysLeft}</b> — 곧 만료됩니다. 미리 갱신하세요. (만료 ${PARKLINK.RENEW_DAYS}일 전부터 알림)</span></div>`;
  } else { bn.innerHTML = ''; }

  // 구독 정보
  $('#subInfo').innerHTML = `
    <dt>토큰</dt><dd><span class="tokenpill">${v.token}</span></dd>
    <dt>구독</dt><dd>${v.months}개월 · ${PARKLINK.statusBadge(s)}</dd>
    <dt>만료일</dt><dd>${PARKLINK.fmtDate(v.expireAt)} ${s.expired ? '(만료)' : '(D-' + s.daysLeft + ')'}</dd>`;

  // 충격 알림
  const shocks = PARKLINK.listShocks(token);
  $('#shockBox').innerHTML = shocks.length
    ? `<div class="banner expired"><span>⚠️</span><span><b>충격 감지: ${shocks[0].level}</b> · ${PARKLINK.fmtTime(shocks[0].ts)} (${PARKLINK.timeAgo(shocks[0].ts)})</span></div>`
    : '';

  // 요청 목록
  const reqs = PARKLINK.listRequests(token);
  const list = $('#reqList');
  if (!reqs.length) { list.innerHTML = ''; $('#empty').style.display = 'block'; }
  else {
    $('#empty').style.display = 'none';
    list.innerHTML = reqs.map(r => {
      if (r.status === 'answered') {
        return `<div class="req answered">
          <div class="head"><span class="title">${r.reason}</span>${PARKLINK.urgencyBadge(r.urgency)}</div>
          <div class="meta">${r.location} · ${PARKLINK.fmtTime(r.ts)}</div>
          <div class="answer">✓ 응답함: ${r.reply}</div></div>`;
      }
      return `<div class="req">
        <div class="head"><span class="title">${r.reason}</span>${PARKLINK.urgencyBadge(r.urgency)}</div>
        <div class="meta">${r.desc} · ${r.location} · ${PARKLINK.timeAgo(r.ts)}</div>
        ${replyButtons(r.id)}</div>`;
    }).join('');
    list.querySelectorAll('button[data-id]').forEach(b =>
      b.addEventListener('click', () => PARKLINK.answerRequest(b.dataset.id, b.dataset.msg)));
  }
}

PARKLINK.onUpdate(render);
setInterval(render, 1000);
boot();
