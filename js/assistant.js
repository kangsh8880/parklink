/* =========================================================================
   PARKLINK AI 어시스턴트 UI — 각 화면 공통
   - 플로팅 AI 버튼 → 패널 열기 → 음성 듣기 → 해석 → 확인 → 실행
   - 화면별 동작은 init(config)의 interpret/helpText로 주입
   ========================================================================= */
window.PARKASSIST = (function () {
  let cfg = null, pending = null, mode = 'idle';
  const $ = id => document.getElementById(id);

  function status(s) { const e = $('pa-status'); if (e) e.innerHTML = s; }
  function heard(t) { const e = $('pa-heard'); if (e) e.textContent = t ? '“' + t + '”' : ''; }

  function open() {
    $('pa-panel').classList.add('open');
    $('pa-fab').classList.add('hide');
    if (!PARKVOICE.supported()) { status('이 브라우저는 음성인식을 지원하지 않습니다. <b>Chrome</b>에서 사용해 주세요.'); return; }
    greet();
  }
  function close() {
    $('pa-panel').classList.remove('open');
    $('pa-fab').classList.remove('hide');
    PARKVOICE.stop(); PARKVOICE.stopSpeak(); mode = 'idle'; pending = null; heard('');
    status('버튼을 눌러 말씀하세요.');
  }

  function greet() {
    PARKVOICE.speak(cfg.greet || '무엇을 도와드릴까요? 말씀하세요.');
    startListen();
  }

  function startListen() {
    mode = 'listen'; pending = null; heard('');
    status('🎙️ 듣고 있어요… 말씀하세요');
    PARKVOICE.listen({
      onStart: () => status('🎙️ 듣고 있어요… 말씀하세요'),
      onResult: (t) => { heard(t); route(t); },
      onError: (e) => status('인식 실패(' + e + ') — <b>말하기</b>를 다시 눌러주세요'),
    });
  }

  function confirmListen() {
    mode = 'confirm';
    status('“네” 또는 “아니오”로 답해주세요 — 또는 아래 버튼');
    PARKVOICE.listen({
      onStart: () => status('🎙️ 확인 답변을 기다려요 (네/아니오)'),
      onResult: (t) => { heard(t); route(t); },
      onError: () => status('확인을 못 들었어요 — 아래 <b>확인/취소</b> 버튼을 눌러주세요'),
    });
  }

  async function route(t) {
    if (mode === 'confirm') {
      if (PARKVOICE.isNo(t)) return cancelPending('취소했어요. 다시 하려면 말하기를 누르세요.');
      if (PARKVOICE.isYes(t)) return doRun();
      PARKVOICE.speak(pending.label + ' 할까요? 네 또는 아니오로 답해주세요.', confirmListen);
      return;
    }
    if (PARKVOICE.isHelp(t)) { showHelp(); return; }
    let r = null;
    try { r = await cfg.interpret(t); } catch (e) { r = null; }
    if (!r) {
      status('잘 못 알아들었어요. <b>말하기</b>로 다시 시도하거나 “사용법”이라고 말해보세요.');
      PARKVOICE.speak('잘 못 알아들었어요. 다시 말씀해 주세요.');
      return;
    }
    pending = r;
    status('확인이 필요해요: <b>' + r.label + '</b>');
    PARKVOICE.speak((r.confirm || (r.label + ' 할까요?')) + ' 네 또는 아니오로 답해주세요.', confirmListen);
  }

  async function doRun() {
    if (!pending) return;
    const p = pending; pending = null; mode = 'idle';
    status('실행 중…');
    try { const msg = await p.run(); status('✓ ' + (msg || '완료했어요')); PARKVOICE.speak(msg || '완료했어요.'); }
    catch (e) { status('실패: ' + e.message); PARKVOICE.speak('실행에 실패했어요.'); }
  }

  function cancelPending(msg) {
    pending = null; mode = 'idle';
    status(msg); PARKVOICE.speak(msg);
  }

  function showHelp() {
    status('📖 사용법 안내');
    $('pa-help').style.display = 'block';
    $('pa-help').textContent = cfg.helpText;
    PARKVOICE.speak(cfg.helpSpeak || cfg.helpText);
  }

  function init(config) {
    cfg = config;
    const fab = document.createElement('button');
    fab.id = 'pa-fab'; fab.type = 'button';
    fab.innerHTML = '<span class="ai">AI</span><span class="lbl">음성</span>';
    fab.addEventListener('click', open);

    const panel = document.createElement('div');
    panel.id = 'pa-panel';
    panel.innerHTML =
      '<div class="pa-head"><b>🎙️ ' + (cfg.title || 'AI 음성 어시스턴트') + '</b>' +
      '<button id="pa-close" class="pa-x" type="button">✕</button></div>' +
      '<div id="pa-status" class="pa-status">버튼을 눌러 말씀하세요.</div>' +
      '<div id="pa-heard" class="pa-heard"></div>' +
      '<div id="pa-help" class="pa-help" style="display:none"></div>' +
      '<div class="pa-btns">' +
      '<button id="pa-talk" class="btn btn-primary" type="button">🎙️ 말하기</button>' +
      '<button id="pa-yes" class="btn btn-outline" type="button">확인</button>' +
      '<button id="pa-no" class="btn btn-outline" type="button">취소</button>' +
      '<button id="pa-help-btn" class="btn btn-ghost" type="button">사용법</button>' +
      '</div>';

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    $('pa-close').addEventListener('click', close);
    $('pa-talk').addEventListener('click', () => { PARKVOICE.stopSpeak(); $('pa-help').style.display = 'none'; startListen(); });
    $('pa-yes').addEventListener('click', () => { if (pending) doRun(); });
    $('pa-no').addEventListener('click', () => cancelPending('취소했어요.'));
    $('pa-help-btn').addEventListener('click', showHelp);
  }

  return { init };
})();
