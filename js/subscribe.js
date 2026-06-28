/* 구독 신청 접수 — 관리자 승인 워크플로 */
const $ = s => document.querySelector(s);

$('#submitBtn').addEventListener('click', async function () {
  const name = $('#vName').value.trim();
  const phone = $('#vPhone').value.trim();
  const applicant = $('#vApplicant').value.trim();
  const memo = $('#vMemo').value.trim();
  const months = parseInt($('#vMonths').value, 10);
  if (!name) { alert('차량명 / 번호판을 입력하세요.'); return; }
  if (!phone) { alert('차주 전화번호를 입력하세요.'); return; }
  if (!months || months < 1) { alert('구독 개월 수를 1 이상 입력하세요.'); return; }
  if (!$('#agreePrivacy').checked || !$('#agreeTerms').checked) {
    alert('개인정보처리방침과 이용약관에 모두 동의해야 신청할 수 있습니다.'); return;
  }

  const btn = $('#submitBtn');
  btn.disabled = true; btn.textContent = '접수 중…';
  try {
    const id = await PARKLINK.requestSubscription({ name, ownerPhone: phone, applicantName: applicant, memo, months });
    await PARKLINK.recordConsent(null);            // 동의 이력 기록(신청 시점)
    showResult(id, { name, phone, applicant, months });
  } catch (e) {
    alert('신청 접수 실패: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = '구독 신청 접수';
  }
});

function statusLink(id) {
  return location.origin + location.pathname.replace(/[^/]*$/, '') + 'status.html?id=' + encodeURIComponent(id);
}

function showResult(id, info) {
  clearForm();
  $('#form').style.display = 'none';
  $('#result').style.display = 'block';
  $('#resultInfo').innerHTML = `
    <dt>차량</dt><dd>${info.name}</dd>
    <dt>차주 번호</dt><dd>${info.phone}</dd>
    ${info.applicant ? `<dt>신청자</dt><dd>${info.applicant}</dd>` : ''}
    <dt>구독 기간</dt><dd>${info.months}개월 (승인 시 적용)</dd>
    <dt>신청 번호</dt><dd><span class="tokenpill">${id}</span></dd>
    <dt>상태</dt><dd>승인 대기 중</dd>`;
  const link = statusLink(id);
  $('#statusUrl').textContent = link;
  $('#goStatus').setAttribute('href', link);
}

$('#copyStatus') && $('#copyStatus').addEventListener('click', function () {
  const t = $('#statusUrl').textContent;
  navigator.clipboard ? navigator.clipboard.writeText(t).then(() => { this.textContent = '복사됨'; setTimeout(() => this.textContent = '복사', 1500); })
    : alert(t);
});

$('#againBtn').addEventListener('click', function () {
  $('#vName').value = ''; $('#vApplicant').value = ''; $('#vMemo').value = '';
  $('#agreePrivacy').checked = false; $('#agreeTerms').checked = false;
  clearForm();
  $('#result').style.display = 'none';
  $('#form').style.display = 'block';
});

/* ── 폼 값 보존(약관/방침 확인 후 복귀 시 입력 유지) + 동의 자동 체크 ── */
const SKEY = 'parklink:subscribeForm';
const FIELDS = ['vName', 'vPhone', 'vApplicant', 'vMemo', 'vMonths'];
const CHECKS = ['agreePrivacy', 'agreeTerms'];

function saveForm() {
  const data = {};
  FIELDS.forEach(id => { const el = $('#' + id); if (el) data[id] = el.value; });
  CHECKS.forEach(id => { const el = $('#' + id); if (el) data[id] = el.checked; });
  try { sessionStorage.setItem(SKEY, JSON.stringify(data)); } catch (e) {}
}
function restoreForm() {
  let data; try { data = JSON.parse(sessionStorage.getItem(SKEY) || '{}'); } catch (e) { data = {}; }
  FIELDS.forEach(id => { if (data[id] != null) { const el = $('#' + id); if (el) el.value = data[id]; } });
  CHECKS.forEach(id => { if (data[id] != null) { const el = $('#' + id); if (el) el.checked = data[id]; } });
}
function clearForm() { try { sessionStorage.removeItem(SKEY); } catch (e) {} }

// 입력/체크 변경 시 자동 저장
[...FIELDS, ...CHECKS].forEach(id => {
  const el = $('#' + id);
  if (el) { el.addEventListener('input', saveForm); el.addEventListener('change', saveForm); }
});

// 초기화: 저장값 복원 → 약관/방침 '확인함'으로 돌아온 경우 해당 동의 자동 체크
(function initSubscribe() {
  restoreForm();
  const agree = new URLSearchParams(location.search).get('agree');
  if (agree === 'privacy') $('#agreePrivacy').checked = true;
  else if (agree === 'terms') $('#agreeTerms').checked = true;
  if (agree) {
    saveForm();
    history.replaceState(null, '', location.pathname);  // URL 정리(새로고침 시 재적용 방지)
  }
})();
