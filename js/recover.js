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

// Phase 2(요청함) 연결 전까지 임시 안내
$('#reqBtn').addEventListener('click', e => {
  e.preventDefault();
  alert('관리자 재발급 요청함은 준비 중입니다. 우선 차량명·전화번호를 다시 확인해 주세요.');
});
