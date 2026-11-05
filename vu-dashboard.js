// ===============================================================
// StuDash — VU homework on the new-tab dashboard.
// Loaded before app.js; uses app.js globals (toJalali, faDigits, isoDate,
// scheduleClasses, renderScheduleTable, …) only inside functions that run
// after app.js has initialised.
// ===============================================================

const vuState = {
  creds: null,
  data: null,
  filter: "upcoming", // "upcoming" | "submitted" | "overdue" | "all"
  course: "",
  syncing: false,
  page: 1,
};
const VU_PAGE_SIZE = 5;

const VU_AUTO_SYNC_AGE = 15 * 60 * 1000;

async function loadVuState() {
  const d = await chrome.storage.local.get(["vuCredentials", "vuData", "pooyaCredentials", "pooyaTerm", "weekParityRef"]);
  vuState.creds = d.vuCredentials || null;
  vuState.data = d.vuData || null;
  vuState.pooyaCreds = d.pooyaCredentials || null;
  vuState.pooyaTerm = d.pooyaTerm || null;
  vuState.parityRef = d.weekParityRef || null;
}

const vuIsConnected = () => Boolean(vuState.creds);
const vuItems = () => (vuState.creds && vuState.data && vuState.data.items) || [];

// ---------------------------------------------------------------
// Course colours: reuse the colour of a matching StuDash class, else hash.
// ---------------------------------------------------------------
function vuNormalizeTitle(t = "") {
  return String(t)
    .replace(/\([^)]*\)/g, "")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .replace(/[\s‌\-_.]+/g, "")
    .toLowerCase();
}

function vuMatchClass(courseName) {
  const key = vuNormalizeTitle(courseName);
  if (!key || typeof scheduleClasses === "undefined") return null;
  return (
    scheduleClasses.find((c) => {
      const k = vuNormalizeTitle(c.title);
      return k && (k === key || key.includes(k) || k.includes(key));
    }) || null
  );
}

function vuCourseColor(item) {
  const cls = vuMatchClass(item.courseName);
  if (cls && cls.color) return cls.color;
  let h = 0;
  for (const ch of String(item.courseId || item.courseName)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h}, 65%, 66%)`;
}

// ---------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------
function vuStatusInfo(item) {
  const status = VU.itemStatus(item);
  const quiz = item.type === "quiz";
  const grade = item.grade ? ` · نمره: ${faDigits(item.grade)}` : "";
  // Colour meaning is shared app-wide (SDUI.STATUS_COLOR): success = done, warning = needs
  // attention soon, danger = overdue/urgent, accent = open, default = neutral.
  switch (status) {
    case "submitted":
      return { status, color: "success", text: (quiz ? "شرکت کرده" : "ارسال شده") + grade };
    case "overdue":
      return { status, color: "danger", text: quiz ? "بسته شد" : "مهلت گذشته" };
    case "draft":
      return { status, color: "warning", text: "پیش‌نویس، ارسال نشده" };
    default:
      return { status, color: "accent", text: quiz ? "شرکت نکرده" : "ارسال نشده" };
  }
}

const VU_LEFT_COLOR = { overdue: "danger", urgent: "danger", soon: "warning", normal: "default", none: "default" };
const vuTypeChip = (item) => SDUI.chip(item.type === "quiz" ? "آزمون" : "تکلیف", { color: "default", variant: "" });
const vuStatusChip = (info) => SDUI.chip(info.text, { color: info.color });
function vuLeftChip(item, now = Date.now()) {
  const left = VU.formatTimeLeft(item.due, now);
  if (item.submitted) return SDUI.chip(item.due && item.due >= now ? left.text : "—", { color: "default", variant: "tertiary" });
  return SDUI.chip(left.text, { color: VU_LEFT_COLOR[left.level] || "default" });
}

function vuTimeOfDay(ms) {
  const d = new Date(ms);
  return faDigits(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`);
}

function vuFormatDue(ms) {
  if (!ms) return "—";
  const d = new Date(ms);
  const j = toJalali(d);
  return `${WEEKDAY_LONG[d.getDay()]} ${faDigits(j.jd)} ${SHAMSI_MONTH_LABELS[j.jm - 1]} • ${vuTimeOfDay(ms)}`;
}

function vuFilteredItems() {
  const now = Date.now();
  let items = vuItems();
  if (vuState.course) items = items.filter((it) => String(it.courseId) === vuState.course);
  const byDueAsc = (a, b) => (a.due || Infinity) - (b.due || Infinity);
  const byDueDesc = (a, b) => (b.due || 0) - (a.due || 0);

  switch (vuState.filter) {
    case "submitted":
      return items.filter((it) => it.submitted).sort(byDueDesc);
    case "overdue":
      return items.filter((it) => !it.submitted && it.due && it.due < now).sort(byDueDesc);
    case "all":
      return [...items].sort(byDueAsc);
    default: {
      // Upcoming: everything still open — unsubmitted first, then the ones already sent.
      const open = items.filter((it) => !it.due || it.due >= now);
      return [
        ...open.filter((it) => !it.submitted).sort(byDueAsc),
        ...open.filter((it) => it.submitted).sort(byDueAsc),
      ];
    }
  }
}

// ---------------------------------------------------------------
// Main VU card
// ---------------------------------------------------------------
function vuEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

// One VU item as a compact row: [course dot] title / course · deadline [badge] [calendar]
function vuBuildListRow(item, now = Date.now()) {
  const info = vuStatusInfo(item);
  const li = vuEl("li", `vu-item vu-item--${info.status}`);
  li.style.setProperty("--course-color", vuCourseColor(item));

  li.appendChild(vuEl("span", "vu-item__dot"));

  const main = vuEl("div", "vu-item__main");
  const link = vuEl("a", "vu-item__title", item.title);
  link.href = item.url;
  link.target = "_blank";
  link.rel = "noopener";
  link.title = item.title;
  const meta = vuEl("div", "vu-item__meta");
  meta.append(vuEl("span", "vu-item__course", item.courseName || ""));
  const due = vuEl("span", "vu-item__due", item.due ? vuFormatDue(item.due) : item.dueText || "بدون مهلت");
  meta.append(due);
  if (item.type === "quiz") meta.append(vuEl("span", "vu-item__type", "آزمون"));
  main.append(link, meta);

  const side = vuEl("div", "vu-item__side");
  // One restrained badge: done / overdue / time left
  if (info.status === "submitted" || info.status === "overdue") side.appendChild(vuStatusChip(info));
  else side.appendChild(vuLeftChip(item, now));
  const gcal = VU.googleCalendarUrl(item);
  if (gcal && info.status !== "submitted" && item.due >= now) {
    const a = vuEl("a", "vu-item__action", "📅");
    a.href = gcal;
    a.target = "_blank";
    a.rel = "noopener";
    a.title = "افزودن به Google Calendar";
    a.setAttribute("aria-label", `افزودن «${item.title}» به Google Calendar`);
    side.appendChild(a);
  }
  li.append(main, side);
  return li;
}

function renderVuSection() {
  const section = document.getElementById("vuSection");
  if (!section) return;
  const connected = vuIsConnected();
  document.getElementById("vuConnectEmpty").hidden = connected;
  document.getElementById("vuConnectedBody").hidden = !connected;
  document.getElementById("vuHeaderActions").hidden = !connected;

  const subtitle = document.getElementById("vuSubtitle");
  if (!connected) {
    subtitle.textContent = "سامانه آموزش مجازی دانشگاه فردوسی";
    return;
  }

  const data = vuState.data;
  const name = (data && data.fullName) || vuState.creds.fullName || vuState.creds.username || "";
  subtitle.textContent = data && data.lastSync
    ? `${name ? name + " • " : ""}آخرین همگام‌سازی: ${VU.relativeTime(data.lastSync)}`
    : "در حال دریافت تکالیف از VU…";

  // Stats
  const now = Date.now();
  const items = vuItems();
  const pending = items.filter((it) => !it.submitted && it.due && it.due >= now);
  const urgent = pending.filter((it) => it.due - now < 3 * 86400000);
  const submitted = items.filter((it) => it.submitted);
  const stats = document.getElementById("vuStats");
  stats.innerHTML = "";
  for (const [label, count, color] of [
    ["در انتظار", pending.length, "accent"],
    ["تا 3 روز", urgent.length, urgent.length ? "danger" : "default"],
    ["ارسال‌شده", submitted.length, "success"],
  ]) {
    const chip = SDUI.chip(`${faDigits(count)} ${label}`, { color });
    chip.setAttribute("role", "listitem");
    stats.appendChild(chip);
  }

  // Course filter options
  const select = document.getElementById("vuCourseFilter");
  const courses = (data && data.courses) || [];
  const want = ["", ...courses.map((c) => String(c.id))].join("|");
  if (select.dataset.courses !== want) {
    select.innerHTML = '<option value="">همه درس‌ها</option>';
    for (const c of courses) {
      const opt = document.createElement("option");
      opt.value = String(c.id);
      opt.textContent = c.shortName || c.name;
      select.appendChild(opt);
    }
    select.dataset.courses = want;
  }
  select.value = vuState.course;

  SDUI.setSelected(document.querySelectorAll("#vuFilterChips .vu-chip"), (opt) => opt.dataset.filter === vuState.filter);

  // Filter and sort the complete collection before selecting the current page.
  const list = document.getElementById("vuTaskList");
  const empty = document.getElementById("vuTableEmpty");
  list.replaceChildren();
  const rows = vuFilteredItems();
  const pageCount = Math.max(1, Math.ceil(rows.length / VU_PAGE_SIZE));
  vuState.page = Math.max(1, Math.min(vuState.page, pageCount));
  const offset = (vuState.page - 1) * VU_PAGE_SIZE;

  for (const item of rows.slice(offset, offset + VU_PAGE_SIZE)) {
    const info = vuStatusInfo(item);
    const row = vuEl("li", `vu-task-row vu-task-row--${info.status}`);
    row.style.setProperty("--course-color", vuCourseColor(item));
    const heading = vuEl("div", "vu-task-heading");
    const link = vuEl("a", "vu-task-title");
    const courseName = item.courseName || "درس نامشخص";
    const course = vuEl("span", "vu-task-course", courseName);
    course.title = courseName;
    link.append(course, vuEl("span", "vu-task-name", item.title));
    link.title = `${courseName} — ${item.title}`;
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener";
    heading.append(link, vuTypeChip(item));

    const due = vuEl("div", "vu-task-due", `مهلت: ${!item.due && item.dueText ? item.dueText : vuFormatDue(item.due)}`);
    const footer = vuEl("div", "vu-task-footer");
    footer.append(vuLeftChip(item, now), vuStatusChip(info));
    const gcal = VU.googleCalendarUrl(item);
    if (gcal && info.status !== "submitted" && item.due >= now) {
      const action = vuEl("a", "vu-calendar-link", "افزودن به تقویم");
      action.href = gcal;
      action.target = "_blank";
      action.rel = "noopener";
      action.setAttribute("aria-label", `افزودن ${item.title} به Google Calendar`);
      footer.appendChild(action);
    }
    row.append(heading, due, footer);
    list.appendChild(row);
  }

  document.getElementById("vuPagination").hidden = rows.length <= VU_PAGE_SIZE;
  document.getElementById("vuPrevPage").disabled = vuState.page === 1;
  document.getElementById("vuNextPage").disabled = vuState.page === pageCount;
  document.getElementById("vuPageSummary").textContent = `صفحه ${faDigits(vuState.page)} از ${faDigits(pageCount)} · ${faDigits(rows.length)} مورد`;

  const emptyText = {
    upcoming: "🎉 تکلیف یا آزمون پیش رویی نداری!",
    submitted: "هنوز تکلیفی ارسال نشده.",
    overdue: "👌 هیچ تکلیفی از مهلتش جا نمانده.",
    all: "تکلیفی در درس‌های VU پیدا نشد.",
  };
  empty.hidden = rows.length > 0;
  empty.textContent = data && data.lastSync ? emptyText[vuState.filter] : "⏳ در حال دریافت اطلاعات از VU…";
}

// ---------------------------------------------------------------
// Weekly schedule table: deadline chips under each day's classes
// ---------------------------------------------------------------
function vuDateForScheduleDay(dayIndex) {
  const current = getCurrentIranianDayIndex();
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  // On Friday the visible Sat–Thu week is the upcoming one.
  d.setDate(d.getDate() + (dayIndex - current) + (current === 6 ? 7 : 0));
  return d;
}

function vuItemsDueOn(date) {
  const iso = isoDate(date);
  return vuItems()
    .filter((it) => it.due && isoDate(new Date(it.due)) === iso)
    .sort((a, b) => a.due - b.due);
}

// End-of-day Moodle deadlines are list entries, so they do not widen the timetable.
function vuIsMidnightDeadline(item) {
  if (!item.due) return false;
  const due = new Date(item.due);
  return (due.getHours() === 0 && due.getMinutes() === 0)
    || (due.getHours() === 23 && due.getMinutes() === 59);
}

function vuBuildScheduleDeadlines(dayIndex, range) {
  if (!vuIsConnected()) return null;
  const items = vuItemsDueOn(vuDateForScheduleDay(dayIndex));
  if (!items.length) return null;

  const wrap = vuEl("div", "vu-sched-deadlines");
  const midnightList = vuEl("div", "vu-sched-night-list");
  midnightList.setAttribute("role", "group");
  midnightList.setAttribute("aria-label", "مهلت‌های نیمه‌شب");
  for (const item of items) {
    const info = vuStatusInfo(item);
    const chip = vuEl("a", `vu-sched-chip vu-sched-${info.status}`);
    const midnight = vuIsMidnightDeadline(item);
    if (!midnight) {
      const due = new Date(item.due);
      const start = due.getHours() + due.getMinutes() / 60;
      const { startCol, endCol } = StudashSchedule.span({ start, end: Math.min(24, start + 1 / 60) }, range);
      chip.style.gridColumn = `${startCol} / ${endCol}`;
    }
    chip.href = item.url;
    chip.target = "_blank";
    chip.rel = "noopener";
    chip.style.setProperty("--course-color", vuCourseColor(item));
    chip.title = `${item.courseName}\n${item.title}\n${vuFormatDue(item.due)}\n${info.text}`;
    const icon = info.status === "submitted" ? "✅" : item.type === "quiz" ? "🧪" : "📝";
    chip.append(
      vuEl("span", "vu-sched-icon", icon),
      vuEl("span", "vu-sched-title", item.title),
      vuEl("span", "vu-sched-time", `مهلت ${vuTimeOfDay(item.due)}`)
    );
    chip.addEventListener("click", (e) => e.stopPropagation());
    (midnight ? midnightList : wrap).appendChild(chip);
  }
  if (midnightList.children.length) {
    midnightList.prepend(vuEl("span", "vu-sched-night-label", "مهلت‌های نیمه‌شب"));
    wrap.appendChild(midnightList);
  }
  return wrap;
}

// ---------------------------------------------------------------
// Calendar dots + sidebar + course hub
// ---------------------------------------------------------------
function vuDeadlineDays() {
  const set = new Set();
  for (const it of vuItems()) if (it.due && !it.submitted) set.add(isoDate(new Date(it.due)));
  return set;
}

function vuPendingCount() {
  const now = Date.now();
  return vuItems().filter((it) => !it.submitted && it.due && it.due >= now).length;
}

function vuBuildSidebarRow(item) {
  const info = vuStatusInfo(item);
  const li = vuEl("li", "sidebar-course-task-item vu-sidebar-item" + (item.submitted ? " vu-sidebar-done" : ""));
  li.style.setProperty("--course-color", vuCourseColor(item));

  const top = vuEl("div", "sidebar-task-top");
  top.append(
    SDUI.chip(item.courseName, { color: "default", className: "sidebar-course-pill" }),
    vuTypeChip(item),
    SDUI.chip("VU", { color: "accent", className: "vu-badge" })
  );

  const main = vuEl("div", "sidebar-task-main");
  const link = vuEl("a", "sidebar-task-title vu-sidebar-link", item.title);
  link.href = item.url;
  link.target = "_blank";
  link.rel = "noopener";
  main.append(vuEl("span", "vu-sidebar-icon", info.status === "submitted" ? "✅" : "⏳"), link);

  const footer = vuEl("div", "sidebar-task-footer");
  if (item.submitted) {
    footer.appendChild(vuStatusChip(info));
  } else {
    const chip = vuLeftChip(item);
    if (item.due) chip.querySelector(".chip__label").textContent += ` • ${vuTimeOfDay(item.due)}`;
    footer.appendChild(chip);
  }
  li.append(top, main, footer);
  return li;
}

// Returns 1 if a section was appended (for the sidebar's visible-section counter).
function vuAppendSidebarSection(fragment, filter, date) {
  if (!vuIsConnected() || (filter !== "all" && filter !== "course")) return 0;
  const now = Date.now();
  let items;
  let title;
  if (filter === "course") {
    items = vuItems()
      .filter((it) => !it.submitted && it.due && it.due >= now)
      .sort((a, b) => a.due - b.due);
    title = "🎓 تکالیف پیش روی VU";
  } else {
    items = vuItemsDueOn(date);
    title = "🎓 مهلت‌های VU در این روز";
  }
  if (!items.length) return 0;

  const group = vuEl("div", "unified-section-group");
  const header = vuEl("div", "unified-group-title");
  const pendingCount = items.filter((it) => !it.submitted).length;
  header.append(vuEl("span", "", title), vuEl("span", "unified-group-count", `${faDigits(pendingCount)} ارسال‌نشده / ${faDigits(items.length)}`));
  const ul = vuEl("ul", "course-tasks-sidebar-list");
  items.forEach((it) => ul.appendChild(vuBuildSidebarRow(it)));
  group.append(header, ul);
  fragment.appendChild(group);
  return 1;
}

function vuRenderHubBlock(course) {
  const list = document.getElementById("hubTasksList");
  if (!list) return;
  let block = document.getElementById("vuHubBlock");
  if (!block) {
    block = vuEl("div", "vu-hub-block");
    block.id = "vuHubBlock";
    list.insertAdjacentElement("afterend", block);
  }
  block.innerHTML = "";
  if (!vuIsConnected() || !course) return (block.hidden = true);

  const key = vuNormalizeTitle(course.title);
  const items = vuItems()
    .filter((it) => {
      const k = vuNormalizeTitle(it.courseName);
      return key && k && (k === key || k.includes(key) || key.includes(k));
    })
    .sort((a, b) => (a.due || Infinity) - (b.due || Infinity));
  block.hidden = items.length === 0;
  if (!items.length) return;

  block.appendChild(vuEl("div", "vu-hub-title", `🎓 از VU (${faDigits(items.length)})`));
  const ul = vuEl("ul", "course-tasks-sidebar-list");
  items.forEach((it) => ul.appendChild(vuBuildSidebarRow(it)));
  block.appendChild(ul);
}

// ---------------------------------------------------------------
// Pooya: week parity + schedule import
// ---------------------------------------------------------------
const PARITY_LABEL = { even: "زوج", odd: "فرد" };

// Parity of the week shown in the schedule table for a given day row.
function scheduleParityForDay(dayIndex) {
  if (!vuState.parityRef || typeof Pooya === "undefined") return null;
  return Pooya.parityForDate(vuState.parityRef, vuDateForScheduleDay(dayIndex));
}

function renderWeekInfo() {
  const badge = document.getElementById("weekParityBadge");
  const parity = scheduleParityForDay(0);
  if (badge) {
    badge.hidden = !parity;
    if (parity) {
      const isFriday = getCurrentIranianDayIndex() === 6;
      badge.textContent = `${isFriday ? "هفته آینده" : "این هفته"}: ${PARITY_LABEL[parity]}`;
      badge.className = `chip chip--md chip--soft chip--${parity === "even" ? "accent" : "default"} week-parity-badge`;
    }
  }
  const subtitle = document.getElementById("scheduleSubtitle");
  const t = vuState.pooyaTerm;
  if (subtitle && t && t.semester && (typeof scheduleViewMode === "undefined" || scheduleViewMode === "university")) {
    subtitle.textContent = `دانشگاه فردوسی مشهد • نیمسال ${t.semester} ${faDigits(t.year || "")}`;
  }
  const select = document.getElementById("weekParitySelect");
  if (select) select.value = scheduleParityForDay(getCurrentIranianDayIndex() === 6 ? 0 : getCurrentIranianDayIndex()) || "";
  const pStatus = document.getElementById("pooyaSettingsStatus");
  if (pStatus) {
    pStatus.textContent = vuState.pooyaCreds ? "پویا: متصل ✅" : "پویا: متصل نیست";
    document.getElementById("pooyaSettingsSub").textContent =
      t && t.importedAt ? `آخرین وارد کردن برنامه: ${VU.relativeTime(t.importedAt)}` : "";
  }
  renderTodayStrip();
}

const pooyaMessage = (err) => VU.errorMessage(err).replace(/VU/g, "پویا");

// ---------------------------------------------------------------
// Today strip under the clock (class now / nearest deadline / week parity)
// ---------------------------------------------------------------
function renderTodayStrip() {
  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el && el.textContent !== text) el.textContent = text;
  };
  if (!document.getElementById("todayStrip")) return;

  // Class: current, else next today, else a friendly state
  let state = null;
  try { state = getTodayClassState(); } catch (e) {}
  const classCell = document.getElementById("todayCellClass");
  if (!state || state.todayIdx === 6) {
    set("todayClassValue", state ? "جمعه، تعطیل" : "—");
    set("todayClassMeta", "");
  } else if (state.current) {
    set("todayClassValue", state.current.course.title);
    set("todayClassMeta", `الان سر کلاسی · تا ${formatHourFraction(state.current.end)}`);
  } else if (state.next) {
    set("todayClassValue", state.next.course.title);
    set("todayClassMeta", `کلاس بعدی · ساعت ${formatHourFraction(state.next.start)}`);
  } else {
    set("todayClassValue", "شما کلاس ندارید");
    set("todayClassMeta", state.sessions.length ? "کلاس‌های امروز تمام شد" : "امروز کلاسی در برنامه نیست");
  }
  if (classCell) classCell.dataset.state = state && state.current ? "live" : "idle";

  // Deadline: nearest unsubmitted VU item that is still open
  const now = Date.now();
  const next = vuItems()
    .filter((it) => !it.submitted && it.due && it.due >= now)
    .sort((a, b) => a.due - b.due)[0];
  const dlCell = document.getElementById("todayCellDeadline");
  if (next) {
    set("todayDeadlineValue", next.title);
    const left = VU.formatTimeLeft(next.due, now);
    set("todayDeadlineMeta", next.courseName ? `${left.text} · ${next.courseName}` : left.text);
    if (dlCell) dlCell.dataset.state = left.level === "urgent" || left.level === "soon" ? "urgent" : "idle";
  } else {
    set("todayDeadlineValue", vuIsConnected() ? "مهلت بازی نداری 🎉" : "VU وصل نیست");
    set("todayDeadlineMeta", vuIsConnected() ? "همه چیز ارسال شده" : "از تنظیمات یا آیکون افزونه وصل شو");
    if (dlCell) dlCell.dataset.state = "idle";
  }

  // Week parity from Pooya (even / odd)
  const parity = scheduleParityForDay(0);
  const isFriday = state && state.todayIdx === 6;
  set("todayWeekValue", parity ? `هفته ${PARITY_LABEL[parity]}` : "نامشخص");
  set("todayWeekMeta", parity ? (isFriday ? "برای هفته آینده" : "طبق تقویم پویا") : "برنامه را از پویا وارد کن");
}

function pooyaImportSummary(r) {
  let msg = `✅ برنامه کلاسی از پویا وارد شد: ${faDigits(r.courses)} درس (${faDigits(r.added)} جدید، ${faDigits(r.updated)} به‌روز).`;
  if (r.parity) msg += ` این هفته ${PARITY_LABEL[r.parity]} است.`;
  return msg;
}

async function vuReloadScheduleFromStorage() {
  const { scheduleClasses: stored } = await chrome.storage.local.get("scheduleClasses");
  scheduleClasses = stored || [];
  try { renderScheduleTable(); } catch (e) {}
  try { updateFocusCourseSelectOptions(); } catch (e) {}
}

// Shared by the new tab: asks replace / merge / cancel when classes already exist.
// Resolves to "replace" | "merge" | null (cancelled). No prompt when the schedule is empty.
async function askPooyaImportMode() {
  const { scheduleClasses: existing } = await chrome.storage.local.get("scheduleClasses");
  const count = (existing || []).length;
  if (!count) return "merge";
  const { value } = await SDUI.choose({
    title: "برنامه کلاسی فعلی را چه کنیم؟",
    message: `الان ${faDigits(count)} درس در برنامه هفتگی‌ات هست.\n«جایگزینی» برنامه فعلی را با برنامه پویا عوض می‌کند تا درس تکراری نماند؛ «ادغام» درس‌های پویا را کنار درس‌های فعلی اضافه یا به‌روز می‌کند.`,
    actions: [
      { value: null, label: "انصراف", variant: "ghost" },
      { value: "merge", label: "ادغام", variant: "secondary" },
      { value: "replace", label: "جایگزینی", variant: "primary" },
    ],
  });
  return value;
}

async function runPooyaImportHere(connectFn) {
  const btn = document.getElementById("pooyaImportBtn");
  const label = btn ? btn.textContent : "";

  // If a schedule already exists, ask whether Pooya should replace it or merge into it.
  const mode = await askPooyaImportMode();
  if (!mode) return null;
  const replaceExisting = mode === "replace";

  if (btn) {
    btn.disabled = true;
    btn.textContent = "⏳ در حال وارد کردن…";
  }
  try {
    if (connectFn) await connectFn();
    const r = await Pooya.importSchedule({ replaceExisting });
    await loadVuState();
    await vuReloadScheduleFromStorage();
    renderWeekInfo();
    alert(pooyaImportSummary(r));
    return r;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = label;
    }
  }
}

async function openPooyaDialog() {
  const dialog = document.getElementById("pooyaDialog");
  document.getElementById("pooyaDialogError").hidden = true;
  const useVu = document.getElementById("pooyaDialogUseVuBtn");
  useVu.hidden = !(vuState.creds && vuState.creds.password);
  if (vuState.creds && vuState.creds.username) document.getElementById("pooyaDialogUsername").value = vuState.creds.username;
  dialog.showModal();
}

async function pooyaImportClicked() {
  if (!vuState.pooyaCreds) return openPooyaDialog();
  try {
    await runPooyaImportHere();
  } catch (err) {
    if (err.code === "NO_CREDENTIALS" || err.code === "BAD_CREDENTIALS") return openPooyaDialog();
    alert(pooyaMessage(err));
  }
}

function initPooyaUI() {
  const dialog = document.getElementById("pooyaDialog");
  const showDialogError = (err) => {
    const el = document.getElementById("pooyaDialogError");
    el.textContent = pooyaMessage(err);
    el.hidden = false;
  };
  const submitBtn = document.getElementById("pooyaDialogSubmit");
  const busy = (on) => {
    submitBtn.disabled = on;
    document.getElementById("pooyaDialogUseVuBtn").disabled = on;
    submitBtn.textContent = on ? "در حال ورود…" : "ورود و وارد کردن";
  };

  document.getElementById("pooyaDialogCloseBtn").addEventListener("click", () => dialog.close());
  document.getElementById("pooyaDialogForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    busy(true);
    try {
      const u = document.getElementById("pooyaDialogUsername").value;
      const pw = document.getElementById("pooyaDialogPassword").value;
      const r = await runPooyaImportHere(() => Pooya.connect(u, pw));
      if (!r) return; // cancelled the replace/merge choice: keep the login dialog open
      document.getElementById("pooyaDialogPassword").value = "";
      dialog.close();
    } catch (err) {
      showDialogError(err);
    } finally {
      busy(false);
    }
  });
  document.getElementById("pooyaDialogUseVuBtn").addEventListener("click", async () => {
    busy(true);
    try {
      const r = await runPooyaImportHere(() => Pooya.connect(vuState.creds.username, vuState.creds.password));
      if (r) dialog.close();
    } catch (err) {
      showDialogError(err);
    } finally {
      busy(false);
    }
  });

  document.getElementById("pooyaImportBtn").addEventListener("click", pooyaImportClicked);
  document.getElementById("pooyaSettingsBtn").addEventListener("click", pooyaImportClicked);

  // Manual override of this week's parity (for students without Pooya import).
  document.getElementById("weekParitySelect").addEventListener("change", async (e) => {
    const value = e.target.value;
    if (!value) await chrome.storage.local.remove("weekParityRef");
    else await chrome.storage.local.set({ weekParityRef: Pooya.makeParityRef(value, "manual") });
  });
}

// ---------------------------------------------------------------
// Sync / connect / settings
// ---------------------------------------------------------------
function vuShowError(message) {
  const el = document.getElementById("vuError");
  if (!el) return;
  el.textContent = message || "";
  el.hidden = !message;
}

function vuRequestSync(force = false) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ action: "VU_SYNC", force }, (res) => {
        if (chrome.runtime.lastError) return resolve({ ok: false, error: chrome.runtime.lastError.message });
        resolve(res || { ok: false });
      });
    } catch (e) {
      resolve({ ok: false, error: e.message });
    }
  });
}

async function vuSyncNow({ silent = false } = {}) {
  if (!vuIsConnected() || vuState.syncing) return;
  vuState.syncing = true;
  const btn = document.getElementById("vuSyncBtn");
  btn && btn.classList.add("spinning");
  if (!silent) vuShowError("");
  const res = await vuRequestSync();
  vuState.syncing = false;
  btn && btn.classList.remove("spinning");
  if (!res.ok && res.error && res.code !== "BUSY") {
    vuShowError(res.code === "NO_CREDENTIALS" ? `${res.error} (از دکمه تنظیمات دوباره وصل شو)` : res.error);
  } else if (res.ok) {
    vuShowError("");
  }
}

async function openVuLoginDialog() {
  const dialog = document.getElementById("vuLoginDialog");
  const err = document.getElementById("vuLoginError");
  err.hidden = true;
  document.getElementById("vuUseSessionBtn").hidden = true;
  dialog.showModal();
  document.getElementById("vuLoginUsername").focus();
  try {
    const session = await VU.checkSession();
    if (session) {
      const btn = document.getElementById("vuUseSessionBtn");
      btn.hidden = false;
      btn.textContent = `استفاده از ورود فعلی مرورگر${session.fullName ? ` (${session.fullName})` : ""}`;
    }
  } catch (e) {}
}

async function updateVuSettingsUI() {
  const status = document.getElementById("vuSettingsStatus");
  if (!status) return;
  const settings = await VU.getSettings();
  const connected = vuIsConnected();
  const name = (vuState.data && vuState.data.fullName) || (vuState.creds && (vuState.creds.fullName || vuState.creds.username)) || "";
  status.textContent = connected ? `وضعیت: متصل ✅ ${name ? `(${name})` : ""}` : "وضعیت: متصل نیست";
  document.getElementById("vuSettingsLastSync").textContent =
    connected && vuState.data && vuState.data.lastSync ? `آخرین همگام‌سازی: ${VU.relativeTime(vuState.data.lastSync)}` : "";
  document.getElementById("vuSettingsActionBtn").textContent = connected ? "قطع اتصال" : "اتصال به VU";
  document.getElementById("vuSettingsInterval").value = String(settings.syncMinutes);
  document.getElementById("vuSettingsNotify").checked = Boolean(settings.notifications);
}

function vuRefreshAll() {
  renderVuSection();
  renderTodayStrip();
  updateVuSettingsUI();
  try { renderScheduleTable(); } catch (e) {} // also re-renders the sidebar
  try { renderCalendar(); } catch (e) {}
}

function initVuListControls() {
  // Filters
  document.querySelectorAll("#vuFilterChips .vu-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      vuState.filter = chip.dataset.filter;
      vuState.page = 1;
      try { localStorage.setItem("vuFilter", vuState.filter); } catch (e) {}
      renderVuSection();
    });
  });
  try { vuState.filter = localStorage.getItem("vuFilter") || "upcoming"; } catch (e) {}
  document.getElementById("vuCourseFilter").addEventListener("change", (e) => {
    vuState.course = e.target.value;
    vuState.page = 1;
    renderVuSection();
  });

  document.getElementById("vuPrevPage").addEventListener("click", () => {
    vuState.page = Math.max(1, vuState.page - 1);
    renderVuSection();
  });
  document.getElementById("vuNextPage").addEventListener("click", () => {
    vuState.page += 1;
    renderVuSection();
  });

}

async function initVuDashboard() {
  initVuListControls();
  document.getElementById("vuSyncBtn").addEventListener("click", () => vuSyncNow());
  document.getElementById("vuConnectBtn").addEventListener("click", openVuLoginDialog);

  // Login dialog
  const dialog = document.getElementById("vuLoginDialog");
  document.getElementById("vuLoginCloseBtn").addEventListener("click", () => dialog.close());
  document.getElementById("vuLoginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submit = document.getElementById("vuLoginSubmit");
    const err = document.getElementById("vuLoginError");
    err.hidden = true;
    submit.disabled = true;
    submit.textContent = "در حال اتصال…";
    try {
      await VU.connect(document.getElementById("vuLoginUsername").value, document.getElementById("vuLoginPassword").value);
      document.getElementById("vuLoginPassword").value = "";
      dialog.close();
      vuSyncNow();
    } catch (error) {
      err.textContent = VU.errorMessage(error);
      err.hidden = false;
    } finally {
      submit.disabled = false;
      submit.textContent = "اتصال";
    }
  });
  document.getElementById("vuUseSessionBtn").addEventListener("click", async () => {
    try {
      await VU.connectExistingSession();
      dialog.close();
      vuSyncNow();
    } catch (error) {
      const err = document.getElementById("vuLoginError");
      err.textContent = VU.errorMessage(error);
      err.hidden = false;
    }
  });

  // Settings
  document.getElementById("vuSettingsActionBtn").addEventListener("click", async () => {
    if (vuIsConnected()) {
      const { value } = await SDUI.choose({
        title: "قطع اتصال VU",
        message: "نام کاربری، رمز و اطلاعات ذخیره‌شدهٔ VU از این کامپیوتر پاک می‌شوند.",
        tone: "danger",
        actions: [
          { value: null, label: "انصراف", variant: "ghost" },
          { value: "ok", label: "قطع اتصال", variant: "danger" },
        ],
      });
      if (value !== "ok") return;
      await VU.disconnect();
    } else {
      openVuLoginDialog();
    }
  });
  const saveSettings = async () => {
    const current = await VU.getSettings();
    await chrome.storage.local.set({
      vuSettings: {
        ...current,
        syncMinutes: Number(document.getElementById("vuSettingsInterval").value) || 30,
        notifications: document.getElementById("vuSettingsNotify").checked,
      },
    });
  };
  document.getElementById("vuSettingsInterval").addEventListener("change", saveSettings);
  document.getElementById("vuSettingsNotify").addEventListener("change", saveSettings);

  initPooyaUI();

  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== "local") return;
    if (changes.vuData || changes.vuCredentials || changes.weekParityRef || changes.pooyaTerm || changes.pooyaCredentials) {
      await loadVuState();
      vuRefreshAll();
      renderWeekInfo();
    }
    // Schedule imported from the popup while this tab is open: adopt it.
    if (changes.scheduleClasses && JSON.stringify(changes.scheduleClasses.newValue || []) !== JSON.stringify(scheduleClasses)) {
      await vuReloadScheduleFromStorage();
    }
  });

  // Keep "time left" fresh while the tab stays open.
  setInterval(renderVuSection, 60 * 1000);

  renderVuSection();
  updateVuSettingsUI();
  renderWeekInfo();
  try { renderScheduleTable(); } catch (e) {} // re-render with week parity known

  // Auto-sync when the data is stale.
  if (vuIsConnected() && (!vuState.data || Date.now() - (vuState.data.lastSync || 0) > VU_AUTO_SYNC_AGE)) {
    vuSyncNow({ silent: true });
  }
}
