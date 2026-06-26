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
    // 항상 초기 화면으로 시작
    $('pa-help').style.display = 'none';
    $('pa-help').textContent = '';
    heard('');
    pending = null; mode = 'idle'; confirmRetry = 0;
    if (!PARKVOICE.supported()) { status('이 브라우저는 음성인식을 지원하지 않습니다. <b>Chrome</b>에서 사용해 주세요.'); return; }
    status('잠시만요…');
    greet();
  }
  function close() {
    $('pa-panel').classList.remove('open');
    $('pa-fab').classList.remove('hide');
    PARKVOICE.stop(); PARKVOICE.stopSpeak(); mode = 'idle'; pending = null; confirmRetry = 0; heard('');
    $('pa-help').style.display = 'none';
    $('pa-help').textContent = '';
    status('버튼을 눌러 말씀하세요.');
  }

  function greet() {
    PARKVOICE.speak(cfg.greet || '무엇을 도와드릴까요? 말씀해 주세요.', startListen);
  }

  function startListen() {
    mode = 'listen'; pending = null; heard('');
    status('🎙️ 듣고 있어요… 말씀하세요');
    PARKVOICE.listen({
      onStart: () => status('🎙️ 듣고 있어요… 말씀하세요'),
      onResult: (t) => { heard(t); route(t); },
      onError: (e) => status('잘 안 들렸어요 — <b>말하기</b>를 다시 눌러주세요'),
    });
  }

  let confirmRetry = 0;
  function confirmListen() {
    mode = 'confirm';
    status('🎙️ <b>삐</b> 소리 후 “네” 또는 “아니요” 라고 말해주세요');
    PARKVOICE.cue();
    setTimeout(function () {
      PARKVOICE.listen({
        onStart: () => status('🎙️ 듣고 있어요 — “네” 또는 “아니요”'),
        onResult: (t) => { heard(t); route(t); },
        onError: () => {
          if (confirmRetry < 2) { confirmRetry++; status('못 들었어요. 한 번 더 — <b>삐</b> 소리 후 “네/아니요”'); confirmListen(); }
          else { status('확인을 못 들었어요. 아래 <b>확인 / 취소</b> 버튼을 눌러주세요.'); }
        },
      });
    }, 180);
  }

  async function route(t) {
    if (mode === 'confirm') {
      confirmRetry = 0;
      if (PARKVOICE.isNo(t)) return cancelPending('알겠습니다. 취소할게요.');
      if (PARKVOICE.isYes(t)) return doRun();
      PARKVOICE.speak('네 또는 아니요로 답해 주세요.', confirmListen);
      return;
    }
    if (PARKVOICE.isHelp(t)) { showHelp(); return; }
    let r = null;
    try { r = await cfg.interpret(t); } catch (e) { r = null; }
    if (!r) {
      status('잘 못 알아들었어요. 다시 말씀해 주세요.');
      PARKVOICE.speak('잘 못 알아들었어요. 다시 한번 말씀해 주세요.', startListen);
      return;
    }
    pending = r; confirmRetry = 0;
    status('확인이 필요해요: <b>' + r.label + '</b>');
    PARKVOICE.speak((r.confirm || (r.label + ' 진행할까요?')), confirmListen);
  }

  async function doRun() {
    if (!pending) return;
    const p = pending; pending = null; mode = 'idle'; confirmRetry = 0;
    status('처리하고 있어요…');
    try {
      const msg = await p.run();
      status('✓ ' + (msg || '완료했어요'));
      // 완료 안내를 끝까지 말한 뒤 패널 자동 닫힘
      PARKVOICE.speak(msg || '완료했어요.', () => { setTimeout(close, 1400); });
    } catch (e) {
      status('실패: ' + e.message);
      PARKVOICE.speak('처리하지 못했어요. 다시 시도해 주세요.');
    }
  }

  function cancelPending(msg) {
    pending = null; mode = 'idle';
    status(msg + ' 다시 하시려면 말하기를 눌러주세요.'); PARKVOICE.speak(msg);
  }

  function showHelp() {
    mode = 'idle'; pending = null; confirmRetry = 0;
    PARKVOICE.stop();
    status('📖 사용법 안내');
    $('pa-help').style.display = 'block';
    $('pa-help').textContent = cfg.helpText;
    // 안내를 끝까지 말한 뒤 패널 자동 닫힘
    PARKVOICE.speak(cfg.helpSpeak || cfg.helpText, () => { setTimeout(close, 1600); });
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
