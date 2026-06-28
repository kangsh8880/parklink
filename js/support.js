/* 복구 요청 조회 — id로 상태(대기/답변) 표시, 답변 시 차주화면 주소 안내 */
const $ = s => document.querySelector(s);
const id = new URLSearchParams(location.search).get('id');

function fmt(ts) { return ts ? PARKLINK.fmtDate(Number(ts)) + ' ' + PARKLINK.fmtTime(Number(ts)) : '-'; }
function hide(ids) { ids.forEach(i => { const el = $('#' + i); if (el) el.style.display = 'none'; }); }

function showOpen(s) {
  $('#open').style.display = 'block';
  $('#openInfo').innerHTML = `
    <dt>차량</dt><dd>${s.name}</dd>
    <dt>차주 번호</dt><dd>${s.phone_masked || '-'}</dd>
    <dt>조회 번호</dt><dd><span class="tokenpill">${s.id}</span></dd>
    <dt>접수일</dt><dd>${fmt(s.created_at)}</dd>
    <dt>상태</dt><dd><b style="color:var(--blue)">관리자 확인 대기 중</b></dd>`;
}

function showAnswered(s) {
  $('#answered').style.display = 'block';
  $('#ansInfo').innerHTML = `
    <dt>차량</dt><dd>${s.name}</dd>
    <dt>처리일</dt><dd>${fmt(s.answered_at)}</dd>`;
  if (s.answer_note) {
    $('#ansNote').textContent = s.answer_note;
    $('#ansNoteBox').style.display = 'flex';
  }
  $('#openOwner').setAttribute('href', 'owner.html?v=' + s.answer_token + '&addhome=1');
  $('#a2hsSteps').innerHTML = PARKLINK.a2hsSteps();
}

async function load() {
  hide(['notfound', 'open', 'answered']);
  $('#loading').style.display = 'block';
  if (!id) { hide(['loading']); $('#notfound').style.display = 'block'; return; }
  let s;
  try { s = await PARKLINK.getSupportRequest(id); }
  catch (e) { hide(['loading']); $('#notfound').style.display = 'block'; return; }
  hide(['loading']);
  if (!s) { $('#notfound').style.display = 'block'; return; }
  if (s.status === 'answered' && s.answer_token) showAnswered(s);
  else showOpen(s);
}

$('#refreshBtn').addEventListener('click', load);
load();
