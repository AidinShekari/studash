/* Exercise the V1.3 table with account-free sample data. */
const faDigits = StudashDate.toPersianDigits;
const toJalali = StudashDate.toJalali;
const pad2 = n => String(n).padStart(2, '0');
const WEEKDAY_LONG = StudashDate.WEEKDAYS;
const SHAMSI_MONTH_LABELS = StudashDate.MONTHS;
const results = [];
function eq(actual, expected) {
  if (actual !== expected) throw new Error('Expected ' + expected + ', got ' + actual);
}
async function test(name, run) {
  try { await run(); results.push({ name, ok: true }); }
  catch (error) { results.push({ name, ok: false, error: error.message }); }
}
(async () => {
  const html = await (await fetch('../../newtab.html')).text();
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  document.body.append(document.importNode(parsed.querySelector('.page'), true));
  const now = Date.now();
  const items = [
    { id: 'a', type: 'assign', title: 'تمرین اول', courseId: '1', courseName: 'درس اول', due: now + 86400000, submitted: false, url: 'https://vu.um.ac.ir/mod/assign/view.php?id=1' },
    { id: 'b', type: 'quiz', title: 'آزمون', courseId: '2', courseName: 'درس دوم', due: now - 86400000, submitted: true, grade: '18', url: 'https://vu.um.ac.ir/mod/quiz/view.php?id=2' },
    { id: 'c', type: 'assign', title: 'مهلت گذشته', courseId: '1', courseName: 'درس اول', due: now - 86400000, submitted: false, url: 'https://vu.um.ac.ir/mod/assign/view.php?id=3' },
  ];
  vuState.creds = { username: 'sample' };
  vuState.data = { items, lastSync: now, courses: [{ id: '1', name: 'درس اول' }, { id: '2', name: 'درس دوم' }] };
  await test('V1.3 renders all received assignments and their course names', () => {
    vuState.filter = 'all'; renderVuSection();
    eq(document.querySelectorAll('#vuTableBody tr').length, 3);
    eq(document.querySelectorAll('#vuTableBody .vu-td-course').length, 3);
    eq(document.querySelector('#vuTableBody').textContent.includes('درس اول'), true);
  });
  await test('upcoming, submitted, overdue and course filters select the correct data', () => {
    for (const [filter, id] of [['upcoming', 'a'], ['submitted', 'b'], ['overdue', 'c']]) {
      vuState.filter = filter;
      eq(vuFilteredItems().map(item => item.id).join(), id);
      renderVuSection();
      eq(document.querySelectorAll('#vuTableBody tr').length, 1);
    }
    vuState.filter = 'all'; vuState.course = '2';
    eq(vuFilteredItems().map(item => item.id).join(), 'b');
    vuState.course = '';
  });
  await test('disconnected view hides the portal table and header actions', () => {
    vuState.creds = null; renderVuSection();
    eq(document.getElementById('vuConnectedBody').hidden, true);
    eq(document.getElementById('vuHeaderActions').hidden, true);
    eq(document.getElementById('vuConnectEmpty').hidden, false);
    vuState.creds = { username: 'sample' };
  });
  await test('sync spinner and disabled state reset after a failed request', async () => {
    const button = document.getElementById('vuSyncBtn');
    const original = vuRequestSync;
    vuRequestSync = async () => ({ ok: false, error: 'اتصال قطع شد' });
    try {
      await vuSyncNow();
      eq(vuState.syncing, false);
      eq(button.disabled, false);
      eq(button.classList.contains('spinning'), false);
      eq(document.getElementById('vuError').textContent, 'اتصال قطع شد');
    } finally { vuRequestSync = original; }
  });
  await test('a partial sync warning is visible while received data remains usable', async () => {
    const original = vuRequestSync;
    vuRequestSync = async () => ({ ok: true, warning: 'اطلاعات قبلی حفظ شد' });
    try {
      await vuSyncNow();
      eq(document.getElementById('vuError').hidden, false);
      eq(document.getElementById('vuError').textContent, 'اطلاعات قبلی حفظ شد');
      renderVuSection();
      eq(document.querySelectorAll('#vuTableBody tr').length, 3);
    } finally { vuRequestSync = original; }
  });
  const output = document.createElement('pre');
  output.id = 'results'; output.textContent = JSON.stringify(results); document.body.append(output);
})().catch(error => {
  const output = document.createElement('pre');
  output.id = 'results'; output.textContent = JSON.stringify([{name:'dashboard execution',ok:false,error:error.stack}]);
  document.body.append(output);
});
