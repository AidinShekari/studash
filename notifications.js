// ===============================================================
// StuDash Modular Notification Hub
// Extensible notification manager supporting:
// - "grade": Pooya grade alerts
// - "food": Weekly dining hall reservation reminder
// - "vu": Assignment & quiz reminders
// - "exam": University exam reminders
// - "system": General announcements
// ===============================================================
(function (global) {
  const STORAGE_KEY = "studashNotifications";
  const MAX_HISTORY = 60;

  const ICONS = {
    grade: "🎓",
    food: "🍱",
    vu: "📚",
    exam: "📅",
    task: "✅",
    weather: "❄️",
    system: "ℹ️",
  };

  const TYPE_NAMES = {
    grade: "نمره پویا",
    food: "رزرو غذا",
    vu: "تکلیف دانشگاه",
    exam: "امتحان",
    task: "تسک روزانه",
    weather: "هوشمند هواشناسی",
    system: "سیستم",
  };

  async function getAll() {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEY);
      if (Array.isArray(data[STORAGE_KEY])) return data[STORAGE_KEY];

      // Initial welcome & food reminder notification on first run
      const initial = [
        {
          id: "welcome_food_reminder",
          type: "food",
          title: "یادآوری هفتگی: رزرو غذای سلف دانشگاه 🍱",
          message: "مرکز اعلان‌ها فعال شد! پنجشنبه‌های هر هفته ساعت ۹ تا ۱۰ صبح یادآوری رزرو غذای هفته آینده و اعلان نمرات جدید پویا در این بخش ثبت می‌شود.",
          icon: "🍱",
          typeName: "رزرو غذا",
          url: "https://pooya.um.ac.ir",
          timestamp: Date.now(),
          read: false,
        },
      ];
      await chrome.storage.local.set({ [STORAGE_KEY]: initial });
      return initial;
    } catch (e) {
      console.error("[Notifications] getAll error:", e);
      return [];
    }
  }

  async function saveAll(list) {
    try {
      const trimmed = list.slice(0, MAX_HISTORY);
      await chrome.storage.local.set({ [STORAGE_KEY]: trimmed });
      broadcastUpdate();
      return trimmed;
    } catch (e) {
      console.error("[Notifications] saveAll error:", e);
      return list;
    }
  }

  function broadcastUpdate() {
    try {
      chrome.runtime.sendMessage({ action: "STUDASH_NOTIFICATIONS_UPDATED" }).catch(() => {});
    } catch (e) {}
  }

  async function getUnreadCount() {
    const list = await getAll();
    return list.filter((n) => !n.read).length;
  }

  async function add(notif, { notify = true } = {}) {
    if (!notif || !notif.title) return null;
    const list = await getAll();

    const id = notif.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    // Avoid exact duplicate ID
    const existingIndex = list.findIndex((n) => n.id === id);
    if (existingIndex !== -1) {
      return list[existingIndex];
    }

    const item = {
      id,
      type: notif.type || "system",
      title: notif.title,
      message: notif.message || "",
      icon: notif.icon || ICONS[notif.type] || "🔔",
      typeName: TYPE_NAMES[notif.type] || "اعلان",
      url: notif.url || "",
      meta: notif.meta || null,
      timestamp: notif.timestamp || Date.now(),
      read: false,
    };

    list.unshift(item);
    await saveAll(list);

    // Trigger Chrome Desktop Notification if enabled and running in extension environment
    if (notify && typeof chrome !== "undefined" && chrome.notifications) {
      try {
        chrome.notifications.create(id, {
          type: "basic",
          iconUrl: chrome.runtime.getURL ? chrome.runtime.getURL("icons/icon128.png") : "icons/icon128.png",
          title: item.title,
          message: item.message,
          priority: 2,
        });
      } catch (err) {
        console.warn("[Notifications] Desktop notification failed:", err);
      }
    }

    return item;
  }

  async function markAsRead(id) {
    const list = await getAll();
    let changed = false;
    list.forEach((n) => {
      if (n.id === id && !n.read) {
        n.read = true;
        changed = true;
      }
    });
    if (changed) {
      await saveAll(list);
    }
    return list;
  }

  async function markAllAsRead() {
    const list = await getAll();
    let changed = false;
    list.forEach((n) => {
      if (!n.read) {
        n.read = true;
        changed = true;
      }
    });
    if (changed) {
      await saveAll(list);
    }
    return list;
  }

  async function remove(id) {
    const list = await getAll();
    const filtered = list.filter((n) => n.id !== id);
    if (filtered.length !== list.length) {
      await saveAll(filtered);
    }
    return filtered;
  }

  async function clearAll() {
    await saveAll([]);
    return [];
  }

  global.StudashNotifications = {
    getAll,
    getUnreadCount,
    add,
    markAsRead,
    markAllAsRead,
    remove,
    clearAll,
    ICONS,
    TYPE_NAMES,
  };
})(typeof self !== "undefined" ? self : window);
