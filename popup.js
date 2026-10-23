// StuDash toolbar popup: VU login + quick deadline summary.
const $ = (id) => document.getElementById(id);

const loginView = $("loginView");
const connectedView = $("connectedView");

function setLoading(btn, loading) {
  btn.disabled = loading;
  const spinner = btn.querySelector(".pp-spinner");
  if (spinner) spinner.toggleAttribute("hidden", !loading); // SVG: no .hidden property
  btn.setAttribute("aria-busy", loading ? "true" : "false");
}

function showError(el, message) {
  el.textContent = message || "";
  el.hidden = !message;
}

// Background owns syncing (offscreen document), so it keeps running if the popup closes.
function requestSync() {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ action: "VU_SYNC" }, (res) => {
        if (chrome.runtime.lastError) return resolve({ ok: false, error: chrome.runtime.lastError.message });
        resolve(res || { ok: false });
      });
    } catch (e) {
      resolve({ ok: false, error: e.message });
    }
  });
}

async function runSync() {
  const btn = $("syncBtn");
  btn.classList.add("spinning");
  btn.disabled = true;
  showError($("syncError"), "");
  const res = await requestSync();
  btn.classList.remove("spinning");
  btn.disabled = false;
  if (!res.ok && res.error) showError($("syncError"), res.error);
  await render();
}

function renderConnected(creds, data) {
  loginView.hidden = true;
  connectedView.hidden = false;

  $("accountName").textContent = (data && data.fullName) || creds.fullName || creds.username || "دانشجو";
  $("lastSyncLabel").textContent = data && data.lastSync
    ? `آخرین همگام‌سازی: ${VU.relativeTime(data.lastSync)}`
    : "در حال دریافت اطلاعات…";

  const now = Date.now();
  const items = (data && data.items) || [];
  const pending = items.filter((it) => !it.submitted && it.due && it.due >= now).sort((a, b) => a.due - b.due);
  const urgent = pending.filter((it) => it.due - now < 3 * 86400000);
  const submitted = items.filter((it) => it.submitted);

  $("statPending").textContent = VU.faNum(pending.length);
  $("statUrgent").textContent = VU.faNum(urgent.length);
  $("statSubmitted").textContent = VU.faNum(submitted.length);

  const list = $("upcomingList");
  list.innerHTML = "";
  for (const item of pending.slice(0, 4)) {
    const left = VU.formatTimeLeft(item.due, now);
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = item.url;
    a.target = "_blank";
    a.rel = "noopener";

    const info = document.createElement("div");
    const title = document.createElement("span");
    title.className = "pp-item-title";
    title.textContent = `${item.type === "quiz" ? "🧪" : "📝"} ${item.title}`;
    const course = document.createElement("span");
    course.className = "pp-item-course";
    course.textContent = item.courseName;
    info.append(title, course);

    const due = document.createElement("span");
    due.className = "pp-due" + (left.level === "urgent" ? " urgent" : "");
    due.textContent = left.text;
    due.title = VU.formatShamsi(item.due);

    a.append(info, due);
    li.appendChild(a);
    list.appendChild(li);
  }
  $("upcomingEmpty").hidden = pending.length > 0 || !(data && data.lastSync);
}

async function renderLogin() {
  connectedView.hidden = true;
  loginView.hidden = false;
  $("vuUsername").focus();

  // Offer the session the browser already has, if any.
  try {
    const session = await VU.checkSession();
    if (session) {
      $("existingName").textContent = session.fullName ? ` (${session.fullName})` : "";
      $("existingSessionBox").hidden = false;
    }
  } catch (e) {}
}

async function render() {
  const creds = await VU.getCredentials();
  if (!creds) return renderLogin();
  renderConnected(creds, await VU.getData());
}

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("loginBtn");
  showError($("loginError"), "");
  setLoading(btn, true);
  try {
    const username = $("vuUsername").value;
    const password = $("vuPassword").value;
    await VU.connect(username, password);
    $("vuPassword").value = "";
    await render();
    runSync();
    // First login: same university account → import the class schedule from Pooya too.
    const { pooyaCredentials } = await chrome.storage.local.get("pooyaCredentials");
    if (!pooyaCredentials) runPooyaImport($("pooyaUseVuBtn"), () => Pooya.connect(username, password));
  } catch (err) {
    showError($("loginError"), VU.errorMessage(err));
  } finally {
    setLoading(btn, false);
  }
});

$("useSessionBtn").addEventListener("click", async () => {
  try {
    await VU.connectExistingSession();
    await render();
    runSync();
  } catch (err) {
    showError($("loginError"), VU.errorMessage(err));
  }
});

$("togglePass").addEventListener("click", () => {
  const input = $("vuPassword");
  input.type = input.type === "password" ? "text" : "password";
});

$("openVuLoginBtn").addEventListener("click", () => {
  chrome.tabs.create({ url: `${VU.VU_ORIGIN}/login/index.php` });
});

$("syncBtn").addEventListener("click", runSync);

// Header: quick appearance toggle (Light → Dark → System) and dashboard shortcut.
const MODE_ORDER = ["light", "dark", "system"];
const MODE_META = {
  light: { icon: "sd-icon--sun", label: "حالت روشن" },
  dark: { icon: "sd-icon--moon", label: "حالت تیره" },
  system: { icon: "sd-icon--monitor", label: "حالت سیستم" },
};
function syncThemeButton(a) {
  const meta = MODE_META[a.mode];
  $("themeCycleIcon").className = `sd-icon ${meta.icon}`;
  $("themeCycleBtn").setAttribute("data-tooltip", `${meta.label} — کلیک برای تغییر`);
  $("themeCycleBtn").setAttribute("aria-label", `${meta.label}، تغییر حالت نمایش`);
}
$("themeCycleBtn").addEventListener("click", () => {
  const next = MODE_ORDER[(MODE_ORDER.indexOf(StudashTheme.get().mode) + 1) % MODE_ORDER.length];
  StudashTheme.update({ mode: next });
});
StudashTheme.onChange(syncThemeButton);
syncThemeButton(StudashTheme.get());
StudashTheme.ready.then(syncThemeButton);

$("openDashboardTopBtn").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("newtab.html") });
  window.close();
});

$("openDashboardBtn").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("newtab.html") });
  window.close();
});

$("disconnectBtn").addEventListener("click", async () => {
  if (!confirm("اتصال VU قطع شود؟ نام کاربری، رمز و اطلاعات ذخیره‌شده پاک می‌شوند.")) return;
  await VU.disconnect();
  await render();
});

// ---------------------------------------------------------------
// Pooya: login (same oauth.um.ac.ir SSO) + class schedule import
// ---------------------------------------------------------------
const pooyaMessage = (err) => VU.errorMessage(err).replace(/VU/g, "پویا");
const PARITY_LABEL = { even: "زوج", odd: "فرد" };
let pooyaMode = "vu"; // "vu" (reuse VU account) | "form" | "session"

function pooyaSetLoading(btn, loading) {
  setLoading(btn, loading);
  document.querySelectorAll("#pooyaSection button").forEach((b) => (b.disabled = loading));
}

async function renderPooya() {
  const data = await chrome.storage.local.get(["pooyaCredentials", "pooyaTerm", "weekParityRef", "vuCredentials", "scheduleClasses"]);
  const connected = Boolean(data.pooyaCredentials);
  $("pooyaConnectBox").hidden = connected;
  $("pooyaConnectedBox").hidden = !connected;

  const parity = Pooya.parityForDate(data.weekParityRef);
  $("pooyaParityPill").hidden = !parity;
  if (parity) $("pooyaParityPill").textContent = `این هفته: ${PARITY_LABEL[parity]}`;

  if (connected) {
    const t = data.pooyaTerm || {};
    const count = (data.scheduleClasses || []).filter((c) => c.importedFrom === "pooya").length;
    const term = t.semester ? `نیمسال ${t.semester} ${VU.faNum(t.year || "")}` : "برنامه وارد شده";
    $("pooyaStatus").textContent = `${term} • ${VU.faNum(count)} درس • ${VU.relativeTime(t.importedAt)}`;
    return;
  }

  const vu = data.vuCredentials;
  const canReuseVu = Boolean(vu && vu.password);
  if (pooyaMode === "vu" && !canReuseVu) pooyaMode = "form";
  if (pooyaMode === "form" && !$("pooyaUsername").value && vu && vu.username) $("pooyaUsername").value = vu.username;

  $("pooyaUseVuBtn").hidden = pooyaMode === "form";
  $("pooyaForm").hidden = pooyaMode !== "form";
  $("pooyaOtherAccountBtn").hidden = pooyaMode === "form";

  // A Pooya session that the browser already has can be used without a password.
  if (pooyaMode === "form" || !canReuseVu) {
    try {
      if (await Pooya.checkSession()) {
        pooyaMode = "session";
        $("pooyaUseVuBtn").hidden = false;
        $("pooyaUseVuBtn").querySelector(".pp-btn-label").textContent = "وارد کردن برنامه از ورود فعلی پویا";
        $("pooyaForm").hidden = true;
        $("pooyaOtherAccountBtn").hidden = false;
      }
    } catch (e) {}
  }
}

async function runPooyaImport(btn, connectFn) {
  showError($("pooyaError"), "");
  $("pooyaSuccess").hidden = true;
  pooyaSetLoading(btn, true);
  try {
    if (connectFn) await connectFn();
    const r = await Pooya.importSchedule();
    const parts = [`${VU.faNum(r.courses)} درس وارد شد`];
    if (r.added || r.updated) parts.push(`(${VU.faNum(r.added)} جدید، ${VU.faNum(r.updated)} به‌روز)`);
    if (r.parity) parts.push(`• این هفته ${PARITY_LABEL[r.parity]} است`);
    $("pooyaSuccess").textContent = `✅ ${parts.join(" ")}`;
    $("pooyaSuccess").hidden = false;
  } catch (err) {
    showError($("pooyaError"), pooyaMessage(err));
  } finally {
    pooyaSetLoading(btn, false);
    renderPooya();
  }
}

$("pooyaUseVuBtn").addEventListener("click", async () => {
  const btn = $("pooyaUseVuBtn");
  if (pooyaMode === "session") return runPooyaImport(btn, () => Pooya.connectExistingSession());
  const { vuCredentials } = await chrome.storage.local.get("vuCredentials");
  runPooyaImport(btn, () => Pooya.connect(vuCredentials.username, vuCredentials.password));
});

$("pooyaForm").addEventListener("submit", (e) => {
  e.preventDefault();
  runPooyaImport($("pooyaLoginBtn"), async () => {
    await Pooya.connect($("pooyaUsername").value, $("pooyaPassword").value);
    $("pooyaPassword").value = "";
  });
});

$("pooyaOtherAccountBtn").addEventListener("click", () => {
  pooyaMode = "form";
  $("pooyaUseVuBtn").querySelector(".pp-btn-label").textContent = "ورود به پویا با همین حساب و وارد کردن برنامه";
  $("pooyaUseVuBtn").hidden = true;
  $("pooyaForm").hidden = false;
  $("pooyaOtherAccountBtn").hidden = true;
  $("pooyaUsername").focus();
});

$("pooyaImportBtn").addEventListener("click", () => runPooyaImport($("pooyaImportBtn")));

$("pooyaDisconnectBtn").addEventListener("click", async () => {
  if (!confirm("اتصال پویا قطع شود؟ برنامه کلاسی واردشده باقی می‌ماند.")) return;
  await Pooya.disconnect();
  pooyaMode = "vu";
  renderPooya();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.vuData || changes.vuCredentials) render();
  if (changes.vuCredentials || changes.pooyaCredentials || changes.pooyaTerm || changes.weekParityRef) renderPooya();
});

render();
renderPooya();
