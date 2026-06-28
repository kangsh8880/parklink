/* =========================================================================
   PARKLINK 공통 모듈 — Supabase REST 백엔드 연동 (방법 A)
   - 차량 토큰↔차주 매핑 + 월 구독을 Supabase(PostgreSQL/PostgREST)에 저장.
   - 모든 데이터 함수는 async(Promise). 기기 간 동기화는 페이지 폴링으로 처리.
   - 게시 가능한 키(publishable)는 클라이언트 공개용. RLS 정책으로 접근 제어.
   ========================================================================= */
window.PARKLINK = (function () {
  const SUPABASE_URL = 'https://ydladdffjqpcjynqpjdd.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_hqsnudfSFzN78mCy3s92Qw_ZXBMl782';
  const REST = SUPABASE_URL + '/rest/v1/';
  const AUTH_BASE = SUPABASE_URL + '/auth/v1';
  let AUTH_BEARER = SUPABASE_KEY;            // 관리자 로그인 시 사용자 JWT로 교체
  const DAY = 86400000;
  const RENEW_DAYS = 14;
  const BASE = location.pathname.replace(/[^/]*$/, '');

  const REASONS = [
    { key: 'block',   label: '차량 빼주세요',   desc: '통행 방해', urgency: '긴급', cls: 'u' },
    { key: 'contact', label: '접촉 / 문콕 발생', desc: '경미한 사고', urgency: '긴급', cls: 'u' },
    { key: 'tow',     label: '견인 위험 구역',   desc: '단속·견인 임박', urgency: '긴급', cls: 'u' },
    { key: 'light',   label: '라이트가 켜져 있어요', desc: '방전 주의', urgency: '보통', cls: 'n' },
    { key: 'misc',    label: '기타 문의',        desc: '간단한 연락', urgency: '낮음', cls: 'l' },
  ];
  const REPLIES = ['3분 내 이동합니다', '곧 갑니다', '양보 부탁드립니다', '바로 연락드릴게요'];
  const LOCATIONS = ['지하 2층 · B구역', '지상 주차장 · 3열', '노상 · 12번 칸', '아파트 동측 주차면'];

  function H(extra) {
    return Object.assign({
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + AUTH_BEARER,
      'Content-Type': 'application/json',
    }, extra || {});
  }
  async function api(method, path, body) {
    const opt = { method, headers: H((method === 'POST' || method === 'PATCH') ? { 'Prefer': 'return=representation' } : {}) };
    if (body) opt.body = JSON.stringify(body);
    const res = await fetch(REST + path, opt);
    if (!res.ok) throw new Error('Supabase ' + res.status + ': ' + (await res.text()));
    if (method === 'DELETE') return null;
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  }

  // RPC(보안 정의자 함수) 호출 — 익명 사용자의 vehicles 접근은 전부 이 경로로만.
  async function rpc(fn, body) {
    const res = await fetch(REST + 'rpc/' + fn, { method: 'POST', headers: H(), body: JSON.stringify(body || {}) });
    if (!res.ok) throw new Error('Supabase rpc ' + fn + ' ' + res.status + ': ' + (await res.text()));
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  }

  // 관리자 PIN 서버 검증(소스에 PIN 미보관) — Supabase 보안함수로 해시 비교
  async function verifyAdminPin(pin) {
    return (await rpc('verify_admin_pin', { p_pin: String(pin || '') })) === true;
  }

  /* ---------------- 관리자 인증(Supabase Auth) ---------------- */
  function setAuth(jwt) { AUTH_BEARER = jwt || SUPABASE_KEY; }
  async function adminLogin(email, password) {
    const res = await fetch(AUTH_BASE + '/token?grant_type=password', {
      method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error_description || j.msg || ('로그인 실패 (' + res.status + ')'));
    setAuth(j.access_token);
    try { sessionStorage.setItem('parklink:adminJwt', j.access_token); } catch (e) {}
    return true;
  }
  function adminRestore() {
    try { const t = sessionStorage.getItem('parklink:adminJwt'); if (t) { setAuth(t); return true; } } catch (e) {}
    return false;
  }
  function adminLogout() { setAuth(null); try { sessionStorage.removeItem('parklink:adminJwt'); } catch (e) {} }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function makeToken() {
    const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = '';
    for (let i = 0; i < 7; i++) s += c[Math.floor(Math.random() * c.length)];
    return 'PL' + s;
  }
  function addMonths(ts, m) { const d = new Date(ts); d.setMonth(d.getMonth() + Number(m)); return d.getTime(); }

  function vOut(r) { return r ? {
    token: r.token, name: r.name, ownerPhone: r.owner_phone, months: r.months,
    createdAt: Number(r.created_at), startAt: Number(r.start_at), expireAt: Number(r.expire_at),
    renewNotified: r.renew_notified,
  } : null; }
  function reqOut(r) { return r ? {
    id: r.id, token: r.token, reason: r.reason, desc: r.descr, urgency: r.urgency, cls: r.cls,
    location: r.location, ts: Number(r.ts), status: r.status, reply: r.reply,
    replyTs: r.reply_ts ? Number(r.reply_ts) : null,
  } : null; }
  function shockOut(r) { return { id: r.id, token: r.token, level: r.level, ts: Number(r.ts) }; }

  /* ---------------- 구독(차량) ---------------- */
  async function listVehicles() {
    const rows = await api('GET', 'vehicles?select=*&order=created_at.desc');
    return (rows || []).map(vOut);
  }
  async function getVehicle(token) {
    if (!token) return null;
    const rows = await rpc('get_vehicle', { p_token: token });
    return rows && rows[0] ? vOut(rows[0]) : null;
  }
  async function createVehicle({ name, ownerPhone, months }) {
    const rows = await rpc('create_vehicle', { p_name: name || '내 차량', p_owner_phone: ownerPhone, p_months: Number(months) });
    return vOut(rows[0]);
  }
  async function extendVehicle(token, addM) {
    const v = await getVehicle(token); if (!v) return;
    const base = Math.max(v.expireAt, Date.now());
    await api('PATCH', `vehicles?token=eq.${token}`, { expire_at: addMonths(base, addM), months: v.months + Number(addM), renew_notified: false });
  }
  async function setExpireInDays(token, days) {
    await api('PATCH', `vehicles?token=eq.${token}`, { expire_at: Date.now() + days * DAY, renew_notified: false });
  }
  async function setOwnerPhone(token, phone) { await rpc('set_owner_phone', { p_token: token, p_phone: phone }); }
  async function removeVehicle(token) {
    await api('DELETE', `requests?token=eq.${token}`);
    await api('DELETE', `shocks?token=eq.${token}`);
    await api('DELETE', `push_subs?token=eq.${token}`);
    await api('DELETE', `vehicles?token=eq.${token}`);
  }
  async function markRenewNotified(token) { await api('PATCH', `vehicles?token=eq.${token}`, { renew_notified: true }); }

  function statusOf(v) {
    if (!v) return null;
    const now = Date.now();
    const daysLeft = Math.ceil((v.expireAt - now) / DAY);
    const expired = now >= v.expireAt;
    const renewDue = !expired && daysLeft <= RENEW_DAYS;
    return { daysLeft, expired, renewDue, state: expired ? '만료' : (renewDue ? '만료임박' : '구독중') };
  }

  // 시작일→만료일 기간을 개월수로 환산(만료일 변경과 항상 연동). 최소 1개월.
  function subMonths(v) {
    if (!v || !v.startAt || !v.expireAt) return (v && v.months) || 0;
    const m = Math.round((v.expireAt - v.startAt) / (DAY * 30.44));
    return Math.max(1, m);
  }

  /* ---------------- 요청 / 응답 / 충격 ---------------- */
  // ── 동의(개인정보처리방침·이용약관) 기록 ──
  const DOC_PRIVACY_VER = '2026-06-28';
  const DOC_TERMS_VER = '2026-06-28';
  // ── 에러 모니터링: 클라이언트 JS 에러를 Supabase에 적재 ──
  const _errSeen = {}; let _errCount = 0; let _errBusy = false;
  async function logError(msg, stack) {
    try {
      msg = String(msg || '').trim().slice(0, 500);
      if (!msg || _errBusy) return false;
      const now = Date.now();
      if (_errCount >= 30) return false;                       // 세션당 상한
      if (_errSeen[msg] && now - _errSeen[msg] < 60000) return false; // 동일 메시지 60초 1회
      _errSeen[msg] = now; _errCount++; _errBusy = true;
      await fetch(REST + 'error_logs', {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ msg, stack: String(stack || '').slice(0, 1500), page: location.pathname, ua: (navigator.userAgent || '').slice(0, 300), ts: now }),
      });
      _errBusy = false;
      return true;
    } catch (e) { _errBusy = false; return false; }
  }
  async function listErrorLogs(limit) { return await api('GET', 'error_logs?select=*&order=ts.desc&limit=' + (limit || 50)); }
  async function clearErrorLogs() { return await api('DELETE', 'error_logs?id=gt.0'); }
  // 전역 에러 후킹(중복 설치 방지)
  if (typeof window !== 'undefined' && !window.__parklinkErrHook) {
    window.__parklinkErrHook = true;
    window.addEventListener('error', function (e) {
      try { var m = e && e.message; if (m) logError(m, (e.error && e.error.stack) || ((e.filename || '') + ':' + (e.lineno || ''))); } catch (_) {}
    });
    window.addEventListener('unhandledrejection', function (e) {
      try { var r = e && e.reason; logError('unhandledrejection: ' + (r && r.message ? r.message : String(r)), r && r.stack); } catch (_) {}
    });
  }

  // ── 실시간 구독(Realtime) — 라이브러리/구독 실패 시 폴링으로 자동 폴백 ──
  let _rtClient = null;
  function _rt() {
    if (_rtClient) return _rtClient;
    try {
      if (typeof window === 'undefined' || !window.supabase || !window.supabase.createClient) return null;
      _rtClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { realtime: { params: { eventsPerSecond: 10 } } });
      return _rtClient;
    } catch (e) { return null; }
  }
  // 해당 토큰의 requests 변경(INSERT/UPDATE)을 실시간 수신. 폴백 시 pollMs 간격 폴링.
  function liveRequests(token, onChange, pollMs) {
    let pollTimer = null;
    const safe = () => { try { onChange(); } catch (e) {} };
    const startPoll = () => { if (!pollTimer) { safe(); pollTimer = setInterval(safe, pollMs || 3000); } };
    const c = _rt();
    if (!c) { startPoll(); return { mode: 'poll' }; }
    try {
      const ch = c.channel('req-' + token)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'requests', filter: 'token=eq.' + token }, safe)
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') safe();                                  // 구독 직후 1회 동기화
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') startPoll(); // 폴백
        });
      return { mode: 'realtime', channel: ch };
    } catch (e) { startPoll(); return { mode: 'poll' }; }
  }

  // ── 구독 신청·승인 워크플로 ──
  async function requestSubscription({ name, ownerPhone, applicantName, memo, months }) {
    return await rpc('request_subscription', {
      p_name: name, p_owner_phone: ownerPhone,
      p_applicant_name: applicantName || null, p_memo: memo || null, p_months: Number(months) || 3,
    });
  }
  async function getSubscriptionStatus(id) {
    const rows = await rpc('get_subscription_status', { p_id: id });
    return rows && rows[0] ? rows[0] : null;
  }
  async function listSubscriptions(status) { return await rpc('list_subscriptions', { p_status: status || null }); }
  async function approveSubscription(id) { return await rpc('approve_subscription', { p_id: id }); }
  async function rejectSubscription(id, reason) { return await rpc('reject_subscription', { p_id: id, p_reason: reason || null }); }

  // 홈 화면에 추가(A2HS) 플랫폼별 안내 단계
  function a2hsSteps() {
    const ua = navigator.userAgent || '';
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isAndroid = /Android/i.test(ua);
    if (isIOS) return '<ol class="steps"><li>화면 하단의 <b>공유</b> 버튼(□↑)을 누르세요.</li><li>목록에서 <b>홈 화면에 추가</b>를 선택하세요.</li><li>오른쪽 위 <b>추가</b>를 누르면 완료됩니다.</li></ol>';
    if (isAndroid) return '<ol class="steps"><li>오른쪽 위 <b>⋮ 메뉴</b>를 누르세요.</li><li><b>홈 화면에 추가</b>(또는 앱 설치)를 선택하세요.</li><li><b>추가</b>를 누르면 완료됩니다.</li></ol>';
    return '<ol class="steps"><li>브라우저 주소창의 <b>설치</b> 아이콘 또는 메뉴를 여세요.</li><li><b>홈 화면에 추가 / 설치</b>를 선택하세요.</li></ol>';
  }

  async function recordConsent(token) {
    try {
      const res = await fetch(REST + 'consents', {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY, Authorization: 'Bearer ' + AUTH_BEARER,
          'Content-Type': 'application/json', Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          token: token || null,
          doc_privacy_version: DOC_PRIVACY_VER,
          doc_terms_version: DOC_TERMS_VER,
          agreed_at: Date.now(),
          user_agent: (navigator.userAgent || '').slice(0, 300),
        }),
      });
      if (!res.ok) throw new Error('consent ' + res.status + ' ' + (await res.text()));
      return true;
    } catch (e) { console.warn('동의 기록 실패:', e.message); return false; }
  }

  async function sendRequest(token, reasonKey) {
    // 서버측 보안 함수로만 생성: 차량 유효성·내용 확정·레이트리밋을 서버가 수행
    return await rpc('create_request', { p_token: token, p_reason_key: reasonKey });
  }
  async function answerRequest(id, message) {
    // 직접 UPDATE 금지(보안): 회신은 정해진 4종(REPLIES) 인덱스로만 서버 RPC가 확정.
    const idx = REPLIES.indexOf(message);
    if (idx < 0) throw new Error('허용되지 않은 회신입니다');
    await rpc('answer_request', { p_id: id, p_reply_idx: idx });
  }
  async function listRequests(token) {
    const rows = await api('GET', `requests?token=eq.${token}&select=*&order=ts.desc`);
    return (rows || []).map(reqOut);
  }
  async function getRequest(id) {
    const rows = await api('GET', `requests?id=eq.${id}&select=*`);
    return rows && rows[0] ? reqOut(rows[0]) : null;
  }
  async function latestAnswered(token) {
    const rows = await api('GET', `requests?token=eq.${token}&status=eq.answered&select=*&order=reply_ts.desc&limit=1`);
    return rows && rows[0] ? reqOut(rows[0]) : null;
  }
  async function logShock(token) {
    const levels = ['약한 충격', '중간 충격', '강한 충격'];
    await api('POST', 'shocks', { id: uid(), token, level: levels[Math.floor(Math.random() * levels.length)], ts: Date.now() });
  }
  async function listShocks(token) {
    const rows = await api('GET', `shocks?token=eq.${token}&select=*&order=ts.desc`);
    return (rows || []).map(shockOut);
  }
  async function reset() {
    await api('DELETE', 'requests?ts=gte.0');
    await api('DELETE', 'shocks?ts=gte.0');
    await api('DELETE', 'push_subs?created_at=gte.0');
    await api('DELETE', 'vehicles?created_at=gte.0');
  }

  /* ---------------- URL / QR / 유틸 ---------------- */
  function senderUrl(token) { return location.origin + BASE + 'sender.html?v=' + token; }
  function panelUrl(token) { return location.origin + BASE + 'panel.html?v=' + token; }
  function ownerUrl(token) { return location.origin + BASE + 'owner.html?v=' + token; }
  function tokenFromUrl() { return new URLSearchParams(location.search).get('v'); }
  function qrSvg(text, cellSize) { const q = window.qrcode(0, 'H'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: cellSize || 5, margin: 4, scalable: true }); }
  function qrDataUrl(text, cellSize) { const q = window.qrcode(0, 'H'); q.addData(text); q.make(); return q.createDataURL(cellSize || 8, 16); }
  function telDigits(num) { return String(num || '').replace(/[^0-9+]/g, ''); }
  function fmtDate(ts) { const d = new Date(ts), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
  function fmtTime(ts) { const d = new Date(ts), p = n => String(n).padStart(2, '0'); return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; }
  function timeAgo(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 5) return '방금 전'; if (s < 60) return s + '초 전';
    const m = Math.floor(s / 60); if (m < 60) return m + '분 전';
    return Math.floor(m / 60) + '시간 전';
  }
  function urgencyBadge(u) { const c = u === '긴급' ? 'urgent' : (u === '보통' ? 'normal' : 'low'); return `<span class="badge ${c}">${u}</span>`; }
  function statusBadge(s) { const c = s.state === '구독중' ? 'ok' : (s.state === '만료임박' ? 'urgent' : 'low'); return `<span class="badge ${c}">${s.state}</span>`; }

  return {
    REASONS, REPLIES, RENEW_DAYS, DOC_PRIVACY_VER, DOC_TERMS_VER, recordConsent,
    logError, listErrorLogs, clearErrorLogs, liveRequests,
    requestSubscription, getSubscriptionStatus, listSubscriptions, approveSubscription, rejectSubscription, a2hsSteps,
    setAuth, adminLogin, adminRestore, adminLogout, verifyAdminPin,
    listVehicles, getVehicle, createVehicle, extendVehicle, setExpireInDays,
    setOwnerPhone, removeVehicle, markRenewNotified, statusOf, subMonths,
    sendRequest, answerRequest, listRequests, getRequest, latestAnswered, logShock, listShocks, reset,
    senderUrl, panelUrl, ownerUrl, tokenFromUrl, qrSvg, qrDataUrl,
    telDigits, fmtDate, fmtTime, timeAgo, urgencyBadge, statusBadge,
  };
})();
