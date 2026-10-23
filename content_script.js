// ===============================================================
// StuDash Focus Timer - Floating Cross-Tab Widget (Content Script)
// ===============================================================

(function () {
  // Prevent duplicate injection
  if (document.getElementById("studash-floating-root")) return;

  // Don't inject in iframe or extension pages
  if (window !== window.top) return;
  if (window.location.protocol === "chrome-extension:") return;

  let timerState = null;
  let isMinimized = false;
  let isDragging = false;
  let dragStartX, dragStartY;
  let initialLeft, initialTop;
  let tickInterval = null;

  // 1. Create Root Host & Shadow DOM
  const rootHost = document.createElement("div");
  rootHost.id = "studash-floating-root";
  rootHost.style.position = "fixed";
  rootHost.style.zIndex = "2147483647";
  rootHost.style.bottom = "24px";
  rootHost.style.left = "24px";
  rootHost.style.fontFamily = "'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  rootHost.style.userSelect = "none";
  rootHost.style.lineHeight = "1.4";
  document.documentElement.appendChild(rootHost);

  const shadow = rootHost.attachShadow({ mode: "open" });

  // Follow the StuDash appearance: theme.js publishes resolved colours for both modes
  // (appearancePalette) so the widget matches the dashboard without loading page CSS.
  const schemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
  let studashPalette = null;
  function applyStudashPalette() {
    if (!studashPalette) return;
    const mode = studashPalette.mode === "system" ? (schemeQuery.matches ? "dark" : "light") : studashPalette.mode;
    const tokens = studashPalette[mode];
    if (!tokens) return;
    for (const [key, value] of Object.entries(tokens)) rootHost.style.setProperty(`--w-${key}`, value);
  }
  try {
    chrome.storage.local.get("appearancePalette", (res) => {
      studashPalette = res && res.appearancePalette;
      applyStudashPalette();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.appearancePalette) {
        studashPalette = changes.appearancePalette.newValue;
        applyStudashPalette();
      }
    });
    schemeQuery.addEventListener("change", applyStudashPalette);
  } catch (e) {}

  // 2. Inject Isolated Styles
  const style = document.createElement("style");
  style.textContent = `
    :host {
      --w-surface: #1a1d38; --w-fg: #f4f1ea; --w-muted: #9aa0c0; --w-border: rgba(255,255,255,.1);
      --w-accent: #f2a65a; --w-accent-hover: #f7b96e; --w-accent-text: #f2a65a; --w-on-accent: #1a1329;
      --w-success: #6fcf97; --w-success-text: #6fcf97; --w-on-success: #0d2217; --w-shadow: rgba(0,0,0,.5);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    .studash-pill-wrap {
      position: fixed;
      bottom: 24px;
      left: 24px;
      display: flex;
      flex-direction: column;
      background: color-mix(in oklab, var(--w-surface) 94%, transparent);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid color-mix(in oklab, var(--w-accent) 40%, transparent);
      border-radius: 16px;
      box-shadow: 0 12px 36px var(--w-shadow), 0 0 24px color-mix(in oklab, var(--w-accent) 18%, transparent);
      color: var(--w-fg);
      direction: rtl;
      transition: box-shadow 0.2s ease, opacity 0.2s ease;
      cursor: grab;
      width: 275px;
      overflow: hidden;
      font-size: 12px;
    }

    .studash-pill-wrap:active {
      cursor: grabbing;
    }

    .studash-pill-wrap.is-break {
      border-color: color-mix(in oklab, var(--w-success) 45%, transparent);
      box-shadow: 0 12px 36px var(--w-shadow), 0 0 24px color-mix(in oklab, var(--w-success) 20%, transparent);
    }

    .studash-pill-wrap.is-minimized {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      align-items: center;
      justify-content: center;
      padding: 0;
      cursor: pointer;
    }

    .pill-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px 6px;
      border-bottom: 1px solid color-mix(in oklab, var(--w-fg) 8%, transparent);
      background: color-mix(in oklab, var(--w-fg) 3%, transparent);
    }

    .pill-mode-tag {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .pill-mode-tag.tag-study {
      background: color-mix(in oklab, var(--w-accent) 20%, transparent);
      color: var(--w-accent-text);
    }

    .pill-mode-tag.tag-break {
      background: color-mix(in oklab, var(--w-success) 20%, transparent);
      color: var(--w-success-text);
    }

    .pill-mode-tag.tag-stopwatch {
      background: rgba(111, 200, 242, 0.2);
      color: #6fc8f2;
    }

    .pill-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .pill-btn-icon {
      background: none;
      border: none;
      color: var(--w-muted);
      width: 22px;
      height: 22px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-family: inherit;
      transition: all 0.15s ease;
    }

    .pill-btn-icon:hover {
      background: color-mix(in oklab, var(--w-fg) 12%, transparent);
      color: var(--w-fg);
    }

    .pill-body {
      padding: 10px 14px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .pill-subject {
      font-size: 12px;
      font-weight: 600;
      color: var(--w-fg);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      text-align: right;
    }

    .pill-main-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .pill-time {
      font-size: 26px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      color: var(--w-fg);
      letter-spacing: 0.02em;
      line-height: 1;
      direction: ltr;
      text-align: left;
    }

    .pill-controls {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .pill-ctrl-btn {
      border: none;
      border-radius: 999px;
      font-family: inherit;
      font-size: 11.5px;
      font-weight: 700;
      padding: 5px 12px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s ease;
      white-space: nowrap;
    }

    .pill-ctrl-primary {
      background: var(--w-accent);
      color: var(--w-on-accent);
    }

    .pill-ctrl-primary:hover {
      background: var(--w-accent-hover);
      transform: scale(1.03);
    }

    .pill-ctrl-primary.btn-break {
      background: var(--w-success);
      color: var(--w-on-success);
    }

    .pill-ctrl-primary.btn-break:hover {
      background: var(--w-success);
    }

    .pill-ctrl-secondary {
      background: color-mix(in oklab, var(--w-fg) 8%, transparent);
      color: var(--w-muted);
      padding: 5px 8px;
    }

    .pill-ctrl-secondary:hover {
      background: color-mix(in oklab, var(--w-fg) 16%, transparent);
      color: var(--w-fg);
    }

    /* Minimized Floating Bubble */
    .mini-bubble {
      display: none;
      width: 100%;
      height: 100%;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      cursor: pointer;
    }

    .studash-pill-wrap.is-minimized .pill-header,
    .studash-pill-wrap.is-minimized .pill-body {
      display: none;
    }

    .studash-pill-wrap.is-minimized .mini-bubble {
      display: flex;
    }

    .mini-bubble-time {
      font-size: 11px;
      font-weight: 800;
      color: var(--w-accent-text);
      line-height: 1;
      direction: ltr;
    }

    .mini-bubble-icon {
      font-size: 13px;
      margin-bottom: 2px;
    }

    .studash-pill-wrap.is-break .mini-bubble-time {
      color: var(--w-success-text);
    }
  `;
  shadow.appendChild(style);

  // 3. Inject Markup Container
  const container = document.createElement("div");
  container.className = "studash-pill-wrap";
  shadow.appendChild(container);

  // Helper Formatter
  function faDigits(str) {
    return String(str).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    const pad = (n) => (n < 10 ? "0" + n : n);
    return `${pad(m)}:${pad(s)}`;
  }

  // Render Widget UI
  function renderWidget() {
    if (!timerState || timerState.showFloatingWidget === false || (!timerState.isRunning && !timerState.isPaused)) {
      container.style.display = "none";
      return;
    }

    container.style.display = "flex";
    container.classList.toggle("is-break", timerState.mode === "break");
    container.classList.toggle("is-minimized", isMinimized);

    let modeLabel = "🎯 پارت مطالعه";
    let modeClass = "tag-study";
    if (timerState.mode === "break") {
      modeLabel = "☕ وقت استراحت";
      modeClass = "tag-break";
    } else if (timerState.mode === "stopwatch") {
      modeLabel = "⏱️ کرنومتر آزاد";
      modeClass = "tag-stopwatch";
    }

    let currentSecs = 0;
    if (timerState.mode === "stopwatch") {
      if (timerState.isRunning && !timerState.isPaused && timerState.startedAt) {
        currentSecs = Math.max(0, Math.floor((Date.now() - timerState.startedAt) / 1000));
      } else {
        currentSecs = timerState.elapsedSeconds || 0;
      }
    } else {
      if (timerState.isRunning && !timerState.isPaused && timerState.targetEndTime) {
        currentSecs = Math.max(0, Math.ceil((timerState.targetEndTime - Date.now()) / 1000));
      } else {
        currentSecs = timerState.remainingSeconds || 0;
      }
    }

    const timeFormatted = formatTime(currentSecs);
    const primaryBtnIcon = timerState.isRunning ? "⏸️" : "▶️";
    const primaryBtnText = timerState.isRunning ? "توقف" : (timerState.isPaused ? "ادامه" : "شروع");
    const primaryBtnClass = timerState.mode === "break" ? "pill-ctrl-primary btn-break" : "pill-ctrl-primary";

    container.innerHTML = `
      <div class="pill-header">
        <span class="pill-mode-tag ${modeClass}">${modeLabel}</span>
        <div class="pill-actions">
          <button type="button" class="pill-btn-icon" id="btnMinimize" title="کوچک کردن ویجت">_</button>
          <button type="button" class="pill-btn-icon" id="btnClose" title="مخفی‌سازی در این صفحه">×</button>
        </div>
      </div>

      <div class="pill-body">
        <div class="pill-subject" title="${timerState.subjectTitle || "مطالعه آزاد"}">
          📚 ${timerState.subjectTitle || "مطالعه آزاد"}
        </div>
        <div class="pill-main-row">
          <div class="pill-time" id="pillTimeDisplay">${faDigits(timeFormatted)}</div>
          <div class="pill-controls">
            <button type="button" class="${primaryBtnClass} pill-ctrl-btn" id="btnPrimaryAction">
              <span>${primaryBtnIcon}</span>
              <span>${primaryBtnText}</span>
            </button>
            <button type="button" class="pill-ctrl-secondary pill-ctrl-btn" id="btnResetAction" title="ریست تایمر">
              🔄
            </button>
          </div>
        </div>
      </div>

      <!-- Minimized State Bubble -->
      <div class="mini-bubble" id="miniBubble" title="برای باز کردن کلیک کنید">
        <span class="mini-bubble-icon">${timerState.mode === "break" ? "☕" : "🎯"}</span>
        <span class="mini-bubble-time">${faDigits(timeFormatted.split(":")[0])}m</span>
      </div>
    `;

    // Event Handlers
    const btnMinimize = container.querySelector("#btnMinimize");
    if (btnMinimize) {
      btnMinimize.addEventListener("click", (e) => {
        e.stopPropagation();
        isMinimized = true;
        renderWidget();
      });
    }

    const miniBubble = container.querySelector("#miniBubble");
    if (miniBubble) {
      miniBubble.addEventListener("click", () => {
        isMinimized = false;
        renderWidget();
      });
    }

    const btnClose = container.querySelector("#btnClose");
    if (btnClose) {
      btnClose.addEventListener("click", (e) => {
        e.stopPropagation();
        container.style.display = "none";
      });
    }

    const btnPrimaryAction = container.querySelector("#btnPrimaryAction");
    if (btnPrimaryAction) {
      btnPrimaryAction.addEventListener("click", (e) => {
        e.stopPropagation();
        if (timerState.isRunning) {
          chrome.runtime.sendMessage({ action: "PAUSE_TIMER" }, (st) => {
            if (st) { timerState = st; renderWidget(); }
          });
        } else if (timerState.isPaused) {
          chrome.runtime.sendMessage({ action: "RESUME_TIMER" }, (st) => {
            if (st) { timerState = st; renderWidget(); }
          });
        } else {
          chrome.runtime.sendMessage({ action: "START_TIMER" }, (st) => {
            if (st) { timerState = st; renderWidget(); }
          });
        }
      });
    }

    const btnResetAction = container.querySelector("#btnResetAction");
    if (btnResetAction) {
      btnResetAction.addEventListener("click", (e) => {
        e.stopPropagation();
        chrome.runtime.sendMessage({ action: "RESET_TIMER" }, (st) => {
          if (st) { timerState = st; renderWidget(); }
        });
      });
    }
  }

  // 4. Drag & Drop Handling
  function makeDraggable() {
    container.addEventListener("mousedown", (e) => {
      // Don't drag when clicking buttons
      if (e.target.closest("button") || e.target.closest(".pill-controls")) return;

      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;

      const rect = container.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      // Switch from bottom/left to top/left coordinates
      container.style.bottom = "auto";
      container.style.right = "auto";
      container.style.left = `${initialLeft}px`;
      container.style.top = `${initialTop}px`;
      container.style.transition = "none";

      const onMouseMove = (ev) => {
        if (!isDragging) return;
        const dx = ev.clientX - dragStartX;
        const dy = ev.clientY - dragStartY;

        let newLeft = initialLeft + dx;
        let newTop = initialTop + dy;

        // Viewport bounds clamp
        const padding = 10;
        const maxLeft = window.innerWidth - container.offsetWidth - padding;
        const maxTop = window.innerHeight - container.offsetHeight - padding;

        newLeft = Math.max(padding, Math.min(newLeft, maxLeft));
        newTop = Math.max(padding, Math.min(newTop, maxTop));

        container.style.left = `${newLeft}px`;
        container.style.top = `${newTop}px`;
      };

      const onMouseUp = () => {
        isDragging = false;
        container.style.transition = "";
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);

        // Persist position
        try {
          chrome.storage.local.set({
            focusTimerPosition: { left: container.style.left, top: container.style.top },
          });
        } catch (err) {}
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });
  }

  // Restore saved position
  try {
    chrome.storage.local.get("focusTimerPosition", (res) => {
      if (res && res.focusTimerPosition) {
        container.style.bottom = "auto";
        container.style.right = "auto";
        container.style.left = res.focusTimerPosition.left;
        container.style.top = res.focusTimerPosition.top;
      }
    });
  } catch (err) {}

  makeDraggable();

  // 5. Local Timer Ticker
  function startLocalTicker() {
    if (tickInterval) clearInterval(tickInterval);
    tickInterval = setInterval(() => {
      if (timerState && timerState.isRunning && !timerState.isPaused) {
        let currentSecs = 0;
        if (timerState.mode === "stopwatch") {
          if (timerState.startedAt) {
            currentSecs = Math.max(0, Math.floor((Date.now() - timerState.startedAt) / 1000));
          } else {
            currentSecs = (timerState.elapsedSeconds || 0) + 1;
            timerState.elapsedSeconds = currentSecs;
          }
        } else {
          if (timerState.targetEndTime) {
            currentSecs = Math.max(0, Math.ceil((timerState.targetEndTime - Date.now()) / 1000));
            timerState.remainingSeconds = currentSecs;
            if (currentSecs <= 0 && timerState.isRunning) {
              timerState.isRunning = false;
              chrome.runtime.sendMessage({ action: "GET_TIMER_STATE" }, (st) => {
                if (st) { timerState = st; renderWidget(); }
              });
            }
          } else if (timerState.remainingSeconds > 0) {
            timerState.remainingSeconds -= 1;
            currentSecs = timerState.remainingSeconds;
          }
        }

        const displayEl = container.querySelector("#pillTimeDisplay");
        if (displayEl) {
          displayEl.textContent = faDigits(formatTime(currentSecs));
        }

        const miniTimeEl = container.querySelector(".mini-bubble-time");
        if (miniTimeEl) {
          miniTimeEl.textContent = `${faDigits(Math.floor(currentSecs / 60))}m`;
        }
      }
    }, 1000);
  }

  // 6. Listen to Background Updates
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "TIMER_STATE_UPDATED" && msg.state) {
      timerState = msg.state;
      renderWidget();
    }
  });

  // Initial Fetch
  try {
    chrome.runtime.sendMessage({ action: "GET_TIMER_STATE" }, (state) => {
      if (state) {
        timerState = state;
        renderWidget();
        startLocalTicker();
      }
    });
  } catch (e) {}
})();
