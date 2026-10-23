// Run: npm test   (node --test)
const test = require("node:test");
const assert = require("node:assert/strict");
const D = require("../jalali.js");

const g = (y, m, d) => new Date(y, m - 1, d);
const iso = (date) => D.isoDate(date);

test("Nowruz and Esfand boundaries match the official calendar", () => {
  const fixed = [
    [1399, 1, 1, "2020-03-20"],
    [1399, 12, 30, "2021-03-20"], // 1399 is a leap year
    [1400, 1, 1, "2021-03-21"],
    [1402, 12, 29, "2024-03-19"],
    [1403, 1, 1, "2024-03-20"],
    [1403, 12, 30, "2025-03-20"], // 1403 is a leap year
    [1404, 1, 1, "2025-03-21"],
    [1404, 12, 29, "2026-03-20"],
    [1405, 1, 1, "2026-03-21"],
    [1405, 6, 31, "2026-09-22"], // last 31-day month
    [1405, 7, 1, "2026-09-23"],
    [1405, 7, 27, "2026-10-19"],
    [1408, 12, 30, "2030-03-20"], // next leap year
  ];
  for (const [jy, jm, jd, expected] of fixed) {
    assert.equal(iso(D.toGregorian(jy, jm, jd)), expected, `${jy}/${jm}/${jd}`);
    assert.deepEqual(D.toJalali(D.parseIsoDate(expected)), { jy, jm, jd }, expected);
  }
});

test("leap years and month lengths", () => {
  assert.deepEqual([1399, 1400, 1401, 1402, 1403, 1404, 1405, 1408].map(D.isLeapJalaliYear), [true, false, false, false, true, false, false, true]);
  assert.equal(D.jalaliMonthLength(1403, 12), 30);
  assert.equal(D.jalaliMonthLength(1404, 12), 29);
  assert.equal(D.jalaliMonthLength(1404, 6), 31);
  assert.equal(D.jalaliMonthLength(1404, 7), 30);
});

test("invalid input throws instead of returning a fallback date", () => {
  assert.throws(() => D.toGregorian(1404, 12, 30), RangeError); // not a leap year
  assert.throws(() => D.toGregorian(1404, 13, 1), RangeError);
  assert.throws(() => D.toGregorian(1404, 1, 0), RangeError);
  assert.throws(() => D.toJalali(new Date("not a date")), TypeError);
  assert.throws(() => D.toJalali("2025-01-01"), TypeError);
  assert.equal(D.isValidJalaliDate(1403, 12, 30), true);
  assert.equal(D.isValidJalaliDate(1404, 12, 30), false);
});

test("round trip is exact and continuous for 1300–1500", () => {
  let prev = null;
  for (let jy = 1300; jy <= 1500; jy++) {
    for (let jm = 1; jm <= 12; jm++) {
      const len = D.jalaliMonthLength(jy, jm);
      for (let jd = 1; jd <= len; jd++) {
        const date = D.toGregorian(jy, jm, jd);
        const back = D.toJalali(date);
        if (back.jy !== jy || back.jm !== jm || back.jd !== jd) assert.fail(`${jy}/${jm}/${jd} → ${iso(date)} → ${JSON.stringify(back)}`);
        if (prev && D.diffDays(prev, date) !== 1) assert.fail(`gap before ${jy}/${jm}/${jd}`);
        prev = date;
      }
    }
  }
});

test("agrees with Intl's Persian calendar for 1340–1430", () => {
  const fmt = new Intl.DateTimeFormat("en-US-u-ca-persian", { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" });
  let date = D.toGregorian(1340, 1, 1);
  const end = D.toGregorian(1430, 12, D.jalaliMonthLength(1430, 12));
  const mismatches = [];
  while (date <= end) {
    const parts = Object.fromEntries(fmt.formatToParts(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).map((p) => [p.type, p.value]));
    const j = D.toJalali(date);
    if (+parts.year !== j.jy || +parts.month !== j.jm || +parts.day !== j.jd) mismatches.push(iso(date));
    date = D.addDays(date, 1);
  }
  assert.deepEqual(mismatches, []);
});

test("date-only values never shift a day, in any timezone", () => {
  const original = process.env.TZ;
  try {
    for (const tz of ["Asia/Tehran", "America/Los_Angeles", "Pacific/Kiritimati"]) {
      process.env.TZ = tz;
      for (const s of ["2025-03-20", "2025-03-21", "2026-10-19", "2024-02-29", "2026-03-08"]) {
        assert.equal(D.isoDate(D.parseIsoDate(s)), s, `${tz} ${s}`);
      }
      // Local midnight just after the date change: isoDate keeps the local day.
      const justAfterMidnight = new Date(2026, 9, 19, 0, 30);
      assert.equal(D.todayIso(justAfterMidnight), "2026-10-19", tz);
    }
    process.env.TZ = "Asia/Tehran";
    // The bug being fixed: toISOString() reports the previous day at 00:30 in Tehran.
    assert.equal(new Date(2026, 9, 19, 0, 30).toISOString().slice(0, 10), "2026-10-18");
    process.env.TZ = "America/Los_Angeles";
    assert.equal(D.diffDays(g(2026, 3, 8), g(2026, 3, 9)), 1); // across the DST change
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test("parseIsoDate rejects malformed and impossible dates", () => {
  assert.equal(D.parseIsoDate("2025-02-30"), null);
  assert.equal(D.parseIsoDate("2025-2-3"), null);
  assert.equal(D.parseIsoDate(""), null);
  assert.equal(D.parseIsoDate(undefined), null);
  assert.equal(D.parseIsoDate("abc"), null);
});

test("week starts on Saturday; month arithmetic wraps the year", () => {
  assert.equal(iso(D.startOfWeek(g(2026, 10, 19))), "2026-10-17"); // Monday → Saturday
  assert.equal(iso(D.startOfWeek(g(2026, 10, 17))), "2026-10-17"); // Saturday stays
  assert.equal(iso(D.startOfWeek(g(2026, 10, 23))), "2026-10-17"); // Friday → same week
  assert.equal(D.weekdaySat(g(2026, 10, 17)), 0);
  assert.equal(D.weekdaySat(g(2026, 10, 23)), 6);
  assert.deepEqual(D.addJalaliMonths(1405, 12, 1), { jy: 1406, jm: 1 });
  assert.deepEqual(D.addJalaliMonths(1405, 1, -1), { jy: 1404, jm: 12 });
  assert.equal(D.formatJalali(g(2026, 10, 19)), "دوشنبه ۲۷ مهر ۱۴۰۵");
});
