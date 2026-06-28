/* 관리자 페이지 */
const $ = s => document.querySelector(s);
let busy = false;

let _allV = [];
const listFilter = { status: 'all', keyword: '' };

async function render() {
  if (busy || document.hidden) return;
  // 차주번호 편집 중에는 폴링 갱신을 보류(입력값 보존)
  const ae = document.activeElement;
  if (ae && ae.classList && ae.classList.contains('phone-edit')) return;
  busy = true;
  try {
    const vs = await PARKLINK.listVehicles();
    _allV = vs;
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

    renderList();   // 목록(필터 적용)
  } catch (e) {
    console.error(e);
    if (/401|403|JWT|exp/i.test(e.message || '')) { PARKLINK.adminLogout(); location.reload(); return; }
  } finally { busy = false; }
}

// 상태 일치 판정(통계 카드와 동일 기준)
function matchStatus(v, status) {
  if (status === 'all') return true;
  const s = PARKLINK.statusOf(v);
  if (status === 'expired') return s.expired;
  if (status === 'renew') return !s.expired && s.renewDue;
  if (status === 'active') return !s.expired && !s.renewDue;
  return true;
}
function applyFilter(vs) {
  const kw = (listFilter.keyword || '').trim().toLowerCase();
  return vs.filter(v => {
    if (!matchStatus(v, listFilter.status)) return false;
    if (!kw) return true;
    return (v.name || '').toLowerCase().includes(kw)
      || (v.token || '').toLowerCase().includes(kw)
      || (v.ownerPhone || '').toLowerCase().includes(kw);
  });
}
function bindActions() {
  document.querySelectorAll('button[data-act]').forEach(b => { b.onclick = () => action(b.dataset.act, b.dataset.token); });
}
function renderList() {
  const tb = $('#vtable tbody'); if (!tb) return;
  const list = applyFilter(_allV);
  const labelMap = { all: 'ALL(전체)', active: '구독중', renew: '만료 임박', expired: '만료' };
  const cnt = $('#listCount');
  if (cnt) cnt.textContent = `조회 결과 ${list.length}건 · 상태: ${labelMap[listFilter.status]}${listFilter.keyword ? ' · "' + listFilter.keyword + '"' : ''}`;
  if (!list.length) { tb.innerHTML = ''; $('#empty').style.display = 'block'; bindActions(); return; }
  $('#empty').style.display = 'none';
  tb.innerHTML = list.map(v => {
    const s = PARKLINK.statusOf(v);
    return `<tr>
      <td data-label="차량"><b>${v.name}</b><br><span class="muted">${PARKLINK.subMonths(v)}개월 구독</span></td>
      <td data-label="차주번호">
        <input class="phone-edit" data-phone="${v.token}" value="${v.ownerPhone}" inputmode="tel" />
        <button class="btn btn-outline btn-xs" data-act="savephone" data-token="${v.token}">변경</button>
      </td>
      <td data-label="토큰"><span class="tokenpill">${v.token}</span></td>
      <td data-label="시작">${PARKLINK.fmtDate(v.startAt)}</td>
      <td data-label="만료">${PARKLINK.fmtDate(v.expireAt)}</td>
      <td data-label="남은일">${s.expired ? '—' : 'D-' + s.daysLeft}</td>
      <td data-label="상태">${PARKLINK.statusBadge(s)}</td>
      <td data-label="관리"><div class="admin-actions right">
        <button class="btn btn-outline" data-act="qr" data-token="${v.token}">QR</button>
        <button class="btn btn-outline" data-act="extend1" data-token="${v.token}">+1개월</button>
        <button class="btn btn-outline" data-act="exp10" data-token="${v.token}">만료-10일</button>
        <button class="btn btn-outline" data-act="exp0" data-token="${v.token}">만료처리</button>
        <button class="btn btn-danger" data-act="del" data-token="${v.token}">해지</button>
      </div></td>
    </tr>`;
  }).join('');
  bindActions();
}

// ── 탭 전환 ──
function showTab(name) {
  document.querySelectorAll('.tabpanel').forEach(p => p.style.display = 'none');
  const panel = document.getElementById('tab-' + name);
  if (panel) panel.style.display = 'block';
  document.querySelectorAll('.tabbtn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  if (name === 'subs') loadSubs();
  else if (name === 'recover') loadSupportReqs();
  else if (name === 'errors') loadErrorLogs();
  else if (name === 'list') renderList();
}
function initTabs() {
  document.querySelectorAll('.tabbtn').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  // 현황 숫자 클릭 → 가입자목록 탭으로 이동 + 상태 필터 적용
  document.querySelectorAll('.stat[data-stat]').forEach(b => b.addEventListener('click', () => {
    listFilter.status = b.dataset.stat; listFilter.keyword = '';
    const fs = document.getElementById('fStatus'); if (fs) fs.value = listFilter.status;
    const fk = document.getElementById('fKeyword'); if (fk) fk.value = '';
    showTab('list');
  }));
  // 조회(검색)
  const doSearch = () => {
    listFilter.status = document.getElementById('fStatus').value;
    listFilter.keyword = document.getElementById('fKeyword').value;
    renderList();
  };
  const fSearch = document.getElementById('fSearch'); if (fSearch) fSearch.addEventListener('click', doSearch);
  const fKeyword = document.getElementById('fKeyword');
  if (fKeyword) {
    const autoGrow = () => { fKeyword.style.height = 'auto'; fKeyword.style.height = Math.min(fKeyword.scrollHeight, 120) + 'px'; };
    fKeyword.addEventListener('input', autoGrow);
    fKeyword.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSearch(); }  // Enter=검색
      else { setTimeout(autoGrow, 0); }                                          // Shift+Enter 등=줄바꿈→높이 확장
    });
    autoGrow();
  }
  const fStatus = document.getElementById('fStatus'); if (fStatus) fStatus.addEventListener('change', doSearch);
  // 현황으로 복귀
  const btd = document.getElementById('backToDash'); if (btd) btd.addEventListener('click', () => showTab('dashboard'));

  // 구독신청관리 조회
  const doSubSearch = () => {
    subFilter.status = document.getElementById('subStatus').value;
    subFilter.keyword = document.getElementById('subKeyword').value;
    renderSubs();
  };
  const subSearch = document.getElementById('subSearch'); if (subSearch) subSearch.addEventListener('click', doSubSearch);
  const subStatus = document.getElementById('subStatus'); if (subStatus) subStatus.addEventListener('change', doSubSearch);
  const subKeyword = document.getElementById('subKeyword');
  if (subKeyword) {
    const grow = () => { subKeyword.style.height = 'auto'; subKeyword.style.height = Math.min(subKeyword.scrollHeight, 120) + 'px'; };
    subKeyword.addEventListener('input', grow);
    subKeyword.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSubSearch(); }
      else { setTimeout(grow, 0); }
    });
    grow();
  }
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
  initTabs();
  setInterval(render, 3000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  render();
  // 에러 로그 버튼
  const er = document.getElementById('errRefresh');
  const ec = document.getElementById('errClear');
  if (er) er.addEventListener('click', loadErrorLogs);
  if (ec) ec.addEventListener('click', async () => {
    if (!confirm('에러 로그를 전체 삭제할까요?')) return;
    try { await PARKLINK.clearErrorLogs(); loadErrorLogs(); } catch (e) { alert('삭제 실패: ' + e.message); }
  });
  // 구독 신청 새로고침 버튼
  const sr = document.getElementById('subsRefresh');
  if (sr) sr.addEventListener('click', loadSubs);
  // 복구요청 새로고침 버튼
  const supr = document.getElementById('supRefresh');
  if (supr) supr.addEventListener('click', loadSupportReqs);
  // 시작 탭: 가입자현황
  showTab('dashboard');
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
let _allSubs = [];
const subFilter = { status: 'all', keyword: '' };

async function loadSubs() {
  const box = document.getElementById('subsList');
  if (!box) return;
  try {
    const rows = await PARKLINK.listSubscriptions();
    _allSubs = rows || [];
    const cnt = document.getElementById('subsCount');
    const pending = _allSubs.filter(r => r.status === 'pending');
    if (cnt) cnt.textContent = '대기 ' + pending.length + '건';
    renderSubs();
  } catch (e) {
    box.innerHTML = '<span class="muted">불러오기 실패: ' + escHtml(e.message) + '</span>';
  }
}
function applySubFilter(rows) {
  const kw = (subFilter.keyword || '').trim().toLowerCase();
  return rows.filter(r => {
    if (subFilter.status !== 'all' && r.status !== subFilter.status) return false;
    if (!kw) return true;
    return (r.name || '').toLowerCase().includes(kw)
      || (r.owner_phone || '').toLowerCase().includes(kw)
      || (r.applicant_name || '').toLowerCase().includes(kw);
  });
}
function renderSubs() {
  const box = document.getElementById('subsList'); if (!box) return;
  const list = applySubFilter(_allSubs);
  const labelMap = { all: 'ALL(전체)', pending: '승인대기', active: '승인', rejected: '반려' };
  const lc = document.getElementById('subListCount');
  if (lc) lc.textContent = `조회 결과 ${list.length}건 · 상태: ${labelMap[subFilter.status]}${subFilter.keyword ? ' · "' + subFilter.keyword + '"' : ''}`;
  if (!_allSubs.length) { box.innerHTML = '<span class="muted">신청 내역이 없습니다.</span>'; return; }
  if (!list.length) { box.innerHTML = '<span class="muted">조회된 신청이 없습니다.</span>'; return; }
  box.innerHTML = list.map(subRow).join('');
  box.querySelectorAll('[data-appr]').forEach(b => b.addEventListener('click', () => approveSub(b.dataset.appr)));
  box.querySelectorAll('[data-rej]').forEach(b => b.addEventListener('click', () => rejectSub(b.dataset.rej)));
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

/* ───────── 복구 요청(차주 화면 주소 전달) ───────── */
let _allSup = [];

async function loadSupportReqs() {
  const box = document.getElementById('supList'); if (!box) return;
  try {
    const rows = await PARKLINK.listSupportRequests();
    _allSup = rows || [];
    const open = _allSup.filter(r => r.status === 'open');
    const c = document.getElementById('supCount');
    if (c) c.textContent = '대기 ' + open.length + '건';
    renderSupportReqs();
  } catch (e) {
    box.innerHTML = '<span class="muted">불러오기 실패: ' + escHtml(e.message) + '</span>';
  }
}

function renderSupportReqs() {
  const box = document.getElementById('supList'); if (!box) return;
  if (!_allSup.length) { box.innerHTML = '<span class="muted">복구 요청이 없습니다.</span>'; return; }
  box.innerHTML = _allSup.map(supRow).join('');
  box.querySelectorAll('[data-ans]').forEach(b => b.addEventListener('click', () => answerSup(b.dataset.ans)));
}

function supRow(r) {
  const dt = PARKLINK.fmtDate(Number(r.created_at));
  const memo = r.memo ? `<div class="muted" style="font-size:12.5px">메모: ${escHtml(r.memo)}</div>` : '';
  if (r.status === 'answered') {
    return `<div class="req answered">
      <div><b>${escHtml(r.name)}</b> · ${escHtml(r.phone)} <span class="muted">(${dt})</span></div>
      ${memo}
      <div class="answer">✓ 전달함 · 토큰 ${escHtml(r.answer_token || '')}</div></div>`;
  }
  const match = r.match_token
    ? `<div class="note mt8"><span>✅</span><span>전화번호 매칭: <b>${escHtml(r.match_name || '')}</b> · 토큰 <b>${escHtml(r.match_token)}</b></span></div>`
    : `<div class="note mt8"><span>⚠️</span><span>전화번호로 매칭된 차량이 없습니다. <b>가입자목록</b>에서 확인 후 토큰을 직접 입력하세요.</span></div>`;
  const v = r.match_token ? escHtml(r.match_token) : '';
  return `<div class="req">
    <div><b>${escHtml(r.name)}</b> · ${escHtml(r.phone)} <span class="muted">(${dt})</span></div>
    ${memo}${match}
    <div class="srow mt8">
      <input class="supTok" data-id="${escHtml(r.id)}" type="text" placeholder="전달할 토큰(PL...)" value="${v}" style="flex:1">
      <button class="btn btn-primary btn-sm" data-ans="${escHtml(r.id)}">주소 전달</button>
    </div>
    <input class="supNote" data-id="${escHtml(r.id)}" type="text" placeholder="추가 안내(선택)" style="width:100%;margin-top:6px">
  </div>`;
}

async function answerSup(id) {
  const tokEl = document.querySelector('.supTok[data-id="' + id + '"]');
  const noteEl = document.querySelector('.supNote[data-id="' + id + '"]');
  const token = (tokEl ? tokEl.value : '').trim();
  const note = (noteEl ? noteEl.value : '').trim();
  if (!token) { alert('전달할 차량 토큰을 입력하세요.'); return; }
  if (!confirm('이 차주에게 토큰 ' + token + ' 의 차주 화면 주소를 전달할까요?')) return;
  try {
    await PARKLINK.answerSupportRequest(id, token, note);
    alert('전달 완료');
    loadSupportReqs();
  } catch (e) {
    const m = String(e.message || '');
    if (/invalid_token/.test(m)) alert('등록되지 않은 토큰입니다. 가입자목록에서 정확한 토큰을 확인하세요.');
    else if (/not_found/.test(m)) alert('요청을 찾을 수 없습니다.');
    else alert('전달 실패: ' + e.message);
  }
}
