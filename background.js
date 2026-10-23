// ===============================================================
// StuDash Focus Timer - Background Service Worker (Manifest V3)
// ===============================================================

// Shared date helpers (local calendar day, never UTC-shifted).
importScripts("jalali.js");

const DEFAULT_TIMER_STATE = {
  isRunning: false,
  isPaused: false,
  mode: "study", // "study" | "break" | "stopwatch"
  studyMinutes: 45,
  breakMinutes: 10,
  preset: "45_10",
  subjectTitle: "مطالعه آزاد",
  courseId: null,
  targetEndTime: null,
  elapsedSeconds: 0,
  remainingSeconds: 45 * 60,
  totalSeconds: 45 * 60,
  todayCompletedSessions: 0,
  todayStudyMinutes: 0,
  todayDateIso: StudashDate.todayIso(),
  showFloatingWidget: true,
  soundEnabled: true,
};

async function getTimerState() {
  const data = await chrome.storage.local.get("focusTimerState");
  let state = data.focusTimerState ? { ...DEFAULT_TIMER_STATE, ...data.focusTimerState } : { ...DEFAULT_TIMER_STATE };

  // Reset daily stats if day changed
  const todayIso = StudashDate.todayIso();
  if (state.todayDateIso !== todayIso) {
    state.todayDateIso = todayIso;
    state.todayCompletedSessions = 0;
    state.todayStudyMinutes = 0;
    await saveTimerState(state);
  }

  // Calculate live remaining seconds if timer is actively running
  if (state.isRunning && !state.isPaused) {
    if (state.mode === "stopwatch") {
      if (state.startedAt) {
        const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
        state.elapsedSeconds = Math.max(0, elapsed);
      }
    } else if (state.targetEndTime) {
      const left = Math.ceil((state.targetEndTime - Date.now()) / 1000);
      if (left <= 0) {
        // Timer completed while worker or tabs were idle
        await handleTimerCompleted(state);
        return state;
      }
      state.remainingSeconds = Math.max(0, left);
    }
  }

  return state;
}

async function saveTimerState(state) {
  await chrome.storage.local.set({ focusTimerState: state });
  updateBadge(state);
  broadcastState(state);
}

function updateBadge(state) {
  try {
    if (!state.isRunning) {
      if (state.isPaused) {
        chrome.action.setBadgeText({ text: "II" });
        chrome.action.setBadgeBackgroundColor({ color: "#ffd166" });
      } else {
        applyVuBadge();
      }
      return;
    }

    if (state.mode === "stopwatch") {
      const m = Math.floor(state.elapsedSeconds / 60);
      chrome.action.setBadgeText({ text: `${m}m` });
      chrome.action.setBadgeBackgroundColor({ color: "#6fc8f2" });
    } else {
      const m = Math.max(1, Math.ceil(state.remainingSeconds / 60));
      const prefix = state.mode === "break" ? "☕" : "";
      chrome.action.setBadgeText({ text: `${prefix}${m}m` });
      chrome.action.setBadgeBackgroundColor({
        color: state.mode === "break" ? "#6fcf97" : "#f2a65a",
      });
    }
  } catch (err) {
    // Ignore badge errors if context invalidated
  }
}

function broadcastState(state) {
  try {
    chrome.runtime.sendMessage({ action: "TIMER_STATE_UPDATED", state }).catch(() => {});
  } catch (e) {}
}

async function handleTimerCompleted(state) {
  const completedMode = state.mode;
  state.isRunning = false;
  state.isPaused = false;
  state.targetEndTime = null;

  if (completedMode === "study") {
    state.todayCompletedSessions = (state.todayCompletedSessions || 0) + 1;
    state.todayStudyMinutes = (state.todayStudyMinutes || 0) + (state.studyMinutes || 45);

    // Log this session into the daily study history (powers the Study Report panel)
    await logDailyStudyStat(state.studyMinutes || 45, state.courseId || null);

    // If linked to a university course, log study minutes to course in scheduleClasses
    if (state.courseId) {
      await logStudyTimeToCourse(state.courseId, state.studyMinutes || 45);
    }

    // Send Chrome Notification
    showNotification(
      "🎯 پارت مطالعه تکمیل شد!",
      `آفرین! پارت مطالعه «${state.subjectTitle || "مطالعه آزاد"}» تمام شد. الان وقت ${state.breakMinutes || 10} دقیقه استراحت است ☕`
    );

    // Switch to break mode
    state.mode = "break";
    state.totalSeconds = (state.breakMinutes || 10) * 60;
    state.remainingSeconds = state.totalSeconds;
  } else if (completedMode === "break") {
    showNotification(
      "🔔 وقت استراحت تمام شد!",
      "استراحت به پایان رسید. برای شروع پارت جدید مطالعه آماده‌ای؟ 🚀"
    );

    // Switch back to study mode
    state.mode = "study";
    state.totalSeconds = (state.studyMinutes || 45) * 60;
    state.remainingSeconds = state.totalSeconds;
  }

  await saveTimerState(state);
  chrome.alarms.clear("focusTimerAlarm");
}

function showNotification(title, message) {
  try {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: `StuDash | ${title}`,
      message: message,
      priority: 2,
      requireInteraction: true,
    });
  } catch (e) {}
}

async function logStudyTimeToCourse(courseId, minutes) {
  try {
    const data = await chrome.storage.local.get("scheduleClasses");
    const classes = data.scheduleClasses || [];
    const course = classes.find((c) => c.id === courseId);
    if (course) {
      course.totalStudyMinutes = (course.totalStudyMinutes || 0) + minutes;
      await chrome.storage.local.set({ scheduleClasses: classes });
    }
  } catch (e) {}
}

// ---------------------------------------------------------------
// Daily Study History (for the Study Report / weekly stats panel)
// ---------------------------------------------------------------
async function logDailyStudyStat(minutes, courseId) {
  try {
    const data = await chrome.storage.local.get("studyDailyLog");
    const log = data.studyDailyLog || {};
    const todayIso = StudashDate.todayIso();

    if (!log[todayIso]) {
      log[todayIso] = { total: 0, courses: {} };
    }
    log[todayIso].total = (log[todayIso].total || 0) + minutes;
    if (courseId) {
      log[todayIso].courses[courseId] = (log[todayIso].courses[courseId] || 0) + minutes;
    }

    // Keep storage lean: retain only the most recent 90 days of history
    const dateKeys = Object.keys(log).sort();
    if (dateKeys.length > 90) {
      dateKeys.slice(0, dateKeys.length - 90).forEach((k) => delete log[k]);
    }

    await chrome.storage.local.set({ studyDailyLog: log });
  } catch (e) {}
}

// ---------------------------------------------------------------
// Alarm Listeners
// ---------------------------------------------------------------
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "focusTimerAlarm") {
    const state = await getTimerState();
    if (state.isRunning && !state.isPaused) {
      await handleTimerCompleted(state);
    }
  }
});

// ---------------------------------------------------------------
// Runtime Messages
// ---------------------------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // VU messages and offscreen traffic are handled by the VU section below.
  if (message && (message.target === "offscreen" || String(message.action || "").startsWith("VU_"))) return false;
  (async () => {
    let state = await getTimerState();

    switch (message.action) {
      case "GET_TIMER_STATE": {
        sendResponse(state);
        break;
      }

      case "START_TIMER": {
        state.isRunning = true;
        state.isPaused = false;
        if (message.subjectTitle !== undefined) state.subjectTitle = message.subjectTitle;
        if (message.courseId !== undefined) state.courseId = message.courseId;
        if (message.mode) state.mode = message.mode;

        if (state.mode === "stopwatch") {
          state.startedAt = Date.now() - (state.elapsedSeconds || 0) * 1000;
          state.targetEndTime = null;
        } else {
          const duration = (state.remainingSeconds && state.remainingSeconds > 0)
            ? state.remainingSeconds
            : (state.totalSeconds || (state.studyMinutes * 60));
          state.remainingSeconds = duration;
          state.totalSeconds = state.totalSeconds || duration;
          state.targetEndTime = Date.now() + duration * 1000;
          state.startedAt = Date.now();
          chrome.alarms.create("focusTimerAlarm", { when: state.targetEndTime });
        }

        await saveTimerState(state);
        sendResponse(state);
        break;
      }

      case "PAUSE_TIMER": {
        if (state.isRunning) {
          state.isRunning = false;
          state.isPaused = true;
          if (state.mode === "stopwatch") {
            state.elapsedSeconds = Math.floor((Date.now() - state.startedAt) / 1000);
          } else {
            state.remainingSeconds = Math.max(0, Math.ceil((state.targetEndTime - Date.now()) / 1000));
          }
          state.targetEndTime = null;
          chrome.alarms.clear("focusTimerAlarm");
          await saveTimerState(state);
        }
        sendResponse(state);
        break;
      }

      case "RESUME_TIMER": {
        if (state.isPaused) {
          state.isRunning = true;
          state.isPaused = false;
          if (state.mode === "stopwatch") {
            state.startedAt = Date.now() - (state.elapsedSeconds || 0) * 1000;
          } else {
            state.targetEndTime = Date.now() + state.remainingSeconds * 1000;
            chrome.alarms.create("focusTimerAlarm", { when: state.targetEndTime });
          }
          await saveTimerState(state);
        }
        sendResponse(state);
        break;
      }

      case "RESET_TIMER": {
        state.isRunning = false;
        state.isPaused = false;
        state.targetEndTime = null;
        chrome.alarms.clear("focusTimerAlarm");

        if (state.mode === "stopwatch") {
          state.elapsedSeconds = 0;
        } else {
          const mins = state.mode === "break" ? state.breakMinutes : state.studyMinutes;
          state.totalSeconds = mins * 60;
          state.remainingSeconds = mins * 60;
        }

        await saveTimerState(state);
        sendResponse(state);
        break;
      }

      case "SET_PRESET": {
        state.preset = message.preset;
        state.studyMinutes = message.studyMinutes || state.studyMinutes;
        state.breakMinutes = message.breakMinutes || state.breakMinutes;
        state.mode = message.mode || "study";
        state.isRunning = false;
        state.isPaused = false;
        state.targetEndTime = null;
        chrome.alarms.clear("focusTimerAlarm");

        if (state.mode === "stopwatch") {
          state.elapsedSeconds = 0;
        } else {
          const mins = state.mode === "break" ? state.breakMinutes : state.studyMinutes;
          state.totalSeconds = mins * 60;
          state.remainingSeconds = mins * 60;
        }

        await saveTimerState(state);
        sendResponse(state);
        break;
      }

      case "SWITCH_MODE": {
        state.mode = message.mode; // "study" | "break" | "stopwatch"
        state.isRunning = false;
        state.isPaused = false;
        state.targetEndTime = null;
        chrome.alarms.clear("focusTimerAlarm");

        if (state.mode === "stopwatch") {
          state.elapsedSeconds = 0;
        } else {
          const mins = state.mode === "break" ? state.breakMinutes : state.studyMinutes;
          state.totalSeconds = mins * 60;
          state.remainingSeconds = mins * 60;
        }

        await saveTimerState(state);
        sendResponse(state);
        break;
      }

      case "TOGGLE_FLOATING_WIDGET": {
        state.showFloatingWidget = message.show !== undefined ? message.show : !state.showFloatingWidget;
        await saveTimerState(state);
        sendResponse(state);
        break;
      }

      case "SET_SUBJECT": {
        state.subjectTitle = message.subjectTitle || "مطالعه آزاد";
        state.courseId = message.courseId || null;
        await saveTimerState(state);
        sendResponse(state);
        break;
      }

      default:
        sendResponse(state);
    }
  })();

  return true; // Keep message channel open for async response
});


// ===============================================================
// VU (vu.um.ac.ir) integration: periodic sync, notifications, badge
// ===============================================================
const VU_SYNC_ALARM = "vuSyncAlarm";
const VU_OFFSCREEN_URL = "offscreen.html";
const VU_HEADER_RULE_IDS = [9101, 9102, 9103];
let vuPendingCount = 0;
let vuSyncPromise = null;

// Extension pages send Origin: chrome-extension://… — make POSTs to VU/Pooya/OAuth look same-origin.
async function installVuHeaderRules() {
  try {
    const hosts = ["vu.um.ac.ir", "oauth.um.ac.ir", "pooya.um.ac.ir"];
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: VU_HEADER_RULE_IDS,
      addRules: hosts.map((host, i) => ({
        id: VU_HEADER_RULE_IDS[i],
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: [{ header: "Origin", operation: "set", value: `https://${host}` }],
        },
        condition: {
          requestDomains: [host],
          initiatorDomains: [chrome.runtime.id],
          requestMethods: ["post"],
          resourceTypes: ["xmlhttprequest"],
        },
      })),
    });
  } catch (e) {
    console.warn("VU header rules failed", e);
  }
}

async function getVuSettings() {
  const data = await chrome.storage.local.get("vuSettings");
  return { syncMinutes: 30, notifications: true, ...(data.vuSettings || {}) };
}

async function scheduleVuAlarm() {
  const { vuCredentials } = await chrome.storage.local.get("vuCredentials");
  if (!vuCredentials) {
    await chrome.alarms.clear(VU_SYNC_ALARM);
    return;
  }
  const { syncMinutes } = await getVuSettings();
  const period = Math.max(15, Number(syncMinutes) || 30);
  const existing = await chrome.alarms.get(VU_SYNC_ALARM);
  if (!existing || existing.periodInMinutes !== period) {
    chrome.alarms.create(VU_SYNC_ALARM, { delayInMinutes: 1, periodInMinutes: period });
  }
}

async function ensureVuOffscreen() {
  if (chrome.offscreen.hasDocument && (await chrome.offscreen.hasDocument())) return;
  try {
    await chrome.offscreen.createDocument({
      url: VU_OFFSCREEN_URL,
      reasons: ["DOM_PARSER"],
      justification: "Parse VU (Moodle) pages to read assignments and deadlines.",
    });
  } catch (e) {
    if (!String(e.message || "").includes("single offscreen")) throw e;
  }
}

async function runVuSync(force = false) {
  const { vuCredentials } = await chrome.storage.local.get("vuCredentials");
  if (!vuCredentials) return { ok: false, code: "NO_CREDENTIALS" };
  if (vuSyncPromise) return vuSyncPromise;

  vuSyncPromise = (async () => {
    try {
      await ensureVuOffscreen();
      const res = await chrome.runtime.sendMessage({ target: "offscreen", action: "VU_SYNC_OFFSCREEN", force });
      const result = res || { ok: false, error: "پاسخی از همگام‌ساز دریافت نشد." };
      await chrome.storage.local.set({ vuLastSyncResult: { ...result, at: Date.now() } });
      return result;
    } catch (e) {
      return { ok: false, error: e.message };
    } finally {
      try { await chrome.offscreen.closeDocument(); } catch (e) {}
      vuSyncPromise = null;
    }
  })();
  return vuSyncPromise;
}

// ---------- badge ----------
function computeVuPending(vuData) {
  const now = Date.now();
  return ((vuData && vuData.items) || []).filter(
    (it) => !it.submitted && it.due && it.due >= now && it.due - now <= 7 * 86400000
  ).length;
}

function applyVuBadge() {
  try {
    if (vuPendingCount > 0) {
      chrome.action.setBadgeText({ text: String(vuPendingCount) });
      chrome.action.setBadgeBackgroundColor({ color: "#e8735a" });
      chrome.action.setTitle({ title: `StuDash — ${vuPendingCount} تکلیف تا ۷ روز آینده` });
    } else {
      chrome.action.setBadgeText({ text: "" });
      chrome.action.setTitle({ title: "StuDash" });
    }
  } catch (e) {}
}

async function refreshVuBadge(vuData) {
  if (vuData === undefined) vuData = (await chrome.storage.local.get("vuData")).vuData;
  vuPendingCount = computeVuPending(vuData);
  const { focusTimerState } = await chrome.storage.local.get("focusTimerState");
  if (focusTimerState && (focusTimerState.isRunning || focusTimerState.isPaused)) return; // timer owns the badge
  applyVuBadge();
}

// ---------- notifications ----------
function showVuNotification(id, title, message) {
  try {
    chrome.notifications.create(id, {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: `StuDash | ${title}`,
      message,
      priority: 2,
    });
  } catch (e) {}
}

const faNum = (n) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);

function vuTimeLeftText(ms) {
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return `${faNum(Math.max(1, Math.floor(ms / 60000)))} دقیقه`;
  return `${faNum(hours)} ساعت`;
}

async function processVuNotifications(newData, oldData) {
  if (!newData || !newData.items) return;
  const settings = await getVuSettings();
  if (!settings.notifications) return;

  const now = Date.now();
  const { vuNotified = {} } = await chrome.storage.local.get("vuNotified");
  const kindLabel = (it) => (it.type === "quiz" ? "آزمون" : "تکلیف");

  // 1) New activities (skip the very first sync, which would flag everything).
  if (!newData.firstSync && oldData && oldData.items) {
    const oldIds = new Set(oldData.items.map((it) => it.id));
    const fresh = newData.items.filter(
      (it) => !oldIds.has(it.id) && !it.submitted && (!it.due || it.due > now) && !vuNotified[`${it.id}:new`]
    );
    if (fresh.length > 3) {
      showVuNotification("vu|dashboard", "تکالیف جدید در VU", `${faNum(fresh.length)} تکلیف/آزمون جدید اضافه شد.`);
    } else {
      for (const it of fresh) {
        showVuNotification(`vu|${it.url}`, `${kindLabel(it)} جدید: ${it.courseName}`, it.title);
      }
    }
    fresh.forEach((it) => (vuNotified[`${it.id}:new`] = now));
  }

  // 2) Deadline reminders: 24h and 3h before due.
  for (const it of newData.items) {
    if (it.submitted || !it.due || it.due <= now) continue;
    const left = it.due - now;
    const k3 = `${it.id}:3`;
    const k24 = `${it.id}:24`;
    let fire = false;
    if (left <= 3 * 3600000 && !vuNotified[k3]) {
      vuNotified[k3] = now;
      vuNotified[k24] = vuNotified[k24] || now;
      fire = true;
    } else if (left <= 24 * 3600000 && !vuNotified[k24]) {
      vuNotified[k24] = now;
      fire = true;
    }
    if (fire) {
      showVuNotification(
        `vu|${it.url}|${left <= 3 * 3600000 ? 3 : 24}`,
        `⏰ ${vuTimeLeftText(left)} تا مهلت ${kindLabel(it)}`,
        `${it.title} — ${it.courseName}`
      );
    }
  }

  // Prune old entries.
  for (const [k, t] of Object.entries(vuNotified)) {
    if (!t || now - t > 30 * 86400000) delete vuNotified[k];
  }
  await chrome.storage.local.set({ vuNotified });
}

chrome.notifications.onClicked.addListener((id) => {
  if (!id.startsWith("vu|")) return;
  const target = id.split("|")[1];
  chrome.tabs.create({ url: target === "dashboard" ? chrome.runtime.getURL("newtab.html") : target });
  chrome.notifications.clear(id);
});

// ---------- wiring ----------
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.vuData) {
    refreshVuBadge(changes.vuData.newValue || null);
    processVuNotifications(changes.vuData.newValue, changes.vuData.oldValue);
  }
  if (changes.vuSettings) scheduleVuAlarm();
  if (changes.vuCredentials && !changes.vuCredentials.newValue) {
    chrome.alarms.clear(VU_SYNC_ALARM);
    vuPendingCount = 0;
    refreshVuBadge(null);
  }
  if (changes.focusTimerState) {
    const s = changes.focusTimerState.newValue;
    if (s && !s.isRunning && !s.isPaused) applyVuBadge();
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === VU_SYNC_ALARM) runVuSync();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.target === "offscreen") return false;
  switch (message.action) {
    case "VU_SYNC":
      runVuSync(Boolean(message.force)).then(sendResponse);
      return true;
    case "VU_STORAGE": {
      // Storage proxy for the offscreen document (it has no chrome.storage).
      if (!sender.url || !sender.url.startsWith(`chrome-extension://${chrome.runtime.id}/`)) return false;
      const area = chrome.storage.local;
      const op = message.op === "set" ? area.set(message.items) : message.op === "remove" ? area.remove(message.keys) : area.get(message.keys);
      op.then((r) => sendResponse(r || {})).catch(() => sendResponse({}));
      return true;
    }
    case "VU_CONNECTED":
      scheduleVuAlarm();
      return false;
    case "VU_DISCONNECT":
      chrome.alarms.clear(VU_SYNC_ALARM);
      vuPendingCount = 0;
      applyVuBadge();
      return false;
    default:
      return false;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  installVuHeaderRules();
  scheduleVuAlarm();
});
chrome.runtime.onStartup.addListener(() => {
  scheduleVuAlarm();
  runVuSync();
});

// Session rules don't survive a browser restart, and the worker can be restarted any time.
installVuHeaderRules();
refreshVuBadge();
