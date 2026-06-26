/* 허브 */
document.getElementById('resetBtn').addEventListener('click', function () {
  if (confirm('데모 데이터(차량·구독·요청)를 모두 비울까요?')) {
    PARKLINK.reset();
    alert('초기화되었습니다.');
  }
});
