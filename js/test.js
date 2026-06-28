/* PARKLINK E2E 자가검증 — 라이브에서 핵심 흐름·보안 가드를 자동 채점
   외부 도구 없이 재실행 가능. 회귀 발생 시 즉시 빨간색으로 표시됨. */
(function () {
  const URL = 'https://ydladdffjqpcjynqpjdd.supabase.co/rest/v1/';
  const KEY = 'sb_publishable_hqsnudfSFzN78mCy3s92Qw_ZXBMl782';
  const H = (extra) => Object.assign({ apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, extra || {});
  const TEST_TOKEN = 'PL9TWUMP4';   // 존재하는 테스트 차량(유효)
  const RL_TOKEN = 'PL8F6TFRR';     // 레이트리밋 테스트용 차량
  const $ = s => document.querySelector(s);

  async function raw(method, path, body, extra) {
    const opt = { method, headers: H(extra) };
    if (body) opt.body = JSON.stringify(body);
    const r = await fetch(URL + path, opt);
    const t = await r.text();
    let j = null; try { j = JSON.parse(t); } catch (e) {}
    return { status: r.status, text: t, json: j };
  }
  const rpc = (fn, body) => raw('POST', 'rpc/' + fn, body || {});
  const msgOf = (res) => (res.json && res.json.message) || '';

  let RID = null; // 흐름 테스트에서 공유할 요청 id (TEST_TOKEN 생성 1건만 사용)

  // ── 핵심 테스트 스위트(비파괴·비잠금) ──
  const SUITE = [
    { g: '보안', name: 'vehicles 직접 조회 차단(RLS)', expect: '401',
      run: async () => { const r = await raw('GET', 'vehicles?select=*&limit=1'); return { pass: r.status === 401, got: 'HTTP ' + r.status }; } },
    { g: '보안', name: 'requests 직접 INSERT 차단', expect: '401/403',
      run: async () => { const r = await raw('POST', 'requests', { id: 'e2e' + Date.now(), token: TEST_TOKEN, reason: 'x', ts: Date.now(), status: 'pending' }, { Prefer: 'return=minimal' }); return { pass: r.status === 401 || r.status === 403, got: 'HTTP ' + r.status }; } },
    { g: '보안', name: 'app_secrets 해시 비노출', expect: '빈 배열',
      run: async () => { const r = await raw('GET', 'app_secrets?select=*'); return { pass: r.text.trim() === '[]', got: r.text.slice(0, 40) }; } },
    { g: '보안', name: 'consents 익명 조회 차단', expect: '빈 배열',
      run: async () => { const r = await raw('GET', 'consents?select=*&limit=1'); return { pass: r.text.trim() === '[]', got: r.text.slice(0, 40) }; } },
    { g: '보안', name: 'error_logs 익명 조회 차단', expect: '빈 배열',
      run: async () => { const r = await raw('GET', 'error_logs?select=*&limit=1'); return { pass: r.text.trim() === '[]', got: r.text.slice(0, 40) }; } },
    { g: '기능', name: 'get_vehicle RPC 단건 조회', expect: '차량 1건',
      run: async () => { const v = await PARKLINK.getVehicle(TEST_TOKEN); return { pass: !!(v && v.name), got: v ? v.name : '없음' }; } },
    { g: '기능', name: 'create_request 정상 생성', expect: 'id 반환',
      run: async () => { const r = await rpc('create_request', { p_token: TEST_TOKEN, p_reason_key: 'block' }); RID = r.json; return { pass: r.status === 200 && typeof r.json === 'string' && r.json.length > 0, got: r.status === 200 ? ('id=' + r.json) : ('HTTP ' + r.status + ' ' + msgOf(r)) }; } },
    { g: '기능', name: '주차위치 제거(생성 요청 location NULL)', expect: 'location=null',
      run: async () => { if (!RID) return { pass: false, got: '선행 생성 실패' }; const r = await raw('GET', 'requests?id=eq.' + RID + '&select=location'); const loc = r.json && r.json[0] ? r.json[0].location : 'NA'; return { pass: loc === null, got: 'location=' + JSON.stringify(loc) }; } },
    { g: '흐름', name: '양방향: 응답 회신 반영(RPC)', expect: 'answered + 응답 일치',
      run: async () => { if (!RID) return { pass: false, got: '선행 생성 실패' }; const EXP = PARKLINK.REPLIES[0]; await PARKLINK.answerRequest(RID, EXP); const q = await PARKLINK.getRequest(RID); return { pass: q && q.status === 'answered' && q.reply === EXP, got: q ? (q.status + ' / ' + q.reply) : '없음' }; } },
    { g: '보안', name: 'requests 직접 UPDATE 차단', expect: '401/403',
      run: async () => { const r = await raw('PATCH', 'requests?id=eq.' + (RID || 'none'), { status: 'answered', reply: '주입' }, { Prefer: 'return=minimal' }); return { pass: r.status === 401 || r.status === 403, got: 'HTTP ' + r.status }; } },
    { g: '보안', name: 'answer_request 무효 인덱스 거부', expect: 'invalid_reply',
      run: async () => { const r = await rpc('answer_request', { p_id: RID || 'none', p_reply_idx: 99 }); return { pass: r.status === 400 && /invalid_reply/.test(msgOf(r)), got: 'HTTP ' + r.status + ' ' + msgOf(r) }; } },
    { g: '보안', name: 'create_request 무효 토큰 거부', expect: 'invalid_token',
      run: async () => { const r = await rpc('create_request', { p_token: 'NO_SUCH_X', p_reason_key: 'block' }); return { pass: r.status === 400 && /invalid_token/.test(msgOf(r)), got: 'HTTP ' + r.status + ' ' + msgOf(r) }; } },
    { g: '보안', name: 'create_request 무효 사유 거부', expect: 'invalid_reason',
      run: async () => { const r = await rpc('create_request', { p_token: TEST_TOKEN, p_reason_key: '해킹주입' }); return { pass: r.status === 400 && /invalid_reason/.test(msgOf(r)), got: 'HTTP ' + r.status + ' ' + msgOf(r) }; } },
    { g: '보안', name: 'verify_admin_pin 틀린 PIN 거부', expect: 'false',
      run: async () => { const ok = await PARKLINK.verifyAdminPin('00000000_wrong'); return { pass: ok === false, got: String(ok) }; } },
    { g: '기능', name: '동의 기록(recordConsent)', expect: 'true',
      run: async () => { const ok = await PARKLINK.recordConsent('E2E_TEST'); return { pass: ok === true, got: String(ok) }; } },
    { g: '보안', name: '요청 레이트리밋(연속 생성 차단)', expect: 'rate_limited 발생',
      run: async () => { let limited = false, oks = 0; for (let i = 0; i < 6; i++) { const r = await rpc('create_request', { p_token: RL_TOKEN, p_reason_key: 'misc' }); if (r.status === 200) oks++; else if (/rate_limited/.test(msgOf(r))) limited = true; } return { pass: limited, got: '성공 ' + oks + '건, 차단 ' + (limited ? '발생' : '없음') }; } },
  ];

  function row(g, name, expect, res) {
    const ok = res.pass;
    return `<tr class="${ok ? 'pass' : 'fail'}">
      <td class="g">${g}</td>
      <td class="nm">${name}</td>
      <td class="ex muted">${expect}</td>
      <td class="got">${res.got || ''}</td>
      <td class="rs">${ok ? '✓ 통과' : '✗ 실패'}</td></tr>`;
  }

  async function runAll() {
    const btn = $('#runBtn'); btn.disabled = true; btn.textContent = '실행 중…';
    $('#summary').innerHTML = '<span class="muted">테스트 실행 중…</span>';
    $('#rows').innerHTML = '';
    RID = null;
    let pass = 0;
    for (const c of SUITE) {
      let res; try { res = await c.run(); } catch (e) { res = { pass: false, got: '오류: ' + e.message }; }
      if (res.pass) pass++;
      $('#rows').insertAdjacentHTML('beforeend', row(c.g, c.name, c.expect, res));
    }
    const total = SUITE.length;
    const allOk = pass === total;
    $('#summary').innerHTML = `<span class="score ${allOk ? 'ok' : 'ng'}">${pass} / ${total} 통과</span>
      <span class="muted">· ${new Date().toLocaleTimeString('ko-KR')}</span>
      ${allOk ? '<span class="badge ok">전체 정상</span>' : '<span class="badge ng">실패 항목 확인 필요</span>'}`;
    btn.disabled = false; btn.textContent = '전체 테스트 실행';
  }

  // ── 선택: PIN 레이트리밋(60초 잠금 유발) ──
  async function runPinRateLimit() {
    if (!confirm('PIN 시도제한 테스트는 관리자 PIN 게이트를 약 60초간 잠급니다(자동 해제). 진행할까요?')) return;
    const el = $('#pinResult'); el.textContent = '실행 중…';
    let limited = false, fails = 0;
    for (let i = 0; i < 11; i++) {
      const r = await rpc('verify_admin_pin', { p_pin: '00000000' });
      if (r.status === 200) fails++; else if (/rate_limited/.test(msgOf(r))) limited = true;
    }
    el.innerHTML = limited
      ? `<span class="score ok">✓ 통과</span> <span class="muted">실패 ${fails}회 후 차단 발생 · PIN은 약 60초 뒤 자동 해제</span>`
      : `<span class="score ng">✗ 실패</span> <span class="muted">차단이 발생하지 않음</span>`;
  }

  window.addEventListener('DOMContentLoaded', () => {
    $('#runBtn').addEventListener('click', runAll);
    $('#pinBtn').addEventListener('click', runPinRateLimit);
  });
})();
