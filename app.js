// ---------------------------------------------------------------
// storage helpers (chrome.storage.local, promise-based in MV3)
// ---------------------------------------------------------------
const storageGet = (keys) => chrome.storage.local.get(keys);
const storageSet = (obj) => chrome.storage.local.set(obj);

const pad2 = (n) => String(n).padStart(2, "0");
const isoDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const sameDay = (a, b) => isoDate(a) === isoDate(b);

const WEEKDAY_LABELS = ["ی", "د", "س", "چ", "پ", "ج", "ش"]; // getDay(): 0=Sunday
const MONTH_LABELS = [
  "ژانویه", "فوریه", "مارس", "آوریل", "مه", "ژوئن",
  "ژوئیه", "اوت", "سپتامبر", "اکتبر", "نوامبر", "دسامبر"
];
const MONTH_LABELS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const SHAMSI_MONTH_LABELS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
];
const WEEKDAY_LONG = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
const WEEKDAY_LONG_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const faDigits = (str) => String(str).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);

// ---------------------------------------------------------------
// Jalali (Shamsi) conversion — exact arithmetic in jalali.js (StudashDate).
// Invalid input throws; callers that may see bad data check first.
// ---------------------------------------------------------------
function toJalali(date) {
  return StudashDate.toJalali(date);
}

function toGregorian(jy, jm, jd) {
  return StudashDate.toGregorian(jy, jm, jd);
}

function jalaliMonthDays(jy, jm) {
  return StudashDate.jalaliMonthLength(jy, jm);
}

// ---------------------------------------------------------------
// horizon bar + clock + greeting
// ---------------------------------------------------------------
function horizonColorsFor(hour) {
  if (hour >= 5 && hour < 8) return ["#f2a65a", "#f4d2a0"];   // dawn
  if (hour >= 8 && hour < 17) return ["#6fc8f2", "#f2d06f"];  // day
  if (hour >= 17 && hour < 20) return ["#f2a65a", "#a25ad8"]; // sunset
  return ["#4a4fb0", "#1b1e3d"];                                // night
}

let userProfile = { name: "", major: "" };

function greetingFor(hour) {
  const nameSuffix = userProfile.name ? ` ${userProfile.name} جان` : "";
  if (hour >= 5 && hour < 12) return `صبح بخیر${nameSuffix} ☀️`;
  if (hour >= 12 && hour < 17) return `ظهر بخیر${userProfile.name ? ` ${userProfile.name}` : ""}`;
  if (hour >= 17 && hour < 20) return `عصر بخیر${nameSuffix} 🌇`;
  return `شب بخیر${nameSuffix} 🌙`;
}

function tickClock() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  document.getElementById("clock").textContent = `${pad2(h)}:${pad2(m)}`;
  document.getElementById("greeting").textContent = greetingFor(h);

  // Modern English Date (e.g. "Friday, September 4, 2026")
  const weekdayNameEn = WEEKDAY_LONG_EN[now.getDay()];
  const monthNameEn = MONTH_LABELS_EN[now.getMonth()];
  const dateEl = document.getElementById("dateToday");
  if (dateEl) {
    dateEl.textContent = `${weekdayNameEn}, ${monthNameEn} ${now.getDate()}, ${now.getFullYear()}`;
  }

  const secondaryEl = document.getElementById("dateTodaySecondary");
  if (secondaryEl) {
    secondaryEl.textContent = "";
  }

  const [a, b] = horizonColorsFor(h);
  document.documentElement.style.setProperty("--horizon-a", a);
  document.documentElement.style.setProperty("--horizon-b", b);
}

// ---------------------------------------------------------------
// search
// ---------------------------------------------------------------
document.getElementById("searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = document.getElementById("searchInput").value.trim();
  if (!q) return;
  window.location.href = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
});

// ---------------------------------------------------------------
// pinned sites (Default Suggestions & Custom Sites)
// ---------------------------------------------------------------
const DEFAULT_PINNED_SITES = [
  { id: "def-google-apps", title: "Google Apps", url: "https://about.google/products/", isGooglePackage: true },
  { id: "def-research-hub", title: "Research Hub", url: "https://scholar.google.com/", isResearchPackage: true },
  { id: "def-ai-hub", title: "AI Hub", url: "https://chatgpt.com/ai-hub", isAiPackage: true },
  { id: "def-pooya", title: "Pooya Portal", url: "https://pooya.um.ac.ir/" },
  { id: "def-vu", title: "VU Portal", url: "https://vu.um.ac.ir" },
  { id: "def-fum", title: "FUM Website", url: "https://www.um.ac.ir" },
  { id: "def-chatgpt", title: "ChatGPT", url: "https://chatgpt.com/" },
  { id: "def-claude", title: "Claude", url: "https://claude.ai/" },
  { id: "def-gemini", title: "Gemini", url: "https://gemini.google.com/" },
];

const PRESET_TITLE_MAP = {
  "https://pooya.um.ac.ir": "Pooya Portal",
  "https://vu.um.ac.ir": "VU Portal",
  "https://webmail.um.ac.ir": "Webmail",
  "https://www.um.ac.ir": "FUM Website",
  "https://chatgpt.com": "ChatGPT",
  "https://claude.ai": "Claude",
  "https://gemini.google.com": "Gemini",
  "https://calendar.google.com": "Google Calendar",
  "https://mail.google.com": "Gmail",
  "https://drive.google.com": "Google Drive",
  "https://meet.google.com": "Google Meet",
  "https://classroom.google.com": "Google Classroom",
  "https://github.com": "GitHub",
};

const pinnedGrid = document.getElementById("pinnedGrid");
const pinnedEmpty = document.getElementById("pinnedEmpty");
const pinDialog = document.getElementById("pinDialog");
const pinForm = document.getElementById("pinForm");
const pinDialogCloseBtn = document.getElementById("pinDialogCloseBtn");

let pinnedSites = [];

function normalizeUrl(raw) {
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try {
    return new URL(url).href;
  } catch {
    return null;
  }
}

function faviconFor(url) {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
  } catch {
    return "";
  }
}

function getCustomBrandIcon(site) {
  const url = (site.url || "").toLowerCase();
  const title = (site.title || "").toLowerCase();

  // 1. Pooya Portal (پرتال پویای دانشگاه فردوسی)
  if (url.includes("pooya.um.ac.ir") || title.includes("pooya") || title.includes("پویا")) {
    return `
      <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
        <rect width="36" height="36" rx="8" fill="url(#pooyaGrad)" />
        <path d="M18 9L7 15L18 21L29 15L18 9Z" fill="#FFFFFF" />
        <path d="M10.5 18V23.5C10.5 26 13.5 28 18 28C22.5 28 25.5 26 25.5 23.5V18L18 22L10.5 18Z" fill="#E0F2FE" />
        <path d="M29 15.5V23" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" />
        <circle cx="29" cy="24" r="1.5" fill="#FFFFFF" />
        <defs>
          <linearGradient id="pooyaGrad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop stop-color="#0284C7"/>
            <stop offset="1" stop-color="#0369A1"/>
          </linearGradient>
        </defs>
      </svg>
    `;
  }

  // 2. VU Portal (سامانه آموزش مجازی و سه‌با)
  if (url.includes("vu.um.ac.ir") || title.includes("vu portal") || title.includes("سه‌با") || title.includes("مجازی")) {
    return `
      <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
        <rect width="36" height="36" rx="8" fill="url(#vuGrad)" />
        <rect x="7" y="8" width="22" height="16" rx="3" fill="#FFFFFF" />
        <polygon points="15,12.5 22,16 15,19.5" fill="#4F46E5" />
        <path d="M12 28H24M18 24V28" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" />
        <defs>
          <linearGradient id="vuGrad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop stop-color="#6366F1"/>
            <stop offset="1" stop-color="#4338CA"/>
          </linearGradient>
        </defs>
      </svg>
    `;
  }

  // 3. Webmail (ایمیل دانشگاهی فردوسی)
  if (url.includes("webmail.um.ac.ir") || title.includes("webmail") || title.includes("وب‌میل") || title.includes("ایمیل دانشگاه")) {
    return `
      <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
        <rect width="36" height="36" rx="8" fill="url(#webmailGrad)" />
        <rect x="7" y="9" width="22" height="18" rx="3" fill="#FFFFFF" />
        <path d="M7 11L18 19L29 11" stroke="#E11D48" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
        <defs>
          <linearGradient id="webmailGrad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop stop-color="#E11D48"/>
            <stop offset="1" stop-color="#9F1239"/>
          </linearGradient>
        </defs>
      </svg>
    `;
  }

  // 4. FUM Main Website (سایت اصلی دانشگاه فردوسی مشهد)
  if (url.includes("um.ac.ir") || title.includes("fum") || title.includes("فردوسی")) {
    return `
      <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
        <rect width="36" height="36" rx="8" fill="url(#fumGrad)" />
        <path d="M18 7L7 13H29L18 7Z" fill="#FBBF24" />
        <rect x="9.5" y="14" width="3" height="11" rx="0.5" fill="#FFFFFF" />
        <rect x="14.5" y="14" width="3" height="11" rx="0.5" fill="#FFFFFF" />
        <rect x="19.5" y="14" width="3" height="11" rx="0.5" fill="#FFFFFF" />
        <rect x="24.5" y="14" width="3" height="11" rx="0.5" fill="#FFFFFF" />
        <rect x="7" y="25.5" width="22" height="3" rx="1" fill="#FBBF24" />
        <defs>
          <linearGradient id="fumGrad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop stop-color="#1E3A8A"/>
            <stop offset="1" stop-color="#0F172A"/>
          </linearGradient>
        </defs>
      </svg>
    `;
  }

  // 5. ChatGPT
  if (url.includes("chatgpt.com") || url.includes("openai.com") || title.includes("chatgpt")) {
    return `
      <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
        <rect width="36" height="36" rx="8" fill="#10A37F" />
        <path d="M26.2 14.8a4.4 4.4 0 0 0-.4-3.6 4.5 4.5 0 0 0-4.8-2.2 4.5 4.5 0 0 0-4.6-2 4.4 4.4 0 0 0-3 2.1 4.5 4.5 0 0 0 .5 5.2 4.4 4.4 0 0 0 .4 3.6 4.5 4.5 0 0 0 4.8 2.2 4.4 4.4 0 0 0 4.6 2 4.4 4.4 0 0 0 3-2.1 4.5 4.5 0 0 0-.5-5.2zm-6.6 9.3a3.3 3.3 0 0 1-2.1-.8l.1-.1 3.5-2a.6.6 0 0 0 .3-.5v-4.9l1.5.9a.1.1 0 0 1 0 0v4.1a3.3 3.3 0 0 1-3.3 3.3zm-6.5-2.7a3.3 3.3 0 0 1-.5-2.2v-.1l3.5 2a.6.6 0 0 0 .6 0l4.2-2.5v1.7a.1.1 0 0 1 0 .1l-3.6 2.1a3.3 3.3 0 0 1-4.2-1.1zm-1.8-6.6a3.3 3.3 0 0 1 1.6-1.5l-.1.1v4.1a.6.6 0 0 0 .3.5l4.2 2.5-1.5.9a.1.1 0 0 1-.1 0l-3.6-2.1a3.3 3.3 0 0 1-.9-4.5zm11.5-1.4l-4.2 2.5-1.5-.9a.1.1 0 0 1 0-.1l3.6-2.1a3.3 3.3 0 0 1 4.2 1.1 3.3 3.3 0 0 1 .5 2.2v.1l-3.5-2a.6.6 0 0 0-.6 0zm2.7 4.9a3.3 3.3 0 0 1-1.6 1.5l.1-.1v-4.1a.6.6 0 0 0-.3-.5l-4.2-2.5 1.5-.9a.1.1 0 0 1 .1 0l3.6 2.1a3.3 3.3 0 0 1 .9 4.5zm-8.4-.7l1.9-1.1 1.9 1.1v2.2l-1.9 1.1-1.9-1.1v-2.2z" fill="#FFFFFF"/>
      </svg>
    `;
  }

  // 6. Claude
  if (url.includes("claude.ai") || title.includes("claude")) {
    return `
      <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
        <rect width="36" height="36" rx="8" fill="#D97706" />
        <path d="M19.8 8.2l1.8 5.7 5.7-1.8-3.5 5 5 3.5-5.7-1.8 1.8 5.7-5-3.5-1.8 5.7-1.8-5.7-5 3.5 1.8-5.7-5.7 1.8 5-3.5-3.5-5 5.7 1.8-1.8-5.7 5 3.5z" fill="#FFFFFF"/>
      </svg>
    `;
  }

  // 7. Gemini
  if (url.includes("gemini.google.com") || title.includes("gemini")) {
    return `
      <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
        <rect width="36" height="36" rx="8" fill="#0F172A" />
        <path d="M18 6C18 12.6 12.6 18 6 18C12.6 18 18 23.4 18 30C18 23.4 23.4 18 30 18C23.4 18 18 12.6 18 6Z" fill="url(#geminiBrandGrad)"/>
        <defs>
          <linearGradient id="geminiBrandGrad" x1="6" y1="6" x2="30" y2="30" gradientUnits="userSpaceOnUse">
            <stop stop-color="#38BDF8"/>
            <stop offset="0.5" stop-color="#818CF8"/>
            <stop offset="1" stop-color="#F472B6"/>
          </linearGradient>
        </defs>
      </svg>
    `;
  }

  return null;
}

function updatePresetChipsUI() {
  const chips = document.querySelectorAll(".preset-chip");
  chips.forEach((chip) => {
    const pkg = chip.dataset.package;
    if (pkg === "google") {
      const isAdded = pinnedSites.some((s) => s.id === "def-google-apps" || s.isGooglePackage || s.title === "Google Apps");
      chip.classList.toggle("added", isAdded);
      chip.innerHTML = isAdded ? "✓ پکیج Google Apps (فعال)" : "+ پکیج Google Apps";
    } else if (pkg === "research") {
      const isAdded = pinnedSites.some((s) => s.id === "def-research-hub" || s.isResearchPackage || s.title === "Research Hub");
      chip.classList.toggle("added", isAdded);
      chip.innerHTML = isAdded ? "✓ پکیج Research Hub (فعال)" : "+ پکیج Research Hub";
    } else if (pkg === "ai") {
      const isAdded = pinnedSites.some((s) => s.id === "def-ai-hub" || s.isAiPackage || s.title === "AI Hub");
      chip.classList.toggle("added", isAdded);
      chip.innerHTML = isAdded ? "✓ پکیج AI Hub (فعال)" : "+ پکیج AI Hub";
    } else {
      const url = chip.dataset.url;
      const isAdded = url ? pinnedSites.some((s) => s.url.replace(/\/$/, "") === url.replace(/\/$/, "")) : false;
      chip.classList.toggle("added", isAdded);
      if (isAdded) {
        chip.innerHTML = `✓ ${chip.dataset.title}`;
      } else {
        chip.innerHTML = `+ ${chip.dataset.title}`;
      }
    }
  });
}

let dragSrcIndex = null;
let isDraggingSite = false;

function renderPinned() {
  pinnedGrid.innerHTML = "";
  pinnedEmpty.hidden = pinnedSites.length > 0;

  pinnedSites.forEach((site, index) => {
    const a = document.createElement("a");
    a.className = "pin-tile";
    a.href = site.url;
    a.draggable = false;
    a.dataset.index = index;
    a.title = "برای باز کردن کلیک کنید";

    const dragHandle = document.createElement("span");
    dragHandle.className = "pin-drag-handle";
    dragHandle.draggable = true;
    dragHandle.textContent = "⋮⋮";
    dragHandle.title = "برای جابه‌جایی بکشید";
    dragHandle.addEventListener("click", (e) => e.preventDefault());

    // Prevent accidental link opening when dragging
    a.addEventListener("click", (e) => {
      if (isDraggingSite) {
        e.preventDefault();
      }
    });

    // --- Drag and Drop Handlers ---
    dragHandle.addEventListener("dragstart", (e) => {
      dragSrcIndex = index;
      isDraggingSite = true;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", index);
      // Asynchronously add class so drag ghost image is clear
      setTimeout(() => {
        a.classList.add("is-dragging");
      }, 0);
    });

    dragHandle.addEventListener("dragend", () => {
      a.classList.remove("is-dragging");
      document.querySelectorAll(".pin-tile").forEach((el) => {
        el.classList.remove("drag-over");
        el.classList.remove("is-dragging");
      });
      setTimeout(() => {
        isDraggingSite = false;
        dragSrcIndex = null;
      }, 50);
    });

    a.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });

    a.addEventListener("dragenter", (e) => {
      e.preventDefault();
      if (dragSrcIndex !== null && dragSrcIndex !== index) {
        a.classList.add("drag-over");
      }
    });

    a.addEventListener("dragleave", () => {
      a.classList.remove("drag-over");
    });

    a.addEventListener("drop", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      a.classList.remove("drag-over");

      if (dragSrcIndex !== null && dragSrcIndex !== index) {
        const [movedItem] = pinnedSites.splice(dragSrcIndex, 1);
        pinnedSites.splice(index, 0, movedItem);
        await storageSet({ pinnedSites, pinnedSitesInitialized: true });
        renderPinned();
        updatePresetChipsUI();
      }
    });

    const removeBtn = document.createElement("button");
    removeBtn.className = "pin-remove";
    removeBtn.type = "button";
    removeBtn.textContent = "×";
    removeBtn.setAttribute("aria-label", `حذف ${site.title}`);
    removeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      pinnedSites = pinnedSites.filter((s) => s.id !== site.id);
      storageSet({ pinnedSites, pinnedSitesInitialized: true });
      renderPinned();
      updatePresetChipsUI();
    });

    const iconWrap = document.createElement("div");
    iconWrap.className = "pin-favicon";

    if (site.isGooglePackage || site.title === "Google Apps" || site.id === "def-google-apps") {
      a.classList.add("google-suite-tile");
      a.title = "پکیج سرویس‌های گوگل (Google Apps Suite)";
      iconWrap.innerHTML = `
        <svg width="28" height="28" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
          <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
        </svg>
      `;
      a.addEventListener("click", (e) => {
        if (!isDraggingSite) {
          e.preventDefault();
          const googleAppsDialog = document.getElementById("googleAppsDialog");
          if (googleAppsDialog) googleAppsDialog.showModal();
        }
      });
    } else if (site.isResearchPackage || site.title === "Research Hub" || site.id === "def-research-hub") {
      a.classList.add("research-suite-tile");
      a.title = "پکیج مقالات و مراجع علمی (Research & Paper Hub)";
      iconWrap.innerHTML = `
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6fc8f2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
          <path d="M6 12v5c3 3 9 3 12 0v-5"/>
        </svg>
      `;
      a.addEventListener("click", (e) => {
        if (!isDraggingSite) {
          e.preventDefault();
          const researchHubDialog = document.getElementById("researchHubDialog");
          if (researchHubDialog) researchHubDialog.showModal();
        }
      });
    } else if (site.isAiPackage || site.title === "AI Hub" || site.id === "def-ai-hub") {
      a.classList.add("ai-suite-tile");
      a.title = "پکیج ابزارهای هوش مصنوعی (AI Suite & Hub)";
      iconWrap.innerHTML = `
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="url(#aiTileGrad)"/>
          <defs>
            <linearGradient id="aiTileGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
              <stop stop-color="#38BDF8"/>
              <stop offset="0.5" stop-color="#818CF8"/>
              <stop offset="1" stop-color="#C084FC"/>
            </linearGradient>
          </defs>
        </svg>
      `;
      a.addEventListener("click", (e) => {
        if (!isDraggingSite) {
          e.preventDefault();
          const aiHubDialog = document.getElementById("aiHubDialog");
          if (aiHubDialog) aiHubDialog.showModal();
        }
      });
    } else {
      const customSvg = getCustomBrandIcon(site);
      if (customSvg) {
        iconWrap.innerHTML = customSvg;
      } else {
        const img = document.createElement("img");
        img.src = faviconFor(site.url);
        img.alt = "";
        img.loading = "lazy";
        img.onerror = () => {
          iconWrap.textContent = site.title.slice(0, 1).toUpperCase();
        };
        iconWrap.appendChild(img);
      }
    }

    const titleEl = document.createElement("div");
    titleEl.className = "pin-title";
    titleEl.textContent = site.title;

    a.appendChild(removeBtn);
    a.appendChild(dragHandle);
    a.appendChild(iconWrap);
    a.appendChild(titleEl);
    pinnedGrid.appendChild(a);
  });
}

document.getElementById("addPinBtn").addEventListener("click", () => {
  document.getElementById("pinTitle").value = "";
  document.getElementById("pinUrl").value = "";
  updatePresetChipsUI();
  pinDialog.showModal();
  document.getElementById("pinTitle").focus();
});

document.getElementById("pinCancelBtn").addEventListener("click", () => pinDialog.close());
if (pinDialogCloseBtn) {
  pinDialogCloseBtn.addEventListener("click", () => pinDialog.close());
}

// Google Apps Suite Dialog Event Listeners
const googleAppsDialog = document.getElementById("googleAppsDialog");
const googleAppsCloseBtn = document.getElementById("googleAppsCloseBtn");
if (googleAppsCloseBtn && googleAppsDialog) {
  googleAppsCloseBtn.addEventListener("click", () => googleAppsDialog.close());
}
if (googleAppsDialog) {
  googleAppsDialog.addEventListener("click", (e) => {
    const rect = googleAppsDialog.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      googleAppsDialog.close();
    }
  });
}

// Research & Paper Hub Dialog Event Listeners
const researchHubDialog = document.getElementById("researchHubDialog");
const researchHubCloseBtn = document.getElementById("researchHubCloseBtn");
if (researchHubCloseBtn && researchHubDialog) {
  researchHubCloseBtn.addEventListener("click", () => researchHubDialog.close());
}
if (researchHubDialog) {
  researchHubDialog.addEventListener("click", (e) => {
    const rect = researchHubDialog.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      researchHubDialog.close();
    }
  });
}

// AI Suite & Tools Hub Dialog Event Listeners
const aiHubDialog = document.getElementById("aiHubDialog");
const aiHubCloseBtn = document.getElementById("aiHubCloseBtn");
if (aiHubCloseBtn && aiHubDialog) {
  aiHubCloseBtn.addEventListener("click", () => aiHubDialog.close());
}
if (aiHubDialog) {
  aiHubDialog.addEventListener("click", (e) => {
    const rect = aiHubDialog.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      aiHubDialog.close();
    }
  });
}

// Preset Chips Quick Click Handler
document.querySelectorAll(".preset-chip").forEach((chip) => {
  chip.addEventListener("click", async () => {
    const pkg = chip.dataset.package;
    if (pkg === "google") {
      const isAdded = pinnedSites.some((s) => s.id === "def-google-apps" || s.isGooglePackage || s.title === "Google Apps");
      if (isAdded) {
        pinnedSites = pinnedSites.filter((s) => !(s.id === "def-google-apps" || s.isGooglePackage || s.title === "Google Apps"));
      } else {
        pinnedSites.unshift({ id: "def-google-apps", title: "Google Apps", url: "https://about.google/products/", isGooglePackage: true });
      }
    } else if (pkg === "research") {
      const isAdded = pinnedSites.some((s) => s.id === "def-research-hub" || s.isResearchPackage || s.title === "Research Hub");
      if (isAdded) {
        pinnedSites = pinnedSites.filter((s) => !(s.id === "def-research-hub" || s.isResearchPackage || s.title === "Research Hub"));
      } else {
        const googleIdx = pinnedSites.findIndex((s) => s.id === "def-google-apps" || s.isGooglePackage);
        const insertIdx = googleIdx >= 0 ? googleIdx + 1 : 0;
        pinnedSites.splice(insertIdx, 0, { id: "def-research-hub", title: "Research Hub", url: "https://scholar.google.com/", isResearchPackage: true });
      }
    } else if (pkg === "ai") {
      const isAdded = pinnedSites.some((s) => s.id === "def-ai-hub" || s.isAiPackage || s.title === "AI Hub");
      if (isAdded) {
        pinnedSites = pinnedSites.filter((s) => !(s.id === "def-ai-hub" || s.isAiPackage || s.title === "AI Hub"));
      } else {
        const researchIdx = pinnedSites.findIndex((s) => s.id === "def-research-hub" || s.isResearchPackage);
        const googleIdx = pinnedSites.findIndex((s) => s.id === "def-google-apps" || s.isGooglePackage);
        const insertIdx = researchIdx >= 0 ? researchIdx + 1 : (googleIdx >= 0 ? googleIdx + 1 : 0);
        pinnedSites.splice(insertIdx, 0, { id: "def-ai-hub", title: "AI Hub", url: "https://chatgpt.com/ai-hub", isAiPackage: true });
      }
    } else {
      const title = chip.dataset.title;
      const url = chip.dataset.url;
      if (!url) return;

      const exists = pinnedSites.some((s) => s.url.replace(/\/$/, "") === url.replace(/\/$/, ""));
      if (exists) {
        // Remove if already exists
        pinnedSites = pinnedSites.filter((s) => s.url.replace(/\/$/, "") !== url.replace(/\/$/, ""));
      } else {
        // Add if not exists
        pinnedSites.push({ id: crypto.randomUUID(), title, url });
      }
    }

    await storageSet({ pinnedSites, pinnedSitesInitialized: true });
    renderPinned();
    updatePresetChipsUI();
  });
});

pinForm.addEventListener("submit", (e) => {
  const title = document.getElementById("pinTitle").value.trim();
  const rawUrl = document.getElementById("pinUrl").value.trim();
  const url = normalizeUrl(rawUrl);
  if (!title || !url) {
    e.preventDefault();
    return;
  }
  pinnedSites.push({ id: crypto.randomUUID(), title, url });
  storageSet({ pinnedSites, pinnedSitesInitialized: true });
  renderPinned();
  updatePresetChipsUI();
});

// ---------------------------------------------------------------
// calendar (Shamsi & Gregorian Dual Support)
// ---------------------------------------------------------------
let calendarMode = "shamsi"; // "shamsi" | "gregorian"
let shamsiYear, shamsiMonth; // month is 1-indexed (1=Farvardin .. 12=Esfand)
let viewYear, viewMonth;     // Gregorian month is 0-indexed
let selectedDate = new Date();
let tasksCache = {}; // isoDate -> array of {id, text, done}
let daysWithTasksThisMonth = new Set();

const monthLabel = document.getElementById("monthLabel");
const monthSubLabel = document.getElementById("monthSubLabel");
const calendarGrid = document.getElementById("calendarGrid");
const modeShamsiBtn = document.getElementById("modeShamsiBtn");
const modeMiladiBtn = document.getElementById("modeMiladiBtn");

function updateCalendarModeButtons() {
  if (modeShamsiBtn && modeMiladiBtn) {
    SDUI.setSelected([modeShamsiBtn, modeMiladiBtn], (btn) => btn.dataset.mode === calendarMode);
  }
}

if (modeShamsiBtn) {
  modeShamsiBtn.addEventListener("click", async () => {
    calendarMode = "shamsi";
    updateCalendarModeButtons();
    await storageSet({ calendarMode: "shamsi" });
    const j = toJalali(selectedDate);
    shamsiYear = j.jy;
    shamsiMonth = j.jm;
    await loadTasksForMonth();
    renderCalendar();
  });
}

if (modeMiladiBtn) {
  modeMiladiBtn.addEventListener("click", async () => {
    calendarMode = "gregorian";
    updateCalendarModeButtons();
    await storageSet({ calendarMode: "gregorian" });
    viewYear = selectedDate.getFullYear();
    viewMonth = selectedDate.getMonth();
    await loadTasksForMonth();
    renderCalendar();
  });
}

function renderCalendar() {
  calendarGrid.innerHTML = "";
  updateCalendarModeButtons();

  const today = new Date();
  const cells = [];

  if (calendarMode === "shamsi") {
    // --- Shamsi Mode ---
    monthLabel.textContent = `${SHAMSI_MONTH_LABELS[shamsiMonth - 1]} ${faDigits(shamsiYear)}`;

    const firstOfMonthDate = toGregorian(shamsiYear, shamsiMonth, 1);
    const startOffset = (firstOfMonthDate.getDay() + 1) % 7; // Iranian week starts Saturday
    const daysInMonth = jalaliMonthDays(shamsiYear, shamsiMonth);

    let prevY = shamsiYear;
    let prevM = shamsiMonth - 1;
    if (prevM < 1) { prevM = 12; prevY--; }
    const daysInPrevMonth = jalaliMonthDays(prevY, prevM);

    if (monthSubLabel) {
      monthSubLabel.textContent = `${MONTH_LABELS_EN[firstOfMonthDate.getMonth()]} - ${MONTH_LABELS_EN[(firstOfMonthDate.getMonth() + 1) % 12]} ${firstOfMonthDate.getFullYear()}`;
    }

    for (let i = 0; i < startOffset; i++) {
      const dayNum = daysInPrevMonth - startOffset + i + 1;
      cells.push({
        date: toGregorian(prevY, prevM, dayNum),
        outside: true,
        displayNum: dayNum,
        jumpYear: prevY,
        jumpMonth: prevM,
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        date: toGregorian(shamsiYear, shamsiMonth, d),
        outside: false,
        displayNum: d,
      });
    }

    let nextY = shamsiYear;
    let nextM = shamsiMonth + 1;
    if (nextM > 12) { nextM = 1; nextY++; }
    let nextDayNum = 1;

    while (cells.length % 7 !== 0) {
      cells.push({
        date: toGregorian(nextY, nextM, nextDayNum),
        outside: true,
        displayNum: nextDayNum,
        jumpYear: nextY,
        jumpMonth: nextM,
      });
      nextDayNum++;
    }
  } else {
    // --- Gregorian Mode ---
    monthLabel.textContent = `${MONTH_LABELS[viewMonth]} ${faDigits(viewYear)}`;

    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startOffset = (firstOfMonth.getDay() + 1) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    if (monthSubLabel) {
      const jStart = toJalali(firstOfMonth);
      const jEnd = toJalali(new Date(viewYear, viewMonth, daysInMonth));
      monthSubLabel.textContent = `${SHAMSI_MONTH_LABELS[jStart.jm - 1]} - ${SHAMSI_MONTH_LABELS[jEnd.jm - 1]} ${faDigits(jStart.jy)}`;
    }

    for (let i = 0; i < startOffset; i++) {
      const dayNum = daysInPrevMonth - startOffset + i + 1;
      cells.push({
        date: new Date(viewYear, viewMonth - 1, dayNum),
        outside: true,
        displayNum: dayNum,
      });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        date: new Date(viewYear, viewMonth, d),
        outside: false,
        displayNum: d,
      });
    }
    while (cells.length % 7 !== 0) {
      const dayNum = cells.length - (startOffset + daysInMonth) + 1;
      cells.push({
        date: new Date(viewYear, viewMonth + 1, dayNum),
        outside: true,
        displayNum: dayNum,
      });
    }
  }

  const allExams = getAllScheduledExams();
  const daysWithExams = new Set(allExams.map((e) => e.exam.date));
  const daysWithVuDeadlines = typeof vuDeadlineDays === "function" ? vuDeadlineDays() : new Set();

  // Roving focus: keep the keyboard target if it is visible, else the selected day, else today.
  const visibleIsos = cells.map((c) => isoDate(c.date));
  const inMonthIsos = cells.filter((c) => !c.outside).map((c) => isoDate(c.date));
  const focusIso = [calendarFocusIso, isoDate(selectedDate), isoDate(today)].find((iso) => iso && inMonthIsos.includes(iso)) || inMonthIsos[0];

  let row = null;
  cells.forEach((cell, index) => {
    if (index % 7 === 0) {
      row = document.createElement("div");
      row.className = "cal-row";
      row.setAttribute("role", "row");
      calendarGrid.appendChild(row);
    }
    const cellIso = visibleIsos[index];
    const flags = {
      outside: cell.outside,
      today: sameDay(cell.date, today),
      selected: sameDay(cell.date, selectedDate),
      tasks: daysWithTasksThisMonth.has(cellIso),
      exam: daysWithExams.has(cellIso),
      vu: daysWithVuDeadlines.has(cellIso),
    };

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cal-day";
    btn.setAttribute("role", "gridcell");
    btn.dataset.iso = cellIso;
    btn.tabIndex = cellIso === focusIso ? 0 : -1;
    btn.setAttribute("aria-selected", String(flags.selected));
    if (flags.today) btn.setAttribute("aria-current", "date");
    btn.setAttribute("aria-label", calendarCellLabel(cell.date, flags));
    btn.classList.toggle("outside", flags.outside);
    btn.classList.toggle("today", flags.today);
    btn.classList.toggle("selected", flags.selected);
    btn.classList.toggle("has-tasks", flags.tasks);
    btn.classList.toggle("has-exam", flags.exam);
    btn.classList.toggle("has-vu-deadline", flags.vu);

    const num = document.createElement("span");
    num.className = "cal-day__num";
    num.textContent = faDigits(cell.displayNum);
    btn.appendChild(num);
    if (flags.tasks || flags.exam || flags.vu) {
      const marks = document.createElement("span");
      marks.className = "cal-day__marks";
      marks.setAttribute("aria-hidden", "true");
      for (const kind of ["task", "exam", "vu"]) {
        if (flags[kind === "task" ? "tasks" : kind]) {
          const m = document.createElement("span");
          m.className = `cal-mark cal-mark--${kind}`;
          marks.appendChild(m);
        }
      }
      btn.appendChild(marks);
    }

    btn.addEventListener("click", () => selectCalendarDate(cell.date, cell));
    row.appendChild(btn);
  });
}

// Full, screen-reader friendly description of a calendar day.
function calendarCellLabel(date, flags) {
  const jalali = StudashDate.formatJalali(date);
  const base =
    calendarMode === "shamsi"
      ? jalali
      : `${WEEKDAY_LONG[date.getDay()]} ${faDigits(date.getDate())} ${MONTH_LABELS[date.getMonth()]} ${faDigits(date.getFullYear())}، ${StudashDate.formatJalali(date, { weekday: false })}`;
  const parts = [base];
  if (flags.today) parts.push("امروز");
  if (flags.outside) parts.push("خارج از این ماه");
  if (flags.exam) parts.push("دارای امتحان");
  if (flags.tasks) parts.push("دارای کار");
  if (flags.vu) parts.push("مهلت تکلیف VU");
  return parts.join("، ");
}

let calendarFocusIso = null;

function isInVisibleMonth(date) {
  if (calendarMode === "shamsi") {
    const j = toJalali(date);
    return j.jy === shamsiYear && j.jm === shamsiMonth;
  }
  return date.getFullYear() === viewYear && date.getMonth() === viewMonth;
}

function showMonthOf(date) {
  if (calendarMode === "shamsi") {
    const j = toJalali(date);
    shamsiYear = j.jy;
    shamsiMonth = j.jm;
  } else {
    viewYear = date.getFullYear();
    viewMonth = date.getMonth();
  }
}

async function selectCalendarDate(date, cell = null) {
  selectedDate = date;
  calendarFocusIso = isoDate(date);
  if ((cell && cell.outside) || !isInVisibleMonth(date)) {
    showMonthOf(date);
    await loadTasksForMonth();
  }
  renderCalendar();
  focusCalendarCell(calendarFocusIso);
  renderAllTasksUnified();
  loadGoogleEventsForSelectedDate();
}

function focusCalendarCell(iso) {
  const target = calendarGrid.querySelector(`.cal-day[data-iso="${iso}"]`);
  if (!target) return;
  calendarGrid.querySelectorAll(".cal-day").forEach((b) => (b.tabIndex = b === target ? 0 : -1));
  target.focus();
}

// Same day-of-month in another month (clamped), in the active calendar system.
function shiftCalendarMonth(date, delta) {
  if (calendarMode === "shamsi") {
    const j = toJalali(date);
    const t = StudashDate.addJalaliMonths(j.jy, j.jm, delta);
    return toGregorian(t.jy, t.jm, Math.min(j.jd, jalaliMonthDays(t.jy, t.jm)));
  }
  const last = new Date(date.getFullYear(), date.getMonth() + delta + 1, 0).getDate();
  return new Date(date.getFullYear(), date.getMonth() + delta, Math.min(date.getDate(), last));
}

// WAI-ARIA date grid keyboard model (arrows mirrored for RTL).
calendarGrid.addEventListener("keydown", async (e) => {
  const cell = e.target.closest(".cal-day");
  if (!cell) return;
  const current = StudashDate.parseIsoDate(cell.dataset.iso);
  if (!current) return;
  const rtl = getComputedStyle(calendarGrid).direction === "rtl";
  let next = null;
  switch (e.key) {
    case "ArrowLeft": next = StudashDate.addDays(current, rtl ? 1 : -1); break;
    case "ArrowRight": next = StudashDate.addDays(current, rtl ? -1 : 1); break;
    case "ArrowUp": next = StudashDate.addDays(current, -7); break;
    case "ArrowDown": next = StudashDate.addDays(current, 7); break;
    case "Home": next = StudashDate.startOfWeek(current); break;
    case "End": next = StudashDate.addDays(StudashDate.startOfWeek(current), 6); break;
    case "PageUp": next = shiftCalendarMonth(current, e.shiftKey ? -12 : -1); break;
    case "PageDown": next = shiftCalendarMonth(current, e.shiftKey ? 12 : 1); break;
    default: return;
  }
  e.preventDefault();
  calendarFocusIso = isoDate(next);
  if (!isInVisibleMonth(next)) {
    showMonthOf(next);
    await loadTasksForMonth();
    renderCalendar();
  }
  focusCalendarCell(calendarFocusIso);
});

async function loadTasksForMonth() {
  const data = await storageGet(null);
  daysWithTasksThisMonth = new Set();
  const prefix = "tasks:";
  for (const key of Object.keys(data)) {
    if (!key.startsWith(prefix)) continue;
    const dateStr = key.slice(prefix.length);
    if (Array.isArray(data[key]) && data[key].length) {
      const hasPendingTasks = data[key].some((t) => !t.done);
      if (hasPendingTasks) {
        daysWithTasksThisMonth.add(dateStr);
      }
    }
  }
}

document.getElementById("prevMonth").addEventListener("click", async () => {
  if (calendarMode === "shamsi") {
    shamsiMonth--;
    if (shamsiMonth < 1) { shamsiMonth = 12; shamsiYear--; }
  } else {
    viewMonth--;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  }
  await loadTasksForMonth();
  renderCalendar();
});

document.getElementById("nextMonth").addEventListener("click", async () => {
  if (calendarMode === "shamsi") {
    shamsiMonth++;
    if (shamsiMonth > 12) { shamsiMonth = 1; shamsiYear++; }
  } else {
    viewMonth++;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  }
  await loadTasksForMonth();
  renderCalendar();
});

// ---------------------------------------------------------------
// ---------------------------------------------------------------
// Sidebar Unified Tasks & Agenda Panel (with Quick Filters: all, course, daily, gcal, ideas)
// ---------------------------------------------------------------
const tasksFilterBtns = document.querySelectorAll(".tasks-tab-btn");
const badgeAllTasksCount = document.getElementById("badgeAllTasksCount");
const badgeCourseTasksCount = document.getElementById("badgeCourseTasksCount");
const badgeDailyTasksCount = document.getElementById("badgeDailyTasksCount");
const badgeGcalCount = document.getElementById("badgeGcalCount");
const badgeIdeasCount = document.getElementById("badgeIdeasCount");

const allTasksSelectedDateLabel = document.getElementById("allTasksSelectedDateLabel");
const allTasksUnifiedList = document.getElementById("allTasksUnifiedList");
const allTasksUnifiedEmpty = document.getElementById("allTasksUnifiedEmpty");

let currentTaskFilter = "all"; // "all" | "course" | "daily" | "gcal" | "ideas"
let cachedGcalEventsForSelectedDate = [];

function setTaskFilter(filterName) {
  currentTaskFilter = filterName;
  SDUI.setSelected(tasksFilterBtns, (btn) => btn.dataset.filter === filterName);
  const activeTab = [...tasksFilterBtns].find((btn) => btn.dataset.filter === filterName);
  if (activeTab && allTasksUnifiedList) allTasksUnifiedList.setAttribute("aria-labelledby", activeTab.id);
  renderAllTasksUnified();
}

tasksFilterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    setTaskFilter(btn.dataset.filter);
  });
});

let renderAllTasksSeq = 0;

// ---------------------------------------------------------------
// IDEA & RESEARCH LAB (PROJECT ROADMAP & 3-FOCUS SYSTEM)
// ---------------------------------------------------------------
let ideaProjects = [];

const IDEA_CATEGORIES = {
  research: { label: "🔬 پژوهشی / مقاله", shortLabel: "🔬 پژوهشی", class: "cat-research" },
  academic: { label: "📚 درسی / پروژه دانشگاه", shortLabel: "📚 درسی", class: "cat-academic" },
  startup: { label: "🚀 استارتاپ / محصول", shortLabel: "🚀 استارتاپ", class: "cat-startup" },
  personal: { label: "💡 شخصی / مهارت", shortLabel: "💡 شخصی", class: "cat-personal" },
};

const DEFAULT_SAMPLE_IDEAS = [
  {
    id: "sample-idea-1",
    title: "تحقیق روی سیستم‌های پایش هوشمند انرژی",
    category: "research",
    notes: "بررسی مصرف بهینه با سنسورهای IoT و پردازش ابری",
    status: "active",
    createdAt: new Date().toISOString(),
    steps: [
      { id: "s1", text: "مطالعه ۳ مقاله برتر IEEE سال ۲۰۲۵", done: true },
      { id: "s2", text: "طراحی مدل اولیه و شبیه‌سازی الگوریتم", done: true },
      { id: "s3", text: "تست آزمایشگاهی با داده‌های واقعی", done: false },
      { id: "s4", text: "تدوین گزارش نهایی و پیش‌نویس مقاله", done: false },
    ],
  },
];

function calculateIdeaProgress(idea) {
  const steps = idea.steps || [];
  if (steps.length === 0) return { percent: 0, total: 0, doneCount: 0 };
  const doneCount = steps.filter((s) => s.done).length;
  const percent = Math.round((doneCount / steps.length) * 100);
  return { percent, total: steps.length, doneCount };
}

function parseBulkStepsText(rawText) {
  if (!rawText) return [];
  const lines = rawText.split(/\r?\n/);
  const steps = [];
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    // Clean up markers like "- [ ]", "1.", "•", "گام اول:", etc.
    const cleaned = line
      .replace(/^[-*•]\s*(\[[ xX]\]\s*)?/, "")
      .replace(/^\d+[\.\)]\s*/, "")
      .replace(/^گام\s*(\d+|اول|دوم|سوم|چهارم|پنجم|ششم|هفتم|هشتم|نهم|دهم)[\s:]*/i, "")
      .trim();
    if (cleaned.length > 0) {
      steps.push({
        id: crypto.randomUUID(),
        text: cleaned,
        done: false,
      });
    }
  }
  return steps;
}

function generateAiPromptForIdea(idea) {
  const major = userProfile?.major || "دانشجویی";
  const catLabel = IDEA_CATEGORIES[idea.category]?.label || "پژوهشی";

  return `سلام! من دانشجوی رشته «${major}» هستم و قصد دارم یک ایده/پروژه جدید با عنوان «${idea.title}» (${catLabel}) را به یک «مسیر راه عملیاتی و مرحله‌به‌مرحله (Actionable Step-by-Step Roadmap)» تبدیل کنم تا در داشبورد دانشجویی‌ام پیگیری و اجرا کنم.

🎯 نحوه همکاری و گفتگوی ما:
۱. لطفاً در ابتدا در چند خط با من گفتگو کن: ابعاد فنی، موانع احتمالی، مراجع و دغدغه‌های اجرای این ایده در رشته «${major}» را تحلیل کن و اگر سوال یا پیشنهادی داری بگو.
۲. سپس یک مسیر راه استاندارد و واقع‌بینانه شامل ۵ الی ۸ گام اجرایی شفاف و به ترتیب اولویت زمانی طراحی کن.

⚠️⚠️ دستورالعمل بسیار حیاتی برای ساختار خروجی (مختص وارد کردن در نرم‌افزار):
داشبورد من مجهز به پارسر خودکار متنی است. بنابراین در انتهای پاسخت، حتماً یک کادر مجزا ایجاد کن و فقط و فقط گام‌های عملیاتی را بدون هیچ متن یا توضیح اضافی، به صورت خط به خط با علامت خط تیره (-) به شکل دقیق زیر بنویس تا با یک کلیک در برنامه‌ام ایمپورت شود:

- گام اول: [عنوان دقیق اقدام اول]
- گام دوم: [عنوان دقیق اقدام دوم]
- گام سوم: [عنوان دقیق اقدام سوم]
- گام چهارم: [عنوان دقیق اقدام چهارم]
- گام پنجم: [عنوان دقیق اقدام پنجم]

اکنون لطفاً تحلیل و گفتگوی اولیه خود را درباره ایده «${idea.title}» شروع کن!`;
}

function taskKey(date) { return `tasks:${isoDate(date)}`; }

async function renderAllTasksUnified() {
  const currentSeq = ++renderAllTasksSeq;
  if (!allTasksUnifiedList) return;

  const jSelected = toJalali(selectedDate);
  const today = new Date();
  if (allTasksSelectedDateLabel) {
    if (sameDay(selectedDate, today)) {
      allTasksSelectedDateLabel.textContent = `کارهای امروز (${faDigits(jSelected.jd)} ${SHAMSI_MONTH_LABELS[jSelected.jm - 1]})`;
    } else {
      allTasksSelectedDateLabel.textContent = `کارهای ${faDigits(jSelected.jd)} ${SHAMSI_MONTH_LABELS[jSelected.jm - 1]}`;
    }
  }

  // 1. Fetch Scheduled Exams for Selected Date
  const selectedIso = isoDate(selectedDate);
  const allExams = getAllScheduledExams();
  const dayExams = allExams.filter((e) => e.exam.date === selectedIso);

  // 2. Fetch Daily To-Do Tasks for Selected Date
  const key = taskKey(selectedDate);
  const data = await storageGet(key);
  if (currentSeq !== renderAllTasksSeq) return; // Ignore stale async execution

  const tasks = data[key] || [];
  tasksCache[key] = tasks;
  const undoneDaily = tasks.filter((t) => !t.done).length;

  // 3. Fetch Course Assignments (Undone)
  let totalUndoneCourseTasks = 0;
  for (const rawCourse of scheduleClasses) {
    const course = normalizeCourse(rawCourse);
    for (const task of course.tasks || []) {
      if (!task.done) totalUndoneCourseTasks++;
    }
  }

  const allCourseTasks = [];
  const isSelectedDateToday = sameDay(selectedDate, today);

  for (const rawCourse of scheduleClasses) {
    const course = normalizeCourse(rawCourse);
    for (const task of course.tasks || []) {
      if (!task.done) {
        if (currentTaskFilter === "course") {
          // Dedicated Assignments view: show all pending tasks across semester
          allCourseTasks.push({
            courseId: course.id,
            courseTitle: course.title,
            courseColor: course.color || "var(--accent)",
            task,
          });
        } else {
          // Unified Daily Agenda: only show tasks due on selectedDate
          if (task.dueDate === selectedIso) {
            allCourseTasks.push({
              courseId: course.id,
              courseTitle: course.title,
              courseColor: course.color || "var(--accent)",
              task,
            });
          } else if (isSelectedDateToday) {
            if (!task.dueDate) {
              allCourseTasks.push({
                courseId: course.id,
                courseTitle: course.title,
                courseColor: course.color || "var(--accent)",
                task,
              });
            } else {
              const due = new Date(task.dueDate + "T00:00:00");
              const nowDate = new Date();
              nowDate.setHours(0, 0, 0, 0);
              if (due < nowDate) {
                // Overdue task reminder for today
                allCourseTasks.push({
                  courseId: course.id,
                  courseTitle: course.title,
                  courseColor: course.color || "var(--accent)",
                  task,
                });
              }
            }
          }
        }
      }
    }
  }

  // Sort course tasks by due date
  allCourseTasks.sort((a, b) => {
    if (a.task.dueDate && b.task.dueDate) return a.task.dueDate.localeCompare(b.task.dueDate);
    if (a.task.dueDate) return -1;
    if (b.task.dueDate) return 1;
    return 0;
  });

  // 4. Update Badge Counts
  const activeIdeas = ideaProjects.filter((p) => p.status === "active");
  const headerIdeasBadge = document.getElementById("headerIdeasBadge");
  if (headerIdeasBadge) headerIdeasBadge.textContent = `${activeIdeas.length}/3`;
  const menuIdeasBadge = document.getElementById("menuIdeasBadge");
  if (menuIdeasBadge) menuIdeasBadge.textContent = `${activeIdeas.length}/3`;
  if (badgeDailyTasksCount) badgeDailyTasksCount.textContent = faDigits(undoneDaily);
  if (typeof vuPendingCount === "function") totalUndoneCourseTasks += vuPendingCount();
  if (badgeCourseTasksCount) badgeCourseTasksCount.textContent = faDigits(totalUndoneCourseTasks);
  if (badgeGcalCount) badgeGcalCount.textContent = faDigits(cachedGcalEventsForSelectedDate.length);
  if (badgeAllTasksCount) {
    badgeAllTasksCount.textContent = faDigits(undoneDaily + totalUndoneCourseTasks + dayExams.length + cachedGcalEventsForSelectedDate.length);
  }

  const fragment = document.createDocumentFragment();
  let visibleSectionsCount = 0;

  // Section: Scheduled Exams
  if ((currentTaskFilter === "all" || currentTaskFilter === "course") && dayExams.length > 0) {
    visibleSectionsCount++;
    const group = document.createElement("div");
    group.className = "unified-section-group";
    group.innerHTML = `
      <div class="unified-group-title">
        <span>🎯 امتحانات و کوئیزهای این روز</span>
        <span class="unified-group-count">${faDigits(dayExams.length)} آزمون</span>
      </div>
    `;
    const wrap = document.createElement("div");
    wrap.className = "unified-items-wrap";
    dayExams.forEach((de) => {
      const examCard = document.createElement("div");
      examCard.className = "sidebar-day-exam-card";
      examCard.innerHTML = `
        <div class="sidebar-day-exam-title">
          <span>🎯</span>
          <strong>${de.exam.title} (${de.courseTitle})</strong>
        </div>
        <div class="sidebar-day-exam-details">
          <span>⏰ ${de.exam.time ? `ساعت ${faDigits(de.exam.time)}` : "بدون ساعت مشخص"}</span>
          ${de.exam.location ? ` • 📍 ${de.exam.location}` : ""}
          ${de.exam.syllabus ? `<div style="margin-top: 4px; font-size: 11px; color: var(--accent);">📚 مباحث: ${de.exam.syllabus}</div>` : ""}
        </div>
      `;
      wrap.appendChild(examCard);
    });
    group.appendChild(wrap);
    fragment.appendChild(group);
  }

  // Section: Google Calendar Events
  if ((currentTaskFilter === "all" || currentTaskFilter === "gcal") && cachedGcalEventsForSelectedDate.length > 0) {
    visibleSectionsCount++;
    const group = document.createElement("div");
    group.className = "unified-section-group";
    group.innerHTML = `
      <div class="unified-group-title">
        <span>📅 رویدادهای تقویم گوگل</span>
        <span class="unified-group-count">${faDigits(cachedGcalEventsForSelectedDate.length)} رویداد</span>
      </div>
    `;
    const wrap = document.createElement("div");
    wrap.className = "unified-items-wrap";
    cachedGcalEventsForSelectedDate.forEach((ev) => {
      const row = document.createElement("div");
      row.className = "gcal-event";
      const time = document.createElement("time");
      if (ev.start?.dateTime) {
        const d = new Date(ev.start.dateTime);
        time.textContent = faDigits(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`);
      } else {
        time.textContent = "تمام روز";
      }
      const title = document.createElement("span");
      title.textContent = ev.summary || "(بدون عنوان)";
      row.appendChild(time);
      row.appendChild(title);
      wrap.appendChild(row);
    });
    group.appendChild(wrap);
    fragment.appendChild(group);
  }

  // Section: Daily To-Do Tasks
  if ((currentTaskFilter === "all" || currentTaskFilter === "daily") && tasks.length > 0) {
    visibleSectionsCount++;
    const group = document.createElement("div");
    group.className = "unified-section-group";
    group.innerHTML = `
      <div class="unified-group-title">
        <span>✅ کارهای روزانه</span>
        <span class="unified-group-count">${faDigits(undoneDaily)} باز / ${faDigits(tasks.length)} کل</span>
      </div>
    `;
    const ul = document.createElement("ul");
    ul.className = "task-list";

    // Sort tasks: Undone first (!a.done), Completed at the bottom (a.done)
    const sortedDailyTasks = [...tasks].sort((a, b) => {
      if (!!a.done === !!b.done) return 0;
      return a.done ? 1 : -1;
    });

    sortedDailyTasks.forEach((task) => {
      const li = document.createElement("li");
      li.className = "task-item" + (task.done ? " done" : "");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = task.done;
      checkbox.addEventListener("change", async () => {
        task.done = checkbox.checked;
        await storageSet({ [key]: tasks });
        await renderAllTasksUnified();
        await loadTasksForMonth();
        renderCalendar();
        if (scheduleViewMode === "personal") {
          renderPersonalScheduleTable();
        }
      });

      const span = document.createElement("span");
      span.textContent = task.text;

      const removeBtn = document.createElement("button");
      removeBtn.className = "task-remove";
      removeBtn.type = "button";
      removeBtn.textContent = "×";
      removeBtn.setAttribute("aria-label", "حذف کار");
      removeBtn.addEventListener("click", async () => {
        const idx = tasks.findIndex((t) => t.id === task.id);
        if (idx > -1) tasks.splice(idx, 1);
        await storageSet({ [key]: tasks });
        await renderAllTasksUnified();
        await loadTasksForMonth();
        renderCalendar();
        if (scheduleViewMode === "personal") {
          renderPersonalScheduleTable();
        }
      });

      li.appendChild(checkbox);
      li.appendChild(span);
      li.appendChild(removeBtn);
      ul.appendChild(li);
    });
    group.appendChild(ul);
    fragment.appendChild(group);
  }

  // Section: VU (vu.um.ac.ir) deadlines
  if (typeof vuAppendSidebarSection === "function") {
    visibleSectionsCount += vuAppendSidebarSection(fragment, currentTaskFilter, selectedDate);
  }

  // Section: Course Assignments
  if ((currentTaskFilter === "all" || currentTaskFilter === "course") && allCourseTasks.length > 0) {
    visibleSectionsCount++;
    const group = document.createElement("div");
    group.className = "unified-section-group";
    group.innerHTML = `
      <div class="unified-group-title">
        <span>📚 تکالیف و پروژه‌های درسی</span>
        <span class="unified-group-count">${faDigits(allCourseTasks.length)} انجام‌نشده</span>
      </div>
    `;
    const ul = document.createElement("ul");
    ul.className = "course-tasks-sidebar-list";

    allCourseTasks.forEach(({ courseId, courseTitle, courseColor, task }) => {
      const li = document.createElement("li");
      li.className = "sidebar-course-task-item";
      li.style.setProperty("--course-color", courseColor);

      const topRow = document.createElement("div");
      topRow.className = "sidebar-task-top";

      // Interactive chip: a real button (keyboard + focus), styled with the official Chip classes.
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = "chip chip--sm chip--default chip--soft sd-chip-button sidebar-course-pill";
      pill.textContent = courseTitle;
      pill.setAttribute("aria-label", `باز کردن دفترچه درس ${courseTitle}`);
      pill.addEventListener("click", (e) => {
        e.stopPropagation();
        openCourseHub(courseId);
      });
      topRow.appendChild(pill);

      const typeInfo = TASK_TYPE_LABELS[task.type] || TASK_TYPE_LABELS.assignment;
      const typeBadge = typeChip(typeInfo.label);
      topRow.appendChild(typeBadge);

      const mainRow = document.createElement("div");
      mainRow.className = "sidebar-task-main";

      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.checked = false;
      chk.addEventListener("change", async () => {
        task.done = chk.checked;
        await storageSet({ scheduleClasses });
        renderScheduleTable();
        await renderAllTasksUnified();
      });

      const titleSpan = document.createElement("span");
      titleSpan.className = "sidebar-task-title";
      titleSpan.textContent = task.title;

      mainRow.appendChild(chk);
      mainRow.appendChild(titleSpan);

      const footerRow = document.createElement("div");
      footerRow.className = "sidebar-task-footer";
      if (task.dueDate) {
        const dueInfo = formatDueDays(task.dueDate);
        if (dueInfo) {
          const dueBadge = dueChip(dueInfo);
          footerRow.appendChild(dueBadge);
        }
      }

      li.appendChild(topRow);
      li.appendChild(mainRow);
      if (task.dueDate) li.appendChild(footerRow);
      ul.appendChild(li);
    });

    group.appendChild(ul);
    fragment.appendChild(group);
  }

  if (currentSeq !== renderAllTasksSeq) return;
  allTasksUnifiedList.innerHTML = "";
  allTasksUnifiedList.appendChild(fragment);

  if (allTasksUnifiedEmpty) {
    allTasksUnifiedEmpty.hidden = visibleSectionsCount > 0;
    if (currentTaskFilter === "course") {
      allTasksUnifiedEmpty.textContent = "🎉 هیچ تکلیف انجام‌نشده‌ای نداری!";
    } else if (currentTaskFilter === "daily") {
      allTasksUnifiedEmpty.textContent = "کاری برای این روز ثبت نشده.";
    } else if (currentTaskFilter === "gcal") {
      allTasksUnifiedEmpty.textContent = "هیچ رویدادی در تقویم گوگل برای این روز نیست.";
    } else if (currentTaskFilter === "ideas") {
      allTasksUnifiedEmpty.textContent = "💡 هیچ ایده‌ای در کانون تمرکز نداری.";
    } else {
      allTasksUnifiedEmpty.textContent = "🎉 هیچ کار یا رویدادی برای این روز ثبت نشده!";
    }
  }
}

function renderSidebarCourseTasks() {
  renderAllTasksUnified();
}

const taskForm = document.getElementById("taskForm");
if (taskForm) {
  taskForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("taskInput");
    const text = input.value.trim();
    if (!text) return;

    const key = taskKey(selectedDate);
    const data = await storageGet(key);
    const tasks = data[key] || [];
    tasks.push({ id: crypto.randomUUID(), text, done: false });
    await storageSet({ [key]: tasks });

    input.value = "";
    await renderAllTasksUnified();
    await loadTasksForMonth();
    renderCalendar();
    if (scheduleViewMode === "personal") {
      renderPersonalScheduleTable();
    }
  });
}

// ---------------------------------------------------------------
// Google Calendar
// ---------------------------------------------------------------
const GOOGLE_OAUTH_CLIENT_ID = "408512611216-o2itaqqsqinsurh9cq0q30t61uo8knqe.apps.googleusercontent.com";
const GOOGLE_OAUTH_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

const gcalStatus = document.getElementById("gcalStatus");
const gcalEvents = document.getElementById("gcalEvents");
const gcalConnectBtn = document.getElementById("gcalConnectBtn");
const gcalEmpty = document.getElementById("gcalEmpty");
const gcalSelectedDateLabel = document.getElementById("gcalSelectedDateLabel");

function showGcalStatus(msg) {
  if (!gcalStatus) return;
  gcalStatus.hidden = false;
  gcalStatus.textContent = msg;
}

function launchGoogleAuthFlow(interactive) {
  return new Promise((resolve, reject) => {
    if (!chrome.identity) { reject(new Error("identity API در دسترس نیست")); return; }
    if (GOOGLE_OAUTH_CLIENT_ID.startsWith("YOUR_")) {
      reject(new Error("Client ID هنوز در app.js جایگزین نشده")); return;
    }

    const redirectUri = chrome.identity.getRedirectURL();
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", GOOGLE_OAUTH_CLIENT_ID);
    authUrl.searchParams.set("response_type", "token");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", GOOGLE_OAUTH_SCOPE);
    authUrl.searchParams.set("prompt", "consent");

    chrome.identity.launchWebAuthFlow(
      { url: authUrl.href, interactive: !!interactive },
      (responseUrl) => {
        if (chrome.runtime.lastError || !responseUrl) {
          reject(new Error(chrome.runtime.lastError?.message || "ورود لغو شد یا ناموفق بود"));
          return;
        }
        const hash = new URL(responseUrl).hash.slice(1);
        const params = new URLSearchParams(hash);
        const token = params.get("access_token");
        const expiresIn = Number(params.get("expires_in") || 3600);
        if (!token) { reject(new Error("توکن دریافت نشد")); return; }
        resolve({ token, expiresAt: Date.now() + expiresIn * 1000 });
      }
    );
  });
}

async function getValidToken(interactive) {
  const data = await storageGet(["gcalToken", "gcalExpiresAt"]);
  if (data.gcalToken && data.gcalExpiresAt && Date.now() < data.gcalExpiresAt - 30000) {
    return data.gcalToken;
  }
  const { token, expiresAt } = await launchGoogleAuthFlow(interactive);
  await storageSet({ gcalToken: token, gcalExpiresAt: expiresAt, gcalConnected: true });
  return token;
}

async function fetchGoogleEventsForDate(token, date) {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end = new Date(date); end.setHours(23, 59, 59, 999);
  const params = new URLSearchParams({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Google Calendar API: ${res.status}`);
  const data = await res.json();
  return data.items || [];
}

function renderGoogleEvents(events) {
  if (!gcalEvents) return;
  gcalEvents.innerHTML = "";

  const jSelected = toJalali(selectedDate);
  if (gcalSelectedDateLabel) {
    gcalSelectedDateLabel.textContent = `Google Calendar (${faDigits(jSelected.jd)} ${SHAMSI_MONTH_LABELS[jSelected.jm - 1]})`;
  }

  if (badgeGcalCount) {
    badgeGcalCount.textContent = faDigits(events.length);
  }

  if (gcalEmpty) {
    gcalEmpty.hidden = events.length > 0;
  }

  if (!events.length) return;

  for (const ev of events) {
    const row = document.createElement("div");
    row.className = "gcal-event";
    const time = document.createElement("time");
    if (ev.start?.dateTime) {
      const d = new Date(ev.start.dateTime);
      time.textContent = faDigits(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`);
    } else {
      time.textContent = "تمام روز";
    }
    const title = document.createElement("span");
    title.textContent = ev.summary || "(بدون عنوان)";
    row.appendChild(time);
    row.appendChild(title);
    gcalEvents.appendChild(row);
  }
}

async function loadGoogleEventsForSelectedDate(interactive = false) {
  const connected = (await storageGet("gcalConnected")).gcalConnected;
  if (!connected) {
    cachedGcalEventsForSelectedDate = [];
    renderAllTasksUnified();
    return;
  }
  try {
    const token = await getValidToken(false); // never pop the login window on silent loads
    const events = await fetchGoogleEventsForDate(token, selectedDate);
    cachedGcalEventsForSelectedDate = events || [];
    gcalStatus.hidden = true;
    renderGoogleEvents(events);
    renderAllTasksUnified();
  } catch (err) {
    cachedGcalEventsForSelectedDate = [];
    renderAllTasksUnified();
    showGcalStatus("برای دیدن رویدادهای این روز، دوباره روی «اتصال به گوگل‌کلندر» بزن.");
  }
}

gcalConnectBtn.addEventListener("click", async () => {
  try {
    showGcalStatus("در حال اتصال…");
    await getValidToken(true);
    gcalStatus.hidden = true;
    await loadGoogleEventsForSelectedDate(true);
  } catch (err) {
    showGcalStatus(
      err.message === "Client ID هنوز در app.js جایگزین نشده"
        ? "اول باید Client ID خودت رو در app.js جایگزین کنی (راهنما در README)."
        : "اتصال ناموفق بود. راهنمای کامل در README.md هست."
    );
  }
});

// ---------------------------------------------------------------
// Weekly Class Schedule (برنامه هفتگی کلاسی دانشگاه فردوسی)
// ---------------------------------------------------------------
const SCHEDULE_DAYS = [
  { index: 0, name: "شنبه", short: "ش" },
  { index: 1, name: "یکشنبه", short: "ی" },
  { index: 2, name: "دوشنبه", short: "د" },
  { index: 3, name: "سه‌شنبه", short: "س" },
  { index: 4, name: "چهارشنبه", short: "چ" },
  { index: 5, name: "پنجشنبه", short: "پ" },
];

const scheduleGrid = document.getElementById("scheduleGrid");
const scheduleEmpty = document.getElementById("scheduleEmpty");
const todayClassesSummary = document.getElementById("todayClassesSummary");
const addClassBtn = document.getElementById("addClassBtn");

const schedModeUnivBtn = document.getElementById("schedModeUnivBtn");
const schedModePersonalBtn = document.getElementById("schedModePersonalBtn");
const univScheduleActions = document.getElementById("univScheduleActions");
const personalScheduleActions = document.getElementById("personalScheduleActions");
const univScheduleFooter = document.getElementById("univScheduleFooter");
const personalScheduleFooter = document.getElementById("personalScheduleFooter");
const personalWeekRangeText = document.getElementById("personalWeekRangeText");
const personalSyncGcalBtn = document.getElementById("personalSyncGcalBtn");
const personalTotalEvents = document.getElementById("personalTotalEvents");
const personalGcalStatusText = document.getElementById("personalGcalStatusText");

let scheduleViewMode = "university"; // "university" | "personal"

const classDialog = document.getElementById("classDialog");
const classForm = document.getElementById("classForm");
const classDialogTitle = document.getElementById("classDialogTitle");
const classDialogCloseBtn = document.getElementById("classDialogCloseBtn");
const classCancelBtn = document.getElementById("classCancelBtn");
const classEditId = document.getElementById("classEditId");
const classNameInput = document.getElementById("className");
const classInstructorInput = document.getElementById("classInstructor");
const classUnitsSelect = document.getElementById("classUnits");
const classWeekTypeSelect = document.getElementById("classWeekType");
const sessionsList = document.getElementById("sessionsList");
const addSessionBtn = document.getElementById("addSessionBtn");
const sessionsError = document.getElementById("sessionsError");

let scheduleClasses = [];

function getCurrentIranianDayIndex() {
  // getDay(): 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  // Iranian: 0=Sat, 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri
  const jsDay = new Date().getDay();
  return (jsDay + 1) % 7;
}

function normalizeCourse(course) {
  if (!Array.isArray(course.tasks)) course.tasks = [];
  if (!Array.isArray(course.exams)) course.exams = [];
  if (typeof course.notes !== "string") course.notes = "";
  if (!Array.isArray(course.links)) course.links = [];
  if (typeof course.absences !== "number") course.absences = 0;
  const u = Number(course.units);
  course.units = (u === 1 || u === 2 || u === 3) ? u : 3;
  return course;
}

function getAllScheduledExams() {
  const list = [];
  scheduleClasses.forEach((course) => {
    normalizeCourse(course);
    (course.exams || []).forEach((exam) => {
      if (exam.date) {
        list.push({
          courseId: course.id,
          courseTitle: course.title,
          courseColor: course.color,
          exam,
        });
      }
    });
  });
  return list;
}

function getMaxAbsences(units) {
  const u = Number(units) || 3;
  if (u === 1) return 2;
  if (u === 2) return 3;
  return 5; // 3 units
}

function normalizeCourseSessions(course) {
  if (Array.isArray(course.sessions) && course.sessions.length > 0) {
    return course.sessions;
  }
  if (Array.isArray(course.days) && course.days.length > 0) {
    return course.days.map((d) => ({
      day: Number(d),
      startTime: course.startTime || "08:00",
      endTime: course.endTime || "10:00",
      location: course.location || "",
    }));
  }
  return [];
}

function timeToHourFraction(timeStr) {
  if (!timeStr) return 8;
  const [h, m] = timeStr.split(":").map(Number);
  // The timetable runs from 08:00 to 20:00; legacy records sometimes
  // persisted noon as 00:00. Treat that value as 12:00 in this context.
  const hour = isNaN(h) ? 8 : (h === 0 ? 12 : h);
  return hour + ((isNaN(m) ? 0 : m) / 60);
}

function displayScheduleTime(timeStr, fallback = "08:00") {
  const raw = String(timeStr || fallback);
  return raw === "00:00" ? "12:00" : raw;
}

function getGridSpanForClass(startTime, endTime) {
  const startFrac = Math.max(8, Math.min(20, timeToHourFraction(startTime)));
  let endFrac = Math.max(8, Math.min(20, timeToHourFraction(endTime)));
  if (endFrac <= startFrac) endFrac = Math.min(20, startFrac + 1.5);

  // 12 columns for 08:00 to 20:00. In CSS grid line numbers are 1..13
  // Grid direction is RTL, so the natural column numbering already places
  // earlier hours on the right and later hours on the left.
  const startCol = Math.max(1, Math.min(12, Math.floor(startFrac - 8) + 1));
  const endCol = Math.max(startCol + 1, Math.min(13, Math.ceil(endFrac - 8) + 1));

  return { startCol, endCol };
}

// ---------------------------------------------------------------
// "Now" state: which class is running / next, for the live marker
// ---------------------------------------------------------------
const nowHourFraction = (d = new Date()) => d.getHours() + d.getMinutes() / 60;

function formatHourFraction(frac) {
  const h = Math.floor(frac);
  const m = Math.round((frac - h) * 60);
  return faDigits(`${pad2(h)}:${pad2(m)}`);
}

function formatMinutesSpan(mins) {
  mins = Math.max(1, Math.round(mins));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${faDigits(m)} دقیقه`;
  return m ? `${faDigits(h)} ساعت و ${faDigits(m)} دقیقه` : `${faDigits(h)} ساعت`;
}

// Biweekly sessions only count in the week they meet (when parity is known).
function sessionMeetsOnDay(course, session, dayIndex) {
  const weekType = session.weekType && session.weekType !== "all" ? session.weekType : course.weekType;
  if (weekType !== "odd" && weekType !== "even") return true;
  const parity = typeof scheduleParityForDay === "function" ? scheduleParityForDay(dayIndex) : null;
  return !parity || parity === weekType;
}

function getTodayClassState(now = new Date()) {
  const todayIdx = getCurrentIranianDayIndex();
  const nowFrac = nowHourFraction(now);
  const sessions = [];
  for (const raw of scheduleClasses) {
    for (const s of normalizeCourseSessions(raw)) {
      if (s.day !== todayIdx || !sessionMeetsOnDay(raw, s, todayIdx)) continue;
      sessions.push({
        key: `${raw.id}|${s.day}|${s.startTime}`,
        course: raw,
        session: s,
        start: timeToHourFraction(s.startTime),
        end: timeToHourFraction(s.endTime),
      });
    }
  }
  sessions.sort((a, b) => a.start - b.start);
  return {
    todayIdx,
    nowFrac,
    sessions,
    current: sessions.find((x) => x.start <= nowFrac && nowFrac < x.end) || null,
    next: sessions.find((x) => x.start > nowFrac) || null,
  };
}

function updateTodayClassesSummary() {
  const state = getTodayClassState();
  const badge = document.getElementById("todayClassesBadge");
  if (badge) {
    badge.classList.toggle("in-class", Boolean(state.current));
    badge.classList.toggle("free-now", !state.current);
  }

  if (state.todayIdx === 6) {
    todayClassesSummary.textContent = "امروز جمعه است (تعطیل)";
    return;
  }
  if (state.sessions.length === 0) {
    todayClassesSummary.textContent = "امروز کلاسی نداری";
    return;
  }
  if (state.current) {
    const left = (state.current.end - state.nowFrac) * 60;
    todayClassesSummary.textContent = `الان سر کلاس «${state.current.course.title}» هستی • تا ${formatHourFraction(state.current.end)} (${formatMinutesSpan(left)} مانده)`;
    return;
  }
  if (state.next) {
    const wait = (state.next.start - state.nowFrac) * 60;
    todayClassesSummary.textContent = `الان کلاس نداری • کلاس بعدی: «${state.next.course.title}» ساعت ${formatHourFraction(state.next.start)} (${formatMinutesSpan(wait)} دیگر)`;
    return;
  }
  todayClassesSummary.textContent = `کلاس‌های امروز تمام شد ✅ (${faDigits(state.sessions.length)} جلسه)`;
}

// Live "you are here" line on today's row (08:00–20:00 grid).
function updateNowMarker() {
  const row = scheduleGrid && scheduleGrid.querySelector(".schedule-day-row.today-row .sched-day-slots-container");
  if (!row) return;
  const state = getTodayClassState();
  let marker = row.querySelector(".now-marker");
  if (state.nowFrac < 8 || state.nowFrac >= 20) {
    if (marker) marker.remove();
    return;
  }
  if (!marker) {
    marker = document.createElement("div");
    marker.className = "now-marker";
    marker.innerHTML = '<span class="now-marker-dot"></span><span class="now-marker-label"></span>';
    row.appendChild(marker);
  }
  const frac = (state.nowFrac - 8) / 12;
  marker.style.insetInlineStart = `calc(6px + (100% - 12px) * ${frac.toFixed(4)})`;
  marker.classList.toggle("in-class", Boolean(state.current));
  marker.classList.toggle("label-flip", frac > 0.8); // keep the label inside the grid near 20:00
  marker.querySelector(".now-marker-label").textContent = state.current
    ? `شما اینجا هستید · ${formatHourFraction(state.nowFrac)} · سر کلاس`
    : `شما اینجا هستید · ${formatHourFraction(state.nowFrac)} · کلاس ندارید`;

  row.querySelectorAll(".class-card").forEach((card) => {
    card.classList.toggle("is-now", Boolean(state.current) && card.dataset.sessionKey === state.current.key);
  });
}

let lastNowStateKey = "";
function tickScheduleNow() {
  if (scheduleViewMode !== "university") return;
  const state = getTodayClassState();
  const key = `${state.todayIdx}|${state.current ? state.current.start : "-"}|${state.next ? state.next.start : "-"}`;
  if (key !== lastNowStateKey && lastNowStateKey) {
    lastNowStateKey = key;
    renderScheduleTable(); // day changed or a class started/ended
    return;
  }
  lastNowStateKey = key;
  updateTodayClassesSummary();
  updateNowMarker();
}
setInterval(tickScheduleNow, 30 * 1000);

function renderUniversityScheduleTable() {
  scheduleGrid.innerHTML = "";
  if (scheduleEmpty) scheduleEmpty.hidden = true;
  updateTodayClassesSummary();

  const container = document.createElement("div");
  container.className = "schedule-grid-container";

  // 1. Header Row (08:00 to 20:00)
  const headerRow = document.createElement("div");
  headerRow.className = "schedule-grid-header";

  const cornerCell = document.createElement("div");
  cornerCell.className = "sched-corner-cell";
  cornerCell.textContent = "روز / ساعت";
  headerRow.appendChild(cornerCell);

  for (let h = 8; h < 20; h++) {
    const hourCell = document.createElement("div");
    hourCell.className = "sched-hour-header";

    const titleSpan = document.createElement("span");
    titleSpan.textContent = faDigits(`${pad2(h)}:۰۰`);

    const subSpan = document.createElement("span");
    subSpan.className = "sched-hour-sub";
    subSpan.textContent = faDigits(`${pad2(h)} - ${pad2(h + 1)}`);

    hourCell.appendChild(titleSpan);
    hourCell.appendChild(subSpan);
    headerRow.appendChild(hourCell);
  }
  container.appendChild(headerRow);

  // 2. Day Rows
  const currentIranianDay = getCurrentIranianDayIndex();

  for (const day of SCHEDULE_DAYS) {
    const isToday = currentIranianDay === day.index;

    const dayRow = document.createElement("div");
    dayRow.className = "schedule-day-row" + (isToday ? " today-row" : "");

    // Day Name Label Cell
    const dayLabelCell = document.createElement("div");
    dayLabelCell.className = "sched-day-name-cell";

    const dayNameSpan = document.createElement("span");
    dayNameSpan.textContent = day.name;
    dayLabelCell.appendChild(dayNameSpan);

    if (isToday) {
      const todayTag = SDUI.chip("امروز", { color: "accent", variant: "primary", className: "today-tag" });
      dayLabelCell.appendChild(todayTag);
    }
    dayRow.appendChild(dayLabelCell);

    // Slots & Class Cards Container
    const slotsContainer = document.createElement("div");
    slotsContainer.className = "sched-day-slots-container";

    // Background guideline lines (12 columns)
    const guideLines = document.createElement("div");
    guideLines.className = "sched-slot-guidelines";
    for (let i = 0; i < 12; i++) {
      const col = document.createElement("div");
      col.className = "sched-guide-col";
      guideLines.appendChild(col);
    }
    slotsContainer.appendChild(guideLines);

    // Find all sessions for this specific day
    const daySessions = [];
    for (const rawItem of scheduleClasses) {
      const item = normalizeCourse(rawItem);
      const sessions = normalizeCourseSessions(item);
      for (const s of sessions) {
        if (s.day === day.index) {
          daySessions.push({
            course: item,
            session: s,
          });
        }
      }
    }

    // Sort sessions by startTime
    daySessions.sort((a, b) => (a.session.startTime || "").localeCompare(b.session.startTime || ""));

    for (const entry of daySessions) {
      const { course, session } = entry;
      const { startCol, endCol } = getGridSpanForClass(session.startTime, session.endTime);

      const card = document.createElement("div");
      // Interactive card: the title is the card's primary button and its hit area is
      // stretched over the whole card (one tab stop, keyboard + focus ring). The edit /
      // delete / hub buttons sit above it.
      card.className = "class-card sd-card-interactive";
      card.dataset.sessionKey = `${course.id}|${session.day}|${session.startTime}`;
      card.style.gridColumn = `${startCol} / ${endCol}`;
      if (course.color) {
        card.style.setProperty("--card-color", course.color);
      }

      // Top: Title + Action buttons
      const topRow = document.createElement("div");
      topRow.className = "class-card-top";

      const titleEl = document.createElement("h4");
      titleEl.className = "class-title";
      const titleBtn = document.createElement("button");
      titleBtn.type = "button";
      titleBtn.className = "sd-card__link";
      titleBtn.textContent = course.title;
      titleBtn.setAttribute("aria-label", `باز کردن دفترچه درس ${course.title}`);
      titleBtn.addEventListener("click", () => openCourseHub(course.id));
      titleEl.appendChild(titleBtn);
      topRow.appendChild(titleEl);

      const actions = document.createElement("div");
      actions.className = "class-card-actions";

      // Hub button
      const hubBtn = document.createElement("button");
      hubBtn.type = "button";
      hubBtn.className = "class-action-btn class-open-hub-btn";
      hubBtn.title = "دفترچه درس و تکالیف";
      hubBtn.setAttribute("aria-label", `دفترچه ${course.title}`);
      hubBtn.textContent = "📖";
      hubBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openCourseHub(course.id);
      });

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "class-action-btn btn-edit";
      editBtn.title = "ویرایش مشخصات درس";
      editBtn.setAttribute("aria-label", `ویرایش ${course.title}`);
      editBtn.textContent = "✏️";
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openClassDialog(course);
      });

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "class-action-btn btn-delete";
      delBtn.title = "حذف این درس";
      delBtn.setAttribute("aria-label", `حذف ${course.title}`);
      delBtn.textContent = "×";
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteClass(course.id, course.title);
      });

      actions.appendChild(hubBtn);
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      topRow.appendChild(actions);
      card.appendChild(topRow);

      // Middle: Location & Instructor
      const details = document.createElement("div");
      details.className = "class-card-details";

      if (session.location && session.location !== "—") {
        const room = document.createElement("span");
        room.className = "class-room";
        room.textContent = `📍 ${session.location}`;
        if (session.locationFull) room.title = session.locationFull;
        details.appendChild(room);
      }

      if (course.instructor) {
        const inst = document.createElement("span");
        inst.className = "class-instructor";
        inst.textContent = `👨‍🏫 ${course.instructor}`;
        details.appendChild(inst);
      }
      card.appendChild(details);

      // Bottom Row: Time + Week Type Badge + Task / Absence Badges
      const bottomRow = document.createElement("div");
      bottomRow.className = "class-card-bottom";

      const timeEl = document.createElement("span");
      timeEl.className = "class-time";
      timeEl.textContent = `${faDigits(displayScheduleTime(session.startTime, "08:00"))} - ${faDigits(displayScheduleTime(session.endTime, "10:00"))}`;
      bottomRow.appendChild(timeEl);

      // Session-level week (from Pooya) wins over the course-level setting.
      const effectiveWeekType = session.weekType && session.weekType !== "all" ? session.weekType : course.weekType;
      if (effectiveWeekType === "odd" || effectiveWeekType === "even") {
        const tag = SDUI.chip(effectiveWeekType === "odd" ? "هفته‌های فرد" : "هفته‌های زوج", { color: "default", variant: "", className: "class-week-tag" });
        bottomRow.appendChild(tag);

        const weekParity = typeof scheduleParityForDay === "function" ? scheduleParityForDay(day.index) : null;
        if (weekParity && weekParity !== effectiveWeekType) {
          card.classList.add("off-week");
          card.title = "این هفته تشکیل نمی‌شود (کلاس یک هفته در میان)";
          const off = SDUI.chip("این هفته نیست", { color: "default", variant: "tertiary", className: "class-week-tag" });
          bottomRow.appendChild(off);
        }
      }

      const unitsTag = SDUI.chip(`${faDigits(course.units || 3)} واحد`, { color: "default", variant: "", className: "class-units-tag" });
      bottomRow.appendChild(unitsTag);

      // Course Badges (Active Tasks & Absences)
      const activeTasks = (course.tasks || []).filter((t) => !t.done).length;
      const absences = course.absences || 0;

      if (activeTasks > 0 || absences > 0) {
        const badgesContainer = document.createElement("div");
        badgesContainer.className = "class-card-badges";

        if (activeTasks > 0) {
          const taskBadge = SDUI.chip(`${faDigits(activeTasks)} تکلیف`, { color: "accent", className: "class-badge-tasks" });
          badgesContainer.appendChild(taskBadge);
        }

        if (absences > 0) {
          const absBadge = SDUI.chip(`${faDigits(absences)} غیبت`, { color: absences >= getMaxAbsences(course.units) ? "danger" : "warning", className: "class-badge-absence" });
          badgesContainer.appendChild(absBadge);
        }

        card.appendChild(badgesContainer);
      }

      card.appendChild(bottomRow);
      slotsContainer.appendChild(card);
    }

    const vuDeadlines = typeof vuBuildScheduleDeadlines === "function" ? vuBuildScheduleDeadlines(day.index) : null;
    if (vuDeadlines) slotsContainer.appendChild(vuDeadlines);

    dayRow.appendChild(slotsContainer);
    container.appendChild(dayRow);
  }

  scheduleGrid.appendChild(container);
  updateNowMarker();

  // Calculate total units & course count for the footer summary bar
  let totalUnits = 0;
  scheduleClasses.forEach((c) => {
    const norm = normalizeCourse(c);
    totalUnits += norm.units || 3;
  });
  const scheduleTotalUnits = document.getElementById("scheduleTotalUnits");
  const scheduleTotalCourses = document.getElementById("scheduleTotalCourses");
  if (scheduleTotalUnits) {
    scheduleTotalUnits.textContent = `${faDigits(totalUnits)} واحد`;
  }
  if (scheduleTotalCourses) {
    scheduleTotalCourses.textContent = `${faDigits(scheduleClasses.length)} عنوان درس`;
  }

  renderSidebarCourseTasks();
}

function getCurrentWeekDays(baseDate = new Date()) {
  const d = new Date(baseDate);
  const jsDay = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diffToSaturday = (jsDay + 1) % 7;
  const saturday = new Date(d);
  saturday.setDate(d.getDate() - diffToSaturday);
  saturday.setHours(0, 0, 0, 0);

  const days = [];
  const dayNames = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

  for (let i = 0; i < 7; i++) {
    const current = new Date(saturday);
    current.setDate(saturday.getDate() + i);
    const j = toJalali(current);
    days.push({
      dayIndex: i,
      name: dayNames[i],
      date: current,
      isoDate: isoDate(current),
      shamsiDate: `${faDigits(j.jd)} ${SHAMSI_MONTH_LABELS[j.jm - 1]}`,
      isToday: sameDay(current, new Date()),
    });
  }
  return days;
}

async function fetchGoogleEventsForWeek(token, weekDays) {
  if (!token || !weekDays || weekDays.length === 0) return [];
  const start = new Date(weekDays[0].date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(weekDays[6].date);
  end.setHours(23, 59, 59, 999);

  const params = new URLSearchParams({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Google Calendar API: ${res.status}`);
  const data = await res.json();
  return data.items || [];
}

async function renderPersonalScheduleTable() {
  scheduleGrid.innerHTML = "";
  if (scheduleEmpty) scheduleEmpty.hidden = true;

  const weekDays = getCurrentWeekDays();
  if (personalWeekRangeText) {
    personalWeekRangeText.textContent = `${weekDays[0].shamsiDate} تا ${weekDays[6].shamsiDate}`;
  }

  // Fetch Google Calendar events for the week if connected
  let weekGcalEvents = [];
  const gcalConnected = (await storageGet("gcalConnected")).gcalConnected;
  if (gcalConnected) {
    try {
      const token = await getValidToken(false);
      if (token) {
        weekGcalEvents = await fetchGoogleEventsForWeek(token, weekDays);
        if (personalGcalStatusText) {
          personalGcalStatusText.textContent = "Google Calendar متصل و همگام است";
        }
      }
    } catch (e) {
      if (personalGcalStatusText) {
        personalGcalStatusText.textContent = "برای دریافت رویدادها، همگام‌سازی را بزنید";
      }
    }
  } else {
    if (personalGcalStatusText) {
      personalGcalStatusText.textContent = "اتصال به Google Calendar غیرفعال است";
    }
  }

  const container = document.createElement("div");
  container.className = "schedule-grid-container";

  // 1. Header Row (08:00 to 20:00)
  const headerRow = document.createElement("div");
  headerRow.className = "schedule-grid-header";

  const cornerCell = document.createElement("div");
  cornerCell.className = "sched-corner-cell";
  cornerCell.textContent = "روز / تاریخ";
  headerRow.appendChild(cornerCell);

  for (let h = 8; h < 20; h++) {
    const hourCell = document.createElement("div");
    hourCell.className = "sched-hour-header";

    const titleSpan = document.createElement("span");
    titleSpan.textContent = faDigits(`${pad2(h)}:۰۰`);

    const subSpan = document.createElement("span");
    subSpan.className = "sched-hour-sub";
    subSpan.textContent = faDigits(`${pad2(h)} - ${pad2(h + 1)}`);

    hourCell.appendChild(titleSpan);
    hourCell.appendChild(subSpan);
    headerRow.appendChild(hourCell);
  }
  container.appendChild(headerRow);

  let totalEventsCount = 0;

  // 2. Day Rows (7 days: Saturday to Friday)
  for (const day of weekDays) {
    const dayRow = document.createElement("div");
    dayRow.className = "schedule-day-row" + (day.isToday ? " today-row" : "");

    // Day Name + Shamsi Date Label Cell
    const dayLabelCell = document.createElement("div");
    dayLabelCell.className = "sched-day-name-cell";

    const dayNameSpan = document.createElement("span");
    dayNameSpan.textContent = day.name;
    dayLabelCell.appendChild(dayNameSpan);

    const dayDateSpan = document.createElement("span");
    dayDateSpan.className = "sched-day-date-sub";
    dayDateSpan.textContent = day.shamsiDate;
    dayLabelCell.appendChild(dayDateSpan);

    if (day.isToday) {
      const todayTag = SDUI.chip("امروز", { color: "accent", variant: "primary", className: "today-tag" });
      dayLabelCell.appendChild(todayTag);
    }
    dayRow.appendChild(dayLabelCell);

    // Slots Container
    const slotsContainer = document.createElement("div");
    slotsContainer.className = "sched-day-slots-container";

    // 12 guidelines
    const guideLines = document.createElement("div");
    guideLines.className = "sched-slot-guidelines";
    for (let i = 0; i < 12; i++) {
      const col = document.createElement("div");
      col.className = "sched-guide-col";
      guideLines.appendChild(col);
    }
    slotsContainer.appendChild(guideLines);

    // Filter events for this specific day
    const dayEvents = [];

    // 1) From Google Calendar
    for (const ev of weekGcalEvents) {
      if (!ev.start) continue;
      let evStart = null;
      let evEnd = null;
      let isAllDay = false;

      if (ev.start.dateTime) {
        evStart = new Date(ev.start.dateTime);
        evEnd = ev.end?.dateTime ? new Date(ev.end.dateTime) : new Date(evStart.getTime() + 3600000);
      } else if (ev.start.date) {
        isAllDay = true;
        evStart = StudashDate.parseIsoDate(ev.start.date); // all-day: date-only, keep the local day
      }

      if (evStart && isoDate(evStart) === day.isoDate) {
        dayEvents.push({
          id: ev.id,
          title: ev.summary || "رویداد بدون عنوان",
          startTime: isAllDay ? "08:00" : `${pad2(evStart.getHours())}:${pad2(evStart.getMinutes())}`,
          endTime: isAllDay ? "10:00" : (evEnd ? `${pad2(evEnd.getHours())}:${pad2(evEnd.getMinutes())}` : "10:00"),
          isAllDay,
          source: "Google Calendar",
          color: "#818cf8",
          link: ev.htmlLink || ev.hangoutLink,
        });
      }
    }

    // 2) From Scheduled Exams for this day
    const allExams = getAllScheduledExams();
    const dayExams = allExams.filter((e) => e.exam.date === day.isoDate);
    for (const de of dayExams) {
      const examStart = de.exam.time || "08:30";
      // Default duration: 2 hours
      const [eh, em] = examStart.split(":").map(Number);
      const endH = Math.min(20, (isNaN(eh) ? 8 : eh) + 2);
      const examEnd = `${pad2(endH)}:${pad2(isNaN(em) ? 0 : em)}`;
      dayEvents.push({
        id: de.exam.id,
        title: `${de.exam.title} (${de.courseTitle})`,
        startTime: examStart,
        endTime: examEnd,
        source: "🎯 آزمون کلاسی",
        color: "#ef4444",
      });
    }

    totalEventsCount += dayEvents.length;

    // Render Event Cards on Grid
    for (const ev of dayEvents) {
      const { startCol, endCol } = getGridSpanForClass(ev.startTime, ev.endTime);

      const card = document.createElement("div");
      card.className = "personal-event-card";
      card.style.gridColumn = `${startCol} / ${endCol}`;
      card.style.setProperty("--event-color", ev.color);
      card.title = `${ev.title} (${ev.source}) — ${ev.startTime} تا ${ev.endTime}`;

      if (ev.link) {
        card.addEventListener("click", () => {
          window.open(ev.link, "_blank");
        });
      }

      const topRow = document.createElement("div");
      topRow.className = "class-card-top";

      const titleEl = document.createElement("h4");
      titleEl.className = "personal-event-title";
      const icon = ev.source === "Google Calendar" ? "📅" : (ev.source.includes("آزمون") ? "🎯" : "⏰");
      titleEl.innerHTML = `<span>${icon}</span> <span>${ev.title}</span>`;
      topRow.appendChild(titleEl);
      card.appendChild(topRow);

      const bottomRow = document.createElement("div");
      bottomRow.className = "class-card-bottom";

      const timeEl = document.createElement("span");
      timeEl.className = "personal-event-time";
      timeEl.textContent = `${faDigits(displayScheduleTime(ev.startTime))} - ${faDigits(displayScheduleTime(ev.endTime, "10:00"))}`;
      bottomRow.appendChild(timeEl);

      const sourceTag = document.createElement("span");
      sourceTag.className = "personal-event-source";
      sourceTag.textContent = ev.source;
      bottomRow.appendChild(sourceTag);

      card.appendChild(bottomRow);
      slotsContainer.appendChild(card);
    }

    dayRow.appendChild(slotsContainer);
    container.appendChild(dayRow);
  }

  scheduleGrid.appendChild(container);

  if (personalTotalEvents) {
    personalTotalEvents.textContent = `${faDigits(totalEventsCount)} رویداد`;
  }
}

function renderScheduleTable() {
  if (scheduleViewMode === "personal") {
    if (univScheduleActions) univScheduleActions.hidden = true;
    if (personalScheduleActions) personalScheduleActions.hidden = false;
    if (univScheduleFooter) univScheduleFooter.hidden = true;
    if (personalScheduleFooter) personalScheduleFooter.hidden = false;
    SDUI.setSelected([schedModeUnivBtn, schedModePersonalBtn], (btn) => btn === schedModePersonalBtn);
    renderPersonalScheduleTable();
  } else {
    if (univScheduleActions) univScheduleActions.hidden = false;
    if (personalScheduleActions) personalScheduleActions.hidden = true;
    if (univScheduleFooter) univScheduleFooter.hidden = false;
    if (personalScheduleFooter) personalScheduleFooter.hidden = true;
    SDUI.setSelected([schedModeUnivBtn, schedModePersonalBtn], (btn) => btn === schedModeUnivBtn);
    renderUniversityScheduleTable();
  }
}

async function setScheduleViewMode(mode) {
  scheduleViewMode = mode;
  await storageSet({ scheduleViewMode: mode });
  renderScheduleTable();
}

if (schedModeUnivBtn) {
  schedModeUnivBtn.addEventListener("click", () => setScheduleViewMode("university"));
}
if (schedModePersonalBtn) {
  schedModePersonalBtn.addEventListener("click", () => setScheduleViewMode("personal"));
}
if (personalSyncGcalBtn) {
  personalSyncGcalBtn.addEventListener("click", async () => {
    try {
      personalSyncGcalBtn.textContent = "⏳ در حال همگام‌سازی…";
      await getValidToken(true);
      await renderPersonalScheduleTable();
      personalSyncGcalBtn.textContent = "✓ همگام شد!";
      setTimeout(() => {
        personalSyncGcalBtn.textContent = "🔄 همگام‌سازی تقویم گوگل";
      }, 2000);
    } catch (e) {
      personalSyncGcalBtn.textContent = "❌ خطا در اتصال";
      setTimeout(() => {
        personalSyncGcalBtn.textContent = "🔄 همگام‌سازی تقویم گوگل";
      }, 2500);
    }
  });
}

// ---------------------------------------------------------------
// Session Item Builder for Modal Dialog
// ---------------------------------------------------------------
function updateSessionNumbers() {
  const items = sessionsList.querySelectorAll(".session-item");
  items.forEach((item, idx) => {
    const numEl = item.querySelector(".session-num");
    if (numEl) numEl.textContent = `جلسه ${faDigits(idx + 1)}`;
    const removeBtn = item.querySelector(".session-remove-btn");
    if (removeBtn) {
      removeBtn.hidden = items.length === 1; // Can't delete if only 1 session remains
    }
  });
}

function createSessionItem(sessionData = null) {
  const item = document.createElement("div");
  item.className = "session-item";

  const defaultDay = sessionData ? sessionData.day : (getCurrentIranianDayIndex() <= 5 ? getCurrentIranianDayIndex() : 0);
  const defaultLoc = sessionData ? (sessionData.location || "") : "";
  const defaultStart = sessionData ? displayScheduleTime(sessionData.startTime, "08:00") : "08:00";
  const defaultEnd = sessionData ? displayScheduleTime(sessionData.endTime, "10:00") : "10:00";
  const defaultWeek = (sessionData && sessionData.weekType) || "all";

  item.innerHTML = `
    <div class="session-item-header">
      <span class="session-num">جلسه</span>
      <button type="button" class="session-remove-btn" title="حذف این جلسه" aria-label="حذف جلسه">×</button>
    </div>
    <div class="session-fields">
      <div class="form-row">
        <label class="form-group flex-1">
          <span>روز برگزاری *</span>
          <select class="session-day" required>
            <option value="0"${defaultDay === 0 ? " selected" : ""}>شنبه</option>
            <option value="1"${defaultDay === 1 ? " selected" : ""}>یکشنبه</option>
            <option value="2"${defaultDay === 2 ? " selected" : ""}>دوشنبه</option>
            <option value="3"${defaultDay === 3 ? " selected" : ""}>سه‌شنبه</option>
            <option value="4"${defaultDay === 4 ? " selected" : ""}>چهارشنبه</option>
            <option value="5"${defaultDay === 5 ? " selected" : ""}>پنجشنبه</option>
          </select>
        </label>
        <label class="form-group flex-1">
          <span>محل کلاس / دانشکده *</span>
          <input type="text" class="session-location" placeholder="مثلاً: B-25 یا آزمایشگاه" value="${defaultLoc}" required autocomplete="off" />
        </label>
      </div>
      <div class="form-row">
        <label class="form-group flex-1">
          <span>ساعت شروع *</span>
          <input type="time" class="session-start" value="${defaultStart}" required />
        </label>
        <label class="form-group flex-1">
          <span>ساعت پایان *</span>
          <input type="time" class="session-end" value="${defaultEnd}" required />
        </label>
        <label class="form-group flex-1">
          <span>هفته</span>
          <select class="session-week">
            <option value="all"${defaultWeek === "all" ? " selected" : ""}>هر هفته</option>
            <option value="odd"${defaultWeek === "odd" ? " selected" : ""}>هفته‌های فرد</option>
            <option value="even"${defaultWeek === "even" ? " selected" : ""}>هفته‌های زوج</option>
          </select>
        </label>
      </div>
    </div>
  `;

  // Keep fields the form doesn't edit (e.g. Pooya's full location path).
  if (sessionData && sessionData.locationFull) item.dataset.locationFull = sessionData.locationFull;

  item.querySelector(".session-remove-btn").addEventListener("click", () => {
    item.remove();
    updateSessionNumbers();
  });

  return item;
}

function addSessionRow(sessionData = null) {
  const el = createSessionItem(sessionData);
  sessionsList.appendChild(el);
  updateSessionNumbers();
}

addSessionBtn.addEventListener("click", () => {
  addSessionRow(null);
});

function openClassDialog(classToEdit = null) {
  sessionsError.hidden = true;
  sessionsList.innerHTML = "";

  if (classToEdit) {
    classDialogTitle.textContent = "ویرایش درس";
    classEditId.value = classToEdit.id;
    classNameInput.value = classToEdit.title || "";
    classInstructorInput.value = classToEdit.instructor || "";
    if (classUnitsSelect) classUnitsSelect.value = String(classToEdit.units || 3);
    classWeekTypeSelect.value = classToEdit.weekType || "all";

    const colorRadios = document.querySelectorAll('input[name="classColor"]');
    colorRadios.forEach((r) => {
      r.checked = r.value === classToEdit.color;
    });

    const sessions = normalizeCourseSessions(classToEdit);
    if (sessions.length > 0) {
      sessions.forEach((s) => addSessionRow(s));
    } else {
      addSessionRow(null);
    }
  } else {
    classDialogTitle.textContent = "افزودن درس جدید";
    classEditId.value = "";
    classForm.reset();
    if (classUnitsSelect) classUnitsSelect.value = "3";
    classWeekTypeSelect.value = "all";

    const firstColor = document.querySelector('input[name="classColor"][value="#f2a65a"]');
    if (firstColor) firstColor.checked = true;

    addSessionRow(null);
  }

  classDialog.showModal();
  classNameInput.focus();
}

async function deleteClass(id, title = "") {
  const confirmMsg = title ? `آیا از حذف درس «${title}» مطمئن هستید؟` : "آیا از حذف این درس مطمئن هستید؟";
  if (!confirm(confirmMsg)) return;

  scheduleClasses = scheduleClasses.filter((c) => c.id !== id);
  await storageSet({ scheduleClasses });
  renderScheduleTable();
}

addClassBtn.addEventListener("click", () => openClassDialog(null));
classCancelBtn.addEventListener("click", () => classDialog.close());
classDialogCloseBtn.addEventListener("click", () => classDialog.close());


classForm.addEventListener("submit", async (e) => {
  const title = classNameInput.value.trim();
  const instructor = classInstructorInput.value.trim();
  const units = parseInt(classUnitsSelect ? classUnitsSelect.value : "3", 10) || 3;
  const weekType = classWeekTypeSelect.value;
  const selectedColorEl = document.querySelector('input[name="classColor"]:checked');
  const color = selectedColorEl ? selectedColorEl.value : "#f2a65a";

  const sessionItems = sessionsList.querySelectorAll(".session-item");
  const sessions = [];

  sessionItems.forEach((item) => {
    const day = Number(item.querySelector(".session-day").value);
    const location = item.querySelector(".session-location").value.trim();
    const startTime = item.querySelector(".session-start").value || "08:00";
    const endTime = item.querySelector(".session-end").value || "10:00";
    const weekSelect = item.querySelector(".session-week");
    const weekType = weekSelect ? weekSelect.value : "all";

    if (location) {
      const session = { day, location, startTime, endTime, weekType };
      if (item.dataset.locationFull) session.locationFull = item.dataset.locationFull;
      sessions.push(session);
    }
  });

  if (sessions.length === 0) {
    e.preventDefault();
    sessionsError.hidden = false;
    return;
  }
  sessionsError.hidden = true;

  if (!title) {
    e.preventDefault();
    return;
  }

  const editId = classEditId.value;

  if (editId) {
    const idx = scheduleClasses.findIndex((c) => c.id === editId);
    if (idx > -1) {
      scheduleClasses[idx] = {
        ...scheduleClasses[idx],
        title,
        instructor,
        units,
        weekType,
        color,
        sessions,
      };
    }
  } else {
    scheduleClasses.push({
      id: crypto.randomUUID(),
      title,
      instructor,
      units,
      weekType,
      color,
      sessions,
    });
  }

  await storageSet({ scheduleClasses });
  renderScheduleTable();
});

// ---------------------------------------------------------------
// Course Workspace & Hub Management
// ---------------------------------------------------------------
let activeHubCourseId = null;
let hubNotesSaveTimeout = null;

const courseHubDialog = document.getElementById("courseHubDialog");
const hubColorBar = document.getElementById("hubColorBar");
const hubCourseTitle = document.getElementById("hubCourseTitle");
const hubInstructor = document.getElementById("hubInstructor");
const hubSessionsInfo = document.getElementById("hubSessionsInfo");
const hubStudyTimeBadge = document.getElementById("hubStudyTimeBadge");
const hubEditClassBtn = document.getElementById("hubEditClassBtn");
const hubCloseBtn = document.getElementById("hubCloseBtn");

const hubTasksCount = document.getElementById("hubTasksCount");
const hubLinksCount = document.getElementById("hubLinksCount");
const hubAbsenceCount = document.getElementById("hubAbsenceCount");

const hubTaskForm = document.getElementById("hubTaskForm");
const hubTaskTitle = document.getElementById("hubTaskTitle");
const hubTaskType = document.getElementById("hubTaskType");
const hubTaskDueDate = document.getElementById("hubTaskDueDate");
const hubTasksList = document.getElementById("hubTasksList");
const hubTasksEmpty = document.getElementById("hubTasksEmpty");

const hubNotesTextarea = document.getElementById("hubNotesTextarea");
const hubNotesStatus = document.getElementById("hubNotesStatus");

const hubLinkForm = document.getElementById("hubLinkForm");
const hubLinkTitle = document.getElementById("hubLinkTitle");
const hubLinkUrl = document.getElementById("hubLinkUrl");
const hubLinksGrid = document.getElementById("hubLinksGrid");
const hubLinksEmpty = document.getElementById("hubLinksEmpty");

const absenceBigNum = document.getElementById("absenceBigNum");
const absenceDots = document.getElementById("absenceDots");
const absenceMinusBtn = document.getElementById("absenceMinusBtn");
const absencePlusBtn = document.getElementById("absencePlusBtn");
const absenceAlert = document.getElementById("absenceAlert");

const hubTabBtns = document.querySelectorAll(".hub-tab-btn");

function getActiveHubCourse() {
  const course = scheduleClasses.find((c) => c.id === activeHubCourseId);
  return course ? normalizeCourse(course) : null;
}

function switchHubTab(tabName) {
  SDUI.setSelected(hubTabBtns, (btn) => btn.dataset.tab === tabName);
  document.querySelectorAll(".hub-tab-content").forEach((content) => {
    content.classList.remove("active");
  });
  const tabIdMap = {
    tasks: "tabContentTasks",
    exams: "tabContentExams",
    notes: "tabContentNotes",
    links: "tabContentLinks",
    absences: "tabContentAbsences",
  };
  const targetContent = document.getElementById(tabIdMap[tabName] || "tabContentTasks");
  if (targetContent) targetContent.classList.add("active");
}

hubTabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    switchHubTab(btn.dataset.tab);
  });
});

if (hubCloseBtn) {
  hubCloseBtn.addEventListener("click", () => {
    courseHubDialog.close();
  });
}

if (hubEditClassBtn) {
  hubEditClassBtn.addEventListener("click", () => {
    const course = getActiveHubCourse();
    if (course) {
      courseHubDialog.close();
      openClassDialog(course);
    }
  });
}

// Official HeroUI Chips with one colour meaning app-wide:
// danger = overdue, warning = due within days / needs attention, default = later or neutral.
function dueChip(dueInfo) {
  return SDUI.chip(dueInfo.text, { color: dueInfo.isOverdue ? "danger" : dueInfo.isUrgent ? "warning" : "default", className: "due-date-tag" });
}

// Categories (assignment / exam type) are not statuses, so they stay neutral.
function typeChip(label) {
  return SDUI.chip(label, { color: "default", variant: "", className: "hub-type-tag" });
}

function formatDueDays(dueStr) {
  if (!dueStr) return null;
  const due = StudashDate.parseIsoDate(dueStr);
  if (!due) return null; // malformed stored value: show no badge rather than a wrong date
  const jDue = toJalali(due);
  const dateName = `${faDigits(jDue.jd)} ${SHAMSI_MONTH_LABELS[jDue.jm - 1]}`;
  const diffDays = StudashDate.diffDays(new Date(), due);

  if (diffDays < 0) return { text: `${dateName} (گذشته)`, isOverdue: true };
  if (diffDays === 0) return { text: `امروز (${dateName})`, isUrgent: true };
  if (diffDays === 1) return { text: `فردا (${dateName})`, isUrgent: true };
  if (diffDays <= 7) return { text: `${faDigits(diffDays)} روز مانده (${dateName})`, isUrgent: diffDays <= 3 };
  return { text: dateName, isUrgent: false };
}

const TASK_TYPE_LABELS = {
  assignment: { label: "تمرین", class: "tag-assignment" },
  project: { label: "پروژه", class: "tag-project" },
  quiz: { label: "کوئیز", class: "tag-quiz" },
  report: { label: "گزارش", class: "tag-report" },
  other: { label: "سایر", class: "tag-other" },
};

function renderHubTasks() {
  const course = getActiveHubCourse();
  if (!course) return;

  const tasks = course.tasks || [];
  const activeCount = tasks.filter((t) => !t.done).length;
  hubTasksCount.textContent = faDigits(activeCount);
  hubTasksList.innerHTML = "";
  hubTasksEmpty.hidden = tasks.length > 0;

  // Sort tasks: Undone first, Completed at the bottom
  const sortedTasks = [...tasks].sort((a, b) => {
    if (!!a.done === !!b.done) return 0;
    return a.done ? 1 : -1;
  });

  sortedTasks.forEach((task) => {
    const li = document.createElement("li");
    li.className = "hub-task-item" + (task.done ? " done" : "");

    const left = document.createElement("div");
    left.className = "hub-task-left";

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = !!task.done;
    chk.addEventListener("change", async () => {
      task.done = chk.checked;
      await storageSet({ scheduleClasses });
      renderHubTasks();
      renderScheduleTable();
      await renderAllTasksUnified();
    });

    const titleSpan = document.createElement("span");
    titleSpan.className = "hub-task-title";
    titleSpan.textContent = task.title;

    left.appendChild(chk);
    left.appendChild(titleSpan);

    const right = document.createElement("div");
    right.className = "hub-task-right";

    const typeInfo = TASK_TYPE_LABELS[task.type] || TASK_TYPE_LABELS.assignment;
    const typeBadge = typeChip(typeInfo.label);
    right.appendChild(typeBadge);

    if (task.dueDate) {
      const dueInfo = formatDueDays(task.dueDate);
      if (dueInfo) {
        const dueBadge = dueChip(dueInfo);
        right.appendChild(dueBadge);
      }
    }

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "hub-item-delete";
    delBtn.textContent = "×";
    delBtn.title = "حذف تکلیف";
    delBtn.setAttribute("aria-label", `حذف ${task.title}`);
    delBtn.addEventListener("click", async () => {
      course.tasks = course.tasks.filter((t) => t.id !== task.id);
      await storageSet({ scheduleClasses });
      renderHubTasks();
      renderScheduleTable();
    });
    right.appendChild(delBtn);

    li.appendChild(left);
    li.appendChild(right);
    hubTasksList.appendChild(li);
  });

  if (typeof vuRenderHubBlock === "function") vuRenderHubBlock(course);
}

if (hubTaskForm) {
  hubTaskForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const course = getActiveHubCourse();
    if (!course) return;

    const title = hubTaskTitle.value.trim();
    const type = hubTaskType.value || "assignment";
    const dueDate = hubTaskDueDate.value || "";

    if (!title) return;

    if (!course.tasks) course.tasks = [];
    course.tasks.push({
      id: crypto.randomUUID(),
      title,
      type,
      dueDate,
      done: false,
    });

    await storageSet({ scheduleClasses });
    hubTaskTitle.value = "";
    hubTaskDueDate.value = "";
    renderHubTasks();
    renderScheduleTable();
  });
}

function renderHubNotes() {
  const course = getActiveHubCourse();
  if (!course) return;
  hubNotesTextarea.value = course.notes || "";
  hubNotesStatus.textContent = "ذخیره خودکار ✓";
}

if (hubNotesTextarea) {
  hubNotesTextarea.addEventListener("input", () => {
    const course = getActiveHubCourse();
    if (!course) return;

    hubNotesStatus.textContent = "در حال ذخیره…";
    clearTimeout(hubNotesSaveTimeout);
    hubNotesSaveTimeout = setTimeout(async () => {
      course.notes = hubNotesTextarea.value;
      await storageSet({ scheduleClasses });
      hubNotesStatus.textContent = "ذخیره خودکار ✓";
    }, 400);
  });
}

function renderHubLinks() {
  const course = getActiveHubCourse();
  if (!course) return;

  const links = course.links || [];
  hubLinksCount.textContent = faDigits(links.length);
  hubLinksGrid.innerHTML = "";
  hubLinksEmpty.hidden = links.length > 0;

  links.forEach((l) => {
    const card = document.createElement("div");
    card.className = "hub-link-card";

    const left = document.createElement("a");
    left.className = "hub-link-left";
    left.href = l.url;
    left.target = "_blank";
    left.rel = "noopener noreferrer";

    const favWrap = document.createElement("div");
    favWrap.className = "hub-link-favicon";
    const img = document.createElement("img");
    img.src = faviconFor(l.url);
    img.alt = "";
    img.loading = "lazy";
    img.onerror = () => {
      favWrap.textContent = "🔗";
    };
    favWrap.appendChild(img);

    const details = document.createElement("div");
    details.className = "hub-link-details";
    const titleSpan = document.createElement("span");
    titleSpan.className = "hub-link-title";
    titleSpan.textContent = l.title;
    const urlSpan = document.createElement("span");
    urlSpan.className = "hub-link-url";
    urlSpan.textContent = l.url.replace(/^https?:\/\//i, "");

    details.appendChild(titleSpan);
    details.appendChild(urlSpan);
    left.appendChild(favWrap);
    left.appendChild(details);

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "hub-item-delete";
    delBtn.textContent = "×";
    delBtn.title = "حذف لینک";
    delBtn.setAttribute("aria-label", `حذف ${l.title}`);
    delBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      course.links = course.links.filter((item) => item.id !== l.id);
      await storageSet({ scheduleClasses });
      renderHubLinks();
    });

    card.appendChild(left);
    card.appendChild(delBtn);
    hubLinksGrid.appendChild(card);
  });
}

if (hubLinkForm) {
  hubLinkForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const course = getActiveHubCourse();
    if (!course) return;

    const title = hubLinkTitle.value.trim();
    const rawUrl = hubLinkUrl.value.trim();
    const url = normalizeUrl(rawUrl);

    if (!title || !url) return;

    if (!course.links) course.links = [];
    course.links.push({
      id: crypto.randomUUID(),
      title,
      url,
    });

    await storageSet({ scheduleClasses });
    hubLinkTitle.value = "";
    hubLinkUrl.value = "";
    renderHubLinks();
  });
}

function renderHubAbsences() {
  const course = getActiveHubCourse();
  if (!course) return;

  const maxAbsences = getMaxAbsences(course.units);
  const absences = course.absences || 0;

  if (hubAbsenceCount) {
    hubAbsenceCount.textContent = `${faDigits(absences)}/${faDigits(maxAbsences)}`;
  }
  if (absenceBigNum) {
    absenceBigNum.textContent = faDigits(absences);
    absenceBigNum.classList.toggle("is-warning", absences >= maxAbsences);
  }
  const absenceMaxLabel = document.getElementById("absenceMaxLabel");
  if (absenceMaxLabel) {
    absenceMaxLabel.textContent = `از ${faDigits(maxAbsences)} جلسه غیبت مجاز (درس ${faDigits(course.units || 3)} واحدی)`;
  }

  if (absenceDots) {
    absenceDots.innerHTML = "";
    for (let i = 0; i < maxAbsences; i++) {
      const dot = document.createElement("span");
      dot.className = "abs-dot";
      const isFilled = i < absences;
      dot.classList.toggle("filled", isFilled);
      dot.classList.toggle("danger", isFilled && absences >= maxAbsences);
      absenceDots.appendChild(dot);
    }
  }

  if (absenceAlert) {
    absenceAlert.hidden = absences < maxAbsences;
  }
}

if (absencePlusBtn) {
  absencePlusBtn.addEventListener("click", async () => {
    const course = getActiveHubCourse();
    if (!course) return;
    course.absences = Math.min(16, (course.absences || 0) + 1);
    await storageSet({ scheduleClasses });
    renderHubAbsences();
    renderScheduleTable();
  });
}

if (absenceMinusBtn) {
  absenceMinusBtn.addEventListener("click", async () => {
    const course = getActiveHubCourse();
    if (!course) return;
    course.absences = Math.max(0, (course.absences || 0) - 1);
    await storageSet({ scheduleClasses });
    renderHubAbsences();
    renderScheduleTable();
  });
}

// ---------------------------------------------------------------
// Hub Exams & Quizzes Management
// ---------------------------------------------------------------
const EXAM_TYPE_MAP = {
  quiz: { label: "کوییز / آزمونک", class: "badge-quiz" },
  midterm: { label: "میان‌ترم", class: "badge-midterm" },
  final: { label: "پایان‌ترم", class: "badge-final" },
  lab: { label: "آزمایشگاه / عملی", class: "badge-lab" },
  other: { label: "سایر آزمون‌ها", class: "badge-other" },
};

function formatShamsiAndMiladi(date) {
  if (!date || isNaN(date.getTime())) return "";
  const j = toJalali(date);
  const shamsiStr = `${faDigits(j.jd)} ${SHAMSI_MONTH_LABELS[j.jm - 1]} ${faDigits(j.jy)}`;
  const enStr = `${MONTH_LABELS_EN[date.getMonth()]} ${date.getDate()}`;
  return `${shamsiStr} (${enStr})`;
}

function renderHubExams() {
  const course = getActiveHubCourse();
  if (!course) return;

  const exams = course.exams || [];
  const hubExamsCount = document.getElementById("hubExamsCount");
  const hubExamsList = document.getElementById("hubExamsList");
  const hubExamsEmpty = document.getElementById("hubExamsEmpty");

  if (hubExamsCount) hubExamsCount.textContent = faDigits(exams.length);
  if (!hubExamsList) return;

  hubExamsList.innerHTML = "";
  if (hubExamsEmpty) hubExamsEmpty.hidden = exams.length > 0;

  // Sort exams by date ascending
  const sorted = [...exams].sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  sorted.forEach((exam) => {
    const card = document.createElement("div");
    card.className = "hub-exam-card";

    const main = document.createElement("div");
    main.className = "hub-exam-main";

    const top = document.createElement("div");
    top.className = "hub-exam-top";

    const typeInfo = EXAM_TYPE_MAP[exam.type] || EXAM_TYPE_MAP.quiz;
    const badge = typeChip(typeInfo.label);
    top.appendChild(badge);

    const titleEl = document.createElement("span");
    titleEl.className = "hub-exam-title";
    titleEl.textContent = exam.title;
    top.appendChild(titleEl);

    // Days Countdown
    if (exam.date) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const eDate = new Date(exam.date + "T00:00:00");
      const diffDays = Math.ceil((eDate - now) / (1000 * 60 * 60 * 24));

      const cd = document.createElement("span");
      cd.className = "hub-exam-countdown";

      if (diffDays < 0) {
        cd.classList.add("countdown-passed");
        cd.textContent = "✅ برگزار شده";
      } else if (diffDays === 0) {
        cd.classList.add("countdown-urgent");
        cd.textContent = "🔴 امروز!";
      } else if (diffDays === 1) {
        cd.classList.add("countdown-urgent");
        cd.textContent = "⏳ فردا!";
      } else if (diffDays <= 7) {
        cd.classList.add("countdown-near");
        cd.textContent = `⏳ ${faDigits(diffDays)} روز مانده`;
      } else {
        cd.classList.add("countdown-normal");
        cd.textContent = `📅 ${faDigits(diffDays)} روز دیگر`;
      }
      top.appendChild(cd);
    }

    main.appendChild(top);

    // Meta details (Date, Time, Location)
    const meta = document.createElement("div");
    meta.className = "hub-exam-meta";

    if (exam.date) {
      const dObj = new Date(exam.date + "T00:00:00");
      const dSpan = document.createElement("span");
      dSpan.textContent = `🗓️ ${formatShamsiAndMiladi(dObj)}`;
      meta.appendChild(dSpan);
    }

    if (exam.time) {
      const tSpan = document.createElement("span");
      tSpan.textContent = `⏰ ساعت ${faDigits(exam.time)}`;
      meta.appendChild(tSpan);
    }

    if (exam.location) {
      const lSpan = document.createElement("span");
      lSpan.textContent = `📍 ${exam.location}`;
      meta.appendChild(lSpan);
    }

    main.appendChild(meta);

    // Syllabus
    if (exam.syllabus) {
      const syl = document.createElement("div");
      syl.className = "hub-exam-syllabus";
      syl.textContent = `📚 سرفصل‌ها: ${exam.syllabus}`;
      main.appendChild(syl);
    }

    // Delete button
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "hub-exam-delete-btn";
    delBtn.textContent = "×";
    delBtn.title = "حذف آزمون";
    delBtn.setAttribute("aria-label", `حذف ${exam.title}`);
    delBtn.addEventListener("click", async () => {
      course.exams = course.exams.filter((item) => item.id !== exam.id);
      await storageSet({ scheduleClasses });
      renderHubExams();
      renderCalendar();
      renderTasksForSelectedDate();
      checkUpcomingExamReminders();
    });

    card.appendChild(main);
    card.appendChild(delBtn);
    hubExamsList.appendChild(card);
  });
}

const hubExamTypeSelect = document.getElementById("hubExamType");
const hubExamTitleInput = document.getElementById("hubExamTitle");

const EXAM_TYPE_DEFAULT_TITLES = {
  final: "امتحان پایان‌ترم",
  midterm: "امتحان میان‌ترم",
  quiz: "کوییز کلاسی",
  lab: "آزمون آزمایشگاه",
  other: "آزمون کلاسی",
};

if (hubExamTypeSelect && hubExamTitleInput) {
  hubExamTypeSelect.addEventListener("change", () => {
    const selectedType = hubExamTypeSelect.value;
    hubExamTitleInput.value = EXAM_TYPE_DEFAULT_TITLES[selectedType] || "امتحان میان‌ترم";
  });
}

const hubExamForm = document.getElementById("hubExamForm");
if (hubExamForm) {
  hubExamForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const course = getActiveHubCourse();
    if (!course) return;

    const type = hubExamTypeSelect ? hubExamTypeSelect.value : "midterm";
    const title = hubExamTitleInput ? hubExamTitleInput.value.trim() : "";
    const date = document.getElementById("hubExamDate").value;
    const time = document.getElementById("hubExamTime").value || "";
    const location = document.getElementById("hubExamLocation").value.trim();
    const syllabus = document.getElementById("hubExamSyllabus").value.trim();

    if (!title || !date) return;

    if (!course.exams) course.exams = [];
    course.exams.push({
      id: crypto.randomUUID(),
      title,
      type,
      date,
      time,
      location,
      syllabus,
    });

    await storageSet({ scheduleClasses });

    // Reset form to clean default state
    if (hubExamTypeSelect) hubExamTypeSelect.value = "midterm";
    if (hubExamTitleInput) hubExamTitleInput.value = "امتحان میان‌ترم";
    document.getElementById("hubExamDate").value = "";
    document.getElementById("hubExamTime").value = "";
    document.getElementById("hubExamLocation").value = "";
    document.getElementById("hubExamSyllabus").value = "";

    renderHubExams();
    renderCalendar();
    renderTasksForSelectedDate();
    checkUpcomingExamReminders();
  });
}

// ---------------------------------------------------------------
// 7-Day Upcoming Exam Reminder Banner
// ---------------------------------------------------------------
async function checkUpcomingExamReminders() {
  const banner = document.getElementById("examReminderBanner");
  if (!banner) return;

  const data = await storageGet(["examSnoozeUntil", "dismissedExams"]);
  const snoozeUntil = data.examSnoozeUntil || 0;
  const dismissedExams = data.dismissedExams || {};

  if (Date.now() < snoozeUntil) {
    banner.hidden = true;
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = [];

  scheduleClasses.forEach((course) => {
    normalizeCourse(course);
    (course.exams || []).forEach((exam) => {
      if (!exam.date) return;
      if (dismissedExams[exam.id]) return;

      const examDate = new Date(exam.date + "T00:00:00");
      const diffTime = examDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays <= 7) {
        upcoming.push({
          courseTitle: course.title,
          courseColor: course.color,
          exam,
          diffDays,
        });
      }
    });
  });

  if (upcoming.length === 0) {
    banner.hidden = true;
    return;
  }

  upcoming.sort((a, b) => a.diffDays - b.diffDays);
  const topItem = upcoming[0];

  const daysText = topItem.diffDays === 0
    ? "🔴 امروز برگزار می‌شود!"
    : topItem.diffDays === 1
      ? "⏳ فردا برگزار می‌شود!"
      : `⏳ ${faDigits(topItem.diffDays)} روز دیگر`;

  const examDateObj = new Date(topItem.exam.date + "T00:00:00");

  banner.innerHTML = `
    <div class="exam-banner-inner">
      <div class="exam-banner-content">
        <span class="chip chip--sm chip--danger chip--soft exam-banner-badge">🎯 یادآوری آزمون (${topItem.courseTitle})</span>
        <div class="exam-banner-text">
          <strong>${topItem.exam.title}</strong>
          <span>${daysText} • تاریخ: ${formatShamsiAndMiladi(examDateObj)}${topItem.exam.time ? ` • ساعت ${faDigits(topItem.exam.time)}` : ""}${topItem.exam.location ? ` • مکان: ${topItem.exam.location}` : ""}${topItem.exam.syllabus ? ` • مباحث: ${topItem.exam.syllabus}` : ""}</span>
        </div>
      </div>
      <div class="exam-banner-actions">
        <button type="button" class="exam-banner-btn btn-snooze" id="examBannerSnoozeBtn" title="یادآوری مجدد ۲۴ ساعت بعد">⏰ یادآوری ۲۴ ساعت دیگر</button>
        <button type="button" class="exam-banner-btn btn-dismiss" id="examBannerDismissBtn" title="بستن این یادآوری">متوجه شدم ✕</button>
      </div>
    </div>
  `;

  banner.hidden = false;

  const snoozeBtn = document.getElementById("examBannerSnoozeBtn");
  if (snoozeBtn) {
    snoozeBtn.addEventListener("click", async () => {
      const next24h = Date.now() + 24 * 60 * 60 * 1000;
      await storageSet({ examSnoozeUntil: next24h });
      banner.hidden = true;
    });
  }

  const dismissBtn = document.getElementById("examBannerDismissBtn");
  if (dismissBtn) {
    dismissBtn.addEventListener("click", async () => {
      dismissedExams[topItem.exam.id] = true;
      await storageSet({ dismissedExams });
      banner.hidden = true;
    });
  }
}

function openCourseHub(courseId) {
  const course = scheduleClasses.find((c) => c.id === courseId);
  if (!course) return;

  normalizeCourse(course);
  activeHubCourseId = courseId;

  hubCourseTitle.textContent = course.title;
  hubColorBar.style.setProperty("--hub-theme-color", course.color || "var(--accent)");
  hubInstructor.textContent = course.instructor ? `👨‍🏫 ${course.instructor}` : "👨‍🏫 بدون نام استاد";

  const hubUnitsBadge = document.getElementById("hubUnitsBadge");
  if (hubUnitsBadge) {
    hubUnitsBadge.textContent = `📚 ${faDigits(course.units || 3)} واحد`;
  }

  const sessions = normalizeCourseSessions(course);
  if (sessions.length > 0) {
    const summary = sessions
      .map((s) => `${SCHEDULE_DAYS[s.day]?.name || "شنبه"} ${faDigits(s.startTime)} (${s.location ? `کلاس ${s.location}` : "بدون کلاس"})`)
      .join(" • ");
    hubSessionsInfo.textContent = `📍 ${summary}`;
  } else {
    hubSessionsInfo.textContent = "";
  }

  const studyMins = course.totalStudyMinutes || 0;
  if (hubStudyTimeBadge) {
    hubStudyTimeBadge.textContent = `⏱️ ${formatMinutesToHours(studyMins)} مطالعه ثبت‌شده`;
  }

  switchHubTab("tasks");
  renderHubTasks();

  if (hubExamTypeSelect) hubExamTypeSelect.value = "midterm";
  if (hubExamTitleInput) hubExamTitleInput.value = "امتحان میان‌ترم";
  const dateInput = document.getElementById("hubExamDate");
  if (dateInput) dateInput.value = "";
  const timeInput = document.getElementById("hubExamTime");
  if (timeInput) timeInput.value = "";
  const locInput = document.getElementById("hubExamLocation");
  if (locInput) locInput.value = "";
  const sylInput = document.getElementById("hubExamSyllabus");
  if (sylInput) sylInput.value = "";

  renderHubExams();
  renderHubNotes();
  renderHubLinks();
  renderHubAbsences();

  courseHubDialog.showModal();
}

// ---------------------------------------------------------------
// Onboarding & User Profile Management
// ---------------------------------------------------------------
const onboardDialog = document.getElementById("onboardDialog");
const onboardForm = document.getElementById("onboardForm");
const onboardName = document.getElementById("onboardName");
const onboardMajor = document.getElementById("onboardMajor");
const profileEditBtn = document.getElementById("profileEditBtn");

const featureTourDialog = document.getElementById("featureTourDialog");
const tourUserName = document.getElementById("tourUserName");
const tourStartBtn = document.getElementById("tourStartBtn");

function openFeatureTourDialog() {
  if (!featureTourDialog) return;
  if (tourUserName) {
    tourUserName.textContent = userProfile.name || "دوست من";
  }
  featureTourDialog.showModal();
}

if (tourStartBtn) {
  tourStartBtn.addEventListener("click", async () => {
    await storageSet({ onboardingDone: true });
    if (featureTourDialog) featureTourDialog.close();
  });
}

function openOnboardingDialog() {
  if (!onboardDialog) return;
  onboardName.value = userProfile.name || "";
  onboardMajor.value = userProfile.major || "";
  onboardDialog.showModal();
  if (!userProfile.name) {
    onboardName.focus();
  }
}

if (profileEditBtn) {
  profileEditBtn.addEventListener("click", () => {
    openOnboardingDialog();
  });
}

if (onboardForm) {
  onboardForm.addEventListener("submit", async (e) => {
    const name = onboardName.value.trim();
    const major = onboardMajor.value.trim();
    if (!name) {
      e.preventDefault();
      return;
    }
    userProfile = { name, major };
    await storageSet({ userProfile });
    tickClock();
    onboardDialog.close();
    openFeatureTourDialog();
  });
}

// ===============================================================
// Theme & Settings Controller (Lightweight Zero-Bloat Engine)
// ===============================================================
// Appearance (mode, preset, accent, density, corners) lives in theme.js + appearance.js.

const settingsDialog = document.getElementById("settingsDialog");
const settingsLaunchBtn = document.getElementById("settingsLaunchBtn");
const settingsCloseBtn = document.getElementById("settingsCloseBtn");
const settingsEditProfileBtn = document.getElementById("settingsEditProfileBtn");
const settingsCurrentName = document.getElementById("settingsCurrentName");
const settingsCurrentMajor = document.getElementById("settingsCurrentMajor");

function updateSettingsProfileInfo() {
  if (settingsCurrentName) {
    settingsCurrentName.textContent = `دانشجو: ${userProfile.name || "تعیین نشده"}`;
  }
  if (settingsCurrentMajor) {
    settingsCurrentMajor.textContent = `رشته تحصیلی: ${userProfile.major || "تعیین نشده"}`;
  }
}

if (settingsLaunchBtn) {
  settingsLaunchBtn.addEventListener("click", () => {
    updateSettingsProfileInfo();
    if (settingsDialog) settingsDialog.showModal();
  });
}

if (settingsCloseBtn) {
  settingsCloseBtn.addEventListener("click", () => {
    if (settingsDialog) settingsDialog.close();
  });
}

if (settingsEditProfileBtn) {
  settingsEditProfileBtn.addEventListener("click", () => {
    if (settingsDialog) settingsDialog.close();
    openOnboardingDialog();
  });
}

const settingsOpenTourBtn = document.getElementById("settingsOpenTourBtn");
if (settingsOpenTourBtn) {
  settingsOpenTourBtn.addEventListener("click", () => {
    if (settingsDialog) settingsDialog.close();
    openFeatureTourDialog();
  });
}

// ---------------------------------------------------------------
// Global Dialog Background Scroll Lock
// ---------------------------------------------------------------
function updateDialogScrollLock() {
  const openDialogs = document.querySelectorAll("dialog[open]");
  const isAnyOpen = openDialogs.length > 0;
  document.body.classList.toggle("modal-open", isAnyOpen);
}

document.querySelectorAll("dialog").forEach((dlg) => {
  dlg.addEventListener("close", updateDialogScrollLock);
  dlg.addEventListener("cancel", updateDialogScrollLock);
});

const dialogObserver = new MutationObserver(() => {
  updateDialogScrollLock();
});

document.querySelectorAll("dialog").forEach((dlg) => {
  dialogObserver.observe(dlg, { attributes: true, attributeFilter: ["open"] });
});

// ===============================================================
// StuDash Focus Timer Controller (Deep Work Engine)
// ===============================================================

let localFocusState = null;
let focusTickInterval = null;
const RING_CIRCUMFERENCE = 440; // 2 * pi * 70

const focusModal = document.getElementById("focusModal");
const focusModalCloseBtn = document.getElementById("focusModalCloseBtn");
const focusLaunchBtn = document.getElementById("focusLaunchBtn");
const focusTodayStatsBadge = document.getElementById("focusTodayStatsBadge");
const focusPresetsBar = document.getElementById("focusPresetsBar");
const focusRingProgress = document.getElementById("focusRingProgress");
const focusModeBadge = document.getElementById("focusModeBadge");
const focusTimeDisplay = document.getElementById("focusTimeDisplay");
const focusSubStatus = document.getElementById("focusSubStatus");
const focusSubjectInput = document.getElementById("focusSubjectInput");
const focusCourseSelect = document.getElementById("focusCourseSelect");
const focusCustomRow = document.getElementById("focusCustomRow");
const focusCustomStudyMin = document.getElementById("focusCustomStudyMin");
const focusCustomBreakMin = document.getElementById("focusCustomBreakMin");
const focusMainBtn = document.getElementById("focusMainBtn");
const focusMainBtnIcon = document.getElementById("focusMainBtnIcon");
const focusMainBtnText = document.getElementById("focusMainBtnText");
const focusPauseBtn = document.getElementById("focusPauseBtn");
const focusResetBtn = document.getElementById("focusResetBtn");
const focusSkipBtn = document.getElementById("focusSkipBtn");
const focusFloatingWidgetToggle = document.getElementById("focusFloatingWidgetToggle");
const focusSoundToggle = document.getElementById("focusSoundToggle");

// ---------------------------------------------------------------
// Study Report (Weekly Stats) DOM References
// ---------------------------------------------------------------
const studyReportModal = document.getElementById("studyReportModal");
const studyReportLaunchBtn = document.getElementById("studyReportLaunchBtn");
const studyReportCloseBtn = document.getElementById("studyReportCloseBtn");
const reportStreakBadge = document.getElementById("reportStreakBadge");
const reportTodayValue = document.getElementById("reportTodayValue");
const reportWeekValue = document.getElementById("reportWeekValue");
const reportAvgValue = document.getElementById("reportAvgValue");
const reportChartBars = document.getElementById("reportChartBars");
const reportCoursesList = document.getElementById("reportCoursesList");
const reportCoursesEmpty = document.getElementById("reportCoursesEmpty");
const REPORT_WEEKDAY_LABELS = ["ی", "د", "س", "چ", "پ", "ج", "ش"]; // Sun..Sat, matches Date#getDay() index

// Web Audio API Soft Chime Generator
function playChimeSound() {
  if (!localFocusState || localFocusState.soundEnabled === false) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    // Dual-tone harmonic bell (C5, E5, G5, C6)
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);

      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.08 + 1.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + 1.8);
    });
  } catch (e) {}
}

function updateFocusCourseSelectOptions() {
  if (!focusCourseSelect) return;
  const currentVal = focusCourseSelect.value;
  focusCourseSelect.innerHTML = '<option value="">-- مطالعه آزاد / بدون درس --</option>';

  scheduleClasses.forEach((c) => {
    const course = normalizeCourse(c);
    const opt = document.createElement("option");
    opt.value = course.id;
    opt.textContent = `📖 ${course.title}`;
    focusCourseSelect.appendChild(opt);
  });

  if (currentVal) {
    focusCourseSelect.value = currentVal;
  }
}

function formatMinutesToHours(minutes) {
  if (!minutes || minutes <= 0) return "۰ دقیقه";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${faDigits(h)} ساعت و ${faDigits(m)} دقیقه`;
  if (h > 0) return `${faDigits(h)} ساعت`;
  return `${faDigits(m)} دقیقه`;
}

function renderFocusTimerUI() {
  if (!localFocusState) return;

  // 1. Stats Badge
  if (focusTodayStatsBadge) {
    const count = localFocusState.todayCompletedSessions || 0;
    const timeStr = formatMinutesToHours(localFocusState.todayStudyMinutes || 0);
    focusTodayStatsBadge.textContent = `امروز: ${faDigits(count)} پارت مطالعه (${timeStr})`;
  }

  // 2. Preset Buttons
  if (focusPresetsBar) {
    focusPresetsBar.querySelectorAll(".focus-preset-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.preset === localFocusState.preset);
    });
  }

  // 3. Custom Row Visibility
  if (focusCustomRow) {
    focusCustomRow.classList.toggle("is-visible", localFocusState.preset === "custom");
  }

  // 4. Mode Badge & Top Launch Button States
  if (focusModal) {
    focusModal.classList.toggle("is-break", localFocusState.mode === "break");
  }

  if (focusModeBadge) {
    if (localFocusState.mode === "break") {
      focusModeBadge.textContent = "☕ وقت استراحت";
      focusModeBadge.className = "chip chip--sm chip--success chip--soft focus-mode-badge is-break";
    } else if (localFocusState.mode === "stopwatch") {
      focusModeBadge.textContent = "⏱️ کرنومتر آزاد";
      focusModeBadge.className = "chip chip--sm chip--default chip--soft focus-mode-badge is-stopwatch";
    } else {
      focusModeBadge.textContent = "🎯 پارت مطالعه";
      focusModeBadge.className = "chip chip--sm chip--accent chip--soft focus-mode-badge";
    }
  }

  // 5. Live Time and Sub-status
  let currentSecs = 0;
  if (localFocusState.mode === "stopwatch") {
    if (localFocusState.isRunning && !localFocusState.isPaused && localFocusState.startedAt) {
      currentSecs = Math.max(0, Math.floor((Date.now() - localFocusState.startedAt) / 1000));
    } else {
      currentSecs = localFocusState.elapsedSeconds || 0;
    }
  } else {
    if (localFocusState.isRunning && !localFocusState.isPaused && localFocusState.targetEndTime) {
      currentSecs = Math.max(0, Math.ceil((localFocusState.targetEndTime - Date.now()) / 1000));
    } else {
      currentSecs = localFocusState.remainingSeconds || 0;
    }
  }

  const timeFormatted = `${pad2(Math.floor(currentSecs / 60))}:${pad2(currentSecs % 60)}`;

  if (focusTimeDisplay) {
    focusTimeDisplay.textContent = timeFormatted;
  }

  if (focusLaunchBtn) {
    focusLaunchBtn.classList.toggle("active-timer", localFocusState.isRunning);
    if (localFocusState.isRunning) {
      const prefix = localFocusState.mode === "break" ? "☕" : "🔥";
      focusLaunchBtn.innerHTML = `<span>${prefix}</span><span dir="ltr">${faDigits(timeFormatted)}</span>`;
    } else {
      focusLaunchBtn.innerHTML = `<span class="focus-btn-flame">🔥</span><span>تایمر مطالعه</span>`;
    }
  }

  if (focusSubStatus) {
    if (localFocusState.isRunning) {
      focusSubStatus.textContent = localFocusState.mode === "break" ? "در حال استراحت..." : "در حال تمرکز عمیق...";
    } else if (localFocusState.isPaused) {
      focusSubStatus.textContent = "متوقف شده";
    } else {
      focusSubStatus.textContent = "آماده برای شروع";
    }
  }

  // 6. SVG Ring Stroke Progress
  if (focusRingProgress) {
    focusRingProgress.classList.toggle("is-break", localFocusState.mode === "break");
    focusRingProgress.classList.toggle("is-stopwatch", localFocusState.mode === "stopwatch");

    if (localFocusState.mode === "stopwatch") {
      const cycleSeconds = 60;
      const progress = (currentSecs % cycleSeconds) / cycleSeconds;
      focusRingProgress.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress);
    } else {
      const total = localFocusState.totalSeconds || (localFocusState.studyMinutes * 60);
      const ratio = total > 0 ? (currentSecs / total) : 0;
      focusRingProgress.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - ratio);
    }
  }

  // 7. Action Button States
  if (focusMainBtn && focusMainBtnIcon && focusMainBtnText) {
    if (localFocusState.isRunning) {
      focusMainBtnIcon.textContent = "⏸️";
      focusMainBtnText.textContent = "توقف موقت";
      focusMainBtn.className = "primary-btn focus-action-main-btn is-running";
    } else if (localFocusState.isPaused) {
      focusMainBtnIcon.textContent = "▶️";
      focusMainBtnText.textContent = "ادامه پارت";
      focusMainBtn.className = "primary-btn focus-action-main-btn";
    } else {
      focusMainBtnIcon.textContent = "▶️";
      focusMainBtnText.textContent = localFocusState.mode === "break" ? "شروع استراحت" : "شروع پارت مطالعه";
      focusMainBtn.className = localFocusState.mode === "break"
        ? "primary-btn focus-action-main-btn is-break"
        : "primary-btn focus-action-main-btn";
    }
  }

  // 8. Toggles
  if (focusFloatingWidgetToggle) {
    focusFloatingWidgetToggle.checked = localFocusState.showFloatingWidget !== false;
  }
  if (focusSoundToggle) {
    focusSoundToggle.checked = localFocusState.soundEnabled !== false;
  }
}

function startFocusLocalTicker() {
  if (focusTickInterval) clearInterval(focusTickInterval);
  focusTickInterval = setInterval(() => {
    if (localFocusState && localFocusState.isRunning && !localFocusState.isPaused) {
      renderFocusTimerUI();
      if (localFocusState.mode !== "stopwatch" && localFocusState.targetEndTime) {
        const left = Math.ceil((localFocusState.targetEndTime - Date.now()) / 1000);
        if (left <= 0 && localFocusState.isRunning) {
          localFocusState.isRunning = false;
          playChimeSound();
          chrome.runtime.sendMessage({ action: "GET_TIMER_STATE" }, (st) => {
            if (st) { localFocusState = st; renderFocusTimerUI(); }
          });
        }
      }
    }
  }, 1000);
}

async function initFocusTimer() {
  updateFocusCourseSelectOptions();

  // Fetch state from background worker
  try {
    chrome.runtime.sendMessage({ action: "GET_TIMER_STATE" }, (state) => {
      if (state) {
        localFocusState = state;
        if (focusSubjectInput && state.subjectTitle) {
          focusSubjectInput.value = state.subjectTitle;
        }
        if (focusCourseSelect && state.courseId) {
          focusCourseSelect.value = state.courseId;
        }
        renderFocusTimerUI();
        startFocusLocalTicker();
      }
    });
  } catch (err) {}

  // Open Focus Modal Dialog
  if (focusLaunchBtn && focusModal) {
    focusLaunchBtn.addEventListener("click", () => {
      focusModal.showModal();
    });
  }

  // Close Focus Modal
  if (focusModalCloseBtn && focusModal) {
    focusModalCloseBtn.addEventListener("click", () => {
      focusModal.close();
    });
  }

  // Close on backdrop click
  if (focusModal) {
    focusModal.addEventListener("click", (e) => {
      const rect = focusModal.getBoundingClientRect();
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        focusModal.close();
      }
    });
  }

  // Preset Buttons Click Handler
  if (focusPresetsBar) {
    focusPresetsBar.querySelectorAll(".focus-preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const preset = btn.dataset.preset;
        if (preset === "stopwatch") {
          chrome.runtime.sendMessage({ action: "SET_PRESET", preset: "stopwatch", mode: "stopwatch" }, (st) => {
            if (st) { localFocusState = st; renderFocusTimerUI(); }
          });
        } else if (preset === "custom") {
          const studyMin = parseInt(focusCustomStudyMin.value, 10) || 45;
          const breakMin = parseInt(focusCustomBreakMin.value, 10) || 10;
          chrome.runtime.sendMessage({ action: "SET_PRESET", preset: "custom", studyMinutes: studyMin, breakMinutes: breakMin, mode: "study" }, (st) => {
            if (st) { localFocusState = st; renderFocusTimerUI(); }
          });
        } else {
          const studyMin = parseInt(btn.dataset.study, 10) || 45;
          const breakMin = parseInt(btn.dataset.break, 10) || 10;
          chrome.runtime.sendMessage({ action: "SET_PRESET", preset, studyMinutes: studyMin, breakMinutes: breakMin, mode: "study" }, (st) => {
            if (st) { localFocusState = st; renderFocusTimerUI(); }
          });
        }
      });
    });
  }

  // Custom study/break minutes change
  const onCustomMinChange = () => {
    if (localFocusState && localFocusState.preset === "custom") {
      const studyMin = parseInt(focusCustomStudyMin.value, 10) || 45;
      const breakMin = parseInt(focusCustomBreakMin.value, 10) || 10;
      chrome.runtime.sendMessage({ action: "SET_PRESET", preset: "custom", studyMinutes: studyMin, breakMinutes: breakMin, mode: "study" }, (st) => {
        if (st) { localFocusState = st; renderFocusTimerUI(); }
      });
    }
  };
  if (focusCustomStudyMin) focusCustomStudyMin.addEventListener("change", onCustomMinChange);
  if (focusCustomBreakMin) focusCustomBreakMin.addEventListener("change", onCustomMinChange);

  // Subject Input & Course Selection Handler
  if (focusSubjectInput) {
    focusSubjectInput.addEventListener("input", () => {
      const text = focusSubjectInput.value.trim() || "مطالعه آزاد";
      chrome.runtime.sendMessage({ action: "SET_SUBJECT", subjectTitle: text, courseId: focusCourseSelect ? focusCourseSelect.value : null });
    });
  }

  if (focusCourseSelect) {
    focusCourseSelect.addEventListener("change", () => {
      const courseId = focusCourseSelect.value;
      if (courseId) {
        const course = scheduleClasses.find((c) => c.id === courseId);
        if (course && focusSubjectInput) {
          focusSubjectInput.value = course.title;
          chrome.runtime.sendMessage({ action: "SET_SUBJECT", subjectTitle: course.title, courseId: course.id });
        }
      } else {
        chrome.runtime.sendMessage({ action: "SET_SUBJECT", subjectTitle: focusSubjectInput.value.trim() || "مطالعه آزاد", courseId: null });
      }
    });
  }

  // Main Start / Pause Button
  if (focusMainBtn) {
    focusMainBtn.addEventListener("click", () => {
      if (!localFocusState) return;
      if (localFocusState.isRunning) {
        chrome.runtime.sendMessage({ action: "PAUSE_TIMER" }, (st) => {
          if (st) { localFocusState = st; renderFocusTimerUI(); }
        });
      } else if (localFocusState.isPaused) {
        chrome.runtime.sendMessage({ action: "RESUME_TIMER" }, (st) => {
          if (st) { localFocusState = st; renderFocusTimerUI(); }
        });
      } else {
        const subject = focusSubjectInput ? focusSubjectInput.value.trim() || "مطالعه آزاد" : "مطالعه آزاد";
        const cId = focusCourseSelect ? focusCourseSelect.value || null : null;
        chrome.runtime.sendMessage({ action: "START_TIMER", subjectTitle: subject, courseId: cId }, (st) => {
          if (st) { localFocusState = st; renderFocusTimerUI(); }
        });
      }
    });
  }

  // Reset Button
  if (focusResetBtn) {
    focusResetBtn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ action: "RESET_TIMER" }, (st) => {
        if (st) { localFocusState = st; renderFocusTimerUI(); }
      });
    });
  }

  // Skip / Next Part Button
  if (focusSkipBtn) {
    focusSkipBtn.addEventListener("click", () => {
      if (!localFocusState) return;
      const nextMode = localFocusState.mode === "study" ? "break" : "study";
      chrome.runtime.sendMessage({ action: "SWITCH_MODE", mode: nextMode }, (st) => {
        if (st) { localFocusState = st; renderFocusTimerUI(); }
      });
    });
  }

  // Floating Widget & Sound Toggles
  if (focusFloatingWidgetToggle) {
    focusFloatingWidgetToggle.addEventListener("change", () => {
      chrome.runtime.sendMessage({ action: "TOGGLE_FLOATING_WIDGET", show: focusFloatingWidgetToggle.checked }, (st) => {
        if (st) { localFocusState = st; renderFocusTimerUI(); }
      });
    });
  }

  if (focusSoundToggle) {
    focusSoundToggle.addEventListener("change", async () => {
      if (localFocusState) {
        localFocusState.soundEnabled = focusSoundToggle.checked;
        await storageSet({ focusTimerState: localFocusState });
      }
    });
  }

  // Listen to timer updates from background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "TIMER_STATE_UPDATED" && msg.state) {
      localFocusState = msg.state;
      renderFocusTimerUI();
    }
  });
}

// ===============================================================
// Study Report (Weekly Stats) — powered by studyDailyLog history
// ===============================================================

// Returns the ISO date (YYYY-MM-DD) for "today minus offsetDays"
function isoDateOffset(offsetDays) {
  // Local calendar day (toISOString() would report the UTC day and shift it near midnight).
  return StudashDate.isoDate(StudashDate.addDays(new Date(), -offsetDays));
}

async function renderStudyReport() {
  const data = await storageGet(["studyDailyLog"]);
  const log = data.studyDailyLog || {};

  // Build the last 7 days, oldest first, ending today
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const iso = isoDateOffset(i);
    const entry = log[iso] || { total: 0, courses: {} };
    days.push({ iso, total: entry.total || 0, courses: entry.courses || {} });
  }

  const todayEntry = days[days.length - 1];
  const weekTotal = days.reduce((sum, d) => sum + d.total, 0);
  const activeDays = days.filter((d) => d.total > 0).length;
  const avgMinutes = activeDays > 0 ? Math.round(weekTotal / activeDays) : 0;

  if (reportTodayValue) reportTodayValue.textContent = formatMinutesToHours(todayEntry.total);
  if (reportWeekValue) reportWeekValue.textContent = formatMinutesToHours(weekTotal);
  if (reportAvgValue) reportAvgValue.textContent = formatMinutesToHours(avgMinutes);

  // Streak: consecutive days (ending today) with study minutes > 0
  let streak = 0;
  for (let i = 0; i < 90; i++) {
    const entry = log[isoDateOffset(i)];
    if (entry && entry.total > 0) {
      streak++;
    } else {
      break;
    }
  }
  if (reportStreakBadge) {
    reportStreakBadge.textContent = streak > 0 ? `🔥 ${faDigits(streak)} روز متوالی` : "🔥 هنوز استریکی نداری";
  }

  // Weekly bar chart
  if (reportChartBars) {
    const maxVal = Math.max(1, ...days.map((d) => d.total));
    reportChartBars.innerHTML = days
      .map((d) => {
        const dateObj = new Date(`${d.iso}T00:00:00`);
        const label = REPORT_WEEKDAY_LABELS[dateObj.getDay()];
        const heightPct = d.total > 0 ? Math.max(6, Math.round((d.total / maxVal) * 100)) : 2;
        const isToday = d.iso === isoDateOffset(0);
        return `
          <div class="report-bar-col${isToday ? " is-today" : ""}" title="${d.total} دقیقه مطالعه">
            <span class="report-bar-value">${d.total > 0 ? faDigits(d.total) : ""}</span>
            <div class="report-bar-track">
              <div class="report-bar-fill" style="height:${heightPct}%"></div>
            </div>
            <span class="report-bar-label">${label}</span>
          </div>
        `;
      })
      .join("");
  }

  // Top studied courses this week
  if (reportCoursesList) {
    const courseTotals = {};
    days.forEach((d) => {
      Object.entries(d.courses).forEach(([courseId, mins]) => {
        courseTotals[courseId] = (courseTotals[courseId] || 0) + mins;
      });
    });

    const sortedCourseIds = Object.keys(courseTotals)
      .sort((a, b) => courseTotals[b] - courseTotals[a])
      .slice(0, 5);

    if (sortedCourseIds.length === 0) {
      reportCoursesList.innerHTML = "";
      if (reportCoursesEmpty) reportCoursesEmpty.hidden = false;
    } else {
      if (reportCoursesEmpty) reportCoursesEmpty.hidden = true;
      const maxCourseVal = Math.max(...sortedCourseIds.map((id) => courseTotals[id]));
      reportCoursesList.innerHTML = sortedCourseIds
        .map((courseId) => {
          const course = scheduleClasses.find((c) => c.id === courseId);
          const title = course ? course.title : "مطالعه آزاد / بدون درس";
          const color = course && course.color ? course.color : "#f2a65a";
          const mins = courseTotals[courseId];
          const widthPct = Math.max(8, Math.round((mins / maxCourseVal) * 100));
          return `
            <div class="report-course-row">
              <span class="report-course-name" title="${title}">${title}</span>
              <div class="report-course-bar-track">
                <div class="report-course-bar-fill" style="width:${widthPct}%; background:${color};"></div>
              </div>
              <span class="report-course-mins">${formatMinutesToHours(mins)}</span>
            </div>
          `;
        })
        .join("");
    }
  }
}

async function initStudyReport() {
  if (studyReportLaunchBtn && studyReportModal) {
    studyReportLaunchBtn.addEventListener("click", async () => {
      await renderStudyReport();
      studyReportModal.showModal();
    });
  }

  if (studyReportCloseBtn && studyReportModal) {
    studyReportCloseBtn.addEventListener("click", () => {
      studyReportModal.close();
    });
  }

  // Close on backdrop click
  if (studyReportModal) {
    studyReportModal.addEventListener("click", (e) => {
      const rect = studyReportModal.getBoundingClientRect();
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        studyReportModal.close();
      }
    });
  }
}

// ---------------------------------------------------------------
// IDEA & RESEARCH LAB MODAL & INTERACTIONS
// ---------------------------------------------------------------
const ideaLabDialog = document.getElementById("ideaLabDialog");
const ideaLabCloseBtn = document.getElementById("ideaLabCloseBtn");
const tabIdeasActive = document.getElementById("tabIdeasActive");
const tabIdeasArchive = document.getElementById("tabIdeasArchive");
const contentIdeasActive = document.getElementById("contentIdeasActive");
const contentIdeasArchive = document.getElementById("contentIdeasArchive");
const labActiveCount = document.getElementById("labActiveCount");
const labArchiveCount = document.getElementById("labArchiveCount");
const ideaCreateForm = document.getElementById("ideaCreateForm");
const newIdeaTitle = document.getElementById("newIdeaTitle");
const newIdeaCategory = document.getElementById("newIdeaCategory");
const activeIdeasGrid = document.getElementById("activeIdeasGrid");
const archivedIdeasGrid = document.getElementById("archivedIdeasGrid");
const activeIdeasEmpty = document.getElementById("activeIdeasEmpty");
const archivedIdeasEmpty = document.getElementById("archivedIdeasEmpty");

let currentIdeaLabTab = "active"; // "active" | "archive"
const expandedIdeaIds = new Set();

function openIdeaLabModal(tab = "active") {
  currentIdeaLabTab = tab;
  const dlg = document.getElementById("ideaLabDialog");
  const tabActive = document.getElementById("tabIdeasActive");
  const tabArchive = document.getElementById("tabIdeasArchive");
  const contActive = document.getElementById("contentIdeasActive");
  const contArchive = document.getElementById("contentIdeasArchive");
  if (tabActive) tabActive.classList.toggle("active", tab === "active");
  if (tabArchive) tabArchive.classList.toggle("active", tab === "archive");
  if (contActive) contActive.classList.toggle("active", tab === "active");
  if (contArchive) contArchive.classList.toggle("active", tab === "archive");
  renderIdeaLabModal();
  if (dlg && !dlg.open) {
    dlg.showModal();
  }
}

function renderIdeaLabModal() {
  const activeIdeas = ideaProjects.filter((p) => p.status === "active");
  const archivedIdeas = ideaProjects.filter((p) => p.status === "archived");

  const headerIdeasBadge = document.getElementById("headerIdeasBadge");
  if (headerIdeasBadge) headerIdeasBadge.textContent = `${activeIdeas.length}/3`;
  const menuIdeasBadge = document.getElementById("menuIdeasBadge");
  if (menuIdeasBadge) menuIdeasBadge.textContent = `${activeIdeas.length}/3`;
  if (labActiveCount) labActiveCount.textContent = `${activeIdeas.length}/3`;
  if (labArchiveCount) labArchiveCount.textContent = String(archivedIdeas.length);

  // 1. Render Active Ideas
  if (activeIdeasGrid) {
    activeIdeasGrid.innerHTML = "";
    if (activeIdeasEmpty) activeIdeasEmpty.hidden = activeIdeas.length > 0;

    activeIdeas.forEach((idea) => {
      const prog = calculateIdeaProgress(idea);
      const catInfo = IDEA_CATEGORIES[idea.category] || IDEA_CATEGORIES.research;

      const card = document.createElement("div");
      card.className = "idea-full-card";
      card.classList.toggle("is-expanded", expandedIdeaIds.has(idea.id));

      // Top Row
      const topRow = document.createElement("div");
      topRow.className = "idea-card-top-row";

      const headerLeft = document.createElement("div");
      headerLeft.className = "idea-card-header-left";
      headerLeft.innerHTML = `
        <span class="idea-expand-hint" aria-hidden="true">⌄</span>
        <span class="chip chip--sm chip--default idea-cat-tag ${catInfo.class}">${catInfo.label}</span>
        <h3 class="idea-full-title">${idea.title}</h3>
      `;
      headerLeft.addEventListener("click", (e) => {
        e.stopPropagation();
        if (expandedIdeaIds.has(idea.id)) expandedIdeaIds.delete(idea.id);
        else expandedIdeaIds.add(idea.id);
        card.classList.toggle("is-expanded", expandedIdeaIds.has(idea.id));
        headerLeft.setAttribute("aria-expanded", String(expandedIdeaIds.has(idea.id)));
      });
      headerLeft.setAttribute("role", "button");
      headerLeft.setAttribute("tabindex", "0");
      headerLeft.setAttribute("aria-expanded", String(expandedIdeaIds.has(idea.id)));
      headerLeft.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); headerLeft.click(); }
      });

      const topActions = document.createElement("div");
      topActions.className = "idea-card-top-actions";

      // AI Prompt Copy Btn
      const copyPromptBtn = document.createElement("button");
      copyPromptBtn.type = "button";
      copyPromptBtn.className = "idea-action-btn";
      copyPromptBtn.innerHTML = `<span>🤖</span> <span>کپی پرامپت AI</span>`;
      copyPromptBtn.addEventListener("click", () => {
        const pText = generateAiPromptForIdea(idea);
        navigator.clipboard.writeText(pText);
        copyPromptBtn.innerHTML = `<span>✓</span> <span>کپی شد!</span>`;
        setTimeout(() => {
          copyPromptBtn.innerHTML = `<span>🤖</span> <span>کپی پرامپت AI</span>`;
        }, 2000);
      });

      // Archive Btn
      const archiveBtn = document.createElement("button");
      archiveBtn.type = "button";
      archiveBtn.className = "idea-action-btn";
      archiveBtn.innerHTML = `<span>📦</span> <span>انتقال به آرشیو</span>`;
      archiveBtn.addEventListener("click", async () => {
        idea.status = "archived";
        await storageSet({ ideaProjects });
        renderIdeaLabModal();
        renderAllTasksUnified();
      });

      // Delete Btn
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "idea-action-btn btn-danger";
      deleteBtn.innerHTML = `<span>🗑️</span>`;
      deleteBtn.title = "حذف پروژه";
      deleteBtn.addEventListener("click", async () => {
        if (confirm(`آیا از حذف ایده «${idea.title}» مطمئن هستید؟`)) {
          ideaProjects = ideaProjects.filter((p) => p.id !== idea.id);
          await storageSet({ ideaProjects });
          renderIdeaLabModal();
          renderAllTasksUnified();
        }
      });

      topActions.appendChild(copyPromptBtn);
      topActions.appendChild(archiveBtn);
      topActions.appendChild(deleteBtn);

      topRow.appendChild(headerLeft);
      topRow.appendChild(topActions);
      card.appendChild(topRow);
      // Make the whole header row (except action buttons) an easy click target.
      topRow.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        if (expandedIdeaIds.has(idea.id)) expandedIdeaIds.delete(idea.id);
        else expandedIdeaIds.add(idea.id);
        card.classList.toggle("is-expanded", expandedIdeaIds.has(idea.id));
        headerLeft.setAttribute("aria-expanded", String(expandedIdeaIds.has(idea.id)));
      });

      // Progress Bar Box
      const progBox = document.createElement("div");
      progBox.className = "idea-progress-box";
      progBox.innerHTML = `
        <div class="idea-progress-header">
          <span>مسیر پیشرفت و گام‌ها</span>
          <span class="idea-progress-pct">${faDigits(prog.percent)}٪ (${faDigits(prog.doneCount)} از ${faDigits(prog.total)} گام انجام شد)</span>
        </div>
        <div class="idea-progress-bar">
          <div class="idea-progress-fill ${prog.percent === 100 ? "complete" : ""}" style="width: ${prog.percent}%;"></div>
        </div>
      `;
      const details = document.createElement("div");
      details.className = "idea-card-details";
      details.appendChild(progBox);

      // Steps Container
      const stepsContainer = document.createElement("div");
      stepsContainer.className = "idea-steps-container";

      (idea.steps || []).forEach((st, sIdx) => {
        const stepItem = document.createElement("div");
        stepItem.className = "idea-step-item" + (st.done ? " done" : "");

        const left = document.createElement("div");
        left.className = "idea-step-left";

        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.className = "idea-step-chk";
        chk.checked = !!st.done;
        chk.addEventListener("change", async () => {
          st.done = chk.checked;
          await storageSet({ ideaProjects });
          renderIdeaLabModal();
          renderAllTasksUnified();
        });

        const span = document.createElement("span");
        span.className = "idea-step-text";
        span.textContent = `${faDigits(sIdx + 1)}. ${st.text}`;

        left.appendChild(chk);
        left.appendChild(span);

        const delStepBtn = document.createElement("button");
        delStepBtn.type = "button";
        delStepBtn.className = "idea-step-del";
        delStepBtn.textContent = "×";
        delStepBtn.title = "حذف گام";
        delStepBtn.addEventListener("click", async () => {
          idea.steps.splice(sIdx, 1);
          await storageSet({ ideaProjects });
          renderIdeaLabModal();
          renderAllTasksUnified();
        });

        stepItem.appendChild(left);
        stepItem.appendChild(delStepBtn);
        stepsContainer.appendChild(stepItem);
      });

      details.appendChild(stepsContainer);

      // Single Step Adder Row
      const addStepRow = document.createElement("div");
      addStepRow.className = "idea-step-adder-row";
      const addStepInput = document.createElement("input");
      addStepInput.type = "text";
      addStepInput.placeholder = "افزودن دستی گام جدید…";
      const addStepBtn = document.createElement("button");
      addStepBtn.type = "button";
      addStepBtn.className = "ghost-btn-sm";
      addStepBtn.textContent = "+ افزودن";

      const handleAddStep = async () => {
        const val = addStepInput.value.trim();
        if (!val) return;
        if (!idea.steps) idea.steps = [];
        idea.steps.push({ id: crypto.randomUUID(), text: val, done: false });
        await storageSet({ ideaProjects });
        renderIdeaLabModal();
        renderAllTasksUnified();
      };

      addStepBtn.addEventListener("click", handleAddStep);
      addStepInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleAddStep();
        }
      });

      addStepRow.appendChild(addStepInput);
      addStepRow.appendChild(addStepBtn);
      details.appendChild(addStepRow);

      // Bulk AI Importer Box
      const bulkBox = document.createElement("div");
      bulkBox.className = "bulk-ai-importer-box";
      bulkBox.innerHTML = `
        <div class="bulk-ai-header">
          <span>📥 ایمپورت یکپارچه مراحل از هوش مصنوعی (Bulk Paste)</span>
          <span style="font-size: 11px; font-weight: 400; opacity: 0.85;">کل خروجی ChatGPT/Claude را اینجا پیست کنید</span>
        </div>
      `;

      const bulkTextarea = document.createElement("textarea");
      bulkTextarea.className = "bulk-ai-textarea";
      bulkTextarea.placeholder = "مثلاً:\n- گام اول: بررسی پیشینه تحقیق\n- گام دوم: جمع‌آوری داده‌ها\n- گام سوم: شبیه‌سازی مدل";

      const bulkSubmitBtn = document.createElement("button");
      bulkSubmitBtn.type = "button";
      bulkSubmitBtn.className = "primary-btn";
      bulkSubmitBtn.style.alignSelf = "flex-start";
      bulkSubmitBtn.textContent = "تبدیل به گام‌های مسیر راه ✨";
      bulkSubmitBtn.addEventListener("click", async () => {
        const raw = bulkTextarea.value.trim();
        if (!raw) return;
        const newSteps = parseBulkStepsText(raw);
        if (newSteps.length === 0) {
          alert("متن قابل تفکیکی یافت نشد. لطفاً مراحل را خط به خط وارد کنید.");
          return;
        }
        if (!idea.steps) idea.steps = [];
        idea.steps.push(...newSteps);
        await storageSet({ ideaProjects });
        bulkTextarea.value = "";
        renderIdeaLabModal();
        renderAllTasksUnified();
      });

      bulkBox.appendChild(bulkTextarea);
      bulkBox.appendChild(bulkSubmitBtn);
      details.appendChild(bulkBox);
      card.appendChild(details);

      activeIdeasGrid.appendChild(card);
    });
  }

  // 2. Render Archived Ideas
  if (archivedIdeasGrid) {
    archivedIdeasGrid.innerHTML = "";
    if (archivedIdeasEmpty) archivedIdeasEmpty.hidden = archivedIdeas.length > 0;

    archivedIdeas.forEach((idea) => {
      const prog = calculateIdeaProgress(idea);
      const catInfo = IDEA_CATEGORIES[idea.category] || IDEA_CATEGORIES.research;

      const card = document.createElement("div");
      card.className = "idea-full-card";
      card.classList.toggle("is-expanded", expandedIdeaIds.has(idea.id));

      // Top Row
      const topRow = document.createElement("div");
      topRow.className = "idea-card-top-row";

      const headerLeft = document.createElement("div");
      headerLeft.className = "idea-card-header-left";
      headerLeft.innerHTML = `
        <span class="idea-expand-hint" aria-hidden="true">⌄</span>
        <span class="chip chip--sm chip--default idea-cat-tag ${catInfo.class}">${catInfo.label}</span>
        <h3 class="idea-full-title">${idea.title}</h3>
      `;
      headerLeft.addEventListener("click", (e) => {
        e.stopPropagation();
        if (expandedIdeaIds.has(idea.id)) expandedIdeaIds.delete(idea.id);
        else expandedIdeaIds.add(idea.id);
        card.classList.toggle("is-expanded", expandedIdeaIds.has(idea.id));
        headerLeft.setAttribute("aria-expanded", String(expandedIdeaIds.has(idea.id)));
      });
      headerLeft.setAttribute("role", "button");
      headerLeft.setAttribute("tabindex", "0");
      headerLeft.setAttribute("aria-expanded", String(expandedIdeaIds.has(idea.id)));
      headerLeft.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); headerLeft.click(); }
      });

      const topActions = document.createElement("div");
      topActions.className = "idea-card-top-actions";

      // Activate Btn (Enforces Rule of 3)
      const activateBtn = document.createElement("button");
      activateBtn.type = "button";
      activateBtn.className = "idea-action-btn";
      activateBtn.innerHTML = `<span>🚀</span> <span>فعال‌سازی (آوردن به ۳ تمرکز)</span>`;
      activateBtn.addEventListener("click", async () => {
        const currentActive = ideaProjects.filter((p) => p.status === "active");
        if (currentActive.length >= 3) {
          alert("سقف ۳ پروژه فعال در کانون تمرکز پر است! ابتدا یکی از ۳ پروژه فعال را به اتمام برسانید یا به آرشیو منتقل کنید.");
          return;
        }
        idea.status = "active";
        await storageSet({ ideaProjects });
        openIdeaLabModal("active");
        renderAllTasksUnified();
      });

      // Delete Btn
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "idea-action-btn btn-danger";
      deleteBtn.innerHTML = `<span>🗑️</span>`;
      deleteBtn.title = "حذف دائم ایده";
      deleteBtn.addEventListener("click", async () => {
        if (confirm(`آیا از حذف ایده «${idea.title}» مطمئن هستید؟`)) {
          ideaProjects = ideaProjects.filter((p) => p.id !== idea.id);
          await storageSet({ ideaProjects });
          renderIdeaLabModal();
          renderAllTasksUnified();
        }
      });

      topActions.appendChild(activateBtn);
      topActions.appendChild(deleteBtn);
      topRow.appendChild(headerLeft);
      topRow.appendChild(topActions);
      card.appendChild(topRow);
      topRow.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        if (expandedIdeaIds.has(idea.id)) expandedIdeaIds.delete(idea.id);
        else expandedIdeaIds.add(idea.id);
        card.classList.toggle("is-expanded", expandedIdeaIds.has(idea.id));
        headerLeft.setAttribute("aria-expanded", String(expandedIdeaIds.has(idea.id)));
      });

      // Progress Bar Box
      const progBox = document.createElement("div");
      progBox.className = "idea-progress-box";
      progBox.innerHTML = `
        <div class="idea-progress-header">
          <span>میزان پیشرفت در زمان پارک پروژه</span>
          <span class="idea-progress-pct">${faDigits(prog.percent)}٪ (${faDigits(prog.doneCount)} از ${faDigits(prog.total)} گام)</span>
        </div>
        <div class="idea-progress-bar">
          <div class="idea-progress-fill ${prog.percent === 100 ? "complete" : ""}" style="width: ${prog.percent}%;"></div>
        </div>
      `;
      const details = document.createElement("div");
      details.className = "idea-card-details";
      details.appendChild(progBox);
      if (idea.steps && idea.steps.length) {
        const archiveSteps = document.createElement("div");
        archiveSteps.className = "idea-steps-container idea-archive-steps";
        idea.steps.forEach((st, sIdx) => {
          const stepItem = document.createElement("div");
          stepItem.className = "idea-step-item" + (st.done ? " done" : "");
          stepItem.innerHTML = `<span class="idea-step-text">${faDigits(sIdx + 1)}. ${st.text}</span><span class="idea-archive-step-status">${st.done ? "✓" : "—"}</span>`;
          archiveSteps.appendChild(stepItem);
        });
        details.appendChild(archiveSteps);
      }
      card.appendChild(details);

      archivedIdeasGrid.appendChild(card);
    });
  }
}

function initIdeaLab() {
  // Header button → open modal
  const headerIdeaLabBtn = document.getElementById("headerIdeaLabBtn");
  if (headerIdeaLabBtn) {
    headerIdeaLabBtn.addEventListener("click", () => openIdeaLabModal("active"));
  }

  // Guide card collapse toggle
  const ideaGuideToggleBtn = document.getElementById("ideaGuideToggleBtn");
  const ideaGuideCard = document.querySelector(".idea-guide-card");
  const ideaGuideIcon = document.getElementById("ideaGuideIcon");
  if (ideaGuideToggleBtn && ideaGuideCard) {
    ideaGuideToggleBtn.addEventListener("click", () => {
      ideaGuideCard.classList.toggle("collapsed");
      if (ideaGuideIcon) {
        ideaGuideIcon.textContent = ideaGuideCard.classList.contains("collapsed") ? "◀" : "▼";
      }
    });
  }

  // Dialog inner tab buttons
  const tabActive = document.getElementById("tabIdeasActive");
  const tabArchive = document.getElementById("tabIdeasArchive");
  if (tabActive) tabActive.addEventListener("click", () => openIdeaLabModal("active"));
  if (tabArchive) tabArchive.addEventListener("click", () => openIdeaLabModal("archive"));

  // Close button
  const closeBtn = document.getElementById("ideaLabCloseBtn");
  const dlg = document.getElementById("ideaLabDialog");
  if (closeBtn && dlg) {
    closeBtn.addEventListener("click", () => dlg.close());
  }

  // Click on backdrop (native dialog backdrop area) closes dialog
  if (dlg) {
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg) dlg.close();
    });
  }

  // Create Form submission
  const ideaCreateForm = document.getElementById("ideaCreateForm");
  const newIdeaTitleEl = document.getElementById("newIdeaTitle");
  const newIdeaCategoryEl = document.getElementById("newIdeaCategory");
  if (ideaCreateForm) {
    ideaCreateForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = newIdeaTitleEl ? newIdeaTitleEl.value.trim() : "";
      const category = newIdeaCategoryEl ? newIdeaCategoryEl.value : "research";
      if (!title) return;

      const activeCount = ideaProjects.filter((p) => p.status === "active").length;
      let status = "active";
      if (activeCount >= 3) {
        status = "archived";
        alert("سقف ۳ پروژه فعال پر است. این ایده در بانک آرشیو ذخیره شد تا پس از اتمام پروژه‌های جاری آن را فعال کنید.");
      }

      const newProj = {
        id: crypto.randomUUID(),
        title,
        category,
        status,
        createdAt: new Date().toISOString(),
        steps: [],
      };

      ideaProjects.unshift(newProj);
      await storageSet({ ideaProjects });
      if (newIdeaTitleEl) newIdeaTitleEl.value = "";
      renderIdeaLabModal();
      renderAllTasksUnified();
    });
  }
}

// ---------------------------------------------------------------
// Quick Notes
// ---------------------------------------------------------------
async function initNotes() {
  const dialog = document.getElementById("notesDialog");
  const openBtn = document.getElementById("headerNotesBtn");
  const closeBtn = document.getElementById("notesCloseBtn");
  const form = document.getElementById("noteCreateForm");
  const titleInput = document.getElementById("noteTitleInput");
  const bodyInput = document.getElementById("noteBodyInput");
  const colorInput = document.getElementById("noteColorPicker");
  const grid = document.getElementById("notesGrid");
  const empty = document.getElementById("notesEmpty");
  const search = document.getElementById("notesSearchInput");
  if (!dialog || !form || !grid) return;
  const submitBtn = form.querySelector(".note-add-btn");
  let notes = [];
  let editingNote = null;
  const stored = await storageGet(["quickNotes"]);
  notes = Array.isArray(stored.quickNotes) ? stored.quickNotes : [];

  const render = () => {
    const q = (search?.value || "").trim().toLowerCase();
    const visible = notes.filter((n) => `${n.title} ${n.body}`.toLowerCase().includes(q));
    grid.innerHTML = "";
    if (empty) empty.hidden = visible.length > 0;
    visible.forEach((note) => {
      const card = document.createElement("article");
      card.className = "note-card";
      card.dataset.color = note.color || "yellow";
      card.innerHTML = `<h3 class="note-card-title"></h3><p class="note-card-body"></p><div class="note-card-date"></div><div class="note-card-actions"><button type="button" class="note-action-btn copy">کپی</button><button type="button" class="note-action-btn edit">ویرایش</button><button type="button" class="note-action-btn delete">حذف</button></div>`;
      card.querySelector(".note-card-title").textContent = note.title || "یادداشت بدون عنوان";
      card.querySelector(".note-card-body").textContent = note.body;
      card.querySelector(".note-card-date").textContent = new Date(note.createdAt).toLocaleString("fa-IR");
      card.querySelector(".copy").addEventListener("click", async () => {
        const text = note.title ? `${note.title}\n\n${note.body}` : note.body;
        try {
          await navigator.clipboard.writeText(text);
          const btn = card.querySelector(".copy");
          btn.textContent = "کپی شد ✓";
          setTimeout(() => { btn.textContent = "کپی"; }, 1600);
        } catch {
          alert("کپی متن یادداشت انجام نشد.");
        }
      });
      card.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        card.classList.toggle("is-expanded");
        card.setAttribute("aria-expanded", String(card.classList.contains("is-expanded")));
      });
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-expanded", "false");
      card.addEventListener("keydown", (e) => {
        if ((e.key === "Enter" || e.key === " ") && !e.target.closest("button")) {
          e.preventDefault();
          card.click();
        }
      });
      card.querySelector(".edit").addEventListener("click", () => {
        editingNote = note;
        titleInput.value = note.title || "";
        bodyInput.value = note.body || "";
        colorInput.value = note.color || "yellow";
        if (submitBtn) submitBtn.textContent = "ذخیره ویرایش";
        titleInput.focus();
        dialog.querySelector(".note-create-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      card.querySelector(".delete").addEventListener("click", async () => {
        notes = notes.filter((n) => n.id !== note.id);
        await storageSet({ quickNotes: notes });
        render();
      });
      grid.appendChild(card);
    });
    const badge = document.getElementById("headerNotesBadge");
    if (badge) { badge.textContent = String(notes.length); badge.style.display = notes.length ? "" : "none"; }
    const menuBadge = document.getElementById("menuNotesBadge");
    if (menuBadge) { menuBadge.textContent = String(notes.length); menuBadge.style.display = notes.length ? "" : "none"; }
  };
  openBtn?.addEventListener("click", () => { render(); dialog.showModal(); });
  closeBtn?.addEventListener("click", () => dialog.close());
  search?.addEventListener("input", render);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = bodyInput.value.trim();
    if (!body) return;
    if (editingNote) {
      editingNote.title = titleInput.value.trim();
      editingNote.body = body;
      editingNote.color = colorInput.value || "yellow";
      editingNote.updatedAt = new Date().toISOString();
      editingNote = null;
    } else {
      notes.unshift({ id: crypto.randomUUID(), title: titleInput.value.trim(), body, color: colorInput.value || "yellow", createdAt: new Date().toISOString() });
    }
    await storageSet({ quickNotes: notes });
    form.reset();
    if (submitBtn) submitBtn.textContent = "+ افزودن یادداشت";
    render();
  });
  render();
}

// ---------------------------------------------------------------
// Pinned Tools Management (which shortcut buttons show near the clock)
// ---------------------------------------------------------------
const DEFAULT_PINNED_TOOLS = {
  webmail: false,
  idea: false,
  notes: false,
  timer: false,
  report: false,
};

let pinnedToolsState = { ...DEFAULT_PINNED_TOOLS };

// Fixed reading order + element ids for the small buttons that flank the clock.
// Used to split whichever buttons are currently visible evenly between the
// right and left wings (instead of a hardcoded 2/3 split that looks
// lopsided once a button is hidden via settings).
const TOOL_BTN_IDS = {
  webmail: "headerWebmailBtn",
  idea: "headerIdeaLabBtn",
  notes: "headerNotesBtn",
  timer: "focusLaunchBtn",
  report: "studyReportLaunchBtn",
};
const TOOL_BTN_ORDER = ["webmail", "idea", "notes", "timer", "report"];

async function initToolsMenuAndPinning() {
  // Load saved pin preferences
  const stored = await storageGet(["pinnedTools"]);
  if (stored.pinnedTools && typeof stored.pinnedTools === "object") {
    pinnedToolsState = { ...DEFAULT_PINNED_TOOLS, ...stored.pinnedTools };
  } else {
    pinnedToolsState = { ...DEFAULT_PINNED_TOOLS };
  }

  const applyPinnedTools = () => {
    // 1. Update side-tool buttons on main screen
    const sideButtons = document.querySelectorAll(".side-tool-btn[data-tool]");
    sideButtons.forEach((btn) => {
      const toolKey = btn.getAttribute("data-tool");
      if (toolKey in pinnedToolsState) {
        btn.style.display = pinnedToolsState[toolKey] ? "" : "none";
      }
    });

    // 2. Rebalance wings: split currently-visible buttons evenly between
    // right/left instead of a fixed lopsided grouping.
    const rightWing = document.querySelector(".clock-wing-right");
    const leftWing = document.querySelector(".clock-wing-left");
    if (rightWing && leftWing) {
      const visibleBtns = TOOL_BTN_ORDER
        .map((key) => document.getElementById(TOOL_BTN_IDS[key]))
        .filter((btn) => btn && btn.style.display !== "none");
      const half = Math.ceil(visibleBtns.length / 2);
      visibleBtns.forEach((btn, i) => {
        const target = i < half ? rightWing : leftWing;
        if (btn.parentElement !== target) target.appendChild(btn);
      });
    }

    // 3. Check each clock wing; if all children hidden, hide wing
    const wings = document.querySelectorAll(".clock-wing");
    wings.forEach((wing) => {
      const visibleChildren = Array.from(wing.children).filter(
        (ch) => ch.style.display !== "none" && !ch.hidden
      );
      wing.style.display = visibleChildren.length > 0 ? "" : "none";
    });

    // 4. Update checkboxes in Settings modal
    const settingsCheckboxes = document.querySelectorAll(".tool-pin-toggle-input[data-tool]");
    settingsCheckboxes.forEach((chk) => {
      const toolKey = chk.getAttribute("data-tool");
      if (toolKey in pinnedToolsState) {
        chk.checked = !!pinnedToolsState[toolKey];
      }
    });

    // 5. Update pin buttons inside the quick-tools (wrench) dropdown
    const quickPinBtns = document.querySelectorAll(".quick-tool-pin-btn[data-tool]");
    quickPinBtns.forEach((btn) => {
      const toolKey = btn.getAttribute("data-tool");
      const isPinned = !!pinnedToolsState[toolKey];
      btn.classList.toggle("active", isPinned);
      btn.title = isPinned
        ? "پین شده در صفحه اصلی (کلیک برای حذف)"
        : "پین کردن در صفحه اصلی";
    });
  };

  const togglePin = async (toolKey) => {
    if (!toolKey || !(toolKey in pinnedToolsState)) return;
    pinnedToolsState[toolKey] = !pinnedToolsState[toolKey];
    await storageSet({ pinnedTools: pinnedToolsState });
    applyPinnedTools();
  };

  // Bind checkboxes in Settings modal
  const settingsCheckboxes = document.querySelectorAll(".tool-pin-toggle-input[data-tool]");
  settingsCheckboxes.forEach((chk) => {
    chk.addEventListener("change", async () => {
      const toolKey = chk.getAttribute("data-tool");
      if (toolKey && toolKey in pinnedToolsState) {
        pinnedToolsState[toolKey] = chk.checked;
        await storageSet({ pinnedTools: pinnedToolsState });
        applyPinnedTools();
      }
    });
  });

  // ---- Quick Tools (wrench icon next to Settings) ----
  const quickToolsWrap = document.getElementById("quickToolsWrap");
  const quickToolsTriggerBtn = document.getElementById("quickToolsTriggerBtn");
  const quickToolsMenu = document.getElementById("quickToolsMenu");

  const closeQuickToolsMenu = () => {
    if (!quickToolsMenu || quickToolsMenu.hidden) return;
    quickToolsMenu.hidden = true;
    quickToolsTriggerBtn?.setAttribute("aria-expanded", "false");
  };

  if (quickToolsTriggerBtn && quickToolsMenu) {
    quickToolsTriggerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = quickToolsMenu.hidden;
      quickToolsMenu.hidden = !isHidden;
      quickToolsTriggerBtn.setAttribute("aria-expanded", String(isHidden));
    });

    document.addEventListener("click", (e) => {
      if (!quickToolsWrap?.contains(e.target)) closeQuickToolsMenu();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeQuickToolsMenu();
    });
  }

  // Pin/unpin buttons inside the quick-tools dropdown (adds/removes the
  // button near the clock without needing to open Settings, and without
  // requiring the tool to be pinned in order to be opened below).
  const quickPinBtns = document.querySelectorAll(".quick-tool-pin-btn[data-tool]");
  quickPinBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePin(btn.getAttribute("data-tool"));
    });
  });

  // Clicking a tool's name/icon opens it directly — works even if that
  // tool is NOT pinned to the main screen.
  const quickToolIdea = document.getElementById("quickToolIdea");
  quickToolIdea?.addEventListener("click", () => {
    closeQuickToolsMenu();
    if (typeof openIdeaLabModal === "function") openIdeaLabModal();
  });

  const quickToolNotes = document.getElementById("quickToolNotes");
  quickToolNotes?.addEventListener("click", () => {
    closeQuickToolsMenu();
    document.getElementById("notesDialog")?.showModal();
  });

  const quickToolTimer = document.getElementById("quickToolTimer");
  quickToolTimer?.addEventListener("click", () => {
    closeQuickToolsMenu();
    document.getElementById("focusModal")?.showModal();
  });

  const quickToolReport = document.getElementById("quickToolReport");
  quickToolReport?.addEventListener("click", async () => {
    closeQuickToolsMenu();
    const studyReportModal = document.getElementById("studyReportModal");
    if (studyReportModal) {
      if (typeof renderStudyReport === "function") await renderStudyReport();
      studyReportModal.showModal();
    }
  });

  // Webmail is a plain link (id="quickToolWebmail"): clicking it opens the
  // tab and closes the menu; no extra JS needed beyond closing the popover.
  document.getElementById("quickToolWebmail")?.addEventListener("click", closeQuickToolsMenu);

  // Initial apply
  applyPinnedTools();
}

// ---------------------------------------------------------------
// init
// ---------------------------------------------------------------
async function init() {
  const now = new Date();
  const jNow = toJalali(now);
  shamsiYear = jNow.jy;
  shamsiMonth = jNow.jm;
  viewYear = now.getFullYear();
  viewMonth = now.getMonth();

  const data = await storageGet([
    "pinnedSites",
    "pinnedSitesInitialized",
    "scheduleClasses",
    "calendarMode",
    "userProfile",
    "onboardingDone",
    "focusSectionVisible",
    "ideaProjects",
    "ideaProjectsInitialized",
  ]);


  if (data.userProfile) {
    userProfile = data.userProfile;
  }

  tickClock();
  setInterval(tickClock, 1000 * 15);

  if (data.ideaProjects && Array.isArray(data.ideaProjects)) {
    ideaProjects = data.ideaProjects;
  } else if (!data.ideaProjectsInitialized) {
    ideaProjects = [...DEFAULT_SAMPLE_IDEAS];
    await storageSet({ ideaProjects, ideaProjectsInitialized: true });
  } else {
    ideaProjects = [];
  }

  if (data.pinnedSites && Array.isArray(data.pinnedSites)) {
    pinnedSites = data.pinnedSites
      .filter((s) => !s.url.includes("food.um.ac.ir"))
      .map((s) => {
        // 1. Protect and restore AI Hub package
        if (s.id === "def-ai-hub" || s.isAiPackage || s.title === "AI Hub" || s.title === "هاب هوش مصنوعی") {
          return { ...s, id: "def-ai-hub", title: "AI Hub", url: "https://chatgpt.com/ai-hub", isAiPackage: true };
        }
        // 2. Protect Google Apps package
        if (s.id === "def-google-apps" || s.isGooglePackage || s.title === "Google Apps") {
          return { ...s, id: "def-google-apps", title: "Google Apps", url: "https://about.google/products/", isGooglePackage: true };
        }
        // 3. Protect Research Hub package
        if (s.id === "def-research-hub" || s.isResearchPackage || s.title === "Research Hub") {
          return { ...s, id: "def-research-hub", title: "Research Hub", url: "https://scholar.google.com/", isResearchPackage: true };
        }
        // 4. Other preset titles
        const cleanUrl = s.url.replace(/\/$/, "");
        if (PRESET_TITLE_MAP[cleanUrl]) {
          return { ...s, title: PRESET_TITLE_MAP[cleanUrl] };
        }
        return s;
      });
    await storageSet({ pinnedSites, pinnedSitesInitialized: true });
  } else if (!data.pinnedSitesInitialized) {
    pinnedSites = [...DEFAULT_PINNED_SITES];
    await storageSet({ pinnedSites, pinnedSitesInitialized: true });
  } else {
    pinnedSites = [];
  }
  renderPinned();

  if (data.calendarMode) {
    calendarMode = data.calendarMode;
  }
  updateCalendarModeButtons();

  if (data.scheduleViewMode) {
    scheduleViewMode = data.scheduleViewMode;
  }

  scheduleClasses = data.scheduleClasses || [];
  try { await loadVuState(); } catch (err) { console.warn("VU state load failed", err); }
  renderScheduleTable();
  updateFocusCourseSelectOptions();

  await loadTasksForMonth();
  renderCalendar();
  await loadGoogleEventsForSelectedDate(false);
  await renderAllTasksUnified();
  // Keep independent UI modules alive even if an optional timer/storage
  // operation fails on a fresh extension install.
  try { await initFocusTimer(); } catch (err) { console.warn("Focus timer init failed", err); }
  try { await initStudyReport(); } catch (err) { console.warn("Study report init failed", err); }
  try { initIdeaLab(); } catch (err) { console.warn("Idea lab init failed", err); }
  try { await initNotes(); } catch (err) { console.warn("Notes init failed", err); }
  try { await initToolsMenuAndPinning(); } catch (err) { console.warn("Tools menu init failed", err); }
  try { await initVuDashboard(); } catch (err) { console.warn("VU dashboard init failed", err); }
  await checkUpcomingExamReminders();

  // Show onboarding on first installation
  if (!data.onboardingDone) {
    openOnboardingDialog();
  }
}

init();
