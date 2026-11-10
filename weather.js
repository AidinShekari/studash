// ===============================================================
// StuDash Smart Weather & Clothing Advisor
// Powered by Open-Meteo API (Free, Reliable, No API Key Required)
// Provides:
// - Real-time weather for Mashhad (Ferdowsi University) & Iranian cities
// - Morning advice: Is it cold or warm today? What to wear for campus?
// - Late night advice: Forecast for tomorrow (Snow, freezing, rain alerts)
// ===============================================================

(function (global) {
  const STORAGE_KEY = "studashWeatherData";
  const SETTINGS_KEY = "studashWeatherSettings";
  const CACHE_TTL_MS = 35 * 60 * 1000; // 35 minutes cache

  const DEFAULT_SETTINGS = {
    enabled: true,
    cityId: "mashhad",
    cityName: "مشهد (دانشگاه فردوسی)",
    lat: 36.2972,
    lon: 59.6067,
    notifyOnSevere: true
  };

  const CITIES = [
    { id: "mashhad", name: "مشهد (دانشگاه فردوسی)", lat: 36.2972, lon: 59.6067 },
    { id: "tehran", name: "تهران", lat: 35.6892, lon: 51.3890 },
    { id: "isfahan", name: "اصفهان", lat: 32.6546, lon: 51.6680 },
    { id: "shiraz", name: "شیراز", lat: 29.5918, lon: 52.5837 },
    { id: "tabriz", name: "تبریز", lat: 38.0800, lon: 46.2919 },
    { id: "ahvaz", name: "اهواز", lat: 31.3183, lon: 48.6706 },
    { id: "karaj", name: "کرج", lat: 35.8400, lon: 50.9391 },
    { id: "rasht", name: "رشت", lat: 37.2809, lon: 49.5832 },
    { id: "qazvin", name: "قزوین", lat: 36.2797, lon: 50.0049 },
    { id: "kerman", name: "کرمان", lat: 30.2839, lon: 57.0834 },
    { id: "yazd", name: "یزد", lat: 31.8974, lon: 54.3569 },
    { id: "sari", name: "ساری", lat: 36.5659, lon: 53.0586 },
    { id: "urmia", name: "ارومیه", lat: 37.5527, lon: 45.0761 },
    { id: "hamadan", name: "همدان", lat: 34.7983, lon: 48.5146 },
    { id: "qom", name: "قم", lat: 34.6401, lon: 50.8764 },
    { id: "kermanshah", name: "کرمانشاه", lat: 34.3277, lon: 47.0778 },
    { id: "gorgan", name: "گرگان", lat: 36.8430, lon: 54.4339 },
    { id: "birjand", name: "بیرجند", lat: 32.8663, lon: 59.2211 },
    { id: "bojnurd", name: "بجنورد", lat: 37.4747, lon: 57.3290 },
    { id: "ardabil", name: "اردبیل", lat: 38.2498, lon: 48.2933 },
    { id: "zahedan", name: "زاهدان", lat: 29.4963, lon: 60.8629 },
    { id: "bandar_abbas", name: "بندرعباس", lat: 27.1832, lon: 56.2666 },
    { id: "bushehr", name: "بوشهر", lat: 28.9234, lon: 50.8203 }
  ];

  function toPersianDigits(n) {
    if (n === null || n === undefined) return "";
    const p = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
    return String(n).replace(/\d/g, d => p[d]);
  }

  function getWeatherDesc(code) {
    if (code === 0) return { label: "صاف و آفتابی", icon: "☀️" };
    if (code === 1 || code === 2) return { label: "کمی تا قسمتی ابری", icon: "🌤️" };
    if (code === 3) return { label: "ابری", icon: "☁️" };
    if (code === 45 || code === 48) return { label: "مه‌آلود", icon: "🌫️" };
    if (code >= 51 && code <= 55) return { label: "نم‌نم باران", icon: "🌦️" };
    if (code >= 61 && code <= 65) return { label: "بارانی", icon: "🌧️" };
    if (code === 66 || code === 67) return { label: "باران و یخ‌زدگی", icon: "🌧️❄️" };
    if (code >= 71 && code <= 77) return { label: "بارش برف", icon: "🌨️" };
    if (code >= 80 && code <= 82) return { label: "رگبار باران", icon: "🌧️" };
    if (code === 85 || code === 86) return { label: "رگبار برف", icon: "🌨️" };
    if (code >= 95) return { label: "رعد و برق", icon: "⛈️" };
    return { label: "نیمه‌ابری", icon: "⛅" };
  }

  async function getSettings() {
    try {
      const data = await chrome.storage.local.get(SETTINGS_KEY);
      return Object.assign({}, DEFAULT_SETTINGS, data[SETTINGS_KEY] || {});
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  async function saveSettings(newSettings) {
    const merged = Object.assign({}, await getSettings(), newSettings);
    await chrome.storage.local.set({ [SETTINGS_KEY]: merged });
    // Invalidate weather cache on city change
    await chrome.storage.local.remove(STORAGE_KEY);
    return merged;
  }

  async function fetchWeather(forceRefresh = false) {
    const settings = await getSettings();
    if (!settings.enabled) return null;

    try {
      if (!forceRefresh) {
        const cached = await chrome.storage.local.get(STORAGE_KEY);
        if (cached && cached[STORAGE_KEY]) {
          const entry = cached[STORAGE_KEY];
          const isSameCity = entry.cityId === settings.cityId;
          const isFresh = Date.now() - (entry.timestamp || 0) < CACHE_TTL_MS;
          if (isSameCity && isFresh && entry.data) {
            return entry.data;
          }
        }
      }

      const url = `https://api.open-meteo.com/v1/forecast?latitude=${settings.lat}&longitude=${settings.lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,snowfall_sum&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
      const json = await res.json();

      const enriched = {
        city: settings.cityName,
        cityId: settings.cityId,
        fetchedAt: Date.now(),
        current: {
          temp: Math.round(json.current.temperature_2m),
          apparent: Math.round(json.current.apparent_temperature),
          code: json.current.weather_code,
          wind: Math.round(json.current.wind_speed_10m),
          humidity: Math.round(json.current.relative_humidity_2m),
          desc: getWeatherDesc(json.current.weather_code)
        },
        today: {
          max: Math.round(json.daily.temperature_2m_max[0]),
          min: Math.round(json.daily.temperature_2m_min[0]),
          code: json.daily.weather_code[0],
          rainProb: json.daily.precipitation_probability_max[0] || 0,
          snowSum: json.daily.snowfall_sum[0] || 0,
          desc: getWeatherDesc(json.daily.weather_code[0])
        },
        tomorrow: {
          max: Math.round(json.daily.temperature_2m_max[1]),
          min: Math.round(json.daily.temperature_2m_min[1]),
          code: json.daily.weather_code[1],
          rainProb: json.daily.precipitation_probability_max[1] || 0,
          snowSum: json.daily.snowfall_sum[1] || 0,
          desc: getWeatherDesc(json.daily.weather_code[1])
        }
      };

      await chrome.storage.local.set({
        [STORAGE_KEY]: {
          timestamp: Date.now(),
          cityId: settings.cityId,
          data: enriched
        }
      });

      return enriched;
    } catch (err) {
      console.warn("[StuDash Weather] Error fetching weather:", err);
      // Return cached data if available even if stale
      const fallback = await chrome.storage.local.get(STORAGE_KEY);
      return fallback && fallback[STORAGE_KEY] ? fallback[STORAGE_KEY].data : null;
    }
  }

  // Generates smart clothing & campus advice
  function getAdvice(weather, currentHour = new Date().getHours()) {
    if (!weather) return null;

    const city = weather.city ? weather.city.split(" ")[0] : "مشهد";
    const cur = weather.current;
    const tmw = weather.tomorrow;
    const tday = weather.today;

    // Is it Evening / Late Night? (Hour 18:00 to 05:00)
    // Focus on TOMORROW'S forecast and preparation
    const isNight = currentHour >= 18 || currentHour < 5;

    if (isNight) {
      const isTmwSnow = tmw.snowSum > 0 || (tmw.code >= 71 && tmw.code <= 77) || tmw.code === 85 || tmw.code === 86;
      const isTmwRain = tmw.rainProb >= 40 || (tmw.code >= 51 && tmw.code <= 67) || (tmw.code >= 80 && tmw.code <= 82);
      const isTmwFreezing = tmw.min <= 2;
      const tempDrop = tday.max - tmw.max;

      if (isTmwSnow) {
        return {
          mode: "night",
          icon: "🌨️",
          badge: `فردا برفیه (${toPersianDigits(tmw.min)}° تا ${toPersianDigits(tmw.max)}°)`,
          title: "پیش‌بینی برف برای فردا!",
          advice: `فردا در ${city} برف می‌باره! ❄️ از امشب بوت و لباس‌های خیلی گرمت رو برای رفتن به دانشگاه آماده کن.`,
          isSevere: true,
          alertType: "snow"
        };
      }

      if (isTmwRain) {
        return {
          mode: "night",
          icon: "🌧️",
          badge: `فردا بارونیه (${toPersianDigits(tmw.rainProb)}٪ بارش)`,
          title: "احتمال باران فردا",
          advice: `فردا احتمال بارندگی زیاده (${toPersianDigits(tmw.rainProb)}٪) ☔ حتماً چتر و بارونی‌ات رو دم دست بذار.`,
          isSevere: true,
          alertType: "rain"
        };
      }

      if (isTmwFreezing) {
        return {
          mode: "night",
          icon: "🧣",
          badge: `فردا خیلی سرده (حداقل ${toPersianDigits(tmw.min)}°)`,
          title: "سرمای شدید صبح فردا",
          advice: `فردا صبح هوا خیلی سرده (حداقل ${toPersianDigits(tmw.min)}°) ☕ برای رفتن به دانشگاه حتماً کاپشن گرم و شال‌گردن بپوش.`,
          isSevere: true,
          alertType: "cold"
        };
      }

      if (tempDrop >= 5) {
        return {
          mode: "night",
          icon: "📉",
          badge: `افت دما (${toPersianDigits(tempDrop)}° سردتر)`,
          title: "افت محسوس دما برای فردا",
          advice: `فردا هوا حدود ${toPersianDigits(tempDrop)} درجه سردتر از امروز میشه 🧥 لباس گرم‌تری برای فردا در نظر بگیر.`,
          isSevere: false,
          alertType: "temp_drop"
        };
      }

      if (tmw.max >= 28) {
        return {
          mode: "night",
          icon: "☀️",
          badge: `فردا گرمه (حداکثر ${toPersianDigits(tmw.max)}°)`,
          title: "هوای گرم فردا",
          advice: `پیش‌بینی فردا: هوای گرم و آفتابی (حداکثر ${toPersianDigits(tmw.max)}°) 🕶️ لباس خنک انتخاب کن.`,
          isSevere: false,
          alertType: "warm"
        };
      }

      // Default pleasant night forecast
      return {
        mode: "night",
        icon: tmw.desc.icon || "🌙",
        badge: `${city}: فردا ${toPersianDigits(tmw.min)}° تا ${toPersianDigits(tmw.max)}°`,
        title: "پیش‌بینی هوای فردا",
        advice: `پیش‌بینی هوای فردای دانشگاه: ${tmw.desc.label} (دمای ${toPersianDigits(tmw.min)}° تا ${toPersianDigits(tmw.max)}°) 🌿 شب آرامی داشته باشی.`,
        isSevere: false,
        alertType: "normal"
      };
    }

    // DAYTIME & MORNING (05:00 to 18:00)
    // Focus on CURRENT weather & today's advice for campus
    const isCurSnow = (cur.code >= 71 && cur.code <= 77) || cur.code === 85 || cur.code === 86;
    const isCurRain = (cur.code >= 51 && cur.code <= 67) || (cur.code >= 80 && cur.code <= 82);
    const isCold = cur.temp <= 5 || cur.apparent <= 4;
    const isCool = cur.temp >= 6 && cur.temp <= 14;
    const isPleasant = cur.temp >= 15 && cur.temp <= 24;
    const isWarm = cur.temp >= 25;

    if (isCurSnow) {
      return {
        mode: "day",
        icon: "🌨️",
        badge: `برف در حال بارش (${toPersianDigits(cur.temp)}°)`,
        title: "برف در محوطه دانشگاه!",
        advice: `الان در ${city} برف می‌باره! ❄️ کفش مناسب بپوش و در رفت‌وآمد محوطه دانشگاه با احتیاط حرکت کن.`,
        isSevere: true,
        alertType: "snow"
      };
    }

    if (isCurRain) {
      return {
        mode: "day",
        icon: "🌧️",
        badge: `الان بارونیه (${toPersianDigits(cur.temp)}°)`,
        title: "هوای بارانی",
        advice: `هوای الان بارونیه 🌧️ حتماً چتر همراهت باشه تا در محوطه خیس نشی.`,
        isSevere: true,
        alertType: "rain"
      };
    }

    if (isCold) {
      return {
        mode: "day",
        icon: "❄️",
        badge: `هوای سرد (${toPersianDigits(cur.temp)}°، حسی ${toPersianDigits(cur.apparent)}°)`,
        title: "هوای سرد زمستانی",
        advice: `هوای امروز ${city} سرده (${toPersianDigits(cur.temp)}°، دمای حسی ${toPersianDigits(cur.apparent)}°) 🧣 کاپشن گرم و شال‌گردن یادت نره!`,
        isSevere: false,
        alertType: "cold"
      };
    }

    if (isCool) {
      return {
        mode: "day",
        icon: "🧥",
        badge: `پاییزی و خنک (${toPersianDigits(cur.temp)}°)`,
        title: "هوای خنک و پاییزی",
        advice: `هوا خنک و پاییزیه (${toPersianDigits(cur.temp)}°) 🍂 یک سویشرت، هودی یا پالتو سبک برای دانشگاه عالیه.`,
        isSevere: false,
        alertType: "cool"
      };
    }

    if (isPleasant) {
      return {
        mode: "day",
        icon: "🌤️",
        badge: `هوای مطبوع (${toPersianDigits(cur.temp)}°)`,
        title: "هوای دلپذیر دانشگاه",
        advice: `هوای امروز عالی و مطبوعه (${toPersianDigits(cur.temp)}°) ☀️ روز پرانرژی و موفقی در دانشگاه داشته باشی!`,
        isSevere: false,
        alertType: "pleasant"
      };
    }

    if (isWarm) {
      return {
        mode: "day",
        icon: "☀️",
        badge: `گرم و آفتابی (${toPersianDigits(cur.temp)}°)`,
        title: "هوای گرم",
        advice: `امروز نسبتاً گرمه (${toPersianDigits(cur.temp)}°) 🕶️ لباس خنک بپوش و نوشیدن آب یادت نره.`,
        isSevere: false,
        alertType: "warm"
      };
    }

    return {
      mode: "day",
      icon: cur.desc.icon || "🌤️",
      badge: `${city}: ${toPersianDigits(cur.temp)}° (${cur.desc.label})`,
      title: "وضعیت هوای امروز",
      advice: `امروز در ${city}: ${cur.desc.label}، دمای ${toPersianDigits(cur.temp)}° (بیشینه ${toPersianDigits(tday.max)}°). روز خوبی داشته باشی!`,
      isSevere: false,
      alertType: "normal"
    };
  }

  // Export module
  const StudashWeather = {
    CITIES,
    getSettings,
    saveSettings,
    fetchWeather,
    getAdvice,
    getWeatherDesc,
    toPersianDigits,
    updateUI,
    initUI
  };

  let isUpdatingUI = false;

  async function updateUI(forceRefresh = false) {
    if (typeof document === "undefined") return;
    const wrap = document.getElementById("weatherAdvisorWrap");
    if (!wrap) return;

    const topHeader = wrap.closest(".top-clock-header");
    const settings = await getSettings();
    if (!settings.enabled) {
      wrap.hidden = true;
      if (topHeader) topHeader.classList.remove("has-weather-active");
      return;
    }

    wrap.hidden = false;
    if (topHeader) topHeader.classList.add("has-weather-active");
    const iconEl = document.getElementById("weatherIcon");
    const tempEl = document.getElementById("weatherTemp");
    const textEl = document.getElementById("weatherAdviceText");

    const weather = await fetchWeather(forceRefresh);
    if (!weather) {
      if (textEl) textEl.textContent = "هواشناسی در دسترس نیست";
      return;
    }

    const advice = getAdvice(weather);
    if (!advice) return;

    if (iconEl) iconEl.textContent = advice.icon;
    if (tempEl) tempEl.textContent = `${toPersianDigits(weather.current.temp)}°`;
    if (textEl) textEl.textContent = advice.advice;

    // Fill popover details
    const popCity = document.getElementById("weatherPopoverCity");
    const popTime = document.getElementById("weatherPopoverTime");
    const curDetail = document.getElementById("weatherCurDetail");
    const curApparent = document.getElementById("weatherCurApparent");
    const tmwDetail = document.getElementById("weatherTmwDetail");
    const tmwMinMax = document.getElementById("weatherTmwMinMax");
    const advIcon = document.getElementById("weatherPopoverAdviceIcon");
    const advText = document.getElementById("weatherPopoverAdviceText");

    if (popCity) popCity.textContent = weather.city;
    if (popTime) popTime.textContent = advice.mode === "night" ? "پیش‌بینی شبانه و فردای دانشگاه" : "پیش‌بینی روزانه دانشگاه";
    if (curDetail) curDetail.textContent = `${weather.current.desc.icon} ${toPersianDigits(weather.current.temp)}° (${weather.current.desc.label})`;
    if (curApparent) curApparent.textContent = `دمای حسی: ${toPersianDigits(weather.current.apparent)}° | باد: ${toPersianDigits(weather.current.wind)} km/h`;
    if (tmwDetail) tmwDetail.textContent = `${weather.tomorrow.desc.icon} ${weather.tomorrow.desc.label}`;
    if (tmwMinMax) tmwMinMax.textContent = `کمینه ${toPersianDigits(weather.tomorrow.min)}° / بیشینه ${toPersianDigits(weather.tomorrow.max)}° | بارش: ${toPersianDigits(weather.tomorrow.rainProb)}٪`;
    if (advIcon) advIcon.textContent = advice.icon;
    if (advText) advText.textContent = advice.advice;
  }

  function initUI() {
    if (typeof document === "undefined") return;

    const pill = document.getElementById("weatherAdvisorPill");
    const popover = document.getElementById("weatherPopover");
    const refreshBtn = document.getElementById("weatherRefreshBtn");

    if (pill && popover) {
      pill.addEventListener("click", (e) => {
        e.stopPropagation();
        const willOpen = popover.hidden;
        // Close other top popovers if opening
        if (willOpen) {
          const notifDropdownMenu = document.getElementById("notifDropdownMenu");
          if (notifDropdownMenu) {
            notifDropdownMenu.hidden = true;
            document.getElementById("notifTriggerBtn")?.setAttribute("aria-expanded", "false");
          }
          const quickToolsMenu = document.getElementById("quickToolsMenu");
          if (quickToolsMenu) {
            quickToolsMenu.hidden = true;
            document.getElementById("quickToolsTriggerBtn")?.setAttribute("aria-expanded", "false");
          }
        }
        popover.hidden = !willOpen;
      });

      document.addEventListener("click", (e) => {
        if (!popover.hidden && !popover.contains(e.target) && !pill.contains(e.target)) {
          popover.hidden = true;
        }
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        refreshBtn.classList.add("is-spinning");
        await updateUI(true);
        setTimeout(() => refreshBtn.classList.remove("is-spinning"), 800);
      });
    }

    // Settings Modal Bindings
    const enabledToggle = document.getElementById("weatherEnabledToggle");
    const citySelect = document.getElementById("weatherCitySelect");
    const severeToggle = document.getElementById("weatherSevereNotifyToggle");

    if (citySelect && citySelect.options.length === 0) {
      CITIES.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name;
        citySelect.appendChild(opt);
      });
    }

    getSettings().then(s => {
      if (enabledToggle) enabledToggle.checked = s.enabled !== false;
      if (citySelect) citySelect.value = s.cityId || "mashhad";
      if (severeToggle) severeToggle.checked = s.notifyOnSevere !== false;
    });

    if (enabledToggle) {
      enabledToggle.addEventListener("change", async () => {
        await saveSettings({ enabled: enabledToggle.checked });
        updateUI();
      });
    }

    if (citySelect) {
      citySelect.addEventListener("change", async () => {
        const found = CITIES.find(c => c.id === citySelect.value) || CITIES[0];
        await saveSettings({
          cityId: found.id,
          cityName: found.name,
          lat: found.lat,
          lon: found.lon
        });
        updateUI(true);
      });
    }

    if (severeToggle) {
      severeToggle.addEventListener("change", async () => {
        await saveSettings({ notifyOnSevere: severeToggle.checked });
      });
    }

    updateUI();
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initUI);
    } else {
      initUI();
    }
  }

  global.StudashWeather = StudashWeather;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = StudashWeather;
  }
})(typeof window !== "undefined" ? window : globalThis);
