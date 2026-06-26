/* 관리자 페이지 */
const $ = s => document.querySelector(s);
let busy = false;

async function render() {
  if (busy) return; busy = true;
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
          <td><b>${v.name}</b><br><span class="muted">${v.months}개월 구독</span></td>
          <td>${v.ownerPhone}</td>
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
  } finally { busy = false; }
}

async function action(act, token) {
  try {
    if (act === 'extend1') await PARKLINK.extendVehicle(token, 1);
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

setInterval(render, 3000);
render();
