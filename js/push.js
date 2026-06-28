/* PARKLINK 웹푸시(2단계) — Service Worker 등록 + 푸시 구독 + 알림 발송 트리거 */
window.PARKPUSH = (function () {
  const SUPA_URL = 'https://ydladdffjqpcjynqpjdd.supabase.co';
  const SUPA_KEY = 'sb_publishable_hqsnudfSFzN78mCy3s92Qw_ZXBMl782';
  const VAPID_PUBLIC = 'BMe-2oUCD1C1iKqYt1hiGgOn5sa0QWKaM21QeItwQ2UI2YVz88qc1tko_Up7neytxrbf8Cwbt-6fExKsBrIwzVY';
  const FN_URL = SUPA_URL + '/functions/v1/notify';
  const H = { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY, 'Content-Type': 'application/json' };

  function urlB64ToUint8(base64) {
    const pad = '='.repeat((4 - base64.length % 4) % 4);
    const b = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(b); const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  function supported() {
    return ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);
  }

  // 차주 페이지에서 호출: SW 등록 → 푸시 구독 → Supabase 저장
  async function subscribe(token) {
    if (!supported()) throw new Error('이 브라우저/모드는 웹푸시를 지원하지 않습니다. (iOS는 홈 화면에 추가 후 가능)');
    const reg = await navigator.serviceWorker.register('sw.js');
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(VAPID_PUBLIC) });
    }
    const j = sub.toJSON();
    // 동일 endpoint 또는 이전 endpoint가 남아 있으면 정리(중복 PK·누적 방지) 후 일반 INSERT.
    // (RLS에서 익명 SELECT를 막아둔 설계와 upsert가 충돌하므로 delete→insert 사용)
    const prev = localStorage.getItem('parklink:pushEp');
    const dels = new Set([j.endpoint]);
    if (prev) dels.add(prev);
    for (const ep of dels) {
      try { await fetch(SUPA_URL + '/rest/v1/push_subs?endpoint=eq.' + encodeURIComponent(ep), { method: 'DELETE', headers: H }); } catch (e) {}
    }
    const res = await fetch(SUPA_URL + '/rest/v1/push_subs', {
      method: 'POST',
      headers: Object.assign({}, H, { Prefer: 'return=minimal' }),
      body: JSON.stringify({ endpoint: j.endpoint, token: token, p256dh: j.keys.p256dh, auth: j.keys.auth, created_at: Date.now() }),
    });
    if (!res.ok) throw new Error('구독 저장 실패: ' + res.status + ' ' + (await res.text()));
    localStorage.setItem('parklink:pushEp', j.endpoint);
    return true;
  }

  // 발신자 페이지에서 호출: 해당 차량 차주에게 푸시 발송 트리거 (경각심 위해 2회 알림)
  async function notify(token, title, body) {
    const send = () => fetch(FN_URL, { method: 'POST', headers: H, body: JSON.stringify({ token, title, body }) }).catch(e => console.error('notify 실패', e));
    try {
      await send();                          // 1차 알림
      setTimeout(send, 1300);                // 약 1.3초 후 2차 알림(소리·진동 재알림)
    } catch (e) { console.error('notify 실패', e); }
  }

  // 구독 해제: 푸시 구독 취소 + Supabase에서 제거
  async function unsubscribe() {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const ep = sub.endpoint;
    try { await sub.unsubscribe(); } catch (e) {}
    try { await fetch(SUPA_URL + '/rest/v1/push_subs?endpoint=eq.' + encodeURIComponent(ep), { method: 'DELETE', headers: H }); } catch (e) {}
  }

  return { supported, subscribe, notify, unsubscribe };
})();
