/* 데모 허브 */
document.getElementById('resetBtn').addEventListener('click', function () {
  if (confirm('데모 데이터를 모두 비울까요?')) {
    PARKLINK.reset();
    alert('초기화되었습니다.');
  }
});
