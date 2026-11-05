/* Render the real dashboard markup with local sample data; no account or network sync. */
const faDigits = StudashDate.toPersianDigits;
const toJalali = StudashDate.toJalali;
const pad2 = (n) => String(n).padStart(2, '0');
const WEEKDAY_LONG = StudashDate.WEEKDAYS;
const SHAMSI_MONTH_LABELS = StudashDate.MONTHS;
const results = [];
function eq(actual, expected) {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); }
  catch (e) { results.push({ name, ok: false, error: e.message }); }
}
(async () => {
  if (document.readyState !== 'complete') await new Promise(resolve => window.addEventListener('load', resolve, { once: true }));
  const html = await (await fetch('../../newtab.html')).text();
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  document.body.append(document.importNode(parsed.querySelector('.page'), true));
  const now = Date.now();
  const items = Array.from({ length: 12 }, (_, i) => ({
    title: `تمرین شماره ${i} با عنوان طولانی برای بررسی فاصله‌گذاری و نمایش متن فارسی در کارت تکالیف`,
    courseId: i % 2 ? 'a' : 'b', courseName: 'درس نمونه با نام طولانی',
    due: now + (12 - i) * 86400000, type: i % 3 ? 'assignment' : 'quiz',
    submitted: false, url: 'https://vu.um.ac.ir/mod/assign/view.php?id=' + i,
  }));
  vuState.creds = { username: 'دانشجو' };
  vuState.data = { items, lastSync: now, courses: [{ id: 'a', name: 'درس اول' }, { id: 'b', name: 'درس دوم' }] };
  vuState.filter = 'all';
  localStorage.removeItem('vuFilter');
  initVuListControls();
  vuState.filter = 'all';
  renderVuSection();
  const count = () => document.querySelectorAll('#vuTaskList > li').length;
  const next = document.getElementById('vuNextPage');
  test('first page has five sorted items, total count, and disabled previous', () => {
    eq(count(), 5);
    eq(document.querySelector('.vu-task-name').textContent, items[11].title);
    eq(document.getElementById('vuPrevPage').disabled, true);
    eq(document.getElementById('vuPagination').hidden, false);
    eq(document.getElementById('vuPageSummary').textContent.includes(faDigits(12)), true);
  });
  test('next and previous controls paginate without wrapping', () => {
    next.click(); eq(count(), 5); eq(vuState.page, 2);
    next.click(); eq(count(), 2); eq(vuState.page, 3); eq(next.disabled, true);
    next.click(); eq(vuState.page, 3);
    document.getElementById('vuPrevPage').click(); eq(vuState.page, 2);
  });
  test('course filter resets page and filters the full collection', () => {
    const select = document.getElementById('vuCourseFilter');
    select.value = 'a'; select.dispatchEvent(new Event('change'));
    eq(vuState.page, 1); eq(count(), 5);
    next.click(); eq(count(), 1);
    eq(document.querySelector('.vu-task-name').textContent, items[1].title);
  });
  test('empty status filter resets page and hides pagination', () => {
    document.querySelector('[data-filter="submitted"]').click();
    eq(vuState.page, 1); eq(count(), 0);
    eq(document.getElementById('vuPagination').hidden, true);
    eq(document.getElementById('vuTableEmpty').hidden, false);
  });
  test('shrinking data clamps the current page and hides single-page navigation', () => {
    vuState.course = ''; vuState.filter = 'all'; vuState.page = 3;
    vuState.data.items = items.slice(0, 4); renderVuSection();
    eq(vuState.page, 1); eq(count(), 4);
    eq(document.getElementById('vuPagination').hidden, true);
  });
  test('assignments stay beneath today’s tasks in the same sidebar', () => {
    eq(document.getElementById('tasksPanel').nextElementSibling.id, 'vuSection');
    eq(document.getElementById('vuSection').parentElement.className, 'sidebar-left');
  });
  // Exercise the actual calendar renderer without starting account sync or app timers.
  const appSource = await (await fetch('../../app.js')).text();
  const constantsStart = appSource.indexOf('const MONTH_LABELS =');
  const digitsEnd = appSource.indexOf('// ------------------------------------------------', appSource.indexOf('const faDigits ='));
  const renderStart = appSource.indexOf('function renderCalendar() {');
  const renderEnd = appSource.indexOf('let calendarFocusIso =', renderStart);
  let clickedDate = null;
  const calendarState = {
    calendarGrid: document.getElementById('calendarGrid'),
    monthLabel: document.getElementById('monthLabel'), monthSubLabel: document.getElementById('monthSubLabel'),
    calendarMode: 'shamsi', shamsiYear: 1405, shamsiMonth: 8, viewYear: 2026, viewMonth: 10,
    calendarFocusIso: null, selectedDate: new Date(2026, 10, 5),
    daysWithTasksThisMonth: new Set(['2026-11-05']),
    updateCalendarModeButtons() {},
    toJalali: StudashDate.toJalali, toGregorian: StudashDate.toGregorian,
    jalaliMonthDays: StudashDate.jalaliMonthLength, isoDate: StudashDate.isoDate,
    sameDay: (a, b) => StudashDate.isoDate(a) === StudashDate.isoDate(b),
    getAllScheduledExams: () => [{ exam: { date: '2026-11-05' } }],
    vuDeadlineDays: () => new Set(['2026-11-05']),
    selectCalendarDate: date => { clickedDate = date; },
  };
  const calendar = new Function('state', appSource.slice(constantsStart, digitsEnd) +
    'with (state) {' + appSource.slice(renderStart, renderEnd) + 'return {renderCalendar, faDigits};}')(calendarState);
  test('display formatter normalizes Persian and Arabic digits to English', () => {
    eq(calendar.faDigits('۱۴۰۵ / ٢٠٢٦'), '1405 / 2026');
  });
  test('Shamsi and Gregorian months have six complete rows and English numbers', () => {
    for (const [mode, year, month] of [['shamsi',1399,12],['shamsi',1400,1],['shamsi',1405,8],['gregorian',2024,1],['gregorian',2026,11]]) {
      calendarState.calendarMode = mode;
      calendarState.shamsiYear = year; calendarState.shamsiMonth = month;
      calendarState.viewYear = year; calendarState.viewMonth = month;
      calendar.renderCalendar();
      eq(document.querySelectorAll('.cal-row').length, 6);
      eq(document.querySelectorAll('.cal-day').length, 42);
      eq(/[۰-۹٠-٩]/.test(calendarState.calendarGrid.textContent + calendarState.monthLabel.textContent + calendarState.monthSubLabel.textContent), false);
      eq(document.querySelectorAll('.cal-day[tabindex="0"]').length, 1);
    }
  });
  test('calendar preserves event markers, selection, and date click targets', () => {
    calendarState.calendarMode = 'shamsi'; calendarState.shamsiYear = 1405; calendarState.shamsiMonth = 8;
    calendar.renderCalendar();
    const day = document.querySelector('.cal-day[data-iso="2026-11-05"]');
    eq(day.getAttribute('aria-selected'), 'true');
    eq(day.querySelectorAll('.cal-mark').length, 3);
    day.click(); eq(StudashDate.isoDate(clickedDate), '2026-11-05');
  });
  const todayCalls = [];
  const todayStart = appSource.indexOf('async function goToCalendarToday()');
  const todayEnd = appSource.indexOf('document.getElementById("calendarToday")', todayStart);
  const returnToday = new Function('showMonthOf', 'loadTasksForMonth', 'selectCalendarDate',
    appSource.slice(todayStart, todayEnd) + 'return goToCalendarToday;')(
      date => todayCalls.push(['month', StudashDate.isoDate(date)]),
      async () => todayCalls.push(['load']),
      async date => todayCalls.push(['select', StudashDate.isoDate(date)]));
  await returnToday();
  test('Today restores the current month and refreshes the selected date', () => {
    eq(todayCalls.map(call => call[0]).join(','), 'month,load,select');
    eq(todayCalls[0][1], StudashDate.isoDate(new Date()));
    eq(todayCalls[2][1], todayCalls[0][1]);
  });
  const scheduleState = {
    scheduleGrid: document.getElementById('scheduleGrid'), scheduleEmpty: null,
    scheduleClasses: [
      { id:'morning', title:'کلاس صبح', instructor:'استاد نمونه', units:3, tasks:[], sessions:[{day:0,startTime:'09:30',endTime:'11:00',location:'کلاس 101'}] },
      { id:'late', title:'کلاس عصر', units:3, tasks:[], sessions:[{day:1,startTime:'20:30',endTime:'22:00',location:'کلاس 202'}] },
      { id:'off', title:'این هفته نیست', units:3, tasks:[], sessions:[{day:0,startTime:'06:00',endTime:'07:00'}] },
    ],
    SCHEDULE_DAYS: [{index:0,name:'شنبه'},{index:1,name:'یکشنبه'}],
    normalizeCourse: course => course, normalizeCourseSessions: course => course.sessions,
    sessionMeetsOnDay: course => course.id !== 'off',
    getCurrentIranianDayIndex: () => 0,
    updateTodayClassesSummary() {}, updateNowMarker() {}, renderSidebarCourseTasks() {},
    vuItemsDueOn: () => [], vuDateForScheduleDay: () => new Date(), vuBuildScheduleDeadlines: () => null,
  };
  const scheduleHelpers = appSource.slice(appSource.indexOf('function displayScheduleTime('), appSource.indexOf('// ---------------------------------------------------------------', appSource.indexOf('function getGridSpanForClass(')));
  const universityRenderer = appSource.slice(appSource.indexOf('function renderUniversityScheduleTable()'), appSource.indexOf('function getCurrentWeekDays('));
  const renderWeek = new Function('state', 'with(state){' + scheduleHelpers + universityRenderer + 'return renderUniversityScheduleTable;}')(scheduleState);
  test('weekly table trims its header and aligns cards and guides with active classes', () => {
    renderWeek();
    const table = scheduleState.scheduleGrid.querySelector('.schedule-grid-container');
    eq(table.dataset.startHour, '9'); eq(table.dataset.endHour, '22');
    eq(table.querySelectorAll('.sched-hour-header').length, 13);
    eq(table.querySelectorAll('.class-card').length, 2);
    eq(table.querySelector('.sched-slot-guidelines').children.length, 13);
    eq(table.querySelector('.class-card').style.gridColumn, '1 / 3');
  });
  test('class titles use the full row and details align when an instructor is missing', () => {
    const cards = [...scheduleState.scheduleGrid.querySelectorAll('.class-card')];
    for (const card of cards) {
      const top = card.querySelector('.class-card-top');
      const title = card.querySelector('.class-title .sd-card__link');
      eq(Math.abs(title.getBoundingClientRect().width - top.getBoundingClientRect().width) < 1, true);
      eq(getComputedStyle(title).whiteSpace, 'nowrap');
      eq(title.scrollWidth <= title.clientWidth, true);
      eq(card.querySelector('.class-card-actions').parentElement.className, 'class-card-bottom');
    }
    const roomOffsets = cards.map(card => card.querySelector('.class-room').getBoundingClientRect().top - card.getBoundingClientRect().top);
    eq(Math.abs(roomOffsets[0] - roomOffsets[1]) < 1, true);
    eq(getComputedStyle(cards[0].querySelector('.class-instructor')).textAlign, 'start');
  });
  test('midnight deadlines stay below the cards and do not widen the weekly hours', () => {
    const due = (h, m) => { const d = new Date(); d.setHours(h,m,0,0); return d.getTime(); };
    const deadlines = [
      {title:'مهلت اول',courseName:'درس',due:due(0,0),url:'https://vu.um.ac.ir/1'},
      {title:'مهلت دوم',courseName:'درس',due:due(23,59),url:'https://vu.um.ac.ir/2'},
      {title:'مهلت عصر',courseName:'درس',due:due(18,0),url:'https://vu.um.ac.ir/3'},
    ];
    const previous = scheduleState.vuItemsDueOn;
    scheduleState.vuItemsDueOn = () => deadlines;
    renderWeek();
    const table = scheduleState.scheduleGrid.querySelector('.schedule-grid-container');
    eq(table.dataset.startHour,'9'); eq(table.dataset.endHour,'22');
    const build = new Function('vuItemsDueOn','vuDateForScheduleDay','return ' + vuBuildScheduleDeadlines.toString())(() => deadlines, () => new Date());
    const group = build(0,{start:9,end:22,columns:13});
    eq(group.querySelectorAll('.vu-sched-night-list .vu-sched-chip').length,2);
    eq(group.lastElementChild.className,'vu-sched-night-list');
    eq(group.querySelector('.vu-sched-night-list .vu-sched-chip').style.gridColumn,'');
    eq(group.firstElementChild.style.gridColumn,'10 / 11');
    scheduleState.scheduleClasses = [];
    scheduleState.vuItemsDueOn = () => deadlines.slice(0,2);
    renderWeek();
    eq(scheduleState.scheduleGrid.querySelectorAll('.sched-hour-sub').length,0);
    eq(scheduleState.scheduleGrid.querySelector('.schedule-grid-container').hidden,false);
    scheduleState.vuItemsDueOn = previous;
  });
  test('deadline-only weeks use their due hour and empty weeks show a compact message', () => {
    scheduleState.scheduleClasses = [];
    const due = new Date(); due.setHours(18,30,0,0);
    scheduleState.vuItemsDueOn = () => [{due:due.getTime()}]; renderWeek();
    const table = scheduleState.scheduleGrid.querySelector('.schedule-grid-container');
    eq(table.dataset.startHour,'18'); eq(table.dataset.endHour,'19');
    scheduleState.vuItemsDueOn = () => []; renderWeek();
    eq(scheduleState.scheduleGrid.querySelector('.schedule-grid-container').hidden,true);
    eq(scheduleState.scheduleGrid.querySelector('.empty-hint').textContent.includes('این هفته'),true);
  });
  const eventHelper = appSource.slice(appSource.indexOf('function getPersonalDayEvents('), appSource.indexOf('async function renderPersonalScheduleTable('));
  const personalDay = new Function('getAllScheduledExams', eventHelper + 'return getPersonalDayEvents;')(() => []);
  test('personal events keep all-day entries untimed and split overnight times by day', () => {
    const events = [
      {id:'night',start:{dateTime:'2026-11-05T23:00:00'},end:{dateTime:'2026-11-06T01:00:00'}},
      {id:'all',start:{date:'2026-11-05'},end:{date:'2026-11-07'}},
    ];
    const first = personalDay({isoDate:'2026-11-05'},events);
    const second = personalDay({isoDate:'2026-11-06'},events);
    eq(first[0].startTime,'23:00'); eq(first[0].endTime,'24:00');
    eq(second[0].startTime,'00:00'); eq(second[0].endTime,'01:00');
    eq(first[1].isAllDay,true); eq(first[1].startTime,null);
    eq(second[1].isAllDay,true);
  });
  const agendaState = {
    renderAllTasksSeq:0, allTasksUnifiedList:document.getElementById('allTasksUnifiedList'),
    allTasksSelectedDateLabel:document.getElementById('allTasksSelectedDateLabel'),
    allTasksUnifiedEmpty:document.getElementById('allTasksUnifiedEmpty'),
    selectedDate:new Date(), tasksCache:{}, currentTaskFilter:'all', ideaProjects:[], cachedGcalEventsForSelectedDate:[],
    sameDay:calendarState.sameDay, isoDate:StudashDate.isoDate,
    taskKey:date => 'tasks:' + StudashDate.isoDate(date),
    getAllScheduledExams:() => [],
    scheduleClasses:[{tasks:[{id:'assignment',title:'تکلیف تکراری',done:false}]}],
    storageGet:async key => ({[key]:[{id:'daily',text:'کار روزانه',done:false}]}),
    badgeDailyTasksCount:document.getElementById('badgeDailyTasksCount'),
    badgeGcalCount:document.getElementById('badgeGcalCount'),
    badgeAllTasksCount:document.getElementById('badgeAllTasksCount'),
    vuAppendSidebarSection:() => { throw new Error('Assignments must not be appended to Today'); },
  };
  const agendaSource=appSource.slice(appSource.indexOf('async function renderAllTasksUnified()'),appSource.indexOf('function renderSidebarCourseTasks()'));
  const renderAgenda=new Function('state','with(state){'+agendaSource+'return renderAllTasksUnified;}')(agendaState);
  await renderAgenda();
  test('Today contains daily tasks without duplicated assignments or an assignment tab', () => {
    eq(document.getElementById('tabFilterCourse'),null);
    eq(agendaState.allTasksUnifiedList.querySelectorAll('.task-item').length,1);
    eq(agendaState.allTasksUnifiedList.querySelectorAll('.sidebar-course-task-item').length,0);
    eq(agendaState.badgeAllTasksCount.textContent,faDigits(1));
    eq(document.querySelectorAll('#vuTaskList .vu-task-row').length > 0,true);
  });
  test('course name precedes its assignment title with spacing on the same line', () => {
    const link=document.querySelector('.vu-task-title');
    eq(link.firstElementChild.className,'vu-task-course');
    eq(link.lastElementChild.className,'vu-task-name');
    eq(link.firstElementChild.textContent,'درس نمونه با نام طولانی');
    eq(getComputedStyle(link).display,'flex');
    eq(getComputedStyle(link).columnGap,'8px');
  });
  const loadedEmojiFonts = await document.fonts.load('16px "Twemoji"', '🛠️👨‍🏫🇮🇷');
  test('local Twemoji font loads and replaces line icons', () => {
    eq(loadedEmojiFonts.length > 0, true);
    eq(loadedEmojiFonts.every(font => font.status === 'loaded'), true);
    const icon = document.querySelector('.twemoji-icon');
    eq(!!icon, true);
    eq(getComputedStyle(icon).fontFamily.startsWith('Twemoji'), true);
    const masked = document.createElement('span');
    masked.className = 'sd-icon sd-icon--calendar';
    document.body.append(masked);
    eq(getComputedStyle(masked).maskImage, 'none');
    masked.remove();
  });
  const width = Number(new URLSearchParams(location.search).get('width') || 1440);
  if (width < innerWidth) { document.body.style.width = width + 'px'; document.body.style.marginRight = 'auto'; }
  const mode = new URLSearchParams(location.search).get('mode') || 'dark';
  document.documentElement.className = mode;
  document.documentElement.dataset.theme = 'studash-' + mode;
  vuState.data.items = items; renderVuSection();
  document.querySelector('.clock').textContent = '12:45';
  document.querySelector('.greeting').textContent = 'روز خوبی داشته باشی';
  calendar.renderCalendar();
  for (const scale of ['compact', 'normal', 'large']) {
    document.documentElement.dataset.scale = scale;
    test(`cards fit ${width}px / ${mode} / ${scale}`, () => {
      for (const selector of ['.sidebar-left', '.calendar-panel', '#vuSection']) {
        const el = document.querySelector(selector);
        if (el.scrollWidth > el.clientWidth + 1) throw new Error(`${selector} overflows: ${el.scrollWidth}/${el.clientWidth}`);
        const rect = el.getBoundingClientRect();
        if (rect.left < 0 || rect.right > width + 1) throw new Error(`${selector} outside viewport: ${rect.left}..${rect.right}`);
      }
      const tasks = document.getElementById('tasksPanel').getBoundingClientRect();
      const vu = document.getElementById('vuSection').getBoundingClientRect();
      eq(vu.top >= tasks.bottom, true);
    });
  }
  document.documentElement.dataset.scale = 'normal';
  const out = document.createElement('pre'); out.id = 'results';
  out.textContent = JSON.stringify(results); document.body.append(out);
})().catch((e) => {
  const out = document.createElement('pre'); out.id = 'results';
  out.textContent = JSON.stringify([{ name: 'setup', ok: false, error: e.stack }]); document.body.append(out);
});
