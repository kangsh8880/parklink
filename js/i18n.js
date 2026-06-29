/* PARKLINK i18n — 한국어 원문 매칭 방식.
   - 모든 페이지 최상단에 KO/EN 토글바 자동 주입(항상 노출)
   - data-i18n 불필요: 한국어 원문을 키로 영어 치환
   - MutationObserver로 동적 생성 텍스트도 자동 번역
   - 언어 선택은 localStorage('pl_lang')에 저장(전 페이지 공유) */
(function () {
  'use strict';

  const DICT = {
    // ── 공통/푸터/네비 ──
    "← 메인화면": "← Home",
    "메인화면": "Home",
    "메인화면으로 이동": "Go to home",
    "개인정보처리방침": "Privacy Policy",
    "이용약관": "Terms of Service",
    "PARKLINK — 번호는 숨기고, 소통은 양방향으로": "PARKLINK — numbers hidden, two-way contact",
    "새로고침": "Refresh",
    "불러오는 중…": "Loading…",
    "닫기": "Close",
    "조회": "Search",
    "상태": "Status",
    "차량": "Vehicle",
    "토큰": "Token",
    "데모": "Demo",
    "복사": "Copy",
    "차주 화면": "owner screen",
    "QR에는 차량 고유": "The QR contains only the vehicle's unique",

    // ── 동적 메시지(JS) — 사용자 대면 핵심 ──
    "일치하는 차량을 찾지 못했습니다. 입력을 다시 확인해 주세요.": "No matching vehicle found. Please re-check your input.",
    "차량명과 전화번호를 정확히 입력하세요.": "Enter the vehicle name and phone correctly.",
    "시도가 많습니다. 잠시 후 다시 시도하세요.": "Too many attempts. Please try again later.",
    "조회 중 오류가 발생했습니다. 잠시 후 다시 시도하세요.": "An error occurred. Please try again later.",
    "찾는 중…": "Searching…",
    "보내는 중…": "Sending…",
    "접수 중…": "Submitting…",
    "요청이 많습니다. 잠시 후 다시 시도하세요.": "Too many requests. Please try again later.",
    "요청 전송 중 오류가 발생했습니다. 잠시 후 다시 시도하세요.": "An error occurred while sending. Please try again later.",
    "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.": "Requests are too frequent. Please try again later.",
    "유효하지 않은 요청입니다.": "Invalid request.",
    "허용되지 않은 회신입니다": "This reply is not allowed",
    "승인 대기 중": "Pending approval",
    "승인됨": "Approved",
    "반려됨": "Rejected",
    "만료임박": "Expiring",
    "방금 전": "just now",
    "분 전": "min ago",
    "시간 전": "hr ago",
    "초 전": "sec ago",
    "차주에게 보냈어요": "Sent to the owner",
    "전송에 실패했어요. 잠시 후 다시 시도해 주세요.": "Failed to send. Please try again later.",
    "전송하지 못했어요. 다시 시도해 주세요.": "Couldn't send. Please try again.",
    "응답할 새 요청이 없어요.": "No new requests to answer.",
    "응답할 요청 없음": "No requests to answer",
    "전화번호를 입력해 주세요.": "Please enter a phone number.",
    "차량명 / 번호판을 입력하세요.": "Enter the vehicle name / plate.",
    "차주 전화번호를 입력하세요.": "Enter the owner phone.",
    "개인정보처리방침과 이용약관에 모두 동의해야 신청할 수 있습니다.": "You must agree to both the Privacy Policy and Terms to apply.",
    "구독 개월 수를 1 이상 입력하세요.": "Enter a subscription period of at least 1 month.",
    "복사됨": "Copied",
    "확인함": "Reviewed",
    "✓ 전화번호가 변경 완료되었습니다.": "✓ Phone number updated.",
    "✓ 차주 전화번호가 변경되었습니다.": "✓ Owner phone updated.",
    "결제 미연동 — 관리자 수동 승인 모드": "Payment not integrated — manual admin approval mode",
    "결제 연동 전 단계입니다. 관리자 승인 후 이용할 수 있습니다.": "Payment is not yet integrated. Available after admin approval.",
    "구독 만료": "Subscription expired",
    "선행 생성 실패": "Setup creation failed",

    // ── a2hs 홈화면 추가 안내 ──
    "화면 하단의 “공유” 버튼(□↑)을 누르세요.": "Tap the “Share” button (□↑) at the bottom.",
    "목록에서 “홈 화면에 추가”를 선택하세요.": "Choose “Add to Home Screen” from the list.",
    "오른쪽 위 “추가”를 누르면 완료됩니다.": "Tap “Add” at the top right to finish.",
    "오른쪽 위 “⋮ 메뉴”를 누르세요.": "Tap the “⋮ menu” at the top right.",
    "“홈 화면에 추가”(또는 앱 설치)를 선택하세요.": "Choose “Add to Home screen” (or Install app).",
    "“추가”를 누르면 완료됩니다.": "Tap “Add” to finish.",
    "브라우저 주소창의 “설치” 아이콘 또는 메뉴를 여세요.": "Open the “Install” icon or menu in the address bar.",
    "“홈 화면에 추가 / 설치”를 선택하세요.": "Choose “Add to Home Screen / Install”.",

    // ── confirm/alert ──
    "데모 데이터를 모두 비울까요?": "Reset all demo data?",
    "에러 로그를 전체 삭제할까요?": "Delete all error logs?",
    "이 차량 구독을 해지하고 매핑을 삭제할까요?": "Cancel this vehicle's subscription and delete the mapping?",
    "지금은 응답할 새 요청이 없어요. 그래도 진행할까요?": "No new requests to answer right now. Proceed anyway?",
    "알겠습니다. 취소할게요.": "OK, cancelled.",
    "취소했어요.": "Cancelled.",
    "관리자 재발급 요청함은 준비 중입니다. 우선 차량명·전화번호를 다시 확인해 주세요.": "The admin recovery inbox is being prepared. Please re-check the vehicle name and phone first.",
    "전달할 차량 토큰을 입력하세요.": "Enter the vehicle token to send.",
    "등록되지 않은 토큰입니다. 가입자목록에서 정확한 토큰을 확인하세요.": "Unregistered token. Check the exact token in the subscriber list.",
    "전달 완료": "Sent",
    "요청을 찾을 수 없습니다.": "Request not found.",

    // ── index ──
    "PARKLINK · 양방향 안심 스마트 주차패드": "PARKLINK · Two-way smart parking pad",
    "번호는 숨기고, 소통은 양방향으로": "Numbers hidden, contact two-way",
    "양방향 안심 스마트 주차패드": "Two-way smart parking pad",
    "차량별 고유 QR + 월 구독 기반. 스캔하면 번호 노출 없이 차주에게 안심 연결됩니다.": "Per-vehicle QR + monthly subscription. Scan to reach the owner safely without revealing numbers.",
    "먼저": "First,",
    "구독 신청": "Subscribe",
    "에서 차량을 등록하면 전용 QR이 발급됩니다. 발급된 링크로 차주·패널·발신자 화면을 테스트하세요. (백엔드 없이 브라우저에서 동작하는 프로토타입)": " register a vehicle to get a dedicated QR. Use the issued links to test the owner, panel, and sender screens. (Prototype running in the browser)",
    "구독 신청 / 차량 등록": "Subscribe / Register vehicle",
    "개월 수 선택 → 전용 QR 발급": "Pick months → dedicated QR issued",
    "차주 화면 복구": "Recover owner screen",
    "지운 앱(차주 화면) 다시 찾기": "Find your deleted owner app again",
    "관리자 페이지": "Admin page",
    "가입자·매핑 관리, 갱신 알림": "Manage subscribers & mapping, renewal alerts",
    "방법 A — 토큰 기반 안심 매핑": "Method A — token-based safe mapping",
    "만 담깁니다(전화번호·이름 등 개인정보 미포함). 서버가 토큰↔차주를 매핑해 스캔 시 안심 연결합니다. 분실·매도 시 토큰 폐기/재발급이 가능하고, 차주 번호를 바꿔도 QR은 그대로 씁니다.": " only (no personal data such as phone or name). The server maps token↔owner for safe connection on scan. Tokens can be revoked/reissued if lost or sold, and the QR stays valid even if the owner's number changes.",
    "데모 데이터 초기화는": "Demo data reset is available after login in",
    "에서 로그인 후 가능합니다.": ".",

    // ── recover ──
    "PARKLINK · 차주 화면 복구": "PARKLINK · Recover owner screen",
    "차주 화면 다시 찾기": "Find your owner screen again",
    "홈 화면에 추가한 앱(차주 화면)을 실수로 지웠을 때, 등록한": "If you accidentally deleted the home-screen app (owner screen), find it again with your registered",
    "차량명": "vehicle name",
    "과": "and",
    "차주 전화번호": "owner phone",
    "로 다시 찾을 수 있습니다.": ".",
    "차량명 / 번호판": "Vehicle name / plate",
    "구독 신청 때 입력한 차량명과 정확히 같아야 합니다.": "Must exactly match the vehicle name entered when subscribing.",
    "하이픈(-)은 있어도 없어도 됩니다.": "Hyphens (-) are optional.",
    "내 차주 화면 찾기": "Find my owner screen",
    "✓ 차주 화면을 찾았습니다": "✓ Owner screen found",
    "아래에서 차주 화면을 열고, 다시 홈 화면에 추가하면 앱처럼 사용할 수 있습니다.": "Open the owner screen below and add it to your home screen again to use it like an app.",
    "🔔 차주 화면 열기": "🔔 Open owner screen",
    "📱 홈 화면에 다시 추가": "📱 Add to home screen again",
    "위": "Tap",
    "차주 화면 열기": "Open owner screen",
    "를 누르세요.": " above.",
    "열린 차주 화면에서 다음 순서로 추가하세요:": "On the opened owner screen, add it as follows:",
    "찾지 못하셨나요?": "Couldn't find it?",
    "차량명이나 전화번호가 등록 정보와 다르면 찾을 수 없습니다. 입력을 다시 확인해 주세요. 그래도 안 되면 관리자에게 복구를 요청하세요. 관리자가 등록 정보를 확인한 뒤 차주 화면 주소를 전달해 드립니다.": "If the vehicle name or phone differs from the registered info, it can't be found. Please re-check your input. If it still fails, request recovery from the admin, who will verify your info and send the owner screen address.",
    "관리자에게 복구 요청": "Request recovery from admin",
    "메모": "Memo",
    "(선택)": "(optional)",
    "위에 입력한 차량명·전화번호로 요청이 접수됩니다.": "The request uses the vehicle name and phone entered above.",
    "복구 요청 보내기": "Send recovery request",
    "✓ 복구 요청이 접수되었습니다": "✓ Recovery request received",
    "관리자가 확인 후 차주 화면 주소를 전달합니다. 아래": "The admin will verify and send the owner screen address. Keep the",
    "조회 링크": "status link",
    "를 보관했다가 다시 열어 결과를 확인하세요.": " below and reopen it to check the result.",
    "조회 번호": "Reference no.",
    "요청 상태 확인하기 →": "Check request status →",
    "예: 카니발 12가3456": "e.g. Carnival 12GA3456",
    "예: 6월에 등록한 GV80입니다 / 지하주차장 정기": "e.g. GV80 registered in June / underground monthly",

    // ── support ──
    "PARKLINK · 복구 요청 조회": "PARKLINK · Recovery request status",
    "복구 요청 조회": "Recovery request status",
    "복구 요청 상태": "Recovery request status",
    "요청을 찾을 수 없습니다": "Request not found",
    "조회 링크가 올바른지 확인하세요.": "Check that the status link is correct.",
    "차주 화면 복구로 이동": "Go to owner-screen recovery",
    "⏳ 관리자 확인 대기 중": "⏳ Awaiting admin review",
    "관리자가 등록 정보를 확인한 뒤 차주 화면 주소를 전달합니다. 이 페이지를 다시 열어 확인하세요.": "The admin will verify your info and send the owner screen address. Reopen this page to check.",
    "✓ 차주 화면 주소가 전달되었습니다": "✓ Owner screen address has been sent",

    // ── subscribe ──
    "PARKLINK · 구독 신청": "PARKLINK · Subscribe",
    "신청을 접수하면 관리자 승인 후 차량 전용 QR이 발급됩니다.": "After you apply, a dedicated vehicle QR is issued upon admin approval.",
    "발신자의 통화·문자가 이 번호로 안심 연결됩니다.": "Sender calls and texts are safely connected to this number.",
    "신청자 이름": "Applicant name",
    "구독 기간 (개월)": "Subscription period (months)",
    "승인 시점부터 적용되며, 만료 2주 전부터 갱신 알림이 표시됩니다.": "Applies from approval; a renewal alert shows from 2 weeks before expiry.",
    "(필수)": "(required)",
    "에 동의합니다.": " — I agree.",
    "차주 전화번호 등 개인정보 처리를 위해 동의가 필요합니다. 발신자의 전화번호는 수집하지 않습니다.": "Consent is required to process personal data such as the owner phone. Sender phone numbers are not collected.",
    "구독 신청 접수": "Submit subscription",
    "✓ 구독 신청이 접수되었습니다": "✓ Subscription request received",
    "관리자 검토 후 승인되면 차량 전용 QR이 발급됩니다. 아래": "After admin review and approval, a dedicated vehicle QR is issued. Keep the",
    "상태 조회 링크": "status link",
    "를 보관하세요.": " below.",
    "이 링크로 신청 상태(대기/승인/반려)를 확인하고, 승인 시 QR을 받을 수 있습니다.": "Use this link to check status (pending/approved/rejected) and get the QR upon approval.",
    "상태 조회 화면 열기 →": "Open status screen →",
    "새 신청": "New request",
    "예: 홍길동": "e.g. John Doe",
    "예: 지하주차장 B-12 정기주차": "e.g. Underground B-12 monthly parking",

    // ── status ──
    "PARKLINK · 신청 상태 조회": "PARKLINK · Application status",
    "신청 상태 조회": "Application status",
    "구독 신청 상태": "Subscription status",
    "상태를 불러오는 중…": "Loading status…",
    "신청을 찾을 수 없습니다": "Application not found",
    "링크가 올바른지 확인하세요.": "Check that the link is correct.",
    "구독 신청하기": "Subscribe now",
    "⏳ 승인 대기 중": "⏳ Awaiting approval",
    "관리자 검토 후 승인되면 이 화면에서 QR이 발급됩니다. 이 페이지를 다시 열어 확인하세요.": "After admin review and approval, the QR is issued on this screen. Reopen this page to check.",
    "✓ 승인되었습니다": "✓ Approved",
    "차량 전용 QR (E-ink 패널용)": "Dedicated vehicle QR (for E-ink panel)",
    "스캔하면 이 차량 차주에게 안심 연결됩니다.": "Scanning connects safely to this vehicle's owner.",
    "🖨️ 이 QR을 저장 후 프린트하여 차량에 놓으세요.": "🖨️ Save and print this QR, then place it on the vehicle.",
    "QR 이미지 저장": "Save QR image",
    "바로가기": "Shortcuts",
    "🔔 차주 화면": "🔔 Owner screen",
    "🖥️ 차량 패널": "🖥️ Vehicle panel",
    "📷 발신자(스캔) 화면": "📷 Sender (scan) screen",
    "📱 차주 화면 홈 화면에 추가": "📱 Add owner screen to home",
    "📱 홈 화면에 추가": "📱 Add to home screen",
    "차주 화면을 휴대폰 홈에 추가하면 앱처럼 바로 열 수 있어요. 추가된 아이콘은": "Add the owner screen to your phone home to open it like an app. The added icon links directly to the",
    "으로 바로 연결됩니다.": ".",
    "아래": "Tap",
    "차주 화면 열기 →": "Open owner screen →",
    "✗ 반려되었습니다": "✗ Rejected",
    "다시 신청하기": "Apply again",

    // ── owner ──
    "PARKLINK · 차주": "PARKLINK · Owner",
    "차주": "Owner",
    "차량 정보를 찾을 수 없습니다.": "Vehicle info not found.",
    "관리자 또는 구독 신청에서 차량을 선택하세요.": "Select a vehicle from admin or subscription.",
    "실시간 알림": "Live alerts",
    "응답을 보내면, 발신자에게 회신됩니다.": "Your reply is sent back to the sender.",
    "📱 이 화면을 홈 화면에 추가하세요": "📱 Add this screen to your home screen",
    "추가하면 앱처럼 바로 열 수 있어요.": "Once added, it opens instantly like an app.",
    "알림 설정": "Notification settings",
    "구독 정보": "Subscription info",
    "번호 저장": "Save number",
    "발신자의 통화·문자가 이 번호로 연결됩니다.": "Sender calls and texts connect to this number.",
    "현재 요청 현황": "Current requests",
    "지금 회신할 요청이 없습니다.": "No requests to reply to right now.",
    "요청이력 조회": "Request history",
    "과거 요청 이력이 없습니다.": "No past request history.",
    "차주 화면으로 이동 중…": "Going to owner screen…",

    // ── sender ──
    "PARKLINK · 주차 차량에 연락": "PARKLINK · Contact a parked vehicle",
    "연락하기": "Contact",
    "주차 중인 차량에 연락": "Contact a parked vehicle",
    "전화번호를 몰라도 됩니다. 앱 설치·가입 없이 바로 전달됩니다.": "No phone number needed. Delivered instantly without installing an app or signing up.",
    "내 번호와 차주 번호 모두": "Both your number and the owner's are kept",
    "비공개": "private",
    "로 안전하게 중계됩니다.": " and safely relayed.",
    "어떤 일로 연락하시나요?": "What's the reason for contact?",
    "✓ 차주에게 전달되었습니다": "✓ Delivered to the owner",
    "차주 회신을 기다리는 중 —": "Waiting for the owner's reply —",
    "이 화면을 닫지 마세요.": "do not close this screen.",
    "회신이 여기에 표시됩니다.": "The reply will appear here.",
    "차주 응답 대기 중…": "Waiting for owner reply…",
    "차주가 응답하면 이 화면과 차량 패널에 표시됩니다.": "When the owner responds, it appears here and on the vehicle panel.",
    "📞 차주에게 전화": "📞 Call the owner",
    "✉️ 문자 보내기": "✉️ Send a text",
    "다시 연락하기": "Contact again",
    "이 화면을 닫지 마세요": "Do not close this screen",
    "차주의 회신이": "The owner's reply",
    "이 화면에 실시간으로": "appears on this screen in",
    "표시됩니다.": "real time.",
    "화면을 닫거나 나가면 회신을 받을 수 없어요.": "If you close or leave, you won't receive the reply.",
    "잠시만 기다려 주세요.": "Please wait a moment.",
    "확인 — 회신을 기다릴게요": "OK — I'll wait for the reply",
    "차주 응답": "Owner reply",

    // ── panel ──
    "PARKLINK · 차량 패널": "PARKLINK · Vehicle panel",
    "주차 중 · 스캔하여 연락": "Parked · Scan to contact",
    "차량이 지정되지 않았습니다.": "No vehicle assigned.",
    "관리자에서 차량 QR을 발급하세요.": "Issue a vehicle QR in admin.",
    "구독 상태": "Subscription status",
    "구독 만료": "Subscription expired",
    "갱신 후 이용 가능합니다": "Available after renewal",
    "전화번호 비공개 · QR/NFC로 연결됩니다": "Phone hidden · connected via QR/NFC",
    "PARKLINK · 무접착 거치 · 2.9\" E-ink · QR/NFC · G센서 · 태양광": "PARKLINK · Adhesive-free mount · 2.9\" E-ink · QR/NFC · G-sensor · Solar",

    // ── open ──
    "PARKLINK · 관리자": "PARKLINK · Admin",

    // ── admin ──
    "PARKLINK 관리자": "PARKLINK Admin",
    "관리자 PIN을 입력하세요.": "Enter the admin PIN.",
    "다음": "Next",
    "관리자 계정으로 로그인하세요.": "Log in with your admin account.",
    "이메일": "Email",
    "비밀번호": "Password",
    "로그인": "Log in",
    "관리자": "Admin",
    "가입자 관리": "Subscriber management",
    "가입자현황": "Overview",
    "구독신청관리": "Applications",
    "복구요청": "Recovery",
    "가입자목록": "Subscribers",
    "에러로그": "Error log",
    "상태별 가입 현황입니다. 숫자를 누르면 해당 목록으로 이동합니다.": "Subscriptions by status. Tap a number to jump to that list.",
    "총 가입": "Total",
    "구독중": "Active",
    "만료 임박": "Expiring",
    "만료": "Expired",
    "🔔 갱신 알림 대상 (만료 2주 전~만료)": "🔔 Renewal alert targets (2 weeks before expiry ~ expiry)",
    "ALL (전체)": "ALL",
    "승인대기": "Pending",
    "승인": "Approved",
    "반려": "Rejected",
    "📋 구독 신청 관리": "📋 Subscription applications",
    "🔁 차주 화면 복구 요청": "🔁 Owner-screen recovery requests",
    "차주가 등록 정보 확인을 요청한 건입니다. 전화번호로 매칭된 차량을 확인하고, 본인이 맞으면": "Requests where an owner asked to verify their info. Check the vehicle matched by phone, and if it's them, send the",
    "기존 차주 화면 주소": "existing owner screen address",
    "를 전달하세요. (신규 발급 아님)": ". (Not a new issuance.)",
    "가입자 목록": "Subscriber list",
    "← 현황으로": "← Overview",
    "차주번호": "Owner phone",
    "시작": "Start",
    "남은일": "Days left",
    "관리": "Manage",
    "조회된 가입자가 없습니다.": "No subscribers found.",
    "테스트: 각 행의": "Test: each row's",
    "만료-10일": "Expiry-10d",
    "만료처리": "Force expire",
    "버튼으로 갱신 알림·만료 동작을 즉시 확인할 수 있습니다.": " buttons let you instantly verify renewal-alert and expiry behavior.",
    "+ 차량 등록": "+ Register vehicle",
    "전체 초기화": "Reset all",
    "⚠️ 에러 로그": "⚠️ Error log",
    "전체 삭제": "Delete all",
    "차량명 · 번호판 · 전화번호 검색": "Search by vehicle / plate / phone",

    // ── test ──
    "PARKLINK · E2E 자가검증": "PARKLINK · E2E self-check",
    "E2E 자가검증": "E2E self-check",
    "라이브 환경에서 핵심 흐름과 보안 가드를 자동 점검합니다. 코드 변경 후 실행해 회귀를 즉시 확인하세요.": "Automatically checks core flows and security guards in the live environment. Run after code changes to catch regressions.",
    "전체 테스트 실행": "Run all tests",
    "아직 실행하지 않았습니다.": "Not run yet.",
    "구분": "Group",
    "테스트": "Test",
    "기대": "Expected",
    "결과": "Result",
    "판정": "Verdict",
    "선택 테스트 — PIN 시도제한": "Optional test — PIN rate limit",
    "실행 시 관리자 PIN 게이트가 약 60초간 잠깁니다(자동 해제). 정기 점검에는 위 전체 테스트만으로 충분합니다.": "Running this locks the admin PIN gate for ~60s (auto-released). For routine checks, the full test above is enough.",
    "PIN 레이트리밋 테스트": "PIN rate-limit test",
    "※ 테스트는 기존 테스트 차량(PL9TWUMP4·PL8F6TFRR)을 사용하며, 점검용 요청·동의 행이 일부 생성됩니다. 운영 전 admin에서 정리하세요.": "※ Tests use existing test vehicles (PL9TWUMP4, PL8F6TFRR) and create some check rows. Clean up in admin before going live.",

    // ── privacy ──
    "PARKLINK · 개인정보처리방침": "PARKLINK · Privacy Policy",
    "PARKLINK(이하 “서비스”)는 이용자의 개인정보를 중요하게 생각하며, 「개인정보 보호법」 등 관련 법령을 준수합니다.": "PARKLINK (the \"Service\") values user privacy and complies with applicable laws including the Personal Information Protection Act.",
    "시행일: 2026-06-28 · 버전 2026-06-28": "Effective: 2026-06-28 · Version 2026-06-28",
    "0. 개인정보 최소수집 원칙": "0. Principle of minimal collection",
    "서비스는 차량 식별코드(QR)에 차주의 전화번호·성명 등 개인정보를 포함하지 않으며, 서버의 토큰 매핑만으로 발신자와 차주를 익명 연결합니다.": "The Service does not include personal data such as the owner's phone or name in the vehicle code (QR); it links sender and owner anonymously via server-side token mapping only.",
    "주차된 차량에 연락하는 발신자의 전화번호는 수집하지 않습니다.": "The phone number of a sender contacting a parked vehicle is not collected.",
    "1. 수집하는 개인정보 항목": "1. Personal data collected",
    "가. 차주(구독자) — 차량 등록·구독 시": "a. Owner (subscriber) — at vehicle registration/subscription",
    "필수: 차주 전화번호, 차량명/번호판, 구독정보(기간·시작일·만료일)": "Required: owner phone, vehicle name/plate, subscription info (period, start, expiry)",
    "알림 이용 시: 웹푸시 구독정보(브라우저가 발급한 구독 식별자 및 암호화 키)": "For alerts: web push subscription info (browser-issued subscription ID and encryption keys)",
    "나. 발신자 — 차량에 연락 시": "b. Sender — when contacting a vehicle",
    "전화번호 등 식별정보:": "Identifiers such as phone number:",
    "수집하지 않음": "Not collected",
    "연락 사유, 요청·응답 시각(차량 관련 정보로서 개인 식별정보가 아님)": "Reason for contact, request/response times (vehicle-related, not personal identifiers)",
    "다. 동의 기록 — 동의한 약관·방침의 버전 및 동의 시각, 접속 환경 정보(User-Agent)": "c. Consent records — agreed terms/policy versions and timestamps, access environment (User-Agent)",
    "2. 수집·이용 목적": "2. Purpose of collection and use",
    "발신자와 차주 간 익명 연락 중계 및 정형 응답 전달": "Relaying anonymous contact between sender and owner and delivering canned replies",
    "구독 상태·만료일에 따른 연결 허용/차단 및 갱신 안내": "Allowing/blocking connection by subscription status/expiry and renewal guidance",
    "차주에게 연락 요청 발생 시 알림(웹푸시) 발송": "Sending alerts (web push) when a contact request occurs",
    "법령상 의무 이행 및 분쟁 대응을 위한 동의 이력 관리": "Managing consent history for legal obligations and dispute handling",
    "3. 보유 및 이용기간": "3. Retention and use period",
    "수집된 개인정보는 원칙적으로 수집·이용 목적이 달성되면 지체 없이 파기합니다.": "Collected personal data is, in principle, destroyed without delay once its purpose is achieved.",
    "차주 정보·구독정보: 구독 해지 또는 만료 후 파기(분쟁·정산 목적의 단기 보관 후 삭제)": "Owner/subscription info: destroyed after cancellation or expiry (briefly retained for disputes/settlement, then deleted)",
    "연락 요청·응답 기록: 처리 후 단기간 보관 후 삭제": "Contact request/response records: briefly retained after processing, then deleted",
    "웹푸시 구독정보: 알림 해제 또는 구독 종료 시 삭제": "Web push subscription info: deleted when alerts are disabled or subscription ends",
    "동의 이력: 분쟁 대비를 위해 필요한 기간 동안 보관 후 파기": "Consent history: retained for the period needed for disputes, then destroyed",
    "관련 법령에서 별도 보존을 정한 경우 해당 기간 동안 보관": "Retained for any period separately required by applicable law",
    "4. 제3자 제공": "4. Provision to third parties",
    "서비스는 이용자의 개인정보를 외부에 제공하지 않습니다. 다만 법령에 근거가 있거나 수사기관의 적법한 요청이 있는 경우에 한하여 제공할 수 있습니다.": "The Service does not provide user personal data to outside parties, except where legally grounded or upon a lawful request by investigative authorities.",
    "5. 처리위탁": "5. Outsourced processing",
    "서비스는 안정적 운영을 위해 아래와 같이 개인정보 처리를 위탁할 수 있습니다.": "The Service may outsource personal data processing as follows for stable operation.",
    "클라우드 인프라·데이터 저장·푸시 발송: 클라우드 서비스 제공자(예: Supabase 등). 위탁 시 관련 법령에 따라 안전한 관리·감독을 수행합니다.": "Cloud infrastructure, data storage, push delivery: cloud providers (e.g., Supabase). Such outsourcing is managed and supervised safely per applicable law.",
    "6. 정보주체의 권리·행사 방법": "6. Data subject rights and how to exercise them",
    "이용자(차주)는 언제든지 본인 개인정보에 대한 열람·정정·삭제·처리정지를 요청할 수 있으며, 아래 연락처로 요청 시 지체 없이 조치합니다. 차량 토큰의 폐기·재발급으로 즉시 연결을 차단할 수 있습니다.": "Owners may request access, correction, deletion, or suspension of processing of their data at any time; requests to the contact below are handled without delay. Revoking/reissuing the vehicle token immediately blocks connection.",
    "7. 안전성 확보 조치": "7. Security measures",
    "전송 구간 암호화(HTTPS) 적용": "Transport encryption (HTTPS) applied",
    "서버 측 행 수준 보안(RLS)으로 익명 단말의 차주정보 직접·일괄 조회 차단": "Server-side row-level security (RLS) blocks anonymous clients from direct/bulk access to owner data",
    "차주정보는 토큰을 인자로 하는 보안 함수를 통해 1건씩만 접근, 관리 기능은 인증된 세션에 한정": "Owner data is accessed one record at a time via token-argument security functions; admin functions are limited to authenticated sessions",
    "관리자 접근은 PIN 및 별도 인증의 이중 통제": "Admin access is dual-controlled by PIN and separate authentication",
    "8. 개인정보 보호책임자": "8. Privacy officer",
    "개인정보 관련 문의·요청은 아래로 연락해 주시기 바랍니다.": "Please contact below for privacy inquiries/requests.",
    "담당: PARKLINK 운영자": "Contact: PARKLINK operator",
    "이메일: kangsh8880@gmail.com": "Email: kangsh8880@gmail.com",
    "9. 고지의 의무": "9. Duty of notice",
    "본 방침은 법령·서비스 변경에 따라 개정될 수 있으며, 개정 시 본 페이지를 통해 시행일과 변경 내용을 공지합니다.": "This policy may be revised per legal/service changes; revisions are announced on this page with effective date and details.",
    "※ 본 방침은 실제 사업자 정보·보유기간 등을 반영하여 공개 전 개인정보 전문가의 검토를 받을 것을 권장하는 초안입니다.": "※ This is a draft; have a privacy professional review it before publication, reflecting actual business info and retention periods.",
    "이용약관 보기 →": "View Terms →",
    "확인함 — 신청 화면으로 돌아가기": "Reviewed — back to the application",

    // ── terms ──
    "PARKLINK · 이용약관": "PARKLINK · Terms of Service",
    "본 약관은 PARKLINK(이하 “서비스”) 이용에 관한 조건과 절차, 이용자와 운영자의 권리·의무를 규정합니다.": "These Terms govern the conditions and procedures for using PARKLINK (the \"Service\") and the rights and duties of users and the operator.",
    "제1조 (목적)": "Article 1 (Purpose)",
    "본 약관은 이용자가 서비스를 이용함에 있어 운영자와 이용자 간의 권리·의무 및 책임사항, 이용조건·절차 등 기본적인 사항을 규정함을 목적으로 합니다.": "These Terms set out the basic rights, duties, responsibilities, conditions, and procedures between the operator and users in using the Service.",
    "제2조 (정의)": "Article 2 (Definitions)",
    "“차주”란 차량을 등록하고 구독하여 연락을 수신하는 이용자를 말합니다.": "\"Owner\" means a user who registers and subscribes a vehicle and receives contact.",
    "“발신자”란 주차된 차량의 식별코드(QR)를 인식하여 연락하는 자를 말합니다.": "\"Sender\" means a person who contacts by recognizing a parked vehicle's code (QR).",
    "“식별코드”란 차량별 고유 토큰을 담은 QR코드 등으로, 개인정보를 포함하지 않습니다.": "\"Code\" means a QR or similar containing a per-vehicle unique token, with no personal data.",
    "“정형 응답”이란 차주가 선택하여 회신하는 사전 정의된 메시지를 말합니다.": "\"Canned reply\" means a predefined message the owner selects to respond with.",
    "제3조 (서비스의 내용)": "Article 3 (Service description)",
    "서비스는 전화번호 노출 없이 발신자의 연락 사유를 차주에게 전달하고, 차주의 정형 응답을 발신자 화면 및 차량 표시 패널에 실시간 반영하는 익명 연락 중계 기능과, 구독 관리 및 알림 기능을 제공합니다.": "The Service provides anonymous contact relay—delivering the sender's reason to the owner without exposing phone numbers and reflecting the owner's canned reply in real time on the sender screen and vehicle panel—plus subscription management and alerts.",
    "제4조 (이용계약의 성립 및 동의)": "Article 4 (Formation and consent)",
    "이용계약은 이용자가 본 약관 및 개인정보처리방침에 동의하고 차량 등록을 완료함으로써 성립합니다. 동의는 등록 절차의 동의 항목 선택으로 이루어지며, 동의 시점·버전이 기록됩니다.": "The contract forms when a user agrees to these Terms and the Privacy Policy and completes vehicle registration. Consent is given by selecting the consent items during registration, with timestamp and version recorded.",
    "제5조 (차주의 의무)": "Article 5 (Owner's duties)",
    "본인이 정당한 권한을 가진 차량에 한하여 등록하여야 합니다.": "Register only vehicles you are duly authorized for.",
    "정확한 연락 정보를 제공하고, 변경 시 갱신하여야 합니다.": "Provide accurate contact info and update it when it changes.",
    "연락 수신 및 응답은 운전·안전에 지장이 없는 상황에서 수행하여야 합니다.": "Receive and respond to contact only when it does not impair driving or safety.",
    "제6조 (발신자의 이용)": "Article 6 (Sender's use)",
    "발신자는 정당한 주차 관련 연락 목적으로만 서비스를 이용하여야 하며, 허위·반복·괴롭힘 등 부당한 목적의 이용을 하여서는 안 됩니다. 운영자는 부당 이용을 방지하기 위한 조치(발송 제한 등)를 취할 수 있습니다.": "Senders must use the Service only for legitimate parking-related contact and must not misuse it (false, repetitive, or harassing use). The operator may take measures (e.g., send limits) to prevent misuse.",
    "제7조 (서비스의 변경·중단)": "Article 7 (Change/suspension)",
    "운영자는 운영상·기술상 필요에 따라 서비스의 전부 또는 일부를 변경·중단할 수 있으며, 중대한 변경은 사전에 공지하도록 노력합니다.": "The operator may change or suspend all or part of the Service for operational/technical needs and will endeavor to announce material changes in advance.",
    "제8조 (책임의 제한)": "Article 8 (Limitation of liability)",
    "서비스는 차주와 발신자 간의 연락을 중계하는 도구이며, 당사자 간 분쟁이나 그 결과에 대해 책임지지 않습니다.": "The Service is a tool relaying contact between owner and sender and is not responsible for disputes between parties or their outcomes.",
    "사고·화재·범죄 등 긴급상황은 본 서비스가 아니라 119·112 등 관계기관에 직접 신고하여야 합니다.": "For emergencies such as accidents, fire, or crime, report directly to authorities (e.g., 119/112), not via this Service.",
    "통신 환경·단말·제3자 서비스에 기인한 전달 지연·실패에 대해서는 운영자의 고의·중과실이 없는 한 책임이 제한됩니다.": "For delivery delays/failures due to network, device, or third-party services, liability is limited absent the operator's willful misconduct or gross negligence.",
    "제9조 (분쟁 해결 및 준거법)": "Article 9 (Disputes and governing law)",
    "본 약관은 대한민국 법령에 따라 해석되며, 서비스 이용과 관련하여 분쟁이 발생한 경우 관련 법령 및 상관례에 따릅니다.": "These Terms are construed under the laws of the Republic of Korea; disputes follow applicable law and commercial practice.",
    "제10조 (약관의 변경)": "Article 10 (Changes to Terms)",
    "운영자는 관련 법령을 위반하지 않는 범위에서 본 약관을 변경할 수 있으며, 변경 시 시행일과 내용을 본 페이지에 공지합니다.": "The operator may change these Terms within the bounds of law and will announce the effective date and details on this page.",
    "※ 본 약관은 실제 사업자 정보·정책을 반영하여 공개 전 전문가의 검토를 받을 것을 권장하는 초안입니다.": "※ This is a draft; have a professional review it before publication, reflecting actual business info and policy.",
    "개인정보처리방침 보기 →": "View Privacy Policy →"
  };

  const KEY = 'pl_lang';
  let lang = localStorage.getItem(KEY) || 'ko';

  function trNode(node) {
    const raw = node.nodeValue;
    if (!raw) return;
    const k = raw.trim();
    if (!k) return;
    if (lang === 'en') {
      if (DICT[k] !== undefined) {
        if (node.__ko === undefined) node.__ko = raw;
        node.nodeValue = raw.replace(k, DICT[k]);
      }
    } else if (node.__ko !== undefined) {
      node.nodeValue = node.__ko; node.__ko = undefined;
    }
  }

  function trAttrs(el) {
    if (!el.getAttribute) return;
    const ph = el.getAttribute('placeholder');
    if (ph != null) {
      const k = ph.trim();
      if (lang === 'en') {
        if (DICT[k] !== undefined) { if (el.__phko === undefined) el.__phko = ph; el.setAttribute('placeholder', DICT[k]); }
      } else if (el.__phko !== undefined) { el.setAttribute('placeholder', el.__phko); el.__phko = undefined; }
    }
  }

  function walk(root) {
    if (root.nodeType === 3) { trNode(root); return; }
    if (root.nodeType !== 1) return;
    if (root.id === 'pl-langbar') return; // 토글바 자체는 제외
    trAttrs(root);
    const it = document.createNodeIterator(root, NodeFilter.SHOW_TEXT);
    let n; const arr = [];
    while ((n = it.nextNode())) arr.push(n);
    arr.forEach(trNode);
    if (root.querySelectorAll) root.querySelectorAll('[placeholder]').forEach(trAttrs);
  }

  function apply() {
    document.documentElement.setAttribute('lang', lang);
    walk(document.body);
    updateBar();
  }

  function setLang(l) {
    if (l === lang) return;
    lang = l; localStorage.setItem(KEY, l);
    apply();
  }

  function updateBar() {
    const bar = document.getElementById('pl-langbar');
    if (!bar) return;
    bar.querySelectorAll('[data-l]').forEach(b => {
      b.setAttribute('aria-pressed', b.getAttribute('data-l') === lang ? 'true' : 'false');
    });
  }

  function injectBar() {
    if (document.getElementById('pl-langbar')) return;
    const css = document.createElement('style');
    css.textContent =
      '#pl-langbar{position:sticky;top:0;z-index:9999;display:flex;justify-content:flex-end;align-items:center;gap:6px;' +
      'padding:5px 12px;background:#EAF4FB;border-bottom:1px solid #D6E4F0;font:500 12px/1 "Noto Sans KR",system-ui,sans-serif}' +
      '#pl-langbar .pl-lng{color:#5b6b80;margin-right:auto;font-weight:700;letter-spacing:.02em}' +
      '#pl-langbar button{border:1px solid #C9D8EA;background:#fff;color:#365C89;border-radius:7px;padding:4px 10px;cursor:pointer;font:inherit}' +
      '#pl-langbar button[aria-pressed="true"]{background:#365C89;color:#fff;border-color:#365C89}';
    document.head.appendChild(css);
    const bar = document.createElement('div');
    bar.id = 'pl-langbar';
    bar.innerHTML = '<span class="pl-lng">🌐 Language</span>' +
      '<button type="button" data-l="ko">한국어</button>' +
      '<button type="button" data-l="en">English</button>';
    document.body.insertBefore(bar, document.body.firstChild);
    bar.addEventListener('click', e => {
      const b = e.target.closest('[data-l]'); if (b) setLang(b.getAttribute('data-l'));
    });
  }

  const mo = new MutationObserver(muts => {
    muts.forEach(m => m.addedNodes && m.addedNodes.forEach(nd => {
      if (nd.nodeType === 3) trNode(nd);
      else if (nd.nodeType === 1 && nd.id !== 'pl-langbar') walk(nd);
    }));
  });

  function tr(s) {
    if (lang === 'en' && typeof s === 'string') {
      const k = s.trim();
      if (DICT[k] !== undefined) return s.replace(k, DICT[k]);
    }
    return s;
  }

  let _wrapped = false;
  function wrapDialogs() {
    if (_wrapped) return; _wrapped = true;
    ['alert', 'confirm', 'prompt'].forEach(function (fn) {
      const orig = window[fn] && window[fn].bind(window);
      if (!orig) return;
      window[fn] = function () {
        const a = [].slice.call(arguments);
        if (a.length) a[0] = tr(a[0]);
        return orig.apply(window, a);
      };
    });
  }

  function start() {
    document.documentElement.setAttribute('translate', 'no');
    document.documentElement.classList.add('notranslate');
    wrapDialogs();
    injectBar();
    apply();
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.I18N = { apply, setLang, getLang: () => lang, t: k => (lang === 'en' && DICT[k]) || k };
})();
