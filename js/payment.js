/* =========================================================================
   PARKLINK 결제 어댑터(PG Adapter)
   · 지금은 provider='none' → 결제 없이 "관리자 수동 승인"으로 동작
   · 나중에 PG 계약 시 provider와 키만 바꾸면 결제 흐름이 켜짐
   · 실제 PG SDK 호출부는 각 provider 블록에 채워 넣으면 됨(인터페이스 고정)
   ========================================================================= */
window.PARKPAY = (function () {
  // ── 설정: 계약 후 이 부분만 교체 ──
  const CONFIG = {
    provider: 'none',          // 'none' | 'toss' | 'portone' | 'stripe'
    publicKey: '',             // PG 공개키(클라이언트용)
    // 서버 웹훅 검증은 Edge Function에서 비밀키로 처리(클라이언트엔 비밀키 두지 않음)
  };

  function isEnabled() { return CONFIG.provider !== 'none'; }

  // 결제창 요청. 반환: { mode:'manual' } (none) | { mode:'redirect', url } | { mode:'sdk', ... }
  async function createCheckout(sub) {
    if (!isEnabled()) {
      // 결제 미연동: 수동 승인 흐름. 결제 단계를 건너뜀.
      return { mode: 'manual', message: '결제 연동 전 단계입니다. 관리자 승인 후 이용할 수 있습니다.' };
    }
    switch (CONFIG.provider) {
      case 'toss':
        // TODO(계약 후): 토스페이먼츠 SDK로 결제창 호출
        // const tossPayments = TossPayments(CONFIG.publicKey);
        // return tossPayments.requestPayment('카드', { amount, orderId: sub.id, orderName: 'PARKLINK 구독', successUrl, failUrl });
        throw new Error('toss 결제 미구현');
      case 'portone':
        // TODO(계약 후): 포트원(아임포트) IMP.request_pay({...})
        throw new Error('portone 결제 미구현');
      case 'stripe':
        // TODO(계약 후): Stripe Checkout 세션 생성(서버) 후 redirect
        throw new Error('stripe 결제 미구현');
      default:
        return { mode: 'manual' };
    }
  }

  // 결제 완료 후처리(웹훅은 서버에서 검증). 클라이언트에선 상태 폴링만.
  // 2단계에서 결제 성공 시: subscriptions.payment_status='paid'로 서버가 갱신 → 관리자 승인.
  function describe() {
    return isEnabled()
      ? `결제 연동: ${CONFIG.provider}`
      : '결제 미연동 — 관리자 수동 승인 모드';
  }

  return { CONFIG, isEnabled, createCheckout, describe };
})();
