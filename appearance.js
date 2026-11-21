// ===============================================================
// StuDash Appearance settings — controls for theme.js (StudashTheme).
// Radio groups follow the WAI-ARIA pattern: one tab stop per group,
// arrow keys move the selection, Space/Enter selects.
// ===============================================================
(function () {
  const T = window.StudashTheme;
  if (!T) return;

  const $ = (id) => document.getElementById(id);
  const modeGroup = $("appearanceMode");
  const presetGroup = $("appearancePresets");
  const accentGroup = $("appearanceAccents");
  const densityGroup = $("appearanceDensity");
  const scaleGroup = $("appearanceScale");
  const radiusGroup = $("appearanceRadius");
  if (!modeGroup || !presetGroup) return;

  // ---------- builders ----------
  function previewHalf(presetId, mode) {
    const half = document.createElement("div");
    half.className = `sd-preview ${mode}`;
    half.setAttribute("data-theme", `${presetId}-${mode}`);
    half.innerHTML = `
      <div class="sd-preview__side"></div>
      <div class="sd-preview__main">
        <div class="sd-preview__card">
          <span class="sd-preview__line"></span>
          <span class="sd-preview__line short"></span>
          <span class="sd-preview__btn"></span>
        </div>
        <div class="sd-preview__chips"><span></span><span></span></div>
      </div>`;
    return half;
  }

  function renderPresets() {
    presetGroup.innerHTML = "";
    for (const preset of T.PRESETS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sd-preset";
      btn.setAttribute("role", "radio");
      btn.dataset.value = preset.id;
      btn.setAttribute("aria-label", `${preset.name} — ${preset.description}`);

      const frame = document.createElement("div");
      frame.className = "sd-preset__frame";
      frame.append(previewHalf(preset.id, "light"), previewHalf(preset.id, "dark"));

      const meta = document.createElement("div");
      meta.className = "sd-preset__meta";
      meta.innerHTML = `<span class="sd-preset__name"></span><span class="sd-preset__desc"></span><span class="sd-preset__check sd-icon sd-icon--check" aria-hidden="true"></span>`;
      meta.querySelector(".sd-preset__name").textContent = preset.name;
      meta.querySelector(".sd-preset__desc").textContent = preset.description;

      btn.append(frame, meta);
      presetGroup.appendChild(btn);
    }
  }

  function renderAccents() {
    accentGroup.innerHTML = "";
    const items = [{ id: "", name: "رنگ پوسته" }, ...T.ACCENTS];
    for (const accent of items) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sd-swatch" + (accent.id ? "" : " sd-swatch--auto");
      btn.setAttribute("role", "radio");
      btn.dataset.value = accent.id;
      btn.setAttribute("aria-label", accent.name);
      btn.setAttribute("data-tooltip", accent.name);
      if (accent.id) {
        btn.style.setProperty("--swatch-light", accent.light[0]);
        btn.style.setProperty("--swatch-dark", accent.dark[0]);
      }
      btn.innerHTML = '<span class="sd-swatch__dot"></span><span class="sd-swatch__check sd-icon sd-icon--check" aria-hidden="true"></span>';
      accentGroup.appendChild(btn);
    }
  }

  // ---------- radio group behaviour ----------
  function setupGroup(group, key) {
    const items = () => [...group.querySelectorAll('[role="radio"]')];
    group.addEventListener("click", (e) => {
      const btn = e.target.closest('[role="radio"]');
      if (!btn || !group.contains(btn)) return;
      T.update({ [key]: btn.dataset.value });
    });
    group.addEventListener("keydown", (e) => {
      const list = items();
      const idx = list.indexOf(document.activeElement);
      if (idx < 0) return;
      const rtl = getComputedStyle(group).direction === "rtl";
      let next = null;
      if (e.key === "ArrowDown" || e.key === (rtl ? "ArrowLeft" : "ArrowRight")) next = (idx + 1) % list.length;
      if (e.key === "ArrowUp" || e.key === (rtl ? "ArrowRight" : "ArrowLeft")) next = (idx - 1 + list.length) % list.length;
      if (e.key === "Home") next = 0;
      if (e.key === "End") next = list.length - 1;
      if (next === null) return;
      e.preventDefault();
      list[next].focus();
      T.update({ [key]: list[next].dataset.value });
    });
  }

  function syncGroup(group, value) {
    if (!group) return;
    for (const btn of group.querySelectorAll('[role="radio"]')) {
      const on = btn.dataset.value === value;
      btn.setAttribute("aria-checked", on ? "true" : "false");
      btn.setAttribute("aria-selected", on ? "true" : "false");
      btn.classList.toggle("active", on);
      btn.tabIndex = on ? 0 : -1;
    }
  }

  function sync(a) {
    syncGroup(modeGroup, a.mode);
    syncGroup(presetGroup, a.preset);
    syncGroup(accentGroup, a.accent);
    syncGroup(densityGroup, a.density);
    syncGroup(scaleGroup, a.scale || "normal");
    syncGroup(radiusGroup, a.radius);
    const accent = T.ACCENTS.find((x) => x.id === a.accent);
    $("appearanceAccentName").textContent = accent ? accent.name : "رنگ پیش‌فرض پوسته";
    // Keep button always enabled and responsive to user clicks
    if ($("appearanceResetBtn")) $("appearanceResetBtn").disabled = false;
  }

  renderPresets();
  renderAccents();
  setupGroup(modeGroup, "mode");
  setupGroup(presetGroup, "preset");
  setupGroup(accentGroup, "accent");
  setupGroup(densityGroup, "density");
  setupGroup(scaleGroup, "scale");
  setupGroup(radiusGroup, "radius");

  const resetBtn = $("appearanceResetBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      // 1. Reset theme, mode, scale, density, preset, radius
      T.reset();

      // 2. Reset pinned shortcut tools if available
      if (typeof window.resetPinnedTools === "function") {
        try {
          await window.resetPinnedTools();
        } catch (e) {}
      }

      // 3. Clear, instant visual feedback
      const originalHtml = resetBtn.innerHTML;
      resetBtn.innerHTML = '<span class="sd-icon sd-icon--check" aria-hidden="true" style="color:var(--accent,#f2a65a)"></span>به پیش‌فرض بازگشت';
      resetBtn.style.borderColor = "var(--accent, #f2a65a)";
      resetBtn.style.color = "var(--accent, #f2a65a)";

      setTimeout(() => {
        resetBtn.innerHTML = originalHtml;
        resetBtn.style.borderColor = "";
        resetBtn.style.color = "";
      }, 1800);
    });
  }

  T.onChange(sync);
  sync(T.get());
  T.ready.then(sync);
})();
