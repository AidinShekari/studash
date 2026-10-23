// ===============================================================
// StudashDate — exact Jalali (Solar Hijri) ↔ Gregorian conversion and
// timezone-safe helpers for date-only values ("YYYY-MM-DD").
//
// Algorithm: the 33-year-cycle arithmetic with the published "breaks"
// table (Borkowski; the same one used by jalaali-js), valid for Jalali
// years -61 … 3177. No Intl approximations and no hard-coded fallback
// dates: invalid input throws (TypeError / RangeError) so callers must
// handle it explicitly.
//
// Date-only values are always built with the *local* calendar day
// (new Date(y, m, d)) and serialised with local getters — never
// toISOString(), which would shift the day across the UTC boundary
// (e.g. 00:00–03:30 in Tehran).
//
// Works as a classic script (window/self.StudashDate) and in Node tests.
// ===============================================================
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.StudashDate = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  const div = (a, b) => ~~(a / b);
  const mod = (a, b) => a - ~~(a / b) * b;

  const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
  // Index 0 = Saturday (Iranian week start)
  const WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
  const WEEKDAYS_SHORT = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

  function assertInt(name, v) {
    if (!Number.isInteger(v)) throw new TypeError(`${name} must be an integer, got ${v}`);
  }

  // Leap info for Jalali year jy: { leap (0 = leap year), gy, march (day in March of Nowruz) }
  function jalCal(jy) {
    assertInt("Jalali year", jy);
    const bl = BREAKS.length;
    const gy = jy + 621;
    let leapJ = -14;
    let jp = BREAKS[0];
    let jump = 0;
    if (jy < jp || jy >= BREAKS[bl - 1]) throw new RangeError(`Jalali year out of range: ${jy}`);
    for (let i = 1; i < bl; i += 1) {
      const jm = BREAKS[i];
      jump = jm - jp;
      if (jy < jm) break;
      leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
      jp = jm;
    }
    let n = jy - jp;
    leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    const march = 20 + leapJ - leapG;
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    let leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;
    return { leap, gy, march };
  }

  // Gregorian date → Julian Day Number
  function g2d(gy, gm, gd) {
    let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
    return d;
  }

  // Julian Day Number → Gregorian date
  function d2g(jdn) {
    let j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    const i = div(mod(j, 1461), 4) * 5 + 308;
    const gd = div(mod(i, 153), 5) + 1;
    const gm = mod(div(i, 153), 12) + 1;
    const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return { gy, gm, gd };
  }

  function j2d(jy, jm, jd) {
    const r = jalCal(jy);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  }

  function d2j(jdn) {
    const gy = d2g(jdn).gy;
    let jy = gy - 621;
    const r = jalCal(jy);
    const jdn1f = g2d(gy, 3, r.march);
    let k = jdn - jdn1f;
    if (k >= 0) {
      if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
      k -= 186;
    } else {
      jy -= 1;
      k += 179;
      if (r.leap === 1) k += 1;
    }
    return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
  }

  const isLeapJalaliYear = (jy) => jalCal(jy).leap === 0;

  function jalaliMonthLength(jy, jm) {
    assertInt("Jalali month", jm);
    if (jm < 1 || jm > 12) throw new RangeError(`Jalali month out of range: ${jm}`);
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return isLeapJalaliYear(jy) ? 30 : 29;
  }

  function isValidJalaliDate(jy, jm, jd) {
    try {
      return Number.isInteger(jd) && jd >= 1 && jd <= jalaliMonthLength(jy, jm);
    } catch (e) {
      return false;
    }
  }

  function assertValidDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new TypeError("Invalid Date");
  }

  // Local calendar day of `date` → Jalali { jy, jm, jd }
  function toJalali(date) {
    assertValidDate(date);
    return d2j(g2d(date.getFullYear(), date.getMonth() + 1, date.getDate()));
  }

  // Jalali → local Date at 00:00 of that day
  function toGregorian(jy, jm, jd) {
    if (!isValidJalaliDate(jy, jm, jd)) throw new RangeError(`Invalid Jalali date: ${jy}/${jm}/${jd}`);
    const g = d2g(j2d(jy, jm, jd));
    return new Date(g.gy, g.gm - 1, g.gd);
  }

  // ---------- Date-only (YYYY-MM-DD) helpers, timezone-safe ----------
  const pad2 = (n) => String(n).padStart(2, "0");

  function isoDate(date) {
    assertValidDate(date);
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  // "YYYY-MM-DD" → local Date at 00:00, or null if malformed / impossible
  function parseIsoDate(str) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str || "").trim());
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    const date = new Date(y, mo - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
    return date;
  }

  const todayIso = (now = new Date()) => isoDate(now);

  function addDays(date, n) {
    assertValidDate(date);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
  }

  // Whole calendar days from a to b (DST-safe: compares day numbers, not milliseconds)
  function diffDays(a, b) {
    assertValidDate(a);
    assertValidDate(b);
    return g2d(b.getFullYear(), b.getMonth() + 1, b.getDate()) - g2d(a.getFullYear(), a.getMonth() + 1, a.getDate());
  }

  // 0 = Saturday … 6 = Friday
  const weekdaySat = (date) => (date.getDay() + 1) % 7;

  // Saturday that starts the week containing `date`
  const startOfWeek = (date) => addDays(date, -weekdaySat(date));

  function addJalaliMonths(jy, jm, delta) {
    const total = jy * 12 + (jm - 1) + delta;
    return { jy: Math.floor(total / 12), jm: (((total % 12) + 12) % 12) + 1 };
  }

  const toPersianDigits = (v) => String(v).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);

  // "دوشنبه ۲۷ مهر ۱۴۰۵"
  function formatJalali(date, { weekday = true, year = true } = {}) {
    const j = toJalali(date);
    const parts = [];
    if (weekday) parts.push(WEEKDAYS[weekdaySat(date)]);
    parts.push(`${toPersianDigits(j.jd)} ${MONTHS[j.jm - 1]}`);
    if (year) parts.push(toPersianDigits(j.jy));
    return parts.join(" ");
  }

  return {
    MONTHS,
    WEEKDAYS,
    WEEKDAYS_SHORT,
    toJalali,
    toGregorian,
    isLeapJalaliYear,
    jalaliMonthLength,
    isValidJalaliDate,
    isoDate,
    parseIsoDate,
    todayIso,
    addDays,
    diffDays,
    weekdaySat,
    startOfWeek,
    addJalaliMonths,
    toPersianDigits,
    formatJalali,
  };
});
