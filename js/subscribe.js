/* 구독 신청 / 차량 등록 */
const $ = s => document.querySelector(s);

$('#submitBtn').addEventListener('click', function () {
  const name = $('#vName').value.trim() || '내 차량';
  const phone = $('#vPhone').value.trim();
  const months = parseInt($('#vMonths').value, 10);
  if (!phone) { alert('차주 전화번호를 입력하세요.'); return; }
  if (!months || months < 1) { alert('구독 개월 수를 1 이상 입력하세요.'); return; }

  const v = PARKLINK.createVehicle({ name, ownerPhone: phone, months });
  showResult(v);
});

function showResult(v) {
  $('#form').style.display = 'none';
  $('#result').style.display = 'block';

  const s = PARKLINK.vehicleStatus(v.token);
  $('#resultInfo').innerHTML = `
    <dt>차량</dt><dd>${v.name}</dd>
    <dt>차주 번호</dt><dd>${v.ownerPhone}</dd>
    <dt>고유 토큰</dt><dd><span class="tokenpill">${v.token}</span></dd>
    <dt>구독 기간</dt><dd>${v.months}개월</dd>
    <dt>시작일</dt><dd>${PARKLINK.fmtDate(v.startAt)}</dd>
    <dt>만료일</dt><dd>${PARKLINK.fmtDate(v.expireAt)} (D-${s.daysLeft})</dd>`;

  // QR: sender URL(토큰 포함) 인코딩
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
