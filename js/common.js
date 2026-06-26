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
      'Authorization': 'Bearer ' + SUPABASE_KEY,
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
    const rows = await api('GET', `vehicles?token=eq.${encodeURIComponent(token)}&select=*`);
    return rows && rows[0] ? vOut(rows[0]) : null;
  }
  async function createVehicle({ name, ownerPhone, months }) {
    const now = Date.now();
    const row = {
      token: makeToken(), name: name || '내 차량', owner_phone: ownerPhone, months: Number(months),
      created_at: now, start_at: now, expire_at: addMonths(now, months), renew_notified: false,
    };
    const res = await api('POST', 'vehicles', row);
    return vOut(res[0]);
  }
  async function extendVehicle(token, addM) {
    const v = await getVehicle(token); if (!v) return;
    const base = Math.max(v.expireAt, Date.now());
    await api('PATCH', `vehicles?token=eq.${token}`, { expire_at: addMonths(base, addM), months: v.months + Number(addM), renew_notified: false });
  }
  async function setExpireInDays(token, days) {
    await api('PATCH', `vehicles?token=eq.${token}`, { expire_at: Date.now() + days * DAY, renew_notified: false });
  }
  async function setOwnerPhone(token, phone) { await api('PATCH', `vehicles?token=eq.${token}`, { owner_phone: phone }); }
  async function removeVehicle(token) {
    await api('DELETE', `requests?token=eq.${token}`);
    await api('DELETE', `shocks?token=eq.${token}`);
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

  /* ---------------- 요청 / 응답 / 충격 ---------------- */
  async function sendRequest(token, reasonKey) {
    const r = REASONS.find(x => x.key === reasonKey);
    const id = uid();
    await api('POST', 'requests', {
      id, token, reason: r.label, descr: r.desc, urgency: r.urgency, cls: r.cls,
      location: LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)],
      ts: Date.now(), status: 'pending', reply: null, reply_ts: null,
    });
    return id;
  }
  async function answerRequest(id, message) {
    await api('PATCH', `requests?id=eq.${id}`, { status: 'answered', reply: message, reply_ts: Date.now() });
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
    REASONS, REPLIES, RENEW_DAYS,
    listVehicles, getVehicle, createVehicle, extendVehicle, setExpireInDays,
    setOwnerPhone, removeVehicle, markRenewNotified, statusOf,
    sendRequest, answerRequest, listRequests, getRequest, latestAnswered, logShock, listShocks, reset,
    senderUrl, panelUrl, ownerUrl, tokenFromUrl, qrSvg, qrDataUrl,
    telDigits, fmtDate, fmtTime, timeAgo, urgencyBadge, statusBadge,
  };
})();
