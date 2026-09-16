const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../swim-core.js");
const Features = require("../swim-features.js");
const photo = "data:image/png;base64,aGVsbG8=";
const otherPhoto = "data:image/png;base64,Z29vZA==";
const record = (changes = {}) => ({ id: 1, date: "2026-09-16", swam: true, distance: 1000, duration: 20, durationMode: "elapsed", stroke: "自由泳", pool: "水蓝泳馆", ...changes });
const state = (changes = {}) => Core.validateState({ version: 3, records: [record()], goal: { type: "distance", value: 100 }, photos: {}, ...changes });
const weekly = (changes = {}) => ({ id: "week-1", period: "week", type: "count", value: 3, startDate: "2026-09-14", endDate: null, ...changes });

test("weekly bounds use Monday through Sunday across year boundaries", () => {
  const result = Features.periodBounds("week", "2021-01-01");
  assert.equal(result.start, "2020-12-28");
  assert.equal(result.end, "2021-01-03");
  assert.equal(Features.periodBounds("week", "2021-01-04").start, "2021-01-04");
  assert.equal(Features.periodBounds("week", "2021-01-03").start, "2020-12-28");
});

test("monthly bounds handle leap February and December transitions", () => {
  assert.equal(Features.periodBounds("month", "2024-02-15").end, "2024-02-29");
  assert.equal(Features.periodBounds("month", "2026-02-15").end, "2026-02-28");
  assert.equal(Features.periodBounds("month", "2026-12-31").end, "2026-12-31");
  assert.throws(() => Features.periodBounds("month", "2026-02-29"));
  assert.throws(() => Features.periodBounds("year", "2026-09-16"));
});

test("period progress counts distinct sessions on the same date and converts distance to km", () => {
  const records = [record(), record({ id: 2, distance: 2000 }), record({ id: 3, swam: false }), record({ id: 4, date: "2026-09-13" })];
  const count = Features.periodProgress(records, weekly(), "2026-09-16");
  assert.equal(count.current, 2);
  assert.equal(count.target, 3);
  assert.equal(count.done, false);
  const distance = Features.periodProgress(records, weekly({ type: "distance", value: 2.5 }), "2026-09-16");
  assert.equal(distance.current, 3);
  assert.equal(distance.pct, 100);
  assert.equal(distance.done, true);
});

test("goal effective dates prevent counting records before creation or after retirement", () => {
  const records = [record({ id: 1, date: "2026-09-14" }), record({ id: 2, date: "2026-09-16" }), record({ id: 3, date: "2026-09-18" })];
  const result = Features.periodProgress(records, weekly({ startDate: "2026-09-16", endDate: "2026-09-17" }), "2026-09-16");
  assert.equal(result.current, 1);
  assert.equal(result.start, "2026-09-16");
  assert.equal(result.end, "2026-09-17");
});

test("goal history excludes the ongoing cycle and never applies new targets retroactively", () => {
  const records = [record({ date: "2026-09-10" }), record({ id: 2, date: "2026-09-15" })];
  assert.deepEqual(Features.goalHistory(records, [weekly()], "2026-09-16"), []);
  const history = Features.goalHistory(records, [weekly()], "2026-09-21");
  assert.equal(history.length, 1);
  assert.equal(history[0].start, "2026-09-14");
  assert.equal(history[0].end, "2026-09-20");
  assert.equal(history[0].current, 1);
});

test("edited goals preserve earlier target values in completed history", () => {
  const goals = [weekly({ id: "old", value: 1, startDate: "2026-08-31", endDate: "2026-09-13" }), weekly({ id: "new", value: 4 })];
  const history = Features.goalHistory([record({ date: "2026-09-10" }), record()], goals, "2026-09-28", 4);
  assert.equal(history.length, 4);
  assert.deepEqual(history.map((entry) => entry.target), [4, 4, 1, 1]);
  assert.deepEqual(history.map((entry) => entry.goalId), ["new", "new", "old", "old"]);
  assert.equal(history[2].done, true);
  assert.equal(history[1].done, false);
});

test("monthly goal history includes leap-month completion and respects global limit", () => {
  const goal = weekly({ id: "monthly", period: "month", type: "distance", value: 2, startDate: "2024-02-01" });
  const history = Features.goalHistory([record({ date: "2024-02-29", distance: 2000 })], [goal], "2024-03-01");
  assert.equal(history.length, 1);
  assert.equal(history[0].end, "2024-02-29");
  assert.equal(history[0].done, true);
  assert.equal(Features.goalHistory([], [goal], "2026-09-16", 3).length, 3);
  assert.deepEqual(Features.goalHistory([], [goal], "2026-09-16", 0), []);
});

test("record filters combine note/pool text, exact stroke/pool and inclusive date bounds", () => {
  const records = [record({ note: "练习 TURN" }), record({ id: 2, date: "2026-09-15", stroke: "蛙泳", note: "轻松" }), record({ id: 3, date: "2026-09-14", pool: "蓝鲸泳馆" })];
  assert.deepEqual(Features.filterRecords(records, { query: "turn", stroke: "自由泳", pool: "水蓝泳馆", from: "2026-09-16", to: "2026-09-16" }).map((r) => r.id), [1]);
  assert.deepEqual(Features.filterRecords(records, { query: "蓝鲸" }).map((r) => r.id), [3]);
  assert.equal(Features.filterRecords(records, { stroke: "蛙泳" }).length, 1);
  assert.equal(Features.filterRecords(records, {}).length, 3);
  assert.throws(() => Features.filterRecords(records, { from: "invalid" }));
});

test("period comparison keeps strokes and timing modes separate", () => {
  const records = [
    record({ id: 1, date: "2021-01-01", distance: 1000, duration: 20 }),
    record({ id: 2, date: "2020-12-23", distance: 2000, duration: 50 }),
    record({ id: 3, date: "2021-01-01", durationMode: "moving", duration: 10 }),
    record({ id: 4, date: "2021-01-01", durationMode: "unknown", duration: 80 }),
    record({ id: 5, date: "2021-01-01", stroke: "蛙泳", duration: 40 }),
    record({ id: 6, date: "2021-01-01", distance: 500, duration: 0 }),
  ];
  const compared = Features.comparePeriods(records, { period: "week", date: "2021-01-01", stroke: "自由泳", durationMode: "elapsed" });
  assert.equal(compared.current.sessionCount, 2);
  assert.equal(compared.current.totalDistance, 1500);
  assert.equal(compared.current.avgPaceSeconds, 120);
  assert.equal(compared.previous.avgPaceSeconds, 150);
  assert.equal(compared.previous.start, "2020-12-21");
  assert.equal(Features.comparePeriods(records, { date: "2021-01-01", durationMode: "unknown" }).current.avgPaceSeconds, 480);
  assert.throws(() => Features.comparePeriods(records, { durationMode: "all" }));
});

test("pace series aggregates same-day sessions with distance weighting and returns latest twelve dates", () => {
  const records = Array.from({ length: 16 }, (_, index) => record({ id: index + 1, date: "2026-09-" + String(index + 1).padStart(2, "0") }));
  records.push(record({ id: 100, distance: 2000, duration: 50 }), record({ id: 101, durationMode: "moving", duration: 5 }), record({ id: 102, distance: 2000, duration: 0 }));
  const series = Features.paceSeries(records, { stroke: "自由泳", durationMode: "elapsed", date: "2026-09-16" });
  assert.equal(series.length, 12);
  assert.equal(series[0].date, "2026-09-05");
  assert.equal(series[11].date, "2026-09-16");
  assert.equal(series[11].seconds, 140);
  assert.equal(Features.paceSeries([record({ durationMode: "unknown" })]).length, 0);
});

test("backup status distinguishes new records from edits, deletion, photos and goals", () => {
  const initial = state();
  assert.deepEqual(Features.backupInfo(initial), { lastBackupAt: null, unbackedCount: 1, changed: true });
  const backed = Features.markBackup(initial, "2026-09-16T01:00:00.000Z");
  assert.deepEqual(Features.backupInfo(backed), { lastBackupAt: "2026-09-16T01:00:00.000Z", unbackedCount: 0, changed: false });
  const edited = state({ ...backed, records: [{ ...backed.records[0], note: "修改" }] });
  assert.equal(Features.backupInfo(edited).unbackedCount, 0);
  assert.equal(Features.backupInfo(edited).changed, true);
  const added = state({ ...backed, records: [...backed.records, record({ id: 2 })] });
  assert.equal(Features.backupInfo(added).unbackedCount, 1);
  assert.equal(Features.backupInfo(state({ ...backed, records: [] })).changed, true);
  assert.equal(Features.backupInfo(state({ ...backed, photos: { 1: photo } })).changed, true);
  assert.equal(Features.backupInfo(state({ ...backed, periodGoals: [weekly()] })).changed, true);
  assert.equal(Features.backupInfo(state({ ...backed, goal: { type: "count", value: 10 } })).changed, true);
  assert.equal(initial.meta.lastBackupAt, null);
});

test("backup fingerprint is stable across record/key order and excludes metadata/preferences", () => {
  const first = state({ records: [record(), record({ id: 2 })], photos: { 1: photo, 2: otherPhoto } });
  const backed = Features.markBackup(first);
  const second = state({ ...backed, records: [...backed.records].reverse(), photos: { 2: otherPhoto, 1: photo }, preferences: { stroke: "蛙泳", pool: "新默认", durationMode: "moving" } });
  assert.equal(Features.fingerprint(first), Features.fingerprint(second));
  assert.equal(Features.backupInfo(second).changed, false);
});

test("merge preview uses IDs rather than dates and recognizes legacy normalized duplicates", () => {
  const current = state({ records: [record({ durationMode: "unknown" })] });
  const incoming = { version: 2, records: [{ ...record(), durationMode: undefined }, record({ id: 2 })], photos: {} };
  assert.deepEqual(Features.mergePreview(current, incoming), { added: 1, duplicates: 1, conflicts: 0, conflictIds: [] });
  assert.equal(Features.applyImport(current, incoming, { mode: "merge" }).records.length, 2);
  assert.deepEqual(Features.mergePreview(current, state({ records: [record({ id: "1", durationMode: "unknown" })] })), { added: 0, duplicates: 1, conflicts: 0, conflictIds: [] });
});

test("same-ID photo changes are conflicts and chosen record/photo stay together", () => {
  const current = state({ photos: { 1: photo } });
  const incoming = state({ photos: { 1: otherPhoto } });
  assert.deepEqual(Features.mergePreview(current, incoming), { added: 0, duplicates: 0, conflicts: 1, conflictIds: [1] });
  assert.equal(Features.applyImport(current, incoming, { mode: "merge", conflict: "keep" }).photos[1], photo);
  assert.equal(Features.applyImport(current, incoming, { mode: "merge", conflict: "incoming" }).photos[1], otherPhoto);
  const withoutPhoto = Features.applyImport(current, state(), { mode: "merge", conflict: "incoming" });
  assert.equal(withoutPhoto.photos[1], undefined);
  assert.equal(withoutPhoto.records[0].hasPhoto, false);
});

test("merge preserves local goals/metadata/preferences and imports only photos attached to selected records", () => {
  const current = Features.markBackup(state({ periodGoals: [weekly()], preferences: { stroke: "蛙泳", pool: "本机", durationMode: "moving" } }), "2026-09-16T01:00:00Z");
  const incoming = state({ records: [record({ id: 2 })], goal: { type: "count", value: 20 }, periodGoals: [weekly({ id: "incoming", value: 9 })], photos: { 2: photo, 99: otherPhoto } });
  const merged = Features.applyImport(current, incoming, { mode: "merge" });
  assert.deepEqual(merged.goal, current.goal);
  assert.deepEqual(merged.periodGoals, current.periodGoals);
  assert.deepEqual(merged.meta, current.meta);
  assert.deepEqual(merged.preferences, current.preferences);
  assert.equal(merged.photos[2], photo);
  assert.equal(merged.photos[99], undefined);
  assert.equal(Features.backupInfo(merged).unbackedCount, 1);
});

test("replacement uses incoming goals/preferences and resets local backup metadata", () => {
  const current = state();
  const incoming = Features.markBackup(state({ records: [record({ id: 2 })], periodGoals: [weekly()], goal: { type: "count", value: 20 }, photos: { 2: photo }, preferences: { stroke: "仰泳", pool: "外部", durationMode: "moving" } }));
  const replaced = Features.applyImport(current, incoming, { mode: "replace" });
  assert.deepEqual(replaced.records, incoming.records);
  assert.deepEqual(replaced.goal, incoming.goal);
  assert.deepEqual(replaced.periodGoals, incoming.periodGoals);
  assert.deepEqual(replaced.preferences, incoming.preferences);
  assert.deepEqual(replaced.photos, incoming.photos);
  assert.deepEqual(replaced.meta, { lastBackupAt: null, backedUpRecordIds: [], lastBackupFingerprint: null });
});

test("invalid imports fail without mutating either source", () => {
  const current = state({ photos: { 1: photo } });
  const snapshot = JSON.stringify(current);
  const incoming = { version: 3, records: [record({ distance: -1 })] };
  assert.throws(() => Features.mergePreview(current, incoming));
  assert.throws(() => Features.applyImport(current, incoming, { mode: "merge" }));
  assert.equal(JSON.stringify(current), snapshot);
  assert.equal(incoming.records[0].distance, -1);
});

test("current week and month progress ignore imported future sessions", () => {
  const records = [record({ date: "2026-09-15" }), record({ id: 2, date: "2026-09-19", distance: 5000 }), record({ id: 3, date: "2026-09-30", distance: 9000 })];
  const week = Features.periodProgress(records, weekly({ value: 2 }), "2026-09-16");
  assert.equal(week.current, 1);
  assert.equal(week.done, false);
  assert.equal(week.end, "2026-09-20");
  const month = Features.periodProgress(records, weekly({ period: "month", type: "distance", value: 5, startDate: "2026-09-01" }), "2026-09-16");
  assert.equal(month.current, 1);
  assert.equal(month.done, false);
  assert.equal(month.end, "2026-09-30");
});

test("current comparisons stop at reference date while previous cycles remain complete", () => {
  const records = [record({ date: "2026-09-16" }), record({ id: 2, date: "2026-09-19", duration: 5 }), record({ id: 3, date: "2026-09-13", duration: 30 }), record({ id: 4, date: "2026-08-31", duration: 40 })];
  const weeklyResult = Features.comparePeriods(records, { period: "week", date: "2026-09-16", durationMode: "elapsed" });
  assert.equal(weeklyResult.current.sessionCount, 1);
  assert.equal(weeklyResult.current.avgPaceSeconds, 120);
  assert.equal(weeklyResult.previous.sessionCount, 1);
  assert.equal(weeklyResult.previous.avgPaceSeconds, 180);
  const monthlyResult = Features.comparePeriods(records, { period: "month", date: "2026-09-16", durationMode: "elapsed" });
  assert.equal(monthlyResult.current.sessionCount, 2);
  assert.equal(monthlyResult.current.avgPaceSeconds, 150);
  assert.equal(monthlyResult.previous.sessionCount, 1);
  assert.equal(monthlyResult.previous.avgPaceSeconds, 240);
});

test("completed goal history includes sessions on the final day of each full cycle", () => {
  const weekHistory = Features.goalHistory([record({ date: "2026-09-20" })], [weekly({ value: 1 })], "2026-09-21");
  assert.equal(weekHistory[0].current, 1);
  assert.equal(weekHistory[0].done, true);
  const monthGoal = weekly({ period: "month", type: "distance", value: 1, startDate: "2024-02-01" });
  const monthHistory = Features.goalHistory([record({ date: "2024-02-29" })], [monthGoal], "2024-03-01");
  assert.equal(monthHistory[0].current, 1);
  assert.equal(monthHistory[0].done, true);
});

test("pace series excludes future dates by explicit cutoff and by default today", () => {
  const records = [record({ date: "2026-09-16" }), record({ id: 2, date: "2026-09-17" })];
  assert.deepEqual(Features.paceSeries(records, { date: "2026-09-16" }).map((point) => point.date), ["2026-09-16"]);
  assert.deepEqual(Features.paceSeries([record({ date: "9999-12-31" })]), []);
  assert.throws(() => Features.paceSeries(records, { date: "2026-02-29" }));
});
