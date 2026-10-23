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
      btn.tabIndex = on ? 0 : -1;
    }
  }

  function sync(a) {
    syncGroup(modeGroup, a.mode);
    syncGroup(presetGroup, a.preset);
    syncGroup(accentGroup, a.accent);
    syncGroup(densityGroup, a.density);
    syncGroup(radiusGroup, a.radius);
    const accent = T.ACCENTS.find((x) => x.id === a.accent);
    $("appearanceAccentName").textContent = accent ? accent.name : "رنگ پیش‌فرض پوسته";
    const isDefault = JSON.stringify(a) === JSON.stringify(T.DEFAULTS);
    $("appearanceResetBtn").disabled = isDefault;
  }

  renderPresets();
  renderAccents();
  setupGroup(modeGroup, "mode");
  setupGroup(presetGroup, "preset");
  setupGroup(accentGroup, "accent");
  setupGroup(densityGroup, "density");
  setupGroup(radiusGroup, "radius");

  $("appearanceResetBtn").addEventListener("click", () => T.reset());

  T.onChange(sync);
  sync(T.get());
  T.ready.then(sync);
})();
