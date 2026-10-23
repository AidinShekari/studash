// ===============================================================
// StuDash UI kit — shared behaviour for HeroUI v3 CSS structures in
// plain HTML (no React here; see islands/ for the React-based Select
// and DatePicker).
//
//  • SDUI.setSelected(items, fn)  — selection state + ARIA for tabs,
//    radio groups and toggle buttons (roving tabindex)
//  • roving keyboard support for [role=tablist] / [role=radiogroup]
//  • SDUI.chip(text, opts)        — official Chip markup (.chip, .chip__label)
//  • Modals: native <dialog>.showModal() gives the focus trap (inert page),
//    Escape and the top layer. This file adds the official HeroUI Modal
//    element classes (modal__dialog / __header / __heading / __body /
//    __footer / __close-trigger), an accessible name, a deliberate initial
//    focus and focus return to the opener. It is NOT the React Modal
//    component; behaviour comes from the browser's dialog element.
//  • Forms: inline Persian validation messages using .field-error.
// ===============================================================
(function (global) {
  const SDUI = {};

  // ---------------------------------------------------------------
  // Selection state
  // ---------------------------------------------------------------
  SDUI.setSelected = function (items, isSelected) {
    for (const el of items) {
      if (!el) continue;
      const on = Boolean(isSelected(el));
      el.classList.toggle("active", on);
      const role = el.getAttribute("role");
      if (role === "tab") el.setAttribute("aria-selected", String(on));
      else if (role === "radio") el.setAttribute("aria-checked", String(on));
      else el.setAttribute("aria-pressed", String(on));
      if (role === "tab" || role === "radio") el.tabIndex = on ? 0 : -1;
    }
  };

  // Arrow keys move focus *and* activate (tabs/radios with automatic activation).
  function initRoving(group) {
    const selector = ':scope > [role="tab"], :scope > [role="radio"]';
    group.addEventListener("keydown", (e) => {
      const items = [...group.querySelectorAll(selector)].filter((b) => !b.disabled && !b.hidden);
      const idx = items.indexOf(document.activeElement);
      if (idx < 0) return;
      const rtl = getComputedStyle(group).direction === "rtl";
      const vertical = group.getAttribute("aria-orientation") === "vertical";
      const nextKeys = vertical ? ["ArrowDown"] : [rtl ? "ArrowLeft" : "ArrowRight", "ArrowDown"];
      const prevKeys = vertical ? ["ArrowUp"] : [rtl ? "ArrowRight" : "ArrowLeft", "ArrowUp"];
      let next = null;
      if (nextKeys.includes(e.key)) next = (idx + 1) % items.length;
      else if (prevKeys.includes(e.key)) next = (idx - 1 + items.length) % items.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = items.length - 1;
      if (next === null) return;
      e.preventDefault();
      items[next].focus();
      items[next].click();
    });
    // Exactly one tab stop per group.
    const items = [...group.querySelectorAll(selector)];
    if (items.length && !items.some((b) => b.tabIndex === 0 && b.getAttribute("tabindex") !== null)) {
      const current = items.find((b) => b.classList.contains("active") || b.getAttribute("aria-selected") === "true" || b.getAttribute("aria-checked") === "true") || items[0];
      items.forEach((b) => (b.tabIndex = b === current ? 0 : -1));
    }
  }

  SDUI.initRovingGroups = function (root = document) {
    root.querySelectorAll('[role="tablist"], [role="radiogroup"]').forEach((group) => {
      // The Appearance settings groups have their own handler (appearance.js).
      if (group._sdRoving || group.dataset.roving === "off" || group.closest("#appearanceSection")) return;
      group._sdRoving = true;
      initRoving(group);
    });
  };

  // ---------------------------------------------------------------
  // Chip (official HeroUI v3 CSS: .chip / .chip__label + modifiers)
  // color: default | accent | success | warning | danger
  // variant: "" (secondary, default) | primary | tertiary | soft
  // ---------------------------------------------------------------
  SDUI.chip = function (text, { color = "default", variant = "soft", size = "sm", className = "", title = "" } = {}) {
    const el = document.createElement("span");
    el.className = ["chip", `chip--${size}`, `chip--${color}`, variant ? `chip--${variant}` : "", className].filter(Boolean).join(" ");
    if (title) el.title = title;
    const label = document.createElement("span");
    label.className = "chip__label";
    label.textContent = text;
    el.appendChild(label);
    return el;
  };

  // Shared meaning for status colours across the app.
  SDUI.STATUS_COLOR = {
    submitted: "success",
    done: "success",
    pending: "accent",
    soon: "warning",
    draft: "warning",
    urgent: "danger",
    overdue: "danger",
    neutral: "default",
  };

  // ---------------------------------------------------------------
  // Modals
  // ---------------------------------------------------------------
  // Width classes (sd-modal--sm 28rem · md 32rem · lg 36rem · xl 44rem · 2xl 50rem)
  const MODAL_SIZE = {
    vuLoginDialog: "sm",
    pooyaDialog: "sm",
    onboardDialog: "md",
    pinDialog: "lg",
    classDialog: "lg",
    googleAppsDialog: "lg",
    researchHubDialog: "lg",
    aiHubDialog: "lg",
    ideaLabDialog: "2xl",
    notesDialog: "2xl",
  }; // everything else: xl (settings, course hub, focus, report, tour)

  function enhanceDialog(dialog) {
    if (dialog._sdEnhanced) return;
    dialog._sdEnhanced = true;
    dialog.classList.add("modal__dialog", "sd-modal", `sd-modal--${MODAL_SIZE[dialog.id] || "xl"}`);

    const panel = dialog.children.length === 1 ? dialog.firstElementChild : dialog;
    if (panel !== dialog) panel.classList.add("sd-modal__panel");
    const kids = [...panel.children];

    const header = kids.find((k) => k.matches("header, .dialog-header, .onboard-header"));
    if (header) {
      header.classList.add("modal__header", "sd-modal__header");
      const heading = header.querySelector("h1, h2, h3");
      if (heading) {
        heading.classList.add("modal__heading");
        if (!heading.id) heading.id = `${dialog.id || "dialog"}-title`;
        dialog.setAttribute("aria-labelledby", heading.id);
      }
      const close = header.querySelector('.dialog-close-btn, [id$="CloseBtn"], button[aria-label="بستن"]');
      if (close) {
        close.classList.add("close-button", "modal__close-trigger");
        if (!close.getAttribute("aria-label")) close.setAttribute("aria-label", "بستن");
      }
    }

    let start = header ? kids.indexOf(header) + 1 : 0;
    while (kids[start] && kids[start].matches('nav, [role="tablist"], .idea-lab-tabs, .focus-presets-bar, .course-hub-nav')) {
      kids[start].classList.add("sd-modal__subheader");
      start++;
    }
    let end = kids.length;
    const last = kids[kids.length - 1];
    if (last && last !== header && end - 1 >= start && /(^|\s)[\w-]*-actions(\s|$)/.test(last.className)) {
      last.classList.add("modal__footer", "sd-modal__footer");
      end = kids.length - 1;
    }
    const bodyKids = kids.slice(start, end);
    if (bodyKids.length) {
      const body = document.createElement("div");
      body.className = "modal__body modal__body--scroll-inside sd-modal__body";
      bodyKids[0].before(body);
      body.append(...bodyKids);
    }

    dialog.addEventListener("close", () => {
      const opener = dialog._sdOpener;
      dialog._sdOpener = null;
      if (opener && opener.isConnected && !opener.closest("dialog:not([open])")) {
        setTimeout(() => opener.focus({ preventScroll: true }), 0);
      }
    });
  }

  function isVisible(el) {
    return Boolean(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  }

  // Initial focus: an explicit [data-initial-focus] field, else the heading
  // (announces the dialog without jumping into a long form or onto "close").
  function focusInitial(dialog) {
    const target = [...dialog.querySelectorAll("[data-initial-focus]")].find((el) => !el.disabled && isVisible(el));
    if (target) return target.focus({ preventScroll: true });
    const heading = dialog.querySelector(".modal__heading");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      const body = dialog.querySelector(".sd-modal__body");
      if (body) body.scrollTop = 0;
    }
  }

  SDUI.enhanceDialogs = function (root = document) {
    root.querySelectorAll("dialog").forEach(enhanceDialog);
  };

  if (global.HTMLDialogElement && !HTMLDialogElement.prototype._sdPatched) {
    const nativeShowModal = HTMLDialogElement.prototype.showModal;
    HTMLDialogElement.prototype.showModal = function (...args) {
      const opener = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
      enhanceDialog(this);
      nativeShowModal.apply(this, args);
      this._sdOpener = opener;
      focusInitial(this);
    };
    HTMLDialogElement.prototype._sdPatched = true;
  }

  // ---------------------------------------------------------------
  // Form validation: inline Persian messages (.field-error, aria-invalid)
  // ---------------------------------------------------------------
  function persianMessage(field) {
    const v = field.validity;
    const tag = field.tagName;
    if (v.valueMissing) {
      if (field.type === "checkbox" || field.type === "radio") return "این گزینه را انتخاب کن.";
      if (tag === "SELECT") return "یک گزینه انتخاب کن.";
      if (field.type === "date") return "تاریخ را انتخاب کن.";
      return "این فیلد را پر کن.";
    }
    if (v.typeMismatch) {
      if (field.type === "url") return "یک نشانی معتبر وارد کن؛ مثلاً https://example.com";
      if (field.type === "email") return "یک ایمیل معتبر وارد کن.";
      return "قالب مقدار واردشده درست نیست.";
    }
    if (v.tooShort) return `دست‌کم ${field.minLength} نویسه لازم است.`;
    if (v.tooLong) return `حداکثر ${field.maxLength} نویسه مجاز است.`;
    if (v.rangeUnderflow) return `مقدار باید دست‌کم ${field.min} باشد.`;
    if (v.rangeOverflow) return `مقدار باید حداکثر ${field.max} باشد.`;
    if (v.patternMismatch) return field.title || "قالب مقدار واردشده درست نیست.";
    if (v.badInput) return "مقدار واردشده معتبر نیست.";
    return field.validationMessage || "مقدار واردشده معتبر نیست.";
  }

  let errorSeq = 0;
  function fieldContainer(field) {
    return field.closest(".form-group, .vu-field, .pp-field, .sd-field, .session-item .form-group") || field.parentElement;
  }

  SDUI.showFieldError = function (field, message) {
    const box = fieldContainer(field);
    let err = box.querySelector(":scope > .field-error");
    if (!err) {
      err = document.createElement("p");
      err.className = "field-error";
      err.id = `sd-err-${++errorSeq}`;
      box.appendChild(err);
    }
    err.textContent = message;
    err.setAttribute("data-visible", "true");
    box.setAttribute("data-invalid", "true");
    field.setAttribute("aria-invalid", "true");
    const ids = new Set((field.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
    ids.add(err.id);
    field.setAttribute("aria-describedby", [...ids].join(" "));
  };

  SDUI.clearFieldError = function (field) {
    const box = fieldContainer(field);
    const err = box && box.querySelector(":scope > .field-error");
    field.removeAttribute("aria-invalid");
    if (box) box.removeAttribute("data-invalid");
    if (err) {
      err.removeAttribute("data-visible");
      err.textContent = "";
    }
  };

  function enhanceForm(form) {
    if (form._sdValidation) return;
    form._sdValidation = true;
    let firstInvalid = null;
    form.addEventListener(
      "invalid",
      (e) => {
        const field = e.target;
        e.preventDefault(); // replace the browser bubble with an inline message
        SDUI.showFieldError(field, persianMessage(field));
        if (!firstInvalid) {
          firstInvalid = field;
          queueMicrotask(() => {
            const f = firstInvalid;
            firstInvalid = null;
            if (f && f.isConnected) (f._sdFocusTarget || f).focus(); // islands expose their visible control
          });
        }
      },
      true
    );
    const recheck = (e) => {
      const field = e.target;
      if (field.getAttribute && field.getAttribute("aria-invalid") === "true" && field.validity && field.validity.valid) {
        SDUI.clearFieldError(field);
      }
    };
    form.addEventListener("input", recheck);
    form.addEventListener("change", recheck);
  }

  SDUI.enhanceForms = function (root = document) {
    root.querySelectorAll("form").forEach(enhanceForm);
  };

  // ---------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------
  function boot() {
    SDUI.enhanceDialogs();
    SDUI.enhanceForms();
    SDUI.initRovingGroups();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  global.SDUI = SDUI;
})(window);
