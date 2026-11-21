(function () {
  const list = document.getElementById("updatesList");
  const status = document.getElementById("updatesStatus");
  const button = document.getElementById("updatesRefreshBtn");
  if (!list || !status || !button) return;
  let busy = false;

  function render(items) {
    const fragment = document.createDocumentFragment();
    for (const item of items) {
      const row = document.createElement("li");
      row.className = "updates-item";
      const title = document.createElement("h3");
      title.textContent = item.title;
      const date = document.createElement("time");
      date.dateTime = item.date;
      date.textContent = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" })
        .format(new Date(item.date + "T12:00:00"));
      const body = document.createElement("p");
      body.textContent = item.body;
      row.append(title, date, body);
      fragment.append(row);
    }
    list.replaceChildren(fragment);
  }

  async function refresh(force = false) {
    if (busy) return;
    busy = true;
    button.disabled = true;
    status.textContent = "در حال دریافت آخرین آپدیت‌ها…";
    try {
      const result = await chrome.runtime.sendMessage({ action: "GET_STUDASH_UPDATES", force });
      if (result?.items?.length || (!result?.stale && Array.isArray(result?.items))) render(result.items);
      status.textContent = result?.stale
        ? "دریافت از گیت‌هاب انجام نشد. آخرین اعلان‌های ذخیره‌شده نمایش داده می‌شوند."
        : result?.items?.length ? "آخرین اطلاعیه‌های تیم StuDash از گیت‌هاب" : "هنوز اطلاعیه‌ای منتشر نشده است.";
    } catch {
      status.textContent = "دریافت از گیت‌هاب انجام نشد. برای دریافت دوباره، به‌روزرسانی را بزن.";
    } finally {
      button.disabled = false;
      busy = false;
    }
  }

  button.addEventListener("click", () => refresh(true));
  (async () => {
    try {
      const response = await fetch(chrome.runtime.getURL("data/announcements.json"));
      const data = await response.json();
      render(data.announcements.slice(0, 6));
    } catch { /* The remote cache can still supply announcements. */ }
    await refresh();
  })();
})();
