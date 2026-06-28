/* 구독 신청 상태 조회 — id로 상태(대기/승인/반려) 표시, 승인 시 QR 발급 */
const $ = s => document.querySelector(s);
const id = new URLSearchParams(location.search).get('id');

const STATUS_KO = { pending: '승인 대기 중', active: '승인됨', rejected: '반려됨' };
function fmt(ts) { return ts ? PARKLINK.fmtDate(Number(ts)) + ' ' + PARKLINK.fmtTime(Number(ts)) : '-'; }
function hide(ids) { ids.forEach(i => $('#' + i).style.display = 'none'); }

async function load() {
  if (!id) { hide(['loading']); $('#notfound').style.display = 'block'; return; }
  $('#loading').style.display = 'block';
  hide(['notfound', 'pending', 'approved', 'rejected']);
  let s;
  try { s = await PARKLINK.getSubscriptionStatus(id); }
  catch (e) { hide(['loading']); $('#notfound').style.display = 'block'; return; }
  hide(['loading']);
  if (!s) { $('#notfound').style.display = 'block'; return; }

  if (s.status === 'active') return showApproved(s);
  if (s.status === 'rejected') return showRejected(s);
  return showPending(s);
}

function showPending(s) {
  $('#pending').style.display = 'block';
  $('#pendInfo').innerHTML = `
    <dt>차량</dt><dd>${s.name}</dd>
    <dt>차주 번호</dt><dd>${s.phone_masked || '-'}</dd>
    <dt>구독 기간</dt><dd>${s.months}개월</dd>
    <dt>신청 번호</dt><dd><span class="tokenpill">${id}</span></dd>
    <dt>신청일</dt><dd>${fmt(s.applied_at)}</dd>
    <dt>상태</dt><dd><b style="color:var(--blue)">${STATUS_KO[s.status]}</b></dd>`;
}

function showRejected(s) {
  $('#rejected').style.display = 'block';
  $('#rejInfo').innerHTML = `
    <dt>차량</dt><dd>${s.name}</dd>
    <dt>처리일</dt><dd>${fmt(s.decided_at)}</dd>
    <dt>사유</dt><dd>${s.reject_reason || '관리자 검토 결과 반려되었습니다.'}</dd>`;
}

function showApproved(s) {
  $('#approved').style.display = 'block';
  const token = s.vehicle_token;
  $('#apprInfo').innerHTML = `
    <dt>차량</dt><dd>${s.name}</dd>
    <dt>구독 기간</dt><dd>${s.months}개월</dd>
    <dt>고유 토큰</dt><dd><span class="tokenpill">${token}</span></dd>
    <dt>승인일</dt><dd>${fmt(s.decided_at)}</dd>`;
  const url = PARKLINK.senderUrl(token);
  $('#qrBox').innerHTML = PARKLINK.qrSvg(url, 5);
  $('#dlBtn').setAttribute('href', PARKLINK.qrDataUrl(url, 8));
  $('#dlBtn').setAttribute('download', 'PARKLINK_QR_' + token + '.gif');
  $('#lnkOwner').setAttribute('href', 'owner.html?v=' + token);
  $('#lnkPanel').setAttribute('href', 'panel.html?v=' + token);
  $('#lnkSender').setAttribute('href', 'sender.html?v=' + token);

  // 홈 화면에 추가 안내
  const openOwner = 'owner.html?v=' + token + '&addhome=1';
  $('#a2hsOpenOwner').setAttribute('href', openOwner);
  $('#a2hsSteps').innerHTML = PARKLINK.a2hsSteps();
  $('#a2hsBtn').addEventListener('click', () => { $('#a2hsModal').style.display = 'flex'; });
  $('#a2hsClose').addEventListener('click', () => { $('#a2hsModal').style.display = 'none'; });
  $('#a2hsModal').addEventListener('click', (e) => { if (e.target.id === 'a2hsModal') $('#a2hsModal').style.display = 'none'; });
}

$('#refreshBtn').addEventListener('click', load);
load();
