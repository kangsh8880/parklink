/* =========================================================================
   PARKLINK 공통 모듈 (방법 A: 토큰 기반 차량 매핑 + 월 구독)
   - 서버 데이터 모델(차량 매핑 테이블 / 구독)을 그대로 모사한 store 계층.
   - 데모는 localStorage에 저장(같은 브라우저 탭 간 동기화).
   - 실제 서비스 전환 시 이 store 계층만 백엔드 REST API로 교체하면 됨.
   ========================================================================= */
window.PARKLINK = (function () {
  const KEY = 'parklink:db:v2';
  const DAY = 86400000;
  const RENEW_DAYS = 14;             // 만료 2주(14일) 전부터 갱신 알림
  const BASE = location.pathname.replace(/[^/]*$/, ''); // 현재 디렉토리 기준 경로

  // 사유 프리셋
  const REASONS = [
    { key: 'block',   label: '차량 빼주세요',   desc: '통행 방해', urgency: '긴급', cls: 'u' },
    { key: 'contact', label: '접촉 / 문콕 발생', desc: '경미한 사고', urgency: '긴급', cls: 'u' },
    { key: 'tow',     label: '견인 위험 구역',   desc: '단속·견인 임박', urgency: '긴급', cls: 'u' },
    { key: 'light',   label: '라이트가 켜져 있어요', desc: '방전 주의', urgency: '보통', cls: 'n' },
    { key: 'misc',    label: '기타 문의',        desc: '간단한 연락', urgency: '낮음', cls: 'l' },
  ];
  const REPLIES = ['3분 내 이동합니다', '곧 갑니다', '양보 부탁드립니다', '바로 연락드릴게요'];
  const LOCATIONS = ['지하 2층 · B구역', '지상 주차장 · 3열', '노상 · 12번 칸', '아파트 동측 주차면'];

  function _default() { return { vehicles: [], requests: [], shocks: [] }; }
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || _default(); }
    catch (e) { return _default(); }
  }
  function save(db) {
    localStorage.setItem(KEY, JSON.stringify(db));
    window.dispatchEvent(new CustomEvent('parklink:local'));
  }
  function onUpdate(cb) {
    window.addEventListener('storage', function (e) { if (e.key === KEY) cb(load()); });
    window.addEventListener('parklink:local', function () { cb(load()); });
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function makeToken() {
    const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 7; i++) s += c[Math.floor(Math.random() * c.length)];
    return 'PL' + s;
  }
  function addMonths(ts, m) {
    const d = new Date(ts); d.setMonth(d.getMonth() + Number(m)); return d.getTime();
  }

  /* ---------------- 구독(차량) 관리 = 서버 매핑 테이블 ---------------- */
  function listVehicles() { return load().vehicles.slice().sort((a, b) => b.createdAt - a.createdAt); }
  function getVehicle(token) { return load().vehicles.find(v => v.token === token) || null; }

  function createVehicle({ name, ownerPhone, months }) {
    const db = load();
    const now = Date.now();
    const v = {
      token: makeToken(),
      name: name || '내 차량',
      ownerPhone: ownerPhone,
      months: Number(months),
      createdAt: now,
      startAt: now,
      expireAt: addMonths(now, months),
      renewNotified: false,
    };
    db.vehicles.push(v);
    save(db);
    return v;
  }
  function extendVehicle(token, addM) {
    const db = load(); const v = db.vehicles.find(x => x.token === token);
    if (v) {
      const base = Math.max(v.expireAt, Date.now()); // 만료됐으면 오늘 기준 연장
      v.expireAt = addMonths(base, addM);
      v.months += Number(addM);
      v.renewNotified = false;
    }
    save(db);
  }
  function setExpireInDays(token, days) {  // 테스트용: 만료일을 N일 후로 강제 설정
    const db = load(); const v = db.vehicles.find(x => x.token === token);
    if (v) { v.expireAt = Date.now() + days * DAY; v.renewNotified = false; }
    save(db);
  }
  function setOwnerPhone(token, phone) {
    const db = load(); const v = db.vehicles.find(x => x.token === token);
    if (v) v.ownerPhone = phone;
    save(db);
  }
  function removeVehicle(token) {
    const db = load();
    db.vehicles = db.vehicles.filter(v => v.token !== token);
    db.requests = db.requests.filter(r => r.token !== token);
    db.shocks = db.shocks.filter(s => s.token !== token);
    save(db);
  }
  function markRenewNotified(token) {
    const db = load(); const v = db.vehicles.find(x => x.token === token);
    if (v) v.renewNotified = true; save(db);
  }

  // 구독 상태 계산
  function statusOf(v) {
    if (!v) return null;
    const now = Date.now();
    const daysLeft = Math.ceil((v.expireAt - now) / DAY);
    const expired = now >= v.expireAt;
    const renewDue = !expired && daysLeft <= RENEW_DAYS;
    return {
      daysLeft, expired, renewDue,
      state: expired ? '만료' : (renewDue ? '만료임박' : '구독중'),
      cls: expired ? 'red' : (renewDue ? 'peach' : 'blue'),
    };
  }
  function vehicleStatus(token) { return statusOf(getVehicle(token)); }
  function renewList() {  // 갱신 알림 대상(만료 2주 전~만료)
    return listVehicles().filter(v => { const s = statusOf(v); return s.renewDue || s.expired; });
  }

  /* ---------------- 요청 / 응답 (차량 토큰 단위) ---------------- */
  function sendRequest(token, reasonKey) {
    const r = REASONS.find(x => x.key === reasonKey);
    const db = load();
    const req = {
      id: uid(), token,
      reason: r.label, desc: r.desc, urgency: r.urgency, cls: r.cls,
      location: LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)],
      ts: Date.now(), status: 'pending', reply: null, replyTs: null,
    };
    db.requests.unshift(req);
    save(db);
    return req.id;
  }
  function answerRequest(reqId, message) {
    const db = load(); const req = db.requests.find(x => x.id === reqId);
    if (req) { req.status = 'answered'; req.reply = message; req.replyTs = Date.now(); }
    save(db);
  }
  function listRequests(token) { return load().requests.filter(r => r.token === token); }
  function getRequest(id) { return load().requests.find(r => r.id === id) || null; }
  function latestAnswered(token) { return load().requests.find(r => r.token === token && r.status === 'answered') || null; }

  function logShock(token) {
    const levels = ['약한 충격', '중간 충격', '강한 충격'];
    const db = load();
    db.shocks.unshift({ id: uid(), token, level: levels[Math.floor(Math.random() * levels.length)], ts: Date.now() });
    save(db);
  }
  function listShocks(token) { return load().shocks.filter(s => s.token === token); }

  function reset() { localStorage.removeItem(KEY); window.dispatchEvent(new CustomEvent('parklink:local')); }

  /* ---------------- URL / QR ---------------- */
  function senderUrl(token) { return location.origin + BASE + 'sender.html?v=' + token; }
  function panelUrl(token)  { return location.origin + BASE + 'panel.html?v=' + token; }
  function ownerUrl(token)  { return location.origin + BASE + 'owner.html?v=' + token; }
  function tokenFromUrl() { return new URLSearchParams(location.search).get('v'); }

  // 실제 스캔 가능한 QR (svg) — qrcode-generator(window.qrcode) 사용
  function qrSvg(text, cellSize) {
    const qr = window.qrcode(0, 'H');
    qr.addData(text); qr.make();
    return qr.createSvgTag({ cellSize: cellSize || 5, margin: 4, scalable: true });
  }
  function qrDataUrl(text, cellSize) {
    const qr = window.qrcode(0, 'H');
    qr.addData(text); qr.make();
    return qr.createDataURL(cellSize || 8, 16);
  }

  /* ---------------- 유틸 ---------------- */
  function telDigits(num) { return String(num || '').replace(/[^0-9+]/g, ''); }
  function fmtDate(ts) { const d = new Date(ts); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
  function fmtTime(ts) { const d = new Date(ts); const p = n => String(n).padStart(2, '0'); return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; }
  function timeAgo(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 5) return '방금 전'; if (s < 60) return s + '초 전';
    const m = Math.floor(s / 60); if (m < 60) return m + '분 전';
    return Math.floor(m / 60) + '시간 전';
  }
  function urgencyBadge(u) {
    const cls = u === '긴급' ? 'urgent' : (u === '보통' ? 'normal' : 'low');
    return `<span class="badge ${cls}">${u}</span>`;
  }
  function statusBadge(s) {
    const map = { '구독중': 'normal', '만료임박': 'urgent', '만료': 'low' };
    return `<span class="badge ${map[s.state] === 'urgent' ? 'urgent' : (s.state === '구독중' ? 'ok' : 'low')}">${s.state}</span>`;
  }

  return {
    REASONS, REPLIES, RENEW_DAYS, onUpdate, load, reset,
    listVehicles, getVehicle, createVehicle, extendVehicle, setExpireInDays,
    setOwnerPhone, removeVehicle, markRenewNotified, vehicleStatus, renewList, statusOf,
    sendRequest, answerRequest, listRequests, getRequest, latestAnswered, logShock, listShocks,
    senderUrl, panelUrl, ownerUrl, tokenFromUrl, qrSvg, qrDataUrl,
    telDigits, fmtDate, fmtTime, timeAgo, urgencyBadge, statusBadge,
  };
})();
