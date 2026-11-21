// Offscreen document: runs VU syncs for the service worker (which has no DOMParser).
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== "offscreen" || message.action !== "VU_SYNC_OFFSCREEN") return false;
  VU.syncAll({ force: Boolean(message.force) })
    .then((data) => sendResponse({
      ok: true,
      count: data.items.length,
      warning: data.syncWarnings?.length
        ? "دریافت اطلاعات بعضی درس‌ها کامل نشد. اطلاعات قبلی آن‌ها حفظ شد. دوباره همگام‌سازی کن."
        : "",
    }))
    .catch((err) => sendResponse({ ok: false, code: err.code || "UNKNOWN", error: VU.errorMessage(err) }));
  return true;
});
