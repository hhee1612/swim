const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../swim-core.js");

const photo = "data:image/png;base64,aGVsbG8=";
const record = (changes = {}) => ({ id: 1, date: "2026-09-16", swam: true, distance: 1000, duration: 20, ...changes });
const state = (changes = {}) => ({ version: 2, records: [record()], goal: { type: "distance", value: 100 }, photos: {}, ...changes });
const tick = () => new Promise((resolve) => setImmediate(resolve));

function memoryStorage(values = {}) {
  const map = new Map(Object.entries(values));
  return { get length() { return map.size; }, key(index) { return [...map.keys()][index] ?? null; }, getItem(key) { return map.get(key) ?? null; }, setItem(key, value) { map.set(key, String(value)); }, snapshot() { return Object.fromEntries(map); } };
}
// A controllable event harness verifies our transaction contract. This does not
// substitute for a real browser's IndexedDB and quota/rollback integration tests.
function databaseHarness(initial, options = {}) {
  let current = initial === undefined ? undefined : structuredClone(initial);
  const transactions = [];
  let opens = 0;
  let nextFailure = null;
  const db = {
    objectStoreNames: { contains: (name) => name === "snapshots" }, close() {},
    transaction(name, mode) {
      assert.equal(name, "snapshots");
      let pending;
      let request;
      let finished = false;
      const tx = {
        error: null, mode,
        objectStore(storeName) {
          assert.equal(storeName, "snapshots");
          return {
            get(key) { assert.equal(key, "current"); request = {}; return request; },
            put(value, key) { assert.equal(key, "current"); pending = structuredClone(value); request = {}; return request; },
          };
        },
        abort() { if (finished) return; finished = true; tx.error ||= new Error("AbortError"); if (tx.onabort) tx.onabort(); },
        complete() { if (finished) return; finished = true; if (mode === "readwrite") current = pending; tx.oncomplete(); },
      };
      transactions.push(tx);
      queueMicrotask(() => {
        if (mode === "readwrite" && nextFailure) {
          tx.error = nextFailure; nextFailure = null;
          request.error = tx.error;
          if (request.onerror) request.onerror();
          if (tx.onerror) tx.onerror();
          tx.abort(); return;
        }
        request.result = mode === "readonly" ? structuredClone(current) : "current";
        if (request.onsuccess) request.onsuccess();
        if (mode === "readonly" || !options.holdWrites) tx.complete();
      });
      return tx;
    },
  };
  return {
    indexedDB: { open(name, version) { assert.equal(name, "swim-journal"); assert.equal(version, 1); opens++; const request = { result: db }; queueMicrotask(() => request.onsuccess()); return request; } },
    transactions,
    get current() { return current; }, get opens() { return opens; },
    failNextWrite(error = new Error("QuotaExceededError")) { nextFailure = error; },
  };
}

test("legacy backups normalize optional fields and numeric meter goals", () => {
  const original = { version: 1, records: [{ id: 123, date: "2024-02-29", swam: true }], goal: 50000 };
  const normalized = Core.validateState(original);
  assert.deepEqual(normalized.goal, { type: "distance", value: 50 });
  assert.equal(normalized.version, 2);
  assert.equal(normalized.records[0].distance, 0);
  assert.equal(normalized.records[0].note, "");
  assert.equal(normalized.records[0].hasPhoto, false);
  assert.equal(original.records[0].distance, undefined);
});

test("UUID records and safe orphan legacy photos are retained", () => {
  const id = "64bf23bf-7337-4ef9-bbdc-b477b7313578";
  const result = Core.validateState(state({ records: [record({ id })], photos: { [id]: photo, 987: photo } }));
  assert.equal(result.records[0].hasPhoto, true);
  assert.equal(result.photos[987], photo);
});

test("future versions, malformed records and colliding record IDs are rejected", () => {
  for (const raw of [null, [], {}, state({ version: 3 }), state({ version: "2" }), state({ records: {} }), state({ records: [null] }), state({ records: [record(), record({ id: "1" })] })]) assert.throws(() => Core.validateState(raw));
  for (const id of [null, {}, [], -1, 1.1, "", "__proto__", "constructor", "a/b"]) assert.throws(() => Core.validateState(state({ records: [record({ id })] })));
});

test("date validation rejects impossible dates without timezone dependence", () => {
  for (const date of ["", "2026-2-03", "2026-02-29", "2024-02-30", "2026-04-31", "2026-13-01", "0000-01-01", null]) assert.throws(() => Core.validateState(state({ records: [record({ date })] })));
  for (const date of ["2024-02-29", "2000-02-29", "2026-09-16"]) assert.equal(Core.validDate(date), true);
  assert.equal(Core.validDate("1900-02-29"), false);
});

test("negative, nonnumeric and nonfinite distances/durations are rejected", () => {
  for (const field of ["distance", "duration"]) for (const value of [-1, NaN, Infinity, -Infinity, "1000", null, {}, Number.MAX_VALUE]) assert.throws(() => Core.validateState(state({ records: [record({ [field]: value })] })));
  assert.equal(Core.validateState(state({ records: [record({ distance: 0, duration: 0 })] })).records[0].distance, 0);
});

test("record display fields reject types that would break React rendering", () => {
  for (const patch of [{ swam: "true" }, { mood: "开心" }, { mood: { emoji: {}, label: "开心" } }, { stroke: {} }, { pool: [] }, { note: {} }, { hasPhoto: "true" }]) assert.throws(() => Core.validateState(state({ records: [record(patch)] })));
});

test("goals require recognized positive values; counts and days are whole numbers", () => {
  for (const goal of [null, {}, 0, -1, "100000", { type: "unknown", value: 1 }, { type: "distance", value: 0 }, { type: "days", value: 1.5 }, { type: "count", value: Infinity }]) assert.throws(() => Core.validateState(state({ goal })));
  assert.equal(Core.validateState({ records: [] }).goal.value, 100);
  assert.equal(Core.validateState(state({ goal: { type: "distance", value: 1.5 } })).goal.value, 1.5);
});

test("photo data must be raster data URLs with valid base64 syntax", () => {
  for (const photos of [null, [], { 1: 12 }, { 1: "https://example.com/image.png" }, { 1: "data:image/svg+xml;base64,PHN2Zz4=" }, { 1: "data:image/png;base64,%%%=" }, JSON.parse('{"__proto__":"' + photo + '"}')]) assert.throws(() => Core.validateState(state({ photos })));
  assert.equal(Core.validateState(state({ photos: { 1: photo } })).records[0].hasPhoto, true);
});

test("session count, unique swim days, total distance and weighted pace are distinct", () => {
  const result = Core.summarize([
    record({ id: 1, distance: 1000, duration: 20 }),
    record({ id: 2, distance: 2000, duration: 50 }),
    record({ id: 3, date: "2026-09-15", distance: 1500, duration: 0 }),
    record({ id: 4, date: "2026-09-14", distance: 0, duration: 10 }),
    record({ id: 5, date: "2026-09-13", swam: false, distance: 100, duration: 10 }),
  ]);
  assert.deepEqual(result, { sessionCount: 4, dayCount: 3, totalDistance: 4500, totalTime: 80, avgPace: "2'20\"" });
  assert.equal(Core.summarize([record({ duration: 0 })]).avgPace, null);
  assert.deepEqual(Core.summarize([]), { sessionCount: 0, dayCount: 0, totalDistance: 0, totalTime: 0, avgPace: null });
});

test("pace rounds once before splitting minutes and seconds", () => {
  assert.equal(Core.fmtPace(119.6), "2'00\"");
  assert.equal(Core.fmtPace(59.6), "1'00\"");
  assert.equal(Core.paceStr(1000, 20), "2'00\"");
  for (const seconds of [null, undefined, NaN, Infinity, -1]) assert.equal(Core.fmtPace(seconds), null);
  assert.equal(Core.paceSeconds(0, 20), null);
  assert.equal(Core.paceSeconds(1000, 0), null);
});

function parseCSV(csv) {
  csv = csv.replace(/^\ufeff/, "");
  const rows = []; let row = []; let value = ""; let quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (char === '"') { if (quoted && csv[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && char === ",") { row.push(value); value = ""; }
    else if (!quoted && char === "\r" && csv[i + 1] === "\n") { row.push(value); rows.push(row); row = []; value = ""; i++; }
    else value += char;
  }
  assert.equal(quoted, false); row.push(value); rows.push(row); return rows;
}

test("CSV quotes every field including pace, pool quotes, commas and multiline notes", () => {
  const csv = Core.toCSV([record({ pool: 'A "水蓝" 泳馆, 2层', note: "第一行\n第二行" })]);
  const rows = parseCSV(csv);
  assert.ok(csv.startsWith("\ufeff"));
  assert.equal(rows[0].length, 9);
  assert.equal(rows[1].length, 9);
  assert.equal(rows[1][6], "2'00\"");
  assert.equal(rows[1][7], 'A "水蓝" 泳馆, 2层');
  assert.equal(rows[1][8], "第一行\n第二行");
});

test("CSV neutralizes spreadsheet formulas, including leading whitespace", () => {
  for (const note of ["=SUM(1,2)", "+1+2", "-1+2", "@A1", "   =1+1", "\t=1+1", "\ntext"]) assert.equal(parseCSV(Core.toCSV([record({ note })]))[1][8], "'" + note);
  assert.equal(parseCSV(Core.toCSV([record({ note: "普通备注" })]))[1][8], "普通备注");
});

test("invalid import is rejected before opening or writing storage", async () => {
  const harness = databaseHarness(state());
  const repository = Core.createRepository({ indexedDB: harness.indexedDB, localStorage: memoryStorage() });
  await assert.rejects(repository.save(state({ records: [record({ distance: -1 })] })));
  assert.equal(harness.opens, 0);
  assert.equal(harness.transactions.length, 0);
  assert.deepEqual(harness.current, state());
});

test("save waits for transaction complete rather than request success", async () => {
  const before = Core.validateState(state());
  const harness = databaseHarness(before, { holdWrites: true });
  const repository = Core.createRepository({ indexedDB: harness.indexedDB, localStorage: memoryStorage() });
  let resolved = false;
  const promise = repository.save(state({ records: [record({ distance: 2000 })] })).then(() => { resolved = true; });
  await tick();
  assert.equal(resolved, false);
  assert.deepEqual(harness.current, before);
  harness.transactions[0].complete();
  await promise;
  assert.equal(resolved, true);
  assert.equal(harness.current.records[0].distance, 2000);
});

test("transaction abort rejects and preserves the previous complete snapshot", async () => {
  const before = Core.validateState(state({ photos: { 1: photo } }));
  const harness = databaseHarness(before, { holdWrites: true });
  const repository = Core.createRepository({ indexedDB: harness.indexedDB, localStorage: memoryStorage() });
  const promise = repository.save(state({ records: [record({ id: 2 })] }));
  const rejection = assert.rejects(promise, /AbortError/);
  await tick(); harness.transactions[0].abort(); await rejection;
  assert.deepEqual(harness.current, before);
});

test("quota failure rejects without replacing records or photos", async () => {
  const before = Core.validateState(state({ photos: { 1: photo } }));
  const harness = databaseHarness(before); harness.failNextWrite();
  const repository = Core.createRepository({ indexedDB: harness.indexedDB, localStorage: memoryStorage() });
  await assert.rejects(repository.save(state({ records: [record({ id: 2 })] })), /QuotaExceededError/);
  assert.deepEqual(harness.current, before);
});

test("load atomically migrates legacy storage without deleting its raw backup", async () => {
  const values = { "swim-records": JSON.stringify([record({ hasPhoto: true })]), "swim-goal": "50000", "swim-photo:1": photo, unrelated: "preserved" };
  const storage = memoryStorage(values);
  const harness = databaseHarness();
  const repository = Core.createRepository({ indexedDB: harness.indexedDB, localStorage: storage });
  const loaded = await repository.load();
  assert.equal(loaded.goal.value, 50);
  assert.equal(loaded.photos[1], photo);
  assert.deepEqual(harness.current, loaded);
  assert.deepEqual(storage.snapshot(), values);
  assert.equal(repository.readLegacyRaw().unrelated, undefined);
});

test("failed migration keeps legacy bytes and does not create a snapshot", async () => {
  const values = { "swim-records": JSON.stringify([record()]), "swim-goal": "100000", "swim-photo:1": photo };
  const storage = memoryStorage(values);
  const harness = databaseHarness(); harness.failNextWrite();
  const repository = Core.createRepository({ indexedDB: harness.indexedDB, localStorage: storage });
  await assert.rejects(repository.load(), /QuotaExceededError/);
  assert.equal(harness.current, undefined);
  assert.deepEqual(storage.snapshot(), values);
});

test("malformed legacy input is preserved and blocks migration instead of loading blank", async () => {
  for (const raw of ["{broken", JSON.stringify([record({ date: "" })]), "null"]) {
    const storage = memoryStorage({ "swim-records": raw });
    const harness = databaseHarness();
    const repository = Core.createRepository({ indexedDB: harness.indexedDB, localStorage: storage });
    await assert.rejects(repository.load());
    assert.equal(harness.current, undefined);
    assert.equal(storage.getItem("swim-records"), raw);
    assert.equal(harness.transactions.length, 1);
  }
});

test("existing snapshot wins over legacy data, while corrupt snapshot blocks fallback", async () => {
  const storage = { getItem() { throw new Error("legacy should not be read"); } };
  const valid = Core.validateState(state({ records: [record({ distance: 500 })] }));
  const harness = databaseHarness(valid);
  assert.deepEqual(await Core.createRepository({ indexedDB: harness.indexedDB, localStorage: storage }).load(), valid);
  const broken = databaseHarness({ version: 999, records: [] });
  await assert.rejects(Core.createRepository({ indexedDB: broken.indexedDB, localStorage: storage }).load(), /版本/);
});

test("unavailable database and inaccessible legacy storage produce explicit failures", async () => {
  await assert.rejects(Core.createRepository({ indexedDB: null, localStorage: memoryStorage() }).load(), /数据库/);
  const harness = databaseHarness();
  const storage = { getItem() { throw new Error("SecurityError"); } };
  await assert.rejects(Core.createRepository({ indexedDB: harness.indexedDB, localStorage: storage }).load(), /SecurityError/);
  assert.equal(harness.current, undefined);
});


test("object prototype names cannot become record or photo IDs", () => {
  const reserved = [...Object.getOwnPropertyNames(Object.prototype), "prototype"];
  for (const id of reserved) {
    assert.throws(() => Core.validateState(state({ records: [record({ id })] })), /编号/, "record ID " + id);
    const photos = Object.fromEntries([[id, photo]]);
    assert.throws(() => Core.validateState(state({ photos })), /编号/, "photo ID " + id);
  }
  // Accepted IDs must not retrieve a prototype function from an empty photo map.
  for (const id of [1, "safe-record-id", "64bf23bf-7337-4ef9-bbdc-b477b7313578"]) {
    const normalized = Core.validateState(state({ records: [record({ id })] }));
    assert.equal(normalized.photos[id], undefined);
    assert.equal(normalized.records[0].hasPhoto, false);
  }
});
