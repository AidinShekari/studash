// Public announcements are maintained in AidinShekari/studash-updates.
(function (root) {
  const SOURCE = "https://raw.githubusercontent.com/AidinShekari/studash-updates/main/announcements.json";
  const CACHE_KEY = "studashAnnouncements";
  const CACHE_AGE = 30 * 60 * 1000;
  let pending = null;

  function normalize(data) {
    if (!Array.isArray(data?.announcements)) throw new Error("Invalid announcement feed");
    const seen = new Set();
    return data.announcements.slice(0, 50).filter(item => {
      if (!item || typeof item.id !== "string" || !item.id || seen.has(item.id)
        || typeof item.title !== "string" || !item.title.trim()
        || typeof item.body !== "string"
        || !/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !Number.isFinite(Date.parse(item.date))) return false;
      seen.add(item.id);
      return true;
    }).map(item => ({
      id: item.id.slice(0, 100),
      title: item.title.slice(0, 160),
      body: item.body.slice(0, 2000),
      date: item.date,
    })).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  }

  function get(force = false) {
    if (pending) return pending;
    pending = (async () => {
      const stored = await chrome.storage.local.get(CACHE_KEY);
      const cache = stored[CACHE_KEY];
      if (!force && cache?.source === SOURCE && Date.now() - cache.checkedAt < CACHE_AGE) return { ...cache, stale: false };
      try {
        const response = await fetch(SOURCE, { cache: "no-store", credentials: "omit", signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error("Announcement feed unavailable");
        const text = await response.text();
        if (text.length > 100000) throw new Error("Announcement feed too large");
        const items = normalize(JSON.parse(text));
        const result = { source: SOURCE, items, checkedAt: Date.now() };
        await chrome.storage.local.set({ [CACHE_KEY]: result });
        return { ...result, stale: false };
      } catch {
        return { items: cache?.items || [], checkedAt: cache?.checkedAt || null, stale: true };
      }
    })().finally(() => { pending = null; });
    return pending;
  }

  root.StudashUpdates = { normalize, get };
})(globalThis);
