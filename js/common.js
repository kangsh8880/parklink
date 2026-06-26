/* PARKLINK 공통 모듈 - localStorage 기반 메시지 버스 (백엔드 없이 탭 간 실시간 동기화) */
window.PARKLINK = (function () {
  const KEY = 'parklink:state:v1';

  // 사유 프리셋 (발신자 선택지)
  const REASONS = [
    { key: 'block',   label: '차량 빼주세요',   desc: '통행 방해', urgency: '긴급', cls: 'u' },
    { key: 'contact', label: '접촉 / 문콕 발생', desc: '경미한 사고', urgency: '긴급', cls: 'u' },
    { key: 'tow',     label: '견인 위험 구역',   desc: '단속·견인 임박', urgency: '긴급', cls: 'u' },
    { key: 'light',   label: '라이트가 켜져 있어요', desc: '방전 주의', urgency: '보통', cls: 'n' },
    { key: 'misc',    label: '기타 문의',        desc: '간단한 연락', urgency: '낮음', cls: 'l' },
  ];

  // 차주 정형 응답
  const REPLIES = ['3분 내 이동합니다', '곧 갑니다', '양보 부탁드립니다', '바로 연락드릴게요'];

  const LOCATIONS = ['지하 2층 · B구역', '지상 주차장 · 3열', '노상 · 12번 칸', '아파트 동측 주차면'];

  // 차주 휴대폰 번호 기본값 (테스트용) — 발신자의 통화·문자가 이 번호로 연결됨
  const DEFAULT_OWNER_PHONE = '010-4411-3606';

  function _default() { return { requests: [], shocks: [], seq: 1, ownerPhone: DEFAULT_OWNER_PHONE }; }

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || _default(); }
    catch (e) { return _default(); }
  }
  function save(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
    // 같은 탭에는 storage 이벤트가 안 오므로 커스텀 이벤트로 보완
    window.dispatchEvent(new CustomEvent('parklink:local'));
  }

  // 변경 구독 (다른 탭: storage / 같은 탭: parklink:local)
  function onUpdate(cb) {
    window.addEventListener('storage', function (e) { if (e.key === KEY) cb(load()); });
    window.addEventListener('parklink:local', function () { cb(load()); });
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // ---- 액션 ----
  function sendRequest(reasonKey) {
    const r = REASONS.find(x => x.key === reasonKey);
    const st = load();
    const req = {
      id: uid(),
      reason: r.label, desc: r.desc, urgency: r.urgency, cls: r.cls,
      location: LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)],
      ts: Date.now(),
      status: 'pending',   // pending | answered
      reply: null, replyTs: null,
    };
    st.requests.unshift(req);
    save(st);
    return req.id;
  }

  function answerRequest(reqId, message) {
    const st = load();
    const req = st.requests.find(x => x.id === reqId);
    if (req) { req.status = 'answered'; req.reply = message; req.replyTs = Date.now(); }
    save(st);
  }

  function logShock() {
    const levels = ['약한 충격', '중간 충격', '강한 충격'];
    const st = load();
    st.shocks.unshift({ id: uid(), level: levels[Math.floor(Math.random() * levels.length)], ts: Date.now() });
    save(st);
  }

  function latestAnswered() {
    const st = load();
    return st.requests.find(x => x.status === 'answered') || null;
  }
  function getRequest(id) { return load().requests.find(x => x.id === id) || null; }

  function reset() { localStorage.removeItem(KEY); window.dispatchEvent(new CustomEvent('parklink:local')); }

  // ---- 차주 번호 ----
  function getOwnerPhone() { const st = load(); return st.ownerPhone || DEFAULT_OWNER_PHONE; }
  function setOwnerPhone(num) { const st = load(); st.ownerPhone = num; save(st); }
  function telDigits(num) { return String(num || '').replace(/[^0-9+]/g, ''); }

  // ---- 유틸 ----
  function fmtTime(ts) {
    const d = new Date(ts);
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
  function timeAgo(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 5) return '방금 전';
    if (s < 60) return s + '초 전';
    const m = Math.floor(s / 60);
    if (m < 60) return m + '분 전';
    return Math.floor(m / 60) + '시간 전';
  }
  function urgencyBadge(u) {
    const cls = u === '긴급' ? 'urgent' : (u === '보통' ? 'normal' : 'low');
    return `<span class="badge ${cls}">${u}</span>`;
  }

  // 데코용 QR (의사 모듈 패턴) - 실제 스캔 기능 아님, 데모 시각용
  function qrSVG(size) {
    const n = 21, m = size / n;
    let seed = 7, rects = '';
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const sq = (c, r) => `<rect x="${c * m}" y="${r * m}" width="${m}" height="${m}" fill="#1b1b1b"/>`;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const f = (r < 8 && c < 8) || (r < 8 && c > n - 9) || (r > n - 9 && c < 8);
      if (!f && rnd() > 0.52) rects += sq(c, r);
    }
    const finder = (fx, fy) =>
      `<rect x="${fx * m}" y="${fy * m}" width="${7 * m}" height="${7 * m}" fill="#1b1b1b"/>` +
      `<rect x="${(fx + 1) * m}" y="${(fy + 1) * m}" width="${5 * m}" height="${5 * m}" fill="#F3F1EA"/>` +
      `<rect x="${(fx + 2) * m}" y="${(fy + 2) * m}" width="${3 * m}" height="${3 * m}" fill="#1b1b1b"/>`;
    rects += finder(0, 0) + finder(n - 7, 0) + finder(0, n - 7);
    return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
  }

  return {
    REASONS, REPLIES, DEFAULT_OWNER_PHONE, load, onUpdate,
    sendRequest, answerRequest, logShock, latestAnswered, getRequest, reset,
    getOwnerPhone, setOwnerPhone, telDigits,
    fmtTime, timeAgo, urgencyBadge, qrSVG,
  };
})();
