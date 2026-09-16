(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./swim-core.js"));
  else root.SwimFeatures = factory(root.SwimCore);
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core) {
  "use strict";

  function today() {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  function dateObject(date) {
    if (!Core.validDate(date)) throw new Error("日期不正确");
    return new Date(date + "T00:00:00Z");
  }
  function dateString(date) { return date.toISOString().slice(0, 10); }
  function addDays(date, days) { const value = dateObject(date); value.setUTCDate(value.getUTCDate() + days); return dateString(value); }
  function periodBounds(period, date = today()) {
    const value = dateObject(date);
    if (period === "week") {
      const start = addDays(date, -((value.getUTCDay() + 6) % 7));
      const end = addDays(start, 6);
      return { start, end, label: start + " 至 " + end };
    }
    if (period !== "month") throw new Error("周期须为周或月");
    value.setUTCDate(1);
    const start = dateString(value);
    value.setUTCMonth(value.getUTCMonth() + 1);
    value.setUTCDate(0);
    const end = dateString(value);
    return { start, end, label: start.slice(0, 4) + "年" + Number(start.slice(5, 7)) + "月" };
  }
  function periodProgress(records, goal, date = today()) {
    const bounds = periodBounds(goal.period, date);
    const start = goal.startDate && goal.startDate > bounds.start ? goal.startDate : bounds.start;
    const end = goal.endDate && goal.endDate < bounds.end ? goal.endDate : bounds.end;
    const sessions = records.filter((record) => record.swam && record.date >= start && record.date <= end && record.date <= date);
    const current = goal.type === "distance" ? sessions.reduce((sum, record) => sum + record.distance, 0) / 1000 : sessions.length;
    const target = goal.value;
    return { current, target, pct: Math.min(100, current / target * 100), done: current >= target, start, end };
  }
  function goalHistory(records, periodGoals, date = today(), limit = 6) {
    dateObject(date);
    if (!Number.isSafeInteger(limit) || limit < 0) throw new Error("历史条数不正确");
    if (!limit) return [];
    const history = [];
    for (const goal of periodGoals) {
      const lastDate = goal.endDate && goal.endDate < date ? goal.endDate : addDays(date, -1);
      let bounds = periodBounds(goal.period, lastDate);
      if (bounds.end >= date) bounds = periodBounds(goal.period, addDays(bounds.start, -1));
      let count = 0;
      while (bounds.end >= goal.startDate && count < limit) {
        if ((!goal.endDate || bounds.start <= goal.endDate) && bounds.end >= goal.startDate) {
          history.push({ goalId: goal.id, period: goal.period, type: goal.type, label: bounds.label, ...periodProgress(records, goal, bounds.end) });
          count++;
        }
        bounds = periodBounds(goal.period, addDays(bounds.start, -1));
      }
    }
    return history.sort((a, b) => b.end.localeCompare(a.end) || b.start.localeCompare(a.start) || String(a.goalId).localeCompare(String(b.goalId))).slice(0, limit);
  }
  function selected(value) { return value && value !== "全部" && value !== "all"; }
  function filterRecords(records, options = {}) {
    const { query, stroke, pool, from, to } = options;
    if (from && !Core.validDate(from)) throw new Error("开始日期不正确");
    if (to && !Core.validDate(to)) throw new Error("结束日期不正确");
    const needle = String(query || "").trim().toLocaleLowerCase();
    return records.filter((record) => (!needle || ((record.note || "") + "\n" + (record.pool || "")).toLocaleLowerCase().includes(needle))
      && (!selected(stroke) || record.stroke === stroke)
      && (!selected(pool) || record.pool === pool)
      && (!from || record.date >= from) && (!to || record.date <= to));
  }
  function trainingRecords(records, options) {
    const mode = options.durationMode === undefined ? "elapsed" : options.durationMode;
    if (!["elapsed", "moving", "unknown"].includes(mode)) throw new Error("请选择一个时长口径进行比较");
    return records.filter((record) => record.swam && (!selected(options.stroke) || record.stroke === options.stroke) && (record.durationMode || "unknown") === mode);
  }
  function comparisonSummary(records, bounds, cutoff = bounds.end) {
    const scoped = records.filter((record) => record.date >= bounds.start && record.date <= bounds.end && record.date <= cutoff);
    const paired = scoped.filter((record) => record.distance > 0 && record.duration > 0);
    return {
      ...Core.summarize(scoped), ...bounds,
      avgPaceSeconds: Core.paceSeconds(paired.reduce((sum, record) => sum + record.distance, 0), paired.reduce((sum, record) => sum + record.duration, 0)),
    };
  }
  function comparePeriods(records, options = {}) {
    const { period = "week", date = today() } = options;
    const current = periodBounds(period, date);
    const previous = periodBounds(period, addDays(current.start, -1));
    const scoped = trainingRecords(records, options);
    return { current: comparisonSummary(scoped, current, date), previous: comparisonSummary(scoped, previous) };
  }
  function paceSeries(records, options = {}) {
    const date = options.date === undefined ? today() : options.date;
    dateObject(date);
    const byDate = new Map();
    for (const record of trainingRecords(records, options)) {
      if (record.date > date || !(record.distance > 0 && record.duration > 0)) continue;
      const sum = byDate.get(record.date) || { distance: 0, duration: 0 };
      sum.distance += record.distance; sum.duration += record.duration;
      byDate.set(record.date, sum);
    }
    return [...byDate].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([date, sum]) => ({ date, seconds: Core.paceSeconds(sum.distance, sum.duration) }));
  }
  function canonical(value) {
    if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
    if (value && typeof value === "object") return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + canonical(value[key])).join(",") + "}";
    return JSON.stringify(value);
  }
  function fingerprintOf(state) {
    const byId = (a, b) => String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
    const content = canonical({ records: [...state.records].sort(byId), goal: state.goal, photos: state.photos, periodGoals: [...state.periodGoals].sort(byId) });
    // Two small independent hashes plus length are change indicators, not a
    // cryptographic integrity proof. Metadata and input preferences are excluded.
    let first = 2166136261; let second = 5381;
    for (let i = 0; i < content.length; i++) {
      const code = content.charCodeAt(i);
      first = Math.imul(first ^ code, 16777619) >>> 0;
      second = (Math.imul(second, 33) ^ code) >>> 0;
    }
    return "v1:" + content.length + ":" + first.toString(16).padStart(8, "0") + second.toString(16).padStart(8, "0");
  }
  function fingerprint(raw) { return fingerprintOf(Core.validateState(raw)); }
  function backupInfo(raw) {
    const state = Core.validateState(raw);
    const backedUp = new Set(state.meta.backedUpRecordIds.map(String));
    return { lastBackupAt: state.meta.lastBackupAt, unbackedCount: state.records.filter((record) => !backedUp.has(String(record.id))).length, changed: state.meta.lastBackupFingerprint !== fingerprintOf(state) };
  }
  function markBackup(raw, now = new Date()) {
    const state = Core.validateState(raw);
    const at = now instanceof Date ? now.toISOString() : now;
    state.meta = { lastBackupAt: at, backedUpRecordIds: state.records.map((record) => record.id), lastBackupFingerprint: fingerprintOf(state) };
    return Core.validateState(state);
  }
  function sameRecord(first, second, firstPhotos, secondPhotos) {
    return canonical({ ...first, id: String(first.id) }) === canonical({ ...second, id: String(second.id) }) && (firstPhotos[first.id] || null) === (secondPhotos[second.id] || null);
  }
  function mergePreview(currentRaw, incomingRaw) {
    const current = Core.validateState(currentRaw); const incoming = Core.validateState(incomingRaw);
    const byId = new Map(current.records.map((record) => [String(record.id), record]));
    const result = { added: 0, duplicates: 0, conflicts: 0, conflictIds: [] };
    for (const record of incoming.records) {
      const existing = byId.get(String(record.id));
      if (!existing) result.added++;
      else if (sameRecord(existing, record, current.photos, incoming.photos)) result.duplicates++;
      else { result.conflicts++; result.conflictIds.push(record.id); }
    }
    return result;
  }
  function applyImport(currentRaw, incomingRaw, options = {}) {
    const current = Core.validateState(currentRaw); const incoming = Core.validateState(incomingRaw);
    const { mode = "merge", conflict = "keep" } = options;
    if (!["merge", "replace"].includes(mode) || !["keep", "incoming"].includes(conflict)) throw new Error("导入方式不正确");
    if (mode === "replace") return Core.validateState({ ...incoming, meta: undefined });
    const byId = new Map(current.records.map((record) => [String(record.id), record]));
    const photos = { ...current.photos };
    for (const record of incoming.records) {
      const key = String(record.id);
      if (byId.has(key) && conflict === "keep") continue;
      byId.set(key, record);
      if (Object.prototype.hasOwnProperty.call(incoming.photos, key)) photos[key] = incoming.photos[key];
      else delete photos[key];
    }
    return Core.validateState({ ...current, records: [...byId.values()].sort((a, b) => b.date.localeCompare(a.date) || String(a.id).localeCompare(String(b.id))), photos });
  }

  return { periodBounds, periodProgress, goalHistory, filterRecords, comparePeriods, paceSeries, fingerprint, backupInfo, markBackup, mergePreview, applyImport };
});
