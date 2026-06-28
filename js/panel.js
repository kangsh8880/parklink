/* 차량 E-ink 패널 — 토큰(차량)별 QR + 차주 응답 표시, Supabase 연동 */
const $ = s => document.querySelector(s);
const token = PARKLINK.tokenFromUrl();
const REVERT_MS = 20000;
let qrDrawn = false;
let busy = false;

function show(id) {
  ['nodata', 'expired', 'standby', 'response'].forEach(x => { $('#' + x).style.display = (x === id) ? 'block' : 'none'; });
}

async function render() {
  if (busy || document.hidden) return; busy = true;
  try {
    const v = await PARKLINK.getVehicle(token);
    if (!token || !v) { $('#topLabel').textContent = 'PARKLINK'; qrDrawn = false; show('nodata'); return; }
    const s = PARKLINK.statusOf(v);
    $('#topLabel').textContent = v.name + ' · 스캔하여 연락';
    if (s.expired) { qrDrawn = false; show('expired'); return; }

    if (!qrDrawn) { $('#qrBox').innerHTML = PARKLINK.qrSvg(PARKLINK.senderUrl(token), 5); qrDrawn = true; }

    const r = await PARKLINK.latestAnswered(token);
    if (r && (Date.now() - r.replyTs) < REVERT_MS) {
      show('response');
      $('#respMsg').textContent = r.reply;
      $('#respWhy').textContent = `요청: ${r.reason} · ${PARKLINK.fmtTime(r.replyTs)}`;
    } else show('standby');
  } catch (e) { console.error(e); }
  finally { busy = false; }
}

PARKLINK.liveRequests(token, render, 2500);  // 실시간 구독(폴백: 폴링)
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
render();
