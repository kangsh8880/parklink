/* 구독 신청 / 차량 등록 */
const $ = s => document.querySelector(s);

$('#submitBtn').addEventListener('click', async function () {
  const name = $('#vName').value.trim() || '내 차량';
  const phone = $('#vPhone').value.trim();
  const months = parseInt($('#vMonths').value, 10);
  if (!phone) { alert('차주 전화번호를 입력하세요.'); return; }
  if (!months || months < 1) { alert('구독 개월 수를 1 이상 입력하세요.'); return; }
  if (!$('#agreePrivacy').checked || !$('#agreeTerms').checked) {
    alert('개인정보처리방침과 이용약관에 모두 동의해야 등록할 수 있습니다.'); return;
  }

  const btn = $('#submitBtn');
  btn.disabled = true; btn.textContent = '발급 중…';
  try {
    const v = await PARKLINK.createVehicle({ name, ownerPhone: phone, months });
    await PARKLINK.recordConsent(v.token);   // 동의 이력 DB 기록(버전·시각)
    showResult(v);
  } catch (e) {
    alert('구독 생성 실패: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = '구독 신청하고 QR 발급';
  }
});

function showResult(v) {
  $('#form').style.display = 'none';
  $('#result').style.display = 'block';

  const s = PARKLINK.statusOf(v);
  $('#resultInfo').innerHTML = `
    <dt>차량</dt><dd>${v.name}</dd>
    <dt>차주 번호</dt><dd>${v.ownerPhone}</dd>
    <dt>고유 토큰</dt><dd><span class="tokenpill">${v.token}</span></dd>
    <dt>구독 기간</dt><dd>${PARKLINK.subMonths(v)}개월</dd>
    <dt>시작일</dt><dd>${PARKLINK.fmtDate(v.startAt)}</dd>
    <dt>만료일</dt><dd>${PARKLINK.fmtDate(v.expireAt)} (D-${s.daysLeft})</dd>`;

  const url = PARKLINK.senderUrl(v.token);
  $('#qrBox').innerHTML = PARKLINK.qrSvg(url, 5);
  $('#dlBtn').setAttribute('href', PARKLINK.qrDataUrl(url, 8));
  $('#dlBtn').setAttribute('download', 'PARKLINK_QR_' + v.token + '.gif');

  $('#lnkPanel').setAttribute('href', 'panel.html?v=' + v.token);
  $('#lnkOwner').setAttribute('href', 'owner.html?v=' + v.token);
  $('#lnkSender').setAttribute('href', 'sender.html?v=' + v.token);
}

$('#againBtn').addEventListener('click', function () {
  $('#vName').value = '';
  $('#result').style.display = 'none';
  $('#form').style.display = 'block';
});
