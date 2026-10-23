// ===============================================================
// StuDash React island — the smallest React surface needed to use the
// official interactive HeroUI v3 components that have no CSS-only form:
//
//   • <Select>      (React Aria listbox: keyboard, typeahead, popover)
//   • <DatePicker>  (React Aria calendar, shown in the Persian calendar)
//
// Everything else in StuDash stays plain HTML + HeroUI CSS classes.
//
// Progressive enhancement: the native <select> / <input type="date"> stays
// in the DOM (visually hidden) as the single source of truth. app.js keeps
// reading .value and listening for "change" exactly as before; this bridge
// mirrors the value both ways, so no stored data or event flow changes.
// Dates are stored as Gregorian ISO "YYYY-MM-DD" (unchanged); only the
// display is Persian (React Aria returns values in the calendar of `value`).
//
// Built with esbuild into islands/islands.js (local file, MV3-safe: no
// remote code, no eval).
// ===============================================================
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Calendar, DateField, DatePicker, Label, ListBox, Select } from "@heroui/react";
import { I18nProvider } from "react-aria-components";
import { UNSAFE_PortalProvider } from "react-aria";
import { parseDate } from "@internationalized/date";

const LOCALE = "fa-IR-u-ca-persian";
const EMPTY_KEY = "__sd_empty__"; // React Aria keys can't be ""

// ---------------------------------------------------------------
// Native element bridge helpers
// ---------------------------------------------------------------
const SELECT_VALUE = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
const SELECT_INDEX = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "selectedIndex");
const INPUT_VALUE = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");

// Programmatic writes (e.g. `select.value = x` in app.js) don't fire events;
// wrap the instance property so the visible component follows them.
function watchValue(el, descriptors) {
  for (const [prop, desc] of descriptors) {
    Object.defineProperty(el, prop, {
      configurable: true,
      get() {
        return desc.get.call(this);
      },
      set(v) {
        desc.set.call(this, v);
        this.dispatchEvent(new CustomEvent("sd:value"));
      },
    });
  }
}

function commitNative(el, desc, value) {
  if (desc.get.call(el) === value) return;
  desc.set.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

// Visible label text for a native control (without the control's own text).
function labelFor(el) {
  if (el.getAttribute("aria-label")) return { text: el.getAttribute("aria-label"), node: null };
  const label = el.labels && el.labels[0];
  if (!label) return { text: el.dataset.placeholder || "", node: null };
  if (!label.contains(el)) return { text: label.textContent.trim(), node: label };
  const part = label.querySelector(":scope > span, :scope > .label") || null;
  return { text: (part ? part.textContent : label.textContent).trim(), node: part, wrapper: label };
}

function useNativeSnapshot(el, read) {
  const [snap, setSnap] = useState(() => read(el));
  useEffect(() => {
    const update = () => setSnap(read(el));
    const mo = new MutationObserver(update);
    mo.observe(el, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["disabled", "required", "aria-invalid"] });
    el.addEventListener("change", update);
    el.addEventListener("sd:value", update);
    return () => {
      mo.disconnect();
      el.removeEventListener("change", update);
      el.removeEventListener("sd:value", update);
    };
  }, [el]);
  return snap;
}

// Clicking a wrapping <label> would focus the hidden native control; send it to the trigger.
function useLabelRedirect(label, triggerRef) {
  useEffect(() => {
    if (!label) return undefined;
    const onClick = (e) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target) && !e.target.closest("[data-sd-island]")) {
        e.preventDefault();
        triggerRef.current.focus();
      }
    };
    label.addEventListener("click", onClick);
    return () => label.removeEventListener("click", onClick);
  }, [label, triggerRef]);
}

function Providers({ host, children }) {
  // Inside a modal <dialog>, popovers must live in the dialog (the rest of the page is inert).
  const getContainer = () => host.closest("dialog") || document.body;
  return (
    <I18nProvider locale={LOCALE}>
      <UNSAFE_PortalProvider getContainer={getContainer}>{children}</UNSAFE_PortalProvider>
    </I18nProvider>
  );
}

// ---------------------------------------------------------------
// Select
// ---------------------------------------------------------------
function readSelect(select) {
  const options = [...select.options].map((o) => ({
    id: o.value === "" ? EMPTY_KEY : o.value,
    text: o.textContent.trim(),
    disabled: o.disabled,
  }));
  const value = SELECT_VALUE.get.call(select);
  return {
    options,
    value: value === "" ? (options.some((o) => o.id === EMPTY_KEY) ? EMPTY_KEY : null) : value,
    disabled: select.disabled,
    required: select.required,
    invalid: select.getAttribute("aria-invalid") === "true",
    disabledKeys: options.filter((o) => o.disabled).map((o) => o.id),
  };
}

function SelectBridge({ select, host }) {
  const snap = useNativeSnapshot(select, readSelect);
  const triggerRef = useRef(null);
  const { text: labelText, node: labelNode, wrapper } = labelFor(select);
  useLabelRedirect(wrapper || labelNode, triggerRef);
  useEffect(() => {
    select._sdFocusTarget = triggerRef.current; // ui-kit.js focuses this for validation errors
  });
  const labelledBy = labelNode ? (labelNode.id || (labelNode.id = `sd-lbl-${Math.random().toString(36).slice(2, 8)}`)) : undefined;

  return (
    <Providers host={host}>
      <Select
        fullWidth
        variant={host.closest("dialog") ? "secondary" : "primary"}
        aria-label={labelledBy ? undefined : labelText || "انتخاب"}
        aria-labelledby={labelledBy}
        placeholder={select.dataset.placeholder || "انتخاب کنید"}
        value={snap.value}
        onChange={(key) => commitNative(select, SELECT_VALUE, key === EMPTY_KEY || key == null ? "" : String(key))}
        isDisabled={snap.disabled}
        isRequired={snap.required}
        isInvalid={snap.invalid}
        disabledKeys={snap.disabledKeys}
      >
        <Select.Trigger ref={triggerRef}>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox items={snap.options}>
            {(item) => (
              <ListBox.Item id={item.id} textValue={item.text}>
                {item.text}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            )}
          </ListBox>
        </Select.Popover>
      </Select>
    </Providers>
  );
}

// ---------------------------------------------------------------
// DatePicker (Persian calendar display, Gregorian ISO storage)
// ---------------------------------------------------------------
function readDate(input) {
  const raw = INPUT_VALUE.get.call(input);
  let value = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    try {
      value = parseDate(raw);
    } catch (e) {
      value = null; // malformed stored value: show empty rather than a wrong date
    }
  }
  return {
    value,
    disabled: input.disabled,
    required: input.required,
    invalid: input.getAttribute("aria-invalid") === "true",
  };
}

function DateBridge({ input, host }) {
  const snap = useNativeSnapshot(input, readDate);
  const groupRef = useRef(null);
  const { text: labelText, node: labelNode, wrapper } = labelFor(input);
  useLabelRedirect(wrapper || labelNode, groupRef);
  useEffect(() => {
    const first = groupRef.current && groupRef.current.querySelector('[role="spinbutton"]');
    input._sdFocusTarget = first || groupRef.current;
  });
  const labelledBy = labelNode ? (labelNode.id || (labelNode.id = `sd-lbl-${Math.random().toString(36).slice(2, 8)}`)) : undefined;

  return (
    <Providers host={host}>
      <DatePicker
        aria-label={labelledBy ? undefined : labelText || input.title || "تاریخ"}
        aria-labelledby={labelledBy}
        value={snap.value}
        onChange={(date) => commitNative(input, INPUT_VALUE, date ? date.toString() : "")}
        isDisabled={snap.disabled}
        isRequired={snap.required}
        isInvalid={snap.invalid}
      >
        <DateField.Group fullWidth ref={groupRef}>
          <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
          <DateField.Suffix>
            <DatePicker.Trigger aria-label="باز کردن تقویم">
              <DatePicker.TriggerIndicator />
            </DatePicker.Trigger>
          </DateField.Suffix>
        </DateField.Group>
        <DatePicker.Popover>
          <Calendar aria-label={labelText || "تقویم"}>
            <Calendar.Header>
              <Calendar.YearPickerTrigger>
                <Calendar.YearPickerTriggerHeading />
                <Calendar.YearPickerTriggerIndicator />
              </Calendar.YearPickerTrigger>
              <Calendar.NavButton slot="previous" />
              <Calendar.NavButton slot="next" />
            </Calendar.Header>
            <Calendar.Grid>
              <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
              <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
            </Calendar.Grid>
            <Calendar.YearPickerGrid>
              <Calendar.YearPickerGridBody>{({ year }) => <Calendar.YearPickerCell year={year} />}</Calendar.YearPickerGridBody>
            </Calendar.YearPickerGrid>
          </Calendar>
        </DatePicker.Popover>
      </DatePicker>
    </Providers>
  );
}

// ---------------------------------------------------------------
// Mounting
// ---------------------------------------------------------------
function mount(el) {
  // Skip React Aria's own hidden form controls rendered inside an island.
  if (el._sdIsland || el.dataset.native !== undefined || el.closest("[data-sd-island]")) return;
  el._sdIsland = true;
  const isSelect = el.tagName === "SELECT";
  watchValue(el, isSelect ? [["value", SELECT_VALUE], ["selectedIndex", SELECT_INDEX]] : [["value", INPUT_VALUE]]);

  const host = document.createElement("div");
  host.className = `sd-island ${isSelect ? "sd-island--select" : "sd-island--date"}`;
  host.setAttribute("data-sd-island", "");
  el.after(host);
  el.classList.add("sd-native-hidden");
  el.setAttribute("aria-hidden", "true");
  el.tabIndex = -1;

  createRoot(host).render(isSelect ? <SelectBridge select={el} host={host} /> : <DateBridge input={el} host={host} />);
}

const TARGETS = 'select:not([data-native]), input[type="date"]:not([data-native])';

function enhanceAll(root = document) {
  if (root.matches && root.matches(TARGETS)) mount(root);
  root.querySelectorAll && root.querySelectorAll(TARGETS).forEach(mount);
}

enhanceAll();
new MutationObserver((records) => {
  for (const r of records) r.addedNodes.forEach((n) => n.nodeType === 1 && enhanceAll(n));
}).observe(document.body, { childList: true, subtree: true });

window.StudashIslands = { enhanceAll };
