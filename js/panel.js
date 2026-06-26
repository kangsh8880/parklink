/* 차량 E-ink 패널 — 토큰(차량)별 QR + 차주 응답 표시 */
const $ = s => document.querySelector(s);
const token = PARKLINK.tokenFromUrl();
const REVERT_MS = 20000;
let qrDrawn = false;

function show(id) {
  ['nodata', 'expired', 'standby', 'response'].forEach(x => { $('#' + x).style.display = (x === id) ? 'block' : 'none'; });
}

function render() {
  const v = PARKLINK.getVehicle(token);
  if (!token || !v) { $('#topLabel').textContent = 'PARKLINK'; show('nodata'); return; }

  const s = PARKLINK.vehicleStatus(token);
  $('#topLabel').textContent = v.name + ' · 스캔하여 연락';

  if (s.expired) { show('expired'); return; }

  // QR (1회 그림)
  if (!qrDrawn) { $('#qrBox').innerHTML = PARKLINK.qrSvg(PARKLINK.senderUrl(token), 5); qrDrawn = true; }

  const r = PARKLINK.latestAnswered(token);
  if (r && (Date.now() - r.replyTs) < REVERT_MS) {
    show('response');
    $('#respMsg').textContent = r.reply;
    $('#respWhy').textContent = `요청: ${r.reason} · ${PARKLINK.fmtTime(r.replyTs)}`;
  } else {
    show('standby');
  }
}

PARKLINK.onUpdate(render);
setInterval(render, 1000);
render();
