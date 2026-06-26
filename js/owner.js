/* 차주 화면 */
const $ = s => document.querySelector(s);

function replyButtons(id) {
  return `<div class="replies">` +
    PARKLINK.REPLIES.map((m, i) =>
      `<button class="btn btn-primary ${i === 0 ? 'full' : 'btn-outline'}" data-id="${id}" data-msg="${m}">${m}</button>`
    ).join('') + `</div>`;
}

function render() {
  const st = PARKLINK.load();

  // 충격 알림
  const shockBox = $('#shockBox');
  if (st.shocks.length) {
    const s = st.shocks[0];
    shockBox.innerHTML = `<div class="note warn"><span>⚠️</span>
      <span><b>충격 감지: ${s.level}</b> · ${PARKLINK.fmtTime(s.ts)} (${PARKLINK.timeAgo(s.ts)}) — 주차 중 차량에 충격이 감지되었습니다.</span></div>`;
  } else { shockBox.innerHTML = ''; }

  // 요청 목록
  const list = $('#reqList');
  if (!st.requests.length) {
    list.innerHTML = ''; $('#empty').style.display = 'block'; return;
  }
  $('#empty').style.display = 'none';

  list.innerHTML = st.requests.map(r => {
    if (r.status === 'answered') {
      return `<div class="req answered">
        <div class="head"><span class="title">${r.reason}</span>${PARKLINK.urgencyBadge(r.urgency)}</div>
        <div class="meta">${r.location} · ${PARKLINK.fmtTime(r.ts)}</div>
        <div class="answer">✓ 응답함: ${r.reply}</div>
      </div>`;
    }
    return `<div class="req">
      <div class="head"><span class="title">${r.reason}</span>${PARKLINK.urgencyBadge(r.urgency)}</div>
      <div class="meta">${r.desc} · ${r.location} · ${PARKLINK.timeAgo(r.ts)}</div>
      ${replyButtons(r.id)}
    </div>`;
  }).join('');

  list.querySelectorAll('button[data-id]').forEach(b => {
    b.addEventListener('click', () => {
      PARKLINK.answerRequest(b.dataset.id, b.dataset.msg);
    });
  });
}

PARKLINK.onUpdate(render);
setInterval(render, 1000); // 경과 시간 갱신
render();
