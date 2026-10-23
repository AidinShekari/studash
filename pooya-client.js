// ===============================================================
// StuDash Pooya Client — pooya.um.ac.ir (Puya) login + class schedule import.
// Pooya uses the same oauth.um.ac.ir single sign-on as VU (form "LoginForm",
// fields UserID / password), so the login helpers come from vu-client.js.
// Requires vu-client.js to be loaded first.
// ===============================================================
(function (global) {
  const POOYA_ORIGIN = "https://pooya.um.ac.ir";
  const MAIN_FRAME_URL = `${POOYA_ORIGIN}/gateway/PuyaMainFrame2.php`;
  const SCHEDULE_URL = `${POOYA_ORIGIN}/educ/educfac/ShowStSchedule.php`;
  const KEYS = { credentials: "pooyaCredentials", term: "pooyaTerm", parity: "weekParityRef" };

  const {
    store,
    fetchPage,
    postForm,
    formAction,
    findOAuthLoginForm,
    buildCredentialPayload,
    followAutoPostForms,
    hasCaptcha,
    loginErrorText,
    cleanText,
    normalizeFa,
    nodeText,
    toEnglishDigits,
  } = global.VU._internal;
  const { VUError } = global.VU;

  const pad2 = (n) => String(n).padStart(2, "0");
  const SD = global.StudashDate; // shared, timezone-safe date helpers (jalali.js)

  // ---------------------------------------------------------------
  // Session / login
  // ---------------------------------------------------------------
  const isOAuthPage = (page) =>
    page.url.includes("oauth.um.ac.ir") || Boolean(page.doc.querySelector('input[name="UserID"]'));

  // Reads "سال تحصیلی: 1406-1405 نیمسال اول (هفته زوج)" from the Pooya header frame.
  function readTermInfo(page) {
    const text = normalizeFa(toEnglishDigits(page.doc.body ? page.doc.body.textContent : page.text));
    const parityMatch = text.match(/هفته\s*(زوج|فرد)/);
    const yearMatch = text.match(/سال\s*تحصیلی\s*:?\s*(\d{4}\s*-\s*\d{4})/);
    const semMatch = text.match(/نیمسال\s*(اول|دوم|سوم|تابستان)/);
    return {
      parity: parityMatch ? (parityMatch[1] === "زوج" ? "even" : "odd") : null,
      year: yearMatch ? yearMatch[1].replace(/\s+/g, "") : "",
      semester: semMatch ? semMatch[1] : "",
    };
  }

  async function checkSession() {
    const page = await fetchPage(MAIN_FRAME_URL);
    if (isOAuthPage(page) || !page.url.includes("pooya.um.ac.ir")) return null;
    const term = readTermInfo(page);
    // Logged-in header frame always shows the academic year.
    if (!term.year && !term.parity) return null;
    return { term, page };
  }

  async function login(username, password) {
    if (!username || !password) throw new VUError("NO_CREDENTIALS");
    const existing = await checkSession();
    if (existing) return existing;

    // Opening Pooya redirects to oauth.um.ac.ir (or straight back if the SSO session is alive).
    let page = await fetchPage(`${POOYA_ORIGIN}/`);
    const form = findOAuthLoginForm(page.doc);
    if (form) {
      if (hasCaptcha(form)) throw new VUError("CAPTCHA");
      const payload = buildCredentialPayload(form, username, password, ["UserID", "username"], ["password"]);
      page = await followAutoPostForms(await postForm(formAction(form, page.url), payload));
      if (isOAuthPage(page)) {
        if (hasCaptcha(findOAuthLoginForm(page.doc))) throw new VUError("CAPTCHA");
        throw new VUError("BAD_CREDENTIALS", loginErrorText(page.doc) || undefined);
      }
    }

    const session = await checkSession();
    if (!session) throw new VUError("UNKNOWN", "ورود به پویا انجام نشد. یک بار پویا را در مرورگر باز کن و دوباره امتحان کن.");
    return session;
  }

  async function getCredentials() {
    const data = await store.get(KEYS.credentials);
    return data[KEYS.credentials] || null;
  }

  async function ensureSession() {
    const session = await checkSession();
    if (session) return session;
    const creds = await getCredentials();
    if (!creds || !creds.password) throw new VUError("NO_CREDENTIALS");
    return login(creds.username, creds.password);
  }

  // ---------------------------------------------------------------
  // Week parity: remember which week Pooya called odd/even.
  // ---------------------------------------------------------------
  // Iranian week starts on Saturday.
  // Iranian week starts on Saturday.
  const weekStartOf = (date) => SD.startOfWeek(date);

  function makeParityRef(parity, source = "pooya") {
    return { weekStart: SD.isoDate(weekStartOf(new Date())), parity, source, at: Date.now() };
  }

  // Parity ("odd" | "even") of the week containing `date`, from a stored reference.
  // Counts calendar days (not milliseconds), so DST changes can't flip the parity.
  function parityForDate(ref, date = new Date()) {
    if (!ref || !ref.parity) return null;
    const refStart = SD.parseIsoDate(ref.weekStart);
    if (!refStart) return null;
    const weeks = Math.round(SD.diffDays(refStart, weekStartOf(date)) / 7);
    if (weeks % 2 === 0) return ref.parity;
    return ref.parity === "even" ? "odd" : "even";
  }

  // ---------------------------------------------------------------
  // Schedule parsing (ShowStSchedule.php)
  // ---------------------------------------------------------------
  const DAY_INDEX = { شنبه: 0, یکشنبه: 1, دوشنبه: 2, سهشنبه: 3, چهارشنبه: 4, پنجشنبه: 5, جمعه: 6 };
  const dayKey = (t) => normalizeFa(t).replace(/[\s‌]+/g, "");

  function parseCell(td) {
    const clone = td.cloneNode(true);
    let weekType = "all";
    for (const font of clone.querySelectorAll("font")) {
      const t = normalizeFa(font.textContent);
      if (/زوج/.test(t)) weekType = "even";
      else if (/فرد/.test(t)) weekType = "odd";
      font.remove();
    }
    const infoSpan = clone.querySelector("span[title]");
    const locationFull = infoSpan ? cleanText(infoSpan.getAttribute("title")).replace(/\s*->\s*/g, " › ") : "";
    clone.querySelectorAll("span").forEach((s) => s.remove());
    const text = cleanText(clone.textContent);
    if (!text) return null;

    const syllabusEl = td.querySelector('[onclick*="ShowCourseSyllabus"]');
    const syllabus = (syllabusEl && syllabusEl.getAttribute("onclick").match(/ShowCourseSyllabus\(\s*["'](\d+)["']\s*,\s*["'](\d+)["']/)) || [];
    const m = text.match(/^(.+?)\s*\((\d+)\)\s*[,،]\s*([^,،]*?)\s*[,،]\s*\(([^)]*)\)\s*(\*)?/);
    if (!m) return { title: text, units: 0, instructor: "", location: "", locationFull, weekType, key: syllabus[1] || text };
    return {
      title: cleanText(m[1]),
      units: parseInt(m[2], 10) || 0,
      instructor: cleanText(m[3]),
      location: cleanText(m[4]),
      locationFull,
      weekType,
      key: syllabus[1] ? `${syllabus[1]}-${syllabus[2]}` : cleanText(m[1]),
    };
  }

  function parseSchedule(doc) {
    const table = [...doc.querySelectorAll("table")].find(
      (t) => t.querySelector("th") && /شنبه/.test(t.textContent)
    );
    if (!table) return null;

    const rows = [...table.querySelectorAll("tr")];
    const headerRow = rows.find((r) => r.querySelector("th"));
    const hours = [...headerRow.querySelectorAll("th")]
      .slice(1)
      .map((th) => parseInt(toEnglishDigits(th.textContent), 10));
    const firstHour = Number.isFinite(hours[0]) ? hours[0] : 6;
    const hourAt = (col) => (Number.isFinite(hours[col]) ? hours[col] : firstHour + col);

    const courses = new Map();
    for (const tr of rows) {
      if (tr === headerRow) continue;
      const cells = [...tr.children].filter((c) => c.tagName === "TD");
      if (cells.length < 2) continue;
      const day = DAY_INDEX[dayKey(cells[0].textContent)];
      if (day === undefined) continue;

      let col = 0;
      for (const td of cells.slice(1)) {
        const span = parseInt(td.getAttribute("colspan") || "1", 10) || 1;
        const info = parseCell(td);
        if (info) {
          const start = hourAt(col);
          const end = start + span;
          if (!courses.has(info.key)) {
            courses.set(info.key, {
              pooyaKey: info.key,
              title: info.title,
              units: info.units,
              instructor: info.instructor,
              sessions: [],
            });
          }
          courses.get(info.key).sessions.push({
            day,
            startTime: `${pad2(start)}:00`,
            endTime: `${pad2(end)}:00`,
            location: info.location || "—",
            locationFull: info.locationFull,
            weekType: info.weekType,
          });
        }
        col += span;
      }
    }

    const heading = nodeText(doc.querySelector("h3"));
    const unitsMatch = toEnglishDigits(doc.body ? doc.body.textContent : "").match(/تعداد\s*واحدهای\s*مورد\s*قبول\s*:\s*(\d+)/);
    const termInput = (name) => {
      const el = doc.querySelector(`input[name="${name}"]`);
      return el ? el.getAttribute("value") : "";
    };
    return {
      title: heading,
      eduYear: termInput("EduYear"),
      semester: termInput("semester"),
      totalUnits: unitsMatch ? parseInt(unitsMatch[1], 10) : null,
      courses: [...courses.values()],
    };
  }

  async function fetchSchedule() {
    const page = await fetchPage(SCHEDULE_URL);
    if (isOAuthPage(page)) throw new VUError("NO_CREDENTIALS");
    const schedule = parseSchedule(page.doc);
    if (!schedule) throw new VUError("UNKNOWN", "برنامه کلاسی در پویا پیدا نشد.");
    return schedule;
  }

  // ---------------------------------------------------------------
  // Merge into StuDash's scheduleClasses
  // ---------------------------------------------------------------
  const COLORS = ["#f2a65a", "#6fc8f2", "#6fcf97", "#bb6bd9", "#e8735a", "#ffd166"];
  const titleKey = (t = "") =>
    normalizeFa(toEnglishDigits(t)).replace(/\([^)]*\)/g, "").replace(/[\s‌\-_.]+/g, "").toLowerCase();

  function mergeIntoClasses(existing, schedule) {
    const classes = Array.isArray(existing) ? existing.map((c) => ({ ...c })) : [];
    let added = 0;
    let updated = 0;
    schedule.courses.forEach((course, i) => {
      const weekTypes = [...new Set(course.sessions.map((s) => s.weekType))];
      const courseWeekType = weekTypes.length === 1 ? weekTypes[0] : "all";
      const fields = {
        title: course.title,
        instructor: course.instructor,
        units: Math.min(3, Math.max(1, course.units || 3)),
        weekType: courseWeekType,
        sessions: course.sessions,
        pooyaKey: course.pooyaKey,
        importedFrom: "pooya",
      };
      const match = classes.find(
        (c) => (c.pooyaKey && c.pooyaKey === course.pooyaKey) || titleKey(c.title) === titleKey(course.title)
      );
      if (match) {
        Object.assign(match, fields);
        updated++;
      } else {
        classes.push({
          id: crypto.randomUUID(),
          color: COLORS[(classes.length + i) % COLORS.length],
          tasks: [],
          exams: [],
          notes: "",
          links: [],
          absences: 0,
          ...fields,
        });
        added++;
      }
    });
    return { classes, added, updated };
  }

  // Full import: ensure session → read week parity → fetch schedule → merge into storage.
  async function importSchedule() {
    const session = await ensureSession();
    const schedule = await fetchSchedule();
    const data = await store.get(["scheduleClasses"]);
    const { classes, added, updated } = mergeIntoClasses(data.scheduleClasses || [], schedule);

    const toSave = {
      scheduleClasses: classes,
      [KEYS.term]: {
        title: schedule.title,
        year: session.term.year,
        semester: session.term.semester,
        eduYear: schedule.eduYear,
        semesterNo: schedule.semester,
        totalUnits: schedule.totalUnits,
        importedAt: Date.now(),
      },
    };
    if (session.term.parity) toSave[KEYS.parity] = makeParityRef(session.term.parity);
    await store.set(toSave);
    return { added, updated, courses: schedule.courses.length, parity: session.term.parity, term: toSave[KEYS.term] };
  }

  async function connect(username, password) {
    const session = await login(cleanText(username), password);
    await store.set({ [KEYS.credentials]: { username: cleanText(username), password, connectedAt: Date.now() } });
    return session;
  }

  async function connectExistingSession() {
    const session = await checkSession();
    if (!session) throw new VUError("NO_CREDENTIALS");
    await store.set({ [KEYS.credentials]: { username: "", password: "", sessionOnly: true, connectedAt: Date.now() } });
    return session;
  }

  async function disconnect() {
    await store.remove([KEYS.credentials, KEYS.term]);
  }

  global.Pooya = {
    POOYA_ORIGIN,
    KEYS,
    checkSession,
    connect,
    connectExistingSession,
    disconnect,
    getCredentials,
    importSchedule,
    parseSchedule,
    readTermInfo,
    parityForDate,
    makeParityRef,
    weekStartOf,
  };
})(typeof self !== "undefined" ? self : window);
