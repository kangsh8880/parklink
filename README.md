# PARKLINK — 양방향 안심 스마트 주차패드 (동작 데모)

번호는 숨기고, 소통은 양방향으로. 백엔드 없이 브라우저(localStorage 메시지 버스)에서 동작하는 프로토타입입니다.

## 테스트 방법
3개 화면을 각각 다른 탭/창에서 엽니다.
1. **발신자**(`sender.html`) — 사유 선택 후 전송
2. **차주**(`owner.html`) — 요청 수신 → 정형 응답 선택
3. **차량 패널**(`panel.html`) — 차주 응답이 즉시 표시됨

대시보드(`dashboard.html`)에서 연락 이력·충격 로그 확인, "충격 시뮬레이트" 버튼으로 G센서 알림을 테스트할 수 있습니다.

> 동기화는 같은 브라우저의 탭 간(localStorage `storage` 이벤트)에서 동작합니다. 실제 기기 간(휴대폰 스캔↔차량) 연동은 백엔드 연결 시 구현됩니다.

## 파일 구조 (멀티파일)
```
index.html        데모 허브
sender.html       발신자 화면
owner.html        차주 화면
panel.html        차량 E-ink 패널
dashboard.html    관리 대시보드
css/style.css     공통 스타일 (파스텔 테마)
js/common.js      공통 모듈 (메시지 버스·상태·유틸)
js/index.js · sender.js · owner.js · panel.js · dashboard.js
```

## GitHub Pages 배포
저장소 `kangsh8880/parklink` 에 업로드 후 Settings → Pages → Branch `main` / `/ (root)` 선택.
배포 URL: `https://kangsh8880.github.io/parklink/`
