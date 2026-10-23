// ===============================================================
// StuDash appearance engine (HeroUI v3 theming).
//
// Load this synchronously in <head> (before any stylesheet paint) on every
// extension page. It applies the saved appearance immediately from a
// localStorage mirror — extension pages share one origin, so the mirror is
// available synchronously and there is no flash of the wrong theme — then
// reconciles with chrome.storage.local (the source of truth), follows the
// OS colour scheme in "system" mode, and live-updates across open pages.
//
// On <html> it sets:  class="light|dark"  data-theme="<preset>-<mode>"
//                     data-density  data-radius  (+ inline --accent override)
// ===============================================================
(function (global) {
  const STORAGE_KEY = "appearance";
  const MIRROR_KEY = "studash.appearance";

  const DEFAULTS = Object.freeze({
    mode: "system", // "light" | "dark" | "system"
    preset: "studash",
    accent: "", // "" = preset accent, else an id from ACCENTS
    density: "comfortable", // "compact" | "comfortable" | "spacious"
    radius: "rounded", // "sharp" | "rounded" | "soft"
  });

  const PRESETS = [
    { id: "studash", name: "StuDash", description: "کهربایی گرم" },
    { id: "ocean", name: "Ocean", description: "آبی آرام" },
    { id: "forest", name: "Forest", description: "سبز ملایم" },
    { id: "lavender", name: "Lavender", description: "بنفش نرم" },
    { id: "graphite", name: "Graphite", description: "تک‌رنگ، مشکی OLED" },
  ];

  // Curated accents: [accent, text-on-accent, optional focus ring] per mode, tuned for WCAG AA.
  const ACCENTS = [
    { id: "amber", name: "کهربایی", light: ["oklch(0.74 0.15 62)", "oklch(0.24 0.04 50)", "oklch(0.6 0.16 55)"], dark: ["oklch(0.79 0.13 65)", "oklch(0.24 0.04 50)"] },
    { id: "coral", name: "مرجانی", light: ["oklch(0.57 0.18 32)", "oklch(0.99 0 0)"], dark: ["oklch(0.72 0.14 32)", "oklch(0.2 0.03 30)"] },
    { id: "rose", name: "صورتی", light: ["oklch(0.58 0.19 5)", "oklch(0.99 0 0)"], dark: ["oklch(0.73 0.14 5)", "oklch(0.2 0.03 5)"] },
    { id: "violet", name: "بنفش", light: ["oklch(0.55 0.19 295)", "oklch(0.99 0 0)"], dark: ["oklch(0.74 0.14 295)", "oklch(0.2 0.04 295)"] },
    { id: "blue", name: "آبی", light: ["oklch(0.56 0.17 252)", "oklch(0.99 0 0)"], dark: ["oklch(0.7 0.15 245)", "oklch(0.18 0.03 250)"] },
    { id: "teal", name: "فیروزه‌ای", light: ["oklch(0.51 0.1 195)", "oklch(0.99 0 0)"], dark: ["oklch(0.75 0.11 195)", "oklch(0.2 0.03 195)"] },
    { id: "green", name: "سبز", light: ["oklch(0.52 0.12 155)", "oklch(0.99 0 0)"], dark: ["oklch(0.74 0.13 155)", "oklch(0.2 0.03 155)"] },
    { id: "slate", name: "خاکستری", light: ["oklch(0.3 0.02 260)", "oklch(0.99 0 0)"], dark: ["oklch(0.88 0.01 260)", "oklch(0.18 0.01 260)"] },
  ];

  const VALID = {
    mode: ["light", "dark", "system"],
    preset: PRESETS.map((p) => p.id),
    accent: ["", ...ACCENTS.map((a) => a.id)],
    density: ["compact", "comfortable", "spacious"],
    radius: ["sharp", "rounded", "soft"],
  };

  function normalize(value) {
    const out = { ...DEFAULTS };
    if (value && typeof value === "object") {
      for (const key of Object.keys(DEFAULTS)) {
        if (VALID[key].includes(value[key])) out[key] = value[key];
      }
    }
    return out;
  }

  const media = global.matchMedia ? global.matchMedia("(prefers-color-scheme: dark)") : null;
  const resolveMode = (a) => (a.mode === "system" ? (media && media.matches ? "dark" : "light") : a.mode);

  // Apply to <html> (or any element, e.g. a preview swatch).
  function apply(appearance, root = document.documentElement, { withAccent = true } = {}) {
    const a = normalize(appearance);
    const mode = resolveMode(a);
    root.classList.remove("light", "dark");
    root.classList.add(mode);
    root.setAttribute("data-theme", `${a.preset}-${mode}`);
    if (root === document.documentElement) {
      root.setAttribute("data-mode", a.mode);
      root.setAttribute("data-density", a.density);
      root.setAttribute("data-radius", a.radius);
      root.style.colorScheme = mode;
    }
    const accent = withAccent && ACCENTS.find((x) => x.id === a.accent);
    if (accent) {
      const [bg, fg, focus] = accent[mode];
      root.style.setProperty("--accent", bg);
      root.style.setProperty("--accent-foreground", fg);
      root.style.setProperty("--focus", focus || bg); // light amber needs a darker ring for 3:1
    } else {
      root.style.removeProperty("--accent");
      root.style.removeProperty("--accent-foreground");
      root.style.removeProperty("--focus");
    }
    return a;
  }

  // ---------- state ----------
  const readMirror = () => {
    try {
      return JSON.parse(global.localStorage.getItem(MIRROR_KEY) || "null");
    } catch (e) {
      return null;
    }
  };
  const writeMirror = (a) => {
    try {
      global.localStorage.setItem(MIRROR_KEY, JSON.stringify(a));
    } catch (e) {}
  };

  let current = normalize(readMirror());
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => {
    try { fn(current); } catch (e) {}
  });

  // Resolved colours for both modes, for surfaces that can't load this stylesheet
  // (the on-page focus widget in content_script.js reads them from storage).
  const PALETTE_KEY = "appearancePalette";
  let lastPalette = "";
  function publishPalette() {
    if (!(global.chrome && chrome.storage && chrome.storage.local) || !document.body) return;
    const probe = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim();
    if (!probe) return; // stylesheet not applied yet
    const palette = { mode: current.mode };
    for (const mode of ["light", "dark"]) {
      const el = document.createElement("div");
      el.style.display = "none";
      document.body.appendChild(el);
      apply({ ...current, mode }, el);
      const cs = getComputedStyle(el);
      const v = (name) => cs.getPropertyValue(name).trim();
      palette[mode] = {
        surface: v("--overlay"),
        fg: v("--foreground"),
        muted: v("--muted"),
        border: v("--border"),
        accent: v("--accent"),
        "accent-hover": v("--accent-hover"),
        "accent-text": v("--accent-soft-foreground"),
        "on-accent": v("--accent-foreground"),
        success: v("--success"),
        "success-text": v("--success-soft-foreground"),
        "on-success": v("--success-foreground"),
        shadow: mode === "dark" ? "rgba(0, 0, 0, 0.5)" : "rgba(0, 0, 0, 0.14)",
      };
      el.remove();
    }
    const json = JSON.stringify(palette);
    if (json !== lastPalette) {
      lastPalette = json;
      chrome.storage.local.set({ [PALETTE_KEY]: palette });
    }
  }
  const schedulePublish = () => {
    // setTimeout, not rAF: rAF is paused in background tabs; getComputedStyle resolves styles anyway.
    if (document.readyState === "complete") setTimeout(publishPalette, 0);
    else global.addEventListener("load", () => setTimeout(publishPalette, 0), { once: true });
  };

  function set(next, { persist = true } = {}) {
    current = apply(next);
    writeMirror(current);
    if (persist && global.chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [STORAGE_KEY]: current });
    }
    schedulePublish();
    emit();
    return current;
  }

  // First paint: synchronous, from the mirror.
  apply(current);

  // Old StuDash themes → new appearance (one-time, only if nothing saved yet).
  const LEGACY = {
    default: { preset: "studash", mode: "dark" },
    "digital-minimal": { preset: "graphite", mode: "dark" },
    "light-modern": { preset: "studash", mode: "light" },
    "oled-black": { preset: "graphite", mode: "dark" },
  };

  const ready = (async () => {
    if (!(global.chrome && chrome.storage && chrome.storage.local)) return current;
    try {
      const data = await chrome.storage.local.get([STORAGE_KEY, "appTheme"]);
      if (data[STORAGE_KEY]) {
        set(data[STORAGE_KEY], { persist: false });
      } else if (data.appTheme && LEGACY[data.appTheme]) {
        set({ ...DEFAULTS, ...LEGACY[data.appTheme] });
      } else {
        writeMirror(current);
      }
    } catch (e) {}
    schedulePublish();
    return current;
  })();

  if (global.chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes[STORAGE_KEY] && changes[STORAGE_KEY].newValue) {
        const next = normalize(changes[STORAGE_KEY].newValue);
        if (JSON.stringify(next) !== JSON.stringify(current)) set(next, { persist: false });
      }
    });
  }

  if (media) {
    const onScheme = () => {
      if (current.mode === "system") {
        apply(current);
        emit();
      }
    };
    media.addEventListener ? media.addEventListener("change", onScheme) : media.addListener(onScheme);
    // Safety net: re-check when the page comes back (an OS switch can happen while hidden).
    const recheck = () => {
      if (current.mode === "system" && !document.documentElement.classList.contains(resolveMode(current))) onScheme();
    };
    global.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
  }

  global.StudashTheme = {
    DEFAULTS,
    PRESETS,
    ACCENTS,
    ready,
    get: () => ({ ...current }),
    resolvedMode: () => resolveMode(current),
    update: (patch) => set({ ...current, ...patch }),
    reset: () => set({ ...DEFAULTS }),
    apply,
    onChange: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
})(window);
