// Pure timetable calculations shared by classes, calendar events, and deadlines.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StudashSchedule = api;
})(typeof self !== 'undefined' ? self : this, function () {
  function hour(value, legacyNoon = false) {
    const text = String(value || '').replace(/[۰-۹٠-٩]/g, d => String(d.charCodeAt(0) - (d <= '٩' ? 0x660 : 0x6f0)));
    const match = /^(\d{1,2}):(\d{2})$/.exec(text);
    if (!match) return null;
    let h = Number(match[1]); const m = Number(match[2]);
    if (h > 24 || m > 59 || (h === 24 && m !== 0)) return null;
    if (legacyNoon && h === 0 && m === 0) h = 12;
    return h + m / 60;
  }
  function interval(startTime, endTime, legacyNoon = false) {
    const start = hour(startTime, legacyNoon);
    if (start === null || start >= 24) return null;
    let end = hour(endTime, legacyNoon);
    if (end === null || end <= start) end = Math.min(24, start + 1);
    return { start, end };
  }
  function range(intervals) {
    const valid = intervals.filter(i => i && Number.isFinite(i.start) && Number.isFinite(i.end) && i.start >= 0 && i.end <= 24 && i.end > i.start);
    if (!valid.length) return null;
    const start = Math.floor(Math.min(...valid.map(i => i.start)));
    const end = Math.ceil(Math.max(...valid.map(i => i.end)));
    return { start, end, columns: end - start };
  }
  function span(item, bounds) {
    if (!item || !bounds) return { startCol: 1, endCol: (bounds?.columns || 1) + 1 };
    const startCol = Math.max(1, Math.min(bounds.columns, Math.floor(item.start - bounds.start) + 1));
    const endCol = Math.max(startCol + 1, Math.min(bounds.columns + 1, Math.ceil(item.end - bounds.start) + 1));
    return { startCol, endCol };
  }
  return { hour, interval, range, span };
});
