/* 차주 화면 자가복구 — 차량명+차주번호 정확일치 시 차주화면 링크 재발급 */
const $ = s => document.querySelector(s);

const ERR_KO = {
  invalid_input: '차량명과 전화번호를 정확히 입력하세요.',
  not_found: '일치하는 차량을 찾지 못했습니다. 입력을 다시 확인해 주세요.',
  rate_limited: '시도가 많습니다. 잠시 후 다시 시도하세요.',
  default: '조회 중 오류가 발생했습니다. 잠시 후 다시 시도하세요.',
};

function showError(code) {
  const box = $('#errBox');
  box.textContent = ERR_KO[code] || ERR_KO.default;
  box.style.display = 'block';
  // not_found / rate_limited 일 때 관리자 요청 안내 노출
  $('#failHelp').style.display = (code === 'not_found' || code === 'rate_limited') ? 'block' : 'none';
  $('#found').style.display = 'none';
}

function showFound(token) {
  $('#errBox').style.display = 'none';
  $('#failHelp').style.display = 'none';
  $('#openOwner').setAttribute('href', 'owner.html?v=' + token + '&addhome=1');
  $('#a2hsSteps').innerHTML = PARKLINK.a2hsSteps();
  $('#found').style.display = 'block';
  $('#found').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function find() {
  const name = $('#rName').value.trim();
  const phone = $('#rPhone').value.trim();
  if (!name || !phone) { showError('invalid_input'); return; }

  const btn = $('#findBtn');
  btn.disabled = true; btn.textContent = '찾는 중…';
  try {
    const token = await PARKLINK.recoverOwnerLink(name, phone);
    if (token) showFound(token);
    else showError('not_found');
  } catch (e) {
    const m = String(e.message || '');
    if (/rate_limited/.test(m)) showError('rate_limited');
    else if (/invalid_input/.test(m)) showError('invalid_input');
    else if (/not_found/.test(m)) showError('not_found');
    else showError('default');
  } finally {
    btn.disabled = false; btn.textContent = '내 차주 화면 찾기';
  }
}

$('#findBtn').addEventListener('click', find);
$('#rPhone').addEventListener('keydown', e => { if (e.key === 'Enter') find(); });
$('#rName').addEventListener('keydown', e => { if (e.key === 'Enter') $('#rPhone').focus(); });

// 복구 요청함 — 자가복구 실패 시 관리자에게 요청
$('#reqBtn').addEventListener('click', () => {
  const f = $('#reqForm');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
  if (f.style.display === 'block') $('#reqMemo').focus();
});

$('#reqSubmit').addEventListener('click', async () => {
  const name = $('#rName').value.trim();
  const phone = $('#rPhone').value.trim();
  const memo = $('#reqMemo').value.trim();
  if (!name || !phone) { showError('invalid_input'); return; }

  const btn = $('#reqSubmit');
  btn.disabled = true; btn.textContent = '보내는 중…';
  try {
    const id = await PARKLINK.createSupportRequest(name, phone, memo);
    if (!id) throw new Error('no_id');
    $('#failHelp').style.display = 'none';
    $('#reqId').textContent = id;
    $('#reqStatusLink').setAttribute('href', 'support.html?id=' + encodeURIComponent(id));
    $('#reqDone').style.display = 'block';
    $('#reqDone').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    const m = String(e.message || '');
    if (/rate_limited/.test(m)) alert('요청이 많습니다. 잠시 후 다시 시도하세요.');
    else if (/invalid_input/.test(m)) alert('차량명과 전화번호를 정확히 입력하세요.');
    else alert('요청 전송 중 오류가 발생했습니다. 잠시 후 다시 시도하세요.');
  } finally {
    btn.disabled = false; btn.textContent = '복구 요청 보내기';
  }
});
