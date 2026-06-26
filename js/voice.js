/* =========================================================================
   PARKLINK 음성 어시스턴트 공통 모듈 (무료: 브라우저 음성인식 + 음성안내)
   - 인식: webkitSpeechRecognition (ko-KR)
   - 안내: speechSynthesis (ko-KR)
   - 해석: 규칙기반(키워드). 추후 Claude API 해석으로 교체 가능하도록 분리.
   - 실행 전 확인(오인식 방지) 플로우 제공.
   ========================================================================= */
window.PARKVOICE = (function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;
  let recog = null;
  let listening = false;

  function supported() { return !!SR; }

  function speak(text, onEnd) {
    try {
      if (synth.speaking) synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ko-KR'; u.rate = 1.0; u.pitch = 1.0;
      if (onEnd) u.onend = onEnd;
      synth.speak(u);
    } catch (e) { if (onEnd) onEnd(); }
  }
  function stopSpeak() { try { synth.cancel(); } catch (e) {} }

  // 한 번 듣기 → 인식 텍스트 콜백
  function listen({ onResult, onError, onStart, onEnd }) {
    if (!supported()) { if (onError) onError('이 브라우저는 음성인식을 지원하지 않습니다.'); return; }
    if (listening) stop();
    recog = new SR();
    recog.lang = 'ko-KR';
    recog.interimResults = false;
    recog.maxAlternatives = 1;
    recog.continuous = false;
    recog.onstart = () => { listening = true; if (onStart) onStart(); };
    recog.onerror = (e) => { listening = false; if (onError) onError(e.error || '인식 오류'); };
    recog.onend = () => { listening = false; if (onEnd) onEnd(); };
    recog.onresult = (e) => {
      const txt = e.results[0][0].transcript.trim();
      if (onResult) onResult(txt);
    };
    try { recog.start(); } catch (e) { if (onError) onError('인식 시작 실패'); }
  }
  function stop() { try { if (recog) recog.stop(); } catch (e) {} listening = false; }
  function isListening() { return listening; }

  /* ---------------- 규칙기반 해석기 ---------------- */
  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
  function hasAny(t, arr) { return arr.some(k => t.indexOf(k) !== -1); }
  function isHelp(t) { return hasAny(t, ['사용법', '사용 방법', '어떻게', '도움말', '설명', '뭐 할 수', '뭘 할 수', '안내']); }
  function isYes(t) { return hasAny(t, ['네', '예', '응', '맞아', '맞습니다', '확인', '좋아', '그래', '전송', '보내', '등록', '진행', '오케이', 'ok', '예스']); }
  function isNo(t) { return hasAny(t, ['아니', '취소', '안돼', '다시', '노', '말고', '그만']); }

  // 발신자: 사유 매칭 → reason key
  function matchReason(t) {
    t = norm(t);
    if (hasAny(t, ['빼', '이동', '막', '통행', '나가', '출차', '비켜', '차 좀'])) return 'block';
    if (hasAny(t, ['접촉', '문콕', '긁', '부딪', '사고', '박았', '찍'])) return 'contact';
    if (hasAny(t, ['견인', '단속', '불법', '레커', '끌려'])) return 'tow';
    if (hasAny(t, ['라이트', '불', '전조등', '미등', '방전', '시동', '켜져'])) return 'light';
    if (hasAny(t, ['문의', '기타', '연락', '물어', '질문'])) return 'misc';
    return null;
  }

  // 차주: 정형 응답 매칭 → 응답 문구(REPLIES 중)
  function matchReply(t, replies) {
    t = norm(t);
    if (hasAny(t, ['3분', '삼분', '금방', '곧 이동', '이동할', '이동하', '뺄게', '뺄께', '빼russ', '빼겠', '바로 이동'])) return replies[0]; // 3분 내 이동합니다
    if (hasAny(t, ['곧', '금방 갈', '가요', '갈게', '갈께', '갑니다', '가겠'])) return replies[1]; // 곧 갑니다
    if (hasAny(t, ['양보', '먼저', '비켜'])) return replies[2]; // 양보 부탁드립니다
    if (hasAny(t, ['연락', '전화', '문자', '톡'])) return replies[3]; // 바로 연락드릴게요
    return null;
  }

  // 관리자: 차량 등록 항목 추출 {name, phone, months}
  function parseVehicle(t) {
    t = norm(t);
    // 전화번호: 숫자/하이픈 (010 등)
    let phone = null;
    const pm = t.match(/01[016789][\-\s]?\d{3,4}[\-\s]?\d{4}/);
    if (pm) phone = pm[0].replace(/\s/g, '');
    else {
      const digits = (t.match(/\d/g) || []).join('');
      if (digits.length >= 10 && digits.length <= 11) phone = digits;
    }
    // 개월수
    let months = null;
    const mm = t.match(/(\d+)\s*개?월/);
    if (mm) months = parseInt(mm[1], 10);
    else {
      const kor = { '한': 1, '두': 2, '세': 3, '네': 4, '여섯': 6, '열두': 12, '일': 1, '이': 2, '삼': 3, '육': 6, '십이': 12 };
      for (const k in kor) if (t.indexOf(k + '개월') !== -1) { months = kor[k]; break; }
    }
    // 차량명: 전화/개월 토막 제거 후 남은 핵심어 (앞부분)
    let name = t;
    if (phone) name = name.replace(/01[016789][\-\s]?\d{3,4}[\-\s]?\d{4}/, ' ');
    name = name.replace(/\d+\s*개?월/g, ' ')
               .replace(/전화|번호|차주|등록|해줘|해 줘|구독|개월|이고|이며|이고요|입니다|이에요|예요|그리고|에|,|\./g, ' ')
               .replace(/\s+/g, ' ').trim();
    if (name.length < 2) name = '';
    return { name, phone, months };
  }

  return { supported, speak, stopSpeak, listen, stop, isListening, norm, isHelp, isYes, isNo, matchReason, matchReply, parseVehicle };
})();
