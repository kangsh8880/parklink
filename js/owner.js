/* 차주 화면 — 토큰(차량) 기반, Supabase 연동 */
const $ = s => document.querySelector(s);
const token = PARKLINK.tokenFromUrl();
let busy = false;
let phoneInit = false;

async function boot() {
  let v;
  try { v = await PARKLINK.getVehicle(token); }
  catch (e) { $('#invalid').style.display = 'block'; return; }
  if (!token || !v) { $('#invalid').style.display = 'block'; return; }
  $('#valid').style.display = 'block';

  $('#savePhone').addEventListener('click', async () => {
    const val = $('#phoneInput').value.trim();
    if (val) { try { await PARKLINK.setOwnerPhone(token, val); render(); } catch (e) { alert('저장 실패: ' + e.message); } }
  });

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
        b.addEventListener('click', async () => { try { await PARKLINK.answerRequest(b.dataset.id, b.dataset.msg); render(); } catch (e) { alert('응답 실패: ' + e.message); } }));
    }
  } catch (e) { console.error(e); }
  finally { busy = false; }
}

boot();
