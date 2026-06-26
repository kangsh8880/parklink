/* 허브 */
document.getElementById('resetBtn').addEventListener('click', async function () {
  if (!confirm('데모 데이터(차량·구독·요청)를 모두 비울까요?')) return;
  try { await PARKLINK.reset(); alert('초기화되었습니다.'); }
  catch (e) { alert('초기화 실패: ' + e.message); }
});
