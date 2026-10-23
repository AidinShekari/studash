// Browser tests for ui-kit.js (modals, roving groups, validation). Run: npm run test:browser
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); }
  catch (e) { results.push({ name, ok: false, error: String(e && e.message || e) }); }
}
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || ""} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
const key = (el, k) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

(async () => {
  // Focus is only reliable once the document has loaded.
  if (document.readyState !== "complete") await new Promise((r) => addEventListener("load", r, { once: true }));
  await sleep(50);

  await test("setSelected mirrors state to ARIA and roving tabindex", () => {
    const items = document.querySelectorAll("#group [role=radio]");
    SDUI.setSelected(items, (b) => b.dataset.v === "b");
    eq(items[1].getAttribute("aria-checked"), "true");
    eq(items[0].getAttribute("aria-checked"), "false");
    eq(items[1].tabIndex, 0); eq(items[0].tabIndex, -1);
    eq(items[1].classList.contains("active"), true);
  });

  await test("radiogroup arrows are mirrored in RTL and activate", () => {
    const items = [...document.querySelectorAll("#group [role=radio]")];
    let clicked = null;
    items.forEach((b) => b.addEventListener("click", () => { clicked = b.dataset.v; SDUI.setSelected(items, (x) => x === b); }));
    items[1].focus();
    eq(document.activeElement, items[1], "precondition");
    key(items[1], "ArrowLeft"); // RTL: left = next
    eq(document.activeElement, items[2], "focus"); eq(clicked, "c");
    key(items[2], "Home");
    eq(clicked, "a");
  });

  await test("modal gets official HeroUI structure and an accessible name", () => {
    const d = document.getElementById("d1");
    SDUI.enhanceDialogs();
    ["modal__dialog", "sd-modal"].forEach((c) => eq(d.classList.contains(c), true, c));
    eq(!!d.querySelector(".modal__header .modal__heading"), true, "heading");
    eq(!!d.querySelector(".modal__body #name"), true, "body wraps fields");
    eq(!!d.querySelector(".modal__footer .primary-btn"), true, "footer");
    eq(!!d.querySelector(".modal__close-trigger.close-button"), true, "close");
    eq(document.getElementById(d.getAttribute("aria-labelledby")).textContent, "عنوان مودال");
  });

  await test("initial focus: [data-initial-focus] field, else the heading; focus returns to opener", async () => {
    const opener = document.getElementById("opener");
    opener.focus();
    const d1 = document.getElementById("d1");
    d1.showModal();
    eq(document.activeElement.id, "name", "form dialog");
    d1.close();
    await sleep(20);
    eq(document.activeElement, opener, "return focus");
    opener.focus();
    const d2 = document.getElementById("d2");
    d2.showModal();
    eq(document.activeElement.classList.contains("modal__heading"), true, "heading focus");
    d2.close();
    await sleep(20);
    eq(document.activeElement, opener, "return focus 2");
  });

  await test("validation shows inline Persian messages and clears on input", async () => {
    const d1 = document.getElementById("d1");
    d1.showModal();
    const name = document.getElementById("name");
    const url = document.getElementById("url");
    url.value = "not a url";
    document.getElementById("f1").requestSubmit();
    await sleep(20);
    eq(d1.open, true, "dialog stays open");
    eq(name.getAttribute("aria-invalid"), "true");
    const err = document.getElementById(name.getAttribute("aria-describedby").split(" ").pop());
    eq(err.classList.contains("field-error"), true); eq(err.textContent, "این فیلد را پر کن.");
    eq(document.getElementById(url.getAttribute("aria-describedby").split(" ").pop()).textContent.startsWith("یک نشانی معتبر"), true, "url message");
    eq(document.activeElement, name, "focus first invalid");
    name.value = "ریاضی"; name.dispatchEvent(new Event("input", { bubbles: true }));
    eq(name.hasAttribute("aria-invalid"), false, "cleared");
    d1.close();
  });

  await test("chip helper renders official markup", () => {
    const c = SDUI.chip("ارسال شده", { color: "success" });
    eq(c.className, "chip chip--sm chip--success chip--soft");
    eq(c.querySelector(".chip__label").textContent, "ارسال شده");
  });

  await test("StudashDate works in the page context", () => {
    eq(StudashDate.formatJalali(new Date(2025, 2, 20)), "پنجشنبه ۳۰ اسفند ۱۴۰۳");
  });

  document.getElementById("results").textContent = JSON.stringify(results);
  document.body.setAttribute("data-done", "true");
})();
