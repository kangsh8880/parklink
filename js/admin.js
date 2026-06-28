/* 관리자 페이지 */
const $ = s => document.querySelector(s);
let busy = false;

async function render() {
  if (busy || document.hidden) return;
  // 차주번호 편집 중에는 폴링 갱신을 보류(입력값 보존)
  const ae = document.activeElement;
  if (ae && ae.classList && ae.classList.contains('phone-edit')) return;
  busy = true;
  try {
    const vs = await PARKLINK.listVehicles();
    let nA = 0, nR = 0, nE = 0;
    const renew = [];
    vs.forEach(v => { const s = PARKLINK.statusOf(v); if (s.expired) { nE++; renew.push([v, s]); } else if (s.renewDue) { nR++; renew.push([v, s]); } else nA++; });
    $('#kTotal').textContent = vs.length;
    $('#kActive').textContent = nA;
    $('#kRenew').textContent = nR;
    $('#kExpired').textContent = nE;

    // 갱신 알림
    const rc = $('#renewCard');
    if (renew.length) {
      rc.style.display = 'block';
      $('#renewList').innerHTML = renew.map(([v, s]) => `
        <div class="req">
          <div class="head"><span class="title">${v.name}</span>${PARKLINK.statusBadge(s)}</div>
          <div class="meta">${v.ownerPhone} · ${s.expired ? '만료됨' : 'D-' + s.daysLeft} · 만료일 ${PARKLINK.fmtDate(v.expireAt)}</div>
          <div class="admin-actions">
            <button class="btn btn-primary" data-act="sms" data-token="${v.token}">갱신 안내 문자 보내기</button>
            <button class="btn btn-outline" data-act="extend1" data-token="${v.token}">+1개월 연장</button>
            <button class="btn btn-outline" data-act="extend12" data-token="${v.token}">+12개월 연장</button>
          </div>
        </div>`).join('');
    } else rc.style.display = 'none';

    // 목록
    const tb = $('#vtable tbody');
    if (!vs.length) { tb.innerHTML = ''; $('#empty').style.display = 'block'; }
    else {
      $('#empty').style.display = 'none';
      tb.innerHTML = vs.map(v => {
        const s = PARKLINK.statusOf(v);
        return `<tr>
          <td><b>${v.name}</b><br><span class="muted">${PARKLINK.subMonths(v)}개월 구독</span></td>
          <td>
            <input class="phone-edit" data-phone="${v.token}" value="${v.ownerPhone}" inputmode="tel" />
            <button class="btn btn-outline btn-xs" data-act="savephone" data-token="${v.token}">변경</button>
          </td>
          <td><span class="tokenpill">${v.token}</span></td>
          <td>${PARKLINK.fmtDate(v.startAt)}</td>
          <td>${PARKLINK.fmtDate(v.expireAt)}</td>
          <td>${s.expired ? '—' : 'D-' + s.daysLeft}</td>
          <td>${PARKLINK.statusBadge(s)}</td>
          <td><div class="admin-actions right">
            <button class="btn btn-outline" data-act="qr" data-token="${v.token}">QR</button>
            <button class="btn btn-outline" data-act="extend1" data-token="${v.token}">+1개월</button>
            <button class="btn btn-outline" data-act="exp10" data-token="${v.token}">만료-10일</button>
            <button class="btn btn-outline" data-act="exp0" data-token="${v.token}">만료처리</button>
            <button class="btn btn-danger" data-act="del" data-token="${v.token}">해지</button>
          </div></td>
        </tr>`;
      }).join('');
    }
    document.querySelectorAll('button[data-act]').forEach(b => { b.onclick = () => action(b.dataset.act, b.dataset.token); });
  } catch (e) {
    console.error(e);
    if (/401|403|JWT|exp/i.test(e.message || '')) { PARKLINK.adminLogout(); location.reload(); return; }
  } finally { busy = false; }
}

async function action(act, token) {
  try {
    if (act === 'extend1') await PARKLINK.extendVehicle(token, 1);
    else if (act === 'savephone') {
      const inp = document.querySelector(`input.phone-edit[data-phone="${token}"]`);
      const val = inp ? inp.value.trim() : '';
      if (!val) { showAdminToast('전화번호를 입력해 주세요.', true); return; }
      await PARKLINK.setOwnerPhone(token, val);
      showAdminToast('✓ 차주 전화번호가 변경되었습니다.');
      render();
      return;
    }
    else if (act === 'extend12') await PARKLINK.extendVehicle(token, 12);
    else if (act === 'exp10') await PARKLINK.setExpireInDays(token, 10);
    else if (act === 'exp0') await PARKLINK.setExpireInDays(token, 0);
    else if (act === 'del') { if (confirm('이 차량 구독을 해지하고 매핑을 삭제할까요?')) await PARKLINK.removeVehicle(token); }
    else if (act === 'qr') { const v = await PARKLINK.getVehicle(token); if (v) showQr(v); return; }
    else if (act === 'sms') {
      const v = await PARKLINK.getVehicle(token); if (!v) return;
      const s = PARKLINK.statusOf(v);
      const body = `[PARKLINK] ${v.name} 구독이 ${s.expired ? '만료되었습니다' : '곧 만료됩니다(D-' + s.daysLeft + ')'}. 갱신을 진행해 주세요.`;
      await PARKLINK.markRenewNotified(token);
      location.href = 'sms:' + PARKLINK.telDigits(v.ownerPhone) + '?body=' + encodeURIComponent(body);
      return;
    }
    render();
  } catch (e) { alert('작업 실패: ' + e.message); }
}

function showQr(v) {
  const url = PARKLINK.senderUrl(v.token);
  $('#qrTitle').textContent = v.name + ' — 전용 QR';
  $('#qrBox').innerHTML = PARKLINK.qrSvg(url, 5);
  $('#qrUrl').textContent = url;
  $('#qrPanel').style.display = 'block';
  $('#qrPanel').scrollIntoView({ behavior: 'smooth' });
}
$('#qrClose').addEventListener('click', () => { $('#qrPanel').style.display = 'none'; });

$('#resetBtn').addEventListener('click', async () => {
  if (!confirm('데모 데이터를 모두 비울까요?')) return;
  try { await PARKLINK.reset(); render(); } catch (e) { alert('실패: ' + e.message); }
});

function showAdminToast(msg, isError) {
  let t = document.getElementById('pkToast');
  if (!t) { t = document.createElement('div'); t.id = 'pkToast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'pk-toast' + (isError ? ' err' : '') + ' show';
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.className = 'pk-toast' + (isError ? ' err' : ''); }, 3000);
}

/* ---------- 관리자 게이트 (PIN 1차[서버검증] + Supabase Auth 2차) ---------- */
let adminStarted = false;
function startAdmin() {
  if (adminStarted) return; adminStarted = true;
  const g = document.getElementById('adminGate'); if (g) g.style.display = 'none';
  setInterval(render, 3000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  render();
  // 에러 로그
  loadErrorLogs();
  const er = document.getElementById('errRefresh');
  const ec = document.getElementById('errClear');
  if (er) er.addEventListener('click', loadErrorLogs);
  if (ec) ec.addEventListener('click', async () => {
    if (!confirm('에러 로그를 전체 삭제할까요?')) return;
    try { await PARKLINK.clearErrorLogs(); loadErrorLogs(); } catch (e) { alert('삭제 실패: ' + e.message); }
  });
  // 구독 신청 관리
  loadSubs();
  const sr = document.getElementById('subsRefresh');
  if (sr) sr.addEventListener('click', loadSubs);
}
function escHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
async function loadErrorLogs() {
  const box = document.getElementById('errList'); if (!box) return;
  try {
    const rows = await PARKLINK.listErrorLogs(50);
    if (!rows || !rows.length) { box.innerHTML = '<span class="muted">기록된 에러가 없습니다.</span>'; return; }
    box.innerHTML = rows.map(r => `
      <div class="errrow">
        <div class="row"><b>${escHtml(r.msg)}</b><span class="spacer"></span><span class="muted">${PARKLINK.timeAgo(Number(r.ts))}</span></div>
        <div class="meta muted">${escHtml(r.page || '')}${r.ua ? ' · ' + escHtml(String(r.ua).slice(0, 60)) : ''}</div>
        ${r.stack ? `<pre class="errstack">${escHtml(String(r.stack).slice(0, 400))}</pre>` : ''}
      </div>`).join('');
  } catch (e) {
    box.innerHTML = '<span class="muted">불러오기 실패: ' + escHtml(e.message) + '</span>';
  }
}
function gateErr(id, msg) { const e = document.getElementById(id); if (!e) return; e.textContent = msg || ''; e.style.display = msg ? 'block' : 'none'; }
function initGate() {
  if (PARKLINK.adminRestore()) { startAdmin(); return; }   // 기존 세션 있으면 바로 진입
  const pinStep = document.getElementById('gatePin');
  const loginStep = document.getElementById('gateLogin');
  const pinBtn = document.getElementById('pinBtn');
  async function checkPin() {
    const pin = document.getElementById('pinInput').value.trim();
    if (!pin) { gateErr('pinErr', 'PIN을 입력하세요.'); return; }
    pinBtn.disabled = true; gateErr('pinErr', '');
    try {
      const ok = await PARKLINK.verifyAdminPin(pin);
      if (ok) {
        pinStep.style.display = 'none'; loginStep.style.display = 'block'; document.getElementById('loginEmail').focus();
      } else {
        gateErr('pinErr', 'PIN이 올바르지 않습니다.');
      }
    } catch (e) {
      const msg = /rate_limited/.test(e.message)
        ? 'PIN 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.'
        : ('확인 중 오류: ' + e.message);
      gateErr('pinErr', msg);
    } finally {
      pinBtn.disabled = false;
    }
  }
  pinBtn.addEventListener('click', checkPin);
  document.getElementById('pinInput').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('pinBtn').click(); });
  document.getElementById('loginBtn').addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value.trim();
    const pw = document.getElementById('loginPw').value;
    if (!email || !pw) { gateErr('loginErr', '이메일과 비밀번호를 입력하세요.'); return; }
    const btn = document.getElementById('loginBtn'); btn.disabled = true; btn.textContent = '로그인 중…';
    try { await PARKLINK.adminLogin(email, pw); startAdmin(); }
    catch (e) { gateErr('loginErr', e.message); btn.disabled = false; btn.textContent = '로그인'; }
  });
  document.getElementById('loginPw').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('loginBtn').click(); });
}
initGate();

/* ---------- 구독 신청 관리 ---------- */
function subBadge(s) {
  return s === 'active' ? '<span class="sub-badge ok">승인</span>'
    : s === 'rejected' ? '<span class="sub-badge ng">반려</span>'
    : '<span class="sub-badge wait">대기</span>';
}
function subRow(r) {
  const when = PARKLINK.timeAgo(Number(r.applied_at));
  return `<div class="subrow ${r.status}">
    <div class="row"><b>${escHtml(r.name)}</b> ${subBadge(r.status)}<span class="spacer"></span><span class="muted">${when}</span></div>
    <div class="meta muted">${escHtml(r.owner_phone)} · ${r.months}개월${r.applicant_name ? ' · ' + escHtml(r.applicant_name) : ''}${r.memo ? ' · ' + escHtml(r.memo) : ''}</div>
    ${r.status === 'active' && r.vehicle_token ? `<div class="meta">발급 토큰: <span class="tokenpill">${escHtml(r.vehicle_token)}</span></div>` : ''}
    ${r.status === 'rejected' && r.reject_reason ? `<div class="meta muted">사유: ${escHtml(r.reject_reason)}</div>` : ''}
    ${r.status === 'pending' ? `<div class="row mt8">
        <button class="btn btn-primary btn-sm" data-appr="${r.id}">승인</button>
        <button class="btn btn-outline btn-sm" data-rej="${r.id}">반려</button></div>` : ''}
  </div>`;
}
async function loadSubs() {
  const box = document.getElementById('subsList');
  const cnt = document.getElementById('subsCount');
  if (!box) return;
  try {
    const rows = await PARKLINK.listSubscriptions();
    const pending = (rows || []).filter(r => r.status === 'pending');
    if (cnt) cnt.textContent = '대기 ' + pending.length + '건';
    if (!rows || !rows.length) { box.innerHTML = '<span class="muted">신청 내역이 없습니다.</span>'; return; }
    box.innerHTML = rows.map(subRow).join('');
    box.querySelectorAll('[data-appr]').forEach(b => b.addEventListener('click', () => approveSub(b.dataset.appr)));
    box.querySelectorAll('[data-rej]').forEach(b => b.addEventListener('click', () => rejectSub(b.dataset.rej)));
  } catch (e) {
    box.innerHTML = '<span class="muted">불러오기 실패: ' + escHtml(e.message) + '</span>';
  }
}
async function approveSub(id) {
  if (!confirm('이 신청을 승인하고 차량을 발급할까요?')) return;
  try { const token = await PARKLINK.approveSubscription(id); alert('승인 완료 · 발급 토큰: ' + token); loadSubs(); render(); }
  catch (e) { alert('승인 실패: ' + e.message); }
}
async function rejectSub(id) {
  const reason = prompt('반려 사유를 입력하세요(선택):', '');
  if (reason === null) return;
  try { await PARKLINK.rejectSubscription(id, reason); loadSubs(); }
  catch (e) { alert('반려 실패: ' + e.message); }
}
