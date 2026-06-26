# PARKLINK — 양방향 안심 스마트 주차패드 (방법 A: 토큰 매핑 + 월 구독)

차량별 고유 QR(토큰)로 차주에게 안심 연결하는 데모. QR에는 토큰만 담기고 전화번호 등 개인정보는 포함되지 않습니다.

## 아키텍처
- `js/common.js` 가 **서버 데이터 모델(차량 매핑 테이블 / 구독)을 모사한 store 계층**입니다.
- 데모는 localStorage에 저장되어 같은 브라우저 탭 간 실시간 동기화됩니다.
- 실제 서비스 전환 시 이 store 계층(createVehicle/listVehicles/sendRequest 등)만 백엔드 REST API로 교체하면 됩니다.

## 페이지
```
index.html       허브
subscribe.html   구독 신청 / 차량 등록 → 전용 QR 발급
admin.html       관리자: 가입자·매핑 관리, 통계, 갱신 알림, 연장/해지
sender.html?v=토큰   발신자(QR 스캔 진입) — 만료 시 연결 차단
owner.html?v=토큰    차주 — 구독 정보·갱신 배너·요청 응답·충격 알림
panel.html?v=토큰    차량 E-ink 패널 — 전용 QR + 차주 응답 표시
css/style.css · js/qrcode.min.js · js/*.js
```

## 구독 / 갱신 규칙
- 구독: 차주 전화번호 + 원하는 개월 수 입력 → 시작일~만료일 자동 산정
- 갱신 알림: 만료 **14일 전부터** 차주 화면 배너 + 관리자 갱신 목록에 노출
- 만료: 발신자 연결 차단, 패널은 "구독 만료" 표시
- 관리자에서 +개월 연장 / 해지 / (테스트용) 만료일 강제 조정 가능

## 테스트
1. `subscribe.html` 에서 차량 등록 → 발급된 패널/차주/발신자 링크 사용
2. 발신자(스캔)에서 사유 전송 → 차주에서 응답 → 패널에 즉시 표시
3. `admin.html` 의 "만료-10일/만료처리" 버튼으로 갱신 알림·만료 동작 확인

## 배포
GitHub Pages: `kangsh8880/parklink` → https://kangsh8880.github.io/parklink/
