/* 차량 E-ink 패널 — 최신 차주 응답을 표시, 일정 시간 후 대기화면 복귀 */
const $ = s => document.querySelector(s);
const REVERT_MS = 20000; // 응답 표시 후 대기화면 복귀 시간

function render() {
  const r = PARKLINK.latestAnswered();
  if (r && (Date.now() - r.replyTs) < REVERT_MS) {
    $('#standby').style.display = 'none';
    $('#response').style.display = 'block';
    $('#respMsg').textContent = r.reply;
    $('#respWhy').textContent = `요청: ${r.reason} · ${PARKLINK.fmtTime(r.replyTs)}`;
  } else {
    $('#response').style.display = 'none';
    $('#standby').style.display = 'block';
  }
}

PARKLINK.onUpdate(render);
setInterval(render, 1000);
render();
