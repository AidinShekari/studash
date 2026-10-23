// ===============================================================
// StuDash VU Client — talks to vu.um.ac.ir (Moodle) from extension pages.
// Ported from VUBOT-FUM: direct Moodle login → OAuth (oauth.um.ac.ir) login,
// assignment / quiz scraping and Moodle date parsing.
// Works in any page context that has DOMParser (new tab, popup, offscreen).
// Cookies live in Chrome's own cookie jar (fetch + credentials: "include").
// ===============================================================
(function (global) {
  const VU_ORIGIN = "https://vu.um.ac.ir";
  const STORAGE_KEYS = {
    credentials: "vuCredentials",
    data: "vuData",
    settings: "vuSettings",
    lock: "vuSyncLock",
  };
  const DEFAULT_SETTINGS = { syncMinutes: 30, notifications: true };

  // Offscreen documents only get chrome.runtime, so there storage goes through the background worker.
  const hasStorage = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  const store = hasStorage
    ? chrome.storage.local
    : {
        get: (keys) => chrome.runtime.sendMessage({ action: "VU_STORAGE", op: "get", keys }).then((r) => r || {}),
        set: (items) => chrome.runtime.sendMessage({ action: "VU_STORAGE", op: "set", items }),
        remove: (keys) => chrome.runtime.sendMessage({ action: "VU_STORAGE", op: "remove", keys }),
      };

  class VUError extends Error {
    constructor(code, message) {
      super(message || code);
      this.code = code;
    }
  }

  const ERROR_MESSAGES = {
    NO_CREDENTIALS: "هنوز به VU متصل نشده‌ای. نام کاربری و رمز عبور را وارد کن.",
    BAD_CREDENTIALS: "نام کاربری یا رمز عبور اشتباه است.",
    CAPTCHA: "سامانه ورود کد امنیتی (کپچا) خواسته. یک بار در تب جدید وارد VU شو و دوباره امتحان کن.",
    NETWORK: "ارتباط با سامانه VU برقرار نشد. اتصال اینترنت یا VPN را بررسی کن.",
    UNKNOWN: "ورود به VU انجام نشد. کمی بعد دوباره امتحان کن.",
    BUSY: "همگام‌سازی دیگری در حال انجام است.",
  };
  const errorMessage = (err) =>
    (err && ERROR_MESSAGES[err.code]) || (err && err.message) || ERROR_MESSAGES.UNKNOWN;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------------------------------------------------------------
  // Text helpers
  // ---------------------------------------------------------------
  const toEnglishDigits = (value = "") =>
    String(value || "")
      .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

  const cleanText = (value = "") =>
    String(value || "")
      .normalize("NFC")
      .replace(/﻿/g, "")
      .replace(/[ \t\r\n ]+/g, " ")
      .trim();

  const normalizeFa = (value = "") =>
    cleanText(value).replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/‌/g, " ");

  const nodeText = (node) => (node ? cleanText(node.textContent) : "");

  const absoluteUrl = (href, base) => {
    try {
      return new URL(href, base).toString();
    } catch (e) {
      return "";
    }
  };

  const cmidFromUrl = (url) => {
    try {
      return new URL(url).searchParams.get("id") || "";
    } catch (e) {
      return "";
    }
  };

  // Strip "(گروه2-مهر 1405)" style suffixes for a compact course label.
  const shortCourseName = (name = "") =>
    cleanText(name).replace(/\s*\((?:[^()]*?(?:گروه|group)[^()]*)\)\s*$/i, "").trim() || cleanText(name);

  const decodeHtml = (value = "") => {
    const doc = new DOMParser().parseFromString(`<body>${value}</body>`, "text/html");
    return cleanText(doc.body.textContent);
  };

  // ---------------------------------------------------------------
  // Jalali → Gregorian via the shared exact converter (jalali.js).
  // Returns null for impossible dates (e.g. 30 Esfand in a common year).
  // ---------------------------------------------------------------
  function jalaliToDate(jy, jm, jd, hours = 23, minutes = 59) {
    if (!global.StudashDate.isValidJalaliDate(jy, jm, jd)) return null;
    const d = global.StudashDate.toGregorian(jy, jm, jd);
    d.setHours(hours, minutes, 0, 0);
    return d;
  }

  // ---------------------------------------------------------------
  // Moodle date parsing (English & Persian, as rendered by VU)
  // ---------------------------------------------------------------
  const PERSIAN_MONTHS = {
    فروردین: 1, اردیبهشت: 2, خرداد: 3, تیر: 4, مرداد: 5, شهریور: 6,
    مهر: 7, آبان: 8, آذر: 9, دی: 10, بهمن: 11, اسفند: 12,
  };
  const EN_MONTHS = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  };

  function parseTime(text) {
    const m = text.match(/(\d{1,2}):(\d{2})\s*(AM|PM|ق\.?\s*ظ|ب\.?\s*ظ|صبح|عصر|بعد\s*از\s*ظهر|قبل\s*از\s*ظهر)?/i);
    if (!m) return { hours: 23, minutes: 59 };
    let hours = parseInt(m[1], 10);
    const minutes = parseInt(m[2], 10);
    const period = (m[3] || "").replace(/\s|\./g, "").toUpperCase();
    const isPm = period === "PM" || period === "بظ" || period === "عصر" || period === "بعدازظهر";
    const isAm = period === "AM" || period === "قظ" || period === "صبح" || period === "قبلازظهر";
    if (isPm && hours !== 12) hours += 12;
    if (isAm && hours === 12) hours = 0;
    return { hours, minutes };
  }

  function parseMoodleDate(dateText) {
    if (!dateText) return null;
    const text = normalizeFa(toEnglishDigits(dateText));
    if (!text || text === "-" || text === "نامشخص") return null;

    // Persian: "دوشنبه، 6 مهر 1405، 12:00 ق.ظ"
    const fa = text.match(/(\d{1,2})\s+([؀-ۿ]+)\s+(\d{4})/);
    if (fa && PERSIAN_MONTHS[fa[2]]) {
      const rest = text.slice(fa.index + fa[0].length);
      const { hours, minutes } = parseTime(rest);
      return jalaliToDate(parseInt(fa[3], 10), PERSIAN_MONTHS[fa[2]], parseInt(fa[1], 10), hours, minutes);
    }

    // English: "Monday, 28 September 2026, 12:00 AM"
    const en = text.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
    if (en && EN_MONTHS[en[2].toLowerCase()] !== undefined) {
      const rest = text.slice(en.index + en[0].length);
      const { hours, minutes } = parseTime(rest);
      const d = new Date(parseInt(en[3], 10), EN_MONTHS[en[2].toLowerCase()], parseInt(en[1], 10), hours, minutes, 0);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  // ---------------------------------------------------------------
  // HTTP
  // ---------------------------------------------------------------
  // Honour the page charset (some Pooya pages are windows-1256).
  function decodeBody(buffer, contentType) {
    let charset = (contentType.match(/charset=([\w-]+)/i) || [])[1];
    if (!charset) {
      const head = new TextDecoder("latin1").decode(buffer.slice(0, 2048));
      charset = (head.match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1];
    }
    try {
      return new TextDecoder((charset || "utf-8").toLowerCase()).decode(buffer);
    } catch (e) {
      return new TextDecoder("utf-8").decode(buffer);
    }
  }

  async function fetchPage(url, options = {}) {
    let res;
    try {
      res = await fetch(url, {
        credentials: "include",
        redirect: "follow",
        cache: "no-store",
        ...options,
      });
    } catch (e) {
      throw new VUError("NETWORK", e.message);
    }
    const text = decodeBody(await res.arrayBuffer(), res.headers.get("content-type") || "");
    const doc = new DOMParser().parseFromString(text, "text/html");
    return { url: res.url || url, status: res.status, text, doc };
  }

  function isLoginPage(url = "", doc = null) {
    const u = String(url || "");
    if (u.includes("oauth.um.ac.ir") || u.includes("/login/")) return true;
    if (!doc) return false;
    return Boolean(
      doc.querySelector('input[name="UserID"]') ||
        doc.querySelector('input[name="username"]') ||
        doc.querySelector("#page-login-index") ||
        doc.querySelector(".loginform") ||
        doc.querySelector('form[action*="login"]')
    );
  }

  function extractFormFields(form) {
    const fields = {};
    for (const input of form.querySelectorAll("input[name]")) {
      const type = (input.getAttribute("type") || "").toLowerCase();
      if (["button", "file", "image", "reset", "submit"].includes(type)) continue;
      if ((type === "checkbox" || type === "radio") && !input.hasAttribute("checked")) continue;
      fields[input.getAttribute("name")] = input.getAttribute("value") || "";
    }
    return fields;
  }

  function buildCredentialPayload(form, username, password, usernameNames, passwordNames) {
    const payload = extractFormFields(form);
    const names = [...form.querySelectorAll("input[name]")].map((i) => i.getAttribute("name"));
    const userField =
      usernameNames.find((n) => names.includes(n)) ||
      names.find((n) => /^(user(id|name)?|login)$/i.test(n)) ||
      usernameNames[0];
    const passField =
      passwordNames.find((n) => names.includes(n)) ||
      names.find((n) => /pass(word)?/i.test(n)) ||
      passwordNames[0];
    payload[userField] = username;
    payload[passField] = password;
    return payload;
  }

  const formAction = (form, pageUrl) => {
    const action = form.getAttribute("action");
    return action ? absoluteUrl(action, pageUrl) : pageUrl;
  };

  async function postForm(url, payload) {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(payload)) body.append(k, v == null ? "" : String(v));
    return fetchPage(url, { method: "POST", body });
  }

  function findOAuthLoginForm(doc) {
    const userIdInput = doc.querySelector('input[name="UserID"]');
    return (
      doc.querySelector('form[name="LoginForm"]') ||
      doc.querySelector("form.login-form") ||
      (userIdInput && userIdInput.closest("form"))
    );
  }

  function hasCaptcha(form) {
    return Boolean(
      form &&
        form.querySelector(
          'input[name*="aptcha" i], img[src*="aptcha" i], .g-recaptcha, [data-sitekey], iframe[src*="recaptcha"]'
        )
    );
  }

  // Some identity providers answer with an auto-submitting hidden form (form_post).
  async function followAutoPostForms(page, depth = 0) {
    if (depth > 3 || !page.doc) return page;
    const forms = [...page.doc.querySelectorAll("form")];
    if (forms.length !== 1) return page;
    const form = forms[0];
    const visible = form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), textarea, select');
    if (visible.length > 0) return page;
    const action = formAction(form, page.url);
    if (!/um\.ac\.ir/.test(action)) return page;
    const method = (form.getAttribute("method") || "get").toLowerCase();
    if (method !== "post") return page;
    const next = await postForm(action, extractFormFields(form));
    return followAutoPostForms(next, depth + 1);
  }

  function loginErrorText(doc) {
    const el = doc && doc.querySelector(".alert-danger, .validation-summary-errors, .text-danger, .error, #loginerrormessage");
    return el ? nodeText(el) : "";
  }

  const loggedInResult = (page) => !isLoginPage(page.url, page.doc) && page.url.includes("vu.um.ac.ir");

  async function tryDirectMoodleLogin(username, password) {
    const loginPage = await fetchPage(`${VU_ORIGIN}/login/index.php`);
    const form = loginPage.doc.querySelector('form#login, form.login-form[action*="/login/index.php"]');
    if (!form) return { ok: false, page: loginPage };
    const payload = buildCredentialPayload(form, username, password, ["username"], ["password"]);
    const result = await followAutoPostForms(await postForm(formAction(form, loginPage.url), payload));
    return { ok: loggedInResult(result), page: result, attempted: true };
  }

  async function tryOAuthLogin(username, password) {
    const loginPage = await fetchPage(`${VU_ORIGIN}/login/index.php`);
    let oauthPage = loginPage;
    let form = findOAuthLoginForm(loginPage.doc);

    if (!form) {
      const link = loginPage.doc.querySelector(
        '.login-identityprovider-btn[href], a[href*="/auth/oauth2/login.php"], a[href*="oauth"]'
      );
      if (!link) return { ok: loggedInResult(loginPage), page: loginPage };
      oauthPage = await fetchPage(absoluteUrl(link.getAttribute("href"), loginPage.url));
      form = findOAuthLoginForm(oauthPage.doc);
    }
    if (!form) return { ok: loggedInResult(oauthPage), page: oauthPage };
    if (hasCaptcha(form)) throw new VUError("CAPTCHA");

    const payload = buildCredentialPayload(form, username, password, ["UserID", "username"], ["password"]);
    const result = await followAutoPostForms(await postForm(formAction(form, oauthPage.url), payload));
    return { ok: loggedInResult(result), page: result, attempted: true };
  }

  // ---------------------------------------------------------------
  // Session
  // ---------------------------------------------------------------
  function readSessionInfo(page) {
    const sesskeyMatch = page.text.match(/"sesskey"\s*:\s*"([^"]+)"/);
    const userLink =
      page.doc.querySelector('.logininfo a[href*="/user/profile.php"]') ||
      page.doc.querySelector(".usertext") ||
      page.doc.querySelector(".userbutton .usertext");
    return {
      sesskey: sesskeyMatch ? sesskeyMatch[1] : "",
      fullName: nodeText(userLink),
      page,
    };
  }

  async function checkSession() {
    const page = await fetchPage(`${VU_ORIGIN}/my/`);
    if (isLoginPage(page.url, page.doc)) return null;
    const info = readSessionInfo(page);
    return info.sesskey ? info : null;
  }

  async function logout(session) {
    if (!session || !session.sesskey) return;
    try {
      await fetchPage(`${VU_ORIGIN}/login/logout.php?sesskey=${encodeURIComponent(session.sesskey)}`);
    } catch (e) {}
  }

  // Logs in with the given credentials. An existing browser session is closed first so
  // the password is actually verified before it gets saved.
  async function login(username, password) {
    if (!username || !password) throw new VUError("NO_CREDENTIALS");
    const existing = await checkSession();
    if (existing) await logout(existing);

    let lastPage = null;
    const direct = await tryDirectMoodleLogin(username, password);
    lastPage = direct.page;
    if (!direct.ok) {
      const oauth = await tryOAuthLogin(username, password);
      lastPage = oauth.page;
      if (!oauth.ok) {
        const onLogin = lastPage && isLoginPage(lastPage.url, lastPage.doc);
        if (onLogin && lastPage.doc && hasCaptcha(findOAuthLoginForm(lastPage.doc))) throw new VUError("CAPTCHA");
        const msg = loginErrorText(lastPage && lastPage.doc);
        throw new VUError(onLogin ? "BAD_CREDENTIALS" : "UNKNOWN", msg || undefined);
      }
    }

    const session = await checkSession();
    if (!session) throw new VUError("UNKNOWN");
    return session;
  }

  async function getCredentials() {
    const data = await store.get(STORAGE_KEYS.credentials);
    return data[STORAGE_KEYS.credentials] || null;
  }

  async function getSettings() {
    const data = await store.get(STORAGE_KEYS.settings);
    return { ...DEFAULT_SETTINGS, ...(data[STORAGE_KEYS.settings] || {}) };
  }

  async function ensureSession() {
    const session = await checkSession();
    if (session) return session;
    const creds = await getCredentials();
    if (!creds || !creds.password) throw new VUError("NO_CREDENTIALS");
    return login(creds.username, creds.password);
  }

  // Login from the popup / dialog: verifies, then stores the credentials locally.
  async function connect(username, password) {
    const session = await login(cleanText(username), password);
    await store.set({
      [STORAGE_KEYS.credentials]: { username: cleanText(username), password, fullName: session.fullName, connectedAt: Date.now() },
    });
    try {
      chrome.runtime.sendMessage({ action: "VU_CONNECTED" }).catch(() => {});
    } catch (e) {}
    return session;
  }

  // Use a VU session the browser already has, without saving a password.
  async function connectExistingSession() {
    const session = await checkSession();
    if (!session) throw new VUError("NO_CREDENTIALS");
    await store.set({
      [STORAGE_KEYS.credentials]: { username: "", password: "", sessionOnly: true, fullName: session.fullName, connectedAt: Date.now() },
    });
    try {
      chrome.runtime.sendMessage({ action: "VU_CONNECTED" }).catch(() => {});
    } catch (e) {}
    return session;
  }

  async function disconnect() {
    await store.remove([STORAGE_KEYS.credentials, STORAGE_KEYS.data, STORAGE_KEYS.lock, "vuNotified"]);
    try {
      chrome.runtime.sendMessage({ action: "VU_DISCONNECT" }).catch(() => {});
    } catch (e) {}
  }

  // ---------------------------------------------------------------
  // Moodle AJAX web services (same endpoints the VU dashboard uses)
  // ---------------------------------------------------------------
  async function ajax(sesskey, methodname, args) {
    let res;
    try {
      res = await fetch(`${VU_ORIGIN}/lib/ajax/service.php?sesskey=${encodeURIComponent(sesskey)}&info=${methodname}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ index: 0, methodname, args }]),
      });
    } catch (e) {
      throw new VUError("NETWORK", e.message);
    }
    const json = await res.json();
    if (!Array.isArray(json)) throw new Error((json && (json.message || json.error)) || "AJAX error");
    const first = json[0];
    if (first.error) throw new Error((first.exception && first.exception.message) || "AJAX error");
    return first.data;
  }

  async function getCourses(session) {
    const seen = new Map();
    for (const classification of ["inprogress", "all"]) {
      try {
        const data = await ajax(session.sesskey, "core_course_get_enrolled_courses_by_timeline_classification", {
          offset: 0,
          limit: 0,
          classification,
          sort: "fullname",
          customfieldname: "",
          customfieldvalue: "",
        });
        for (const c of (data && data.courses) || []) {
          if (!seen.has(String(c.id))) {
            const name = decodeHtml(c.fullname || c.shortname || "");
            seen.set(String(c.id), { id: String(c.id), name, shortName: shortCourseName(name), url: c.viewurl || `${VU_ORIGIN}/course/view.php?id=${c.id}` });
          }
        }
        if (seen.size > 0) break;
      } catch (e) {
        console.warn("[VU] course list via AJAX failed", e);
      }
    }

    // Fallback: course links on the dashboard page.
    if (seen.size === 0 && session.page) {
      for (const a of session.page.doc.querySelectorAll('a[href*="/course/view.php?id="]')) {
        const url = absoluteUrl(a.getAttribute("href"), session.page.url);
        const id = cmidFromUrl(url);
        const name = nodeText(a);
        if (id && id !== "1" && name && !seen.has(id)) seen.set(id, { id, name, shortName: shortCourseName(name), url });
      }
    }
    return [...seen.values()];
  }

  async function getActionEvents(session) {
    try {
      const data = await ajax(session.sesskey, "core_calendar_get_action_events_by_timesort", {
        timesortfrom: Math.floor(Date.now() / 1000) - 30 * 86400,
        limittonum: 50,
        limittononsuspendedevents: true,
      });
      return (data && data.events) || [];
    } catch (e) {
      console.warn("[VU] action events failed", e);
      return [];
    }
  }

  // ---------------------------------------------------------------
  // Scraping index pages (one request per course lists every activity)
  // ---------------------------------------------------------------
  function readIndexTable(doc, pageUrl, linkSelector) {
    const table = doc.querySelector("table.generaltable") || doc.querySelector("table");
    if (!table) return [];
    const headers = [...table.querySelectorAll("thead th")].map((th) => normalizeFa(th.textContent).toLowerCase());
    const col = (re, skip = []) => headers.findIndex((h, i) => !skip.includes(i) && re.test(h));
    const due = col(/due|مهلت|بسته|close|پایان/);
    // "مهلت تحویل" contains «تحویل», so never reuse the due column for submissions.
    let submission = col(/submission|ارسال|وضعیت/, [due]);
    if (submission < 0) submission = col(/تحویل/, [due]);
    const columns = { due, submission, grade: col(/grade|نمره/, [due, submission]) };
    const rows = [];
    for (const tr of table.querySelectorAll("tbody tr")) {
      const link = tr.querySelector(linkSelector);
      if (!link) continue;
      const cells = [...tr.querySelectorAll("td, th")];
      const cell = (i) => (i >= 0 && cells[i] ? cells[i] : null);
      const url = absoluteUrl(link.getAttribute("href"), pageUrl);
      rows.push({
        cmid: cmidFromUrl(url),
        url,
        title: nodeText(link),
        dueText: nodeText(cell(columns.due)),
        submissionCell: cell(columns.submission),
        gradeText: nodeText(cell(columns.grade)),
      });
    }
    return rows;
  }

  // Returns "submitted" | "draft" | "new" | "unknown"
  function classifySubmission(cell) {
    if (!cell) return "unknown";
    if (cell.querySelector(".submissionstatussubmitted")) return "submitted";
    if (cell.querySelector(".submissionstatusdraft")) return "draft";
    const t = normalizeFa(cell.textContent).toLowerCase();
    if (!t || t === "-") return "unknown";
    if (/draft|پیش ?نویس/.test(t)) return "draft";
    if (/no submission|not submitted|nothing|نشده|نگرفته|ندارد|بدون|هیچ|reopened|بازگشایی/.test(t)) return "new";
    if (/submitted|ارسال|تحویل/.test(t)) return "submitted";
    return "unknown";
  }

  async function getCourseAssignments(courseId) {
    const page = await fetchPage(`${VU_ORIGIN}/mod/assign/index.php?id=${courseId}`);
    if (isLoginPage(page.url, page.doc)) throw new VUError("NO_SESSION");
    return readIndexTable(page.doc, page.url, 'a[href*="/mod/assign/view.php"]').map((r) => ({
      ...r,
      submission: classifySubmission(r.submissionCell),
    }));
  }

  async function getCourseQuizzes(courseId) {
    const page = await fetchPage(`${VU_ORIGIN}/mod/quiz/index.php?id=${courseId}`);
    if (isLoginPage(page.url, page.doc)) throw new VUError("NO_SESSION");
    return readIndexTable(page.doc, page.url, 'a[href*="/mod/quiz/view.php"]');
  }

  // Fallback for one assignment (port of VUBOT extractAssignmentDetails).
  async function getAssignmentDetails(url) {
    const page = await fetchPage(url);
    if (isLoginPage(page.url, page.doc)) throw new VUError("NO_SESSION");
    let dueText = "";
    let openedText = "";
    for (const div of page.doc.querySelectorAll('[data-region="activity-dates"] div')) {
      const text = nodeText(div);
      let m = text.match(/(?:باز\s*(?:شده|شد|می[‌\s]*شود)|Opens?|Opened)\s*:\s*(.+)/);
      if (m) openedText = m[1].trim();
      m = text.match(/(?:مهلت(?:\s*تحویل)?|Due)\s*:\s*(.+)/);
      if (m) dueText = m[1].trim();
    }
    let submission = "unknown";
    let gradeText = "";
    for (const row of page.doc.querySelectorAll(".submissionstatustable tr, .generaltable tr")) {
      const th = row.querySelector("th");
      const td = row.querySelector("td");
      if (!th || !td) continue;
      const label = normalizeFa(th.textContent).toLowerCase();
      if (submission === "unknown" && /submission status|وضعیت ارسال|وضعیت تحویل/.test(label)) {
        if (td.classList.contains("submissionstatussubmitted")) submission = "submitted";
        else if (td.classList.contains("submissionstatusdraft")) submission = "draft";
        else submission = classifySubmission(td);
        if (submission === "unknown") submission = "new";
      }
      if (!dueText && /due date|مهلت/.test(label)) dueText = nodeText(td);
      if (!gradeText && /^(grade|نمره)/.test(label)) gradeText = nodeText(td);
    }
    return { dueText, openedText, submission, gradeText };
  }

  // ---------------------------------------------------------------
  // Full sync → chrome.storage.local.vuData
  // ---------------------------------------------------------------
  async function acquireLock() {
    const data = await store.get(STORAGE_KEYS.lock);
    const lock = data[STORAGE_KEYS.lock];
    if (lock && Date.now() - lock < 3 * 60 * 1000) return false;
    await store.set({ [STORAGE_KEYS.lock]: Date.now() });
    return true;
  }
  const releaseLock = () => store.remove(STORAGE_KEYS.lock);

  const cleanGrade = (g) => {
    const t = cleanText(g);
    return !t || t === "-" ? "" : t;
  };

  async function syncAll({ force = false } = {}) {
    if (!(await acquireLock())) {
      if (!force) throw new VUError("BUSY");
    }
    try {
      const prevData = (await store.get(STORAGE_KEYS.data))[STORAGE_KEYS.data] || {};
      const prevById = new Map((prevData.items || []).map((it) => [it.id, it]));

      const session = await ensureSession();
      const courses = await getCourses(session);
      const events = await getActionEvents(session);
      const eventByCmid = new Map();
      for (const ev of events) {
        if (ev.modulename !== "assign" && ev.modulename !== "quiz") continue;
        const cmid = cmidFromUrl(ev.url || "");
        if (cmid) eventByCmid.set(`${ev.modulename}-${cmid}`, ev);
      }

      const items = [];
      let detailFetches = 0;
      for (const course of courses) {
        let assignments = [];
        let quizzes = [];
        try {
          assignments = await getCourseAssignments(course.id);
          await sleep(200);
          quizzes = await getCourseQuizzes(course.id);
          await sleep(200);
        } catch (e) {
          console.warn("[VU] course scrape failed", course.id, e);
          continue;
        }

        for (const a of assignments) {
          const id = `assign-${a.cmid}`;
          const ev = eventByCmid.get(id);
          let submission = a.submission;
          let dueText = a.dueText;
          let gradeText = a.gradeText;
          let due = ev ? ev.timesort * 1000 : (parseMoodleDate(dueText) || { getTime: () => null }).getTime();

          if ((submission === "unknown" || !due) && detailFetches < 15) {
            detailFetches++;
            try {
              const details = await getAssignmentDetails(a.url);
              if (submission === "unknown") submission = details.submission;
              if (!due && details.dueText) {
                dueText = details.dueText;
                const parsed = parseMoodleDate(details.dueText);
                due = parsed ? parsed.getTime() : null;
              }
              gradeText = gradeText || details.gradeText;
              await sleep(200);
            } catch (e) {}
          }
          if (submission === "unknown" && ev) submission = "new"; // open action ⇒ not submitted yet

          items.push({
            id,
            type: "assign",
            courseId: course.id,
            courseName: course.shortName,
            title: a.title,
            url: a.url,
            due: due || null,
            dueText,
            submitted: submission === "submitted",
            submission,
            grade: cleanGrade(gradeText),
            firstSeen: (prevById.get(id) && prevById.get(id).firstSeen) || Date.now(),
          });
        }

        for (const q of quizzes) {
          const id = `quiz-${q.cmid}`;
          const ev = eventByCmid.get(id);
          const parsed = parseMoodleDate(q.dueText);
          const grade = cleanGrade(q.gradeText);
          items.push({
            id,
            type: "quiz",
            courseId: course.id,
            courseName: course.shortName,
            title: q.title,
            url: q.url,
            due: ev ? ev.timesort * 1000 : parsed ? parsed.getTime() : null,
            dueText: q.dueText,
            submitted: Boolean(grade) && !ev,
            submission: grade && !ev ? "submitted" : "new",
            grade,
            firstSeen: (prevById.get(id) && prevById.get(id).firstSeen) || Date.now(),
          });
        }
      }

      // Timeline events for activities that the index pages did not show.
      const known = new Set(items.map((it) => it.id));
      for (const [id, ev] of eventByCmid) {
        if (known.has(id)) continue;
        const course = courses.find((c) => String(c.id) === String(ev.course && ev.course.id));
        items.push({
          id,
          type: ev.modulename,
          courseId: course ? course.id : String((ev.course && ev.course.id) || ""),
          courseName: course ? course.shortName : shortCourseName(decodeHtml((ev.course && ev.course.fullname) || "")),
          title: decodeHtml(ev.activityname || ev.name || ""),
          url: ev.url,
          due: ev.timesort * 1000,
          dueText: "",
          submitted: false,
          submission: "new",
          grade: "",
          firstSeen: (prevById.get(id) && prevById.get(id).firstSeen) || Date.now(),
        });
      }

      const vuData = {
        lastSync: Date.now(),
        fullName: session.fullName || prevData.fullName || "",
        courses,
        items,
        initialized: true,
        firstSync: !prevData.initialized,
      };
      await store.set({ [STORAGE_KEYS.data]: vuData });
      return vuData;
    } finally {
      await releaseLock();
    }
  }

  async function getData() {
    const data = await store.get(STORAGE_KEYS.data);
    return data[STORAGE_KEYS.data] || null;
  }

  // ---------------------------------------------------------------
  // Shared presentation helpers
  // ---------------------------------------------------------------
  // "overdue" | "submitted" | "pending" | "draft" | "nodue"
  function itemStatus(item, now = Date.now()) {
    if (item.submitted) return "submitted";
    if (item.due && item.due < now) return "overdue";
    if (item.submission === "draft") return "draft";
    if (!item.due) return "nodue";
    return "pending";
  }

  const faNum = (n) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);

  // { text, level: "overdue" | "urgent" (<24h) | "soon" (<3d) | "normal" | "none" }
  function formatTimeLeft(due, now = Date.now()) {
    if (!due) return { text: "بدون مهلت", level: "none" };
    const diff = due - now;
    const abs = Math.abs(diff);
    const mins = Math.floor(abs / 60000);
    const hours = Math.floor(abs / 3600000);
    const days = Math.floor(abs / 86400000);
    let span;
    if (mins < 60) span = `${faNum(Math.max(1, mins))} دقیقه`;
    else if (hours < 24) span = `${faNum(hours)} ساعت`;
    else if (days < 7) span = `${faNum(days)} روز${hours % 24 ? ` و ${faNum(hours % 24)} ساعت` : ""}`;
    else span = `${faNum(days)} روز`;
    if (diff < 0) return { text: `${span} گذشته`, level: "overdue" };
    return { text: `${span} مانده`, level: hours < 24 ? "urgent" : days < 3 ? "soon" : "normal" };
  }

  const shamsiFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const formatShamsi = (ms) => (ms ? shamsiFormatter.format(new Date(ms)) : "—");

  function relativeTime(ms, now = Date.now()) {
    if (!ms) return "هرگز";
    const mins = Math.round((now - ms) / 60000);
    if (mins < 1) return "همین الان";
    if (mins < 60) return `${faNum(mins)} دقیقه پیش`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${faNum(hours)} ساعت پیش`;
    return `${faNum(Math.round(hours / 24))} روز پیش`;
  }

  function googleCalendarUrl(item) {
    if (!item.due) return "";
    const fmt = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const end = new Date(item.due);
    const start = new Date(item.due - 60 * 60 * 1000);
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: `${item.type === "quiz" ? "آزمون" : "تکلیف"}: ${item.title} — ${item.courseName}`,
      dates: `${fmt(start)}/${fmt(end)}`,
      details: item.url,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  global.VU = {
    VU_ORIGIN,
    STORAGE_KEYS,
    DEFAULT_SETTINGS,
    VUError,
    errorMessage,
    parseMoodleDate,
    checkSession,
    ensureSession,
    connect,
    connectExistingSession,
    disconnect,
    getCredentials,
    getSettings,
    syncAll,
    getData,
    itemStatus,
    googleCalendarUrl,
    shortCourseName,
    // Shared with pooya-client.js (same oauth.um.ac.ir single sign-on).
    _internal: {
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
      jalaliToDate,
    },
    formatTimeLeft,
    formatShamsi,
    relativeTime,
    faNum,
  };
})(typeof self !== "undefined" ? self : window);
