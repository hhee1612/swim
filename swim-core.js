(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SwimCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_GOAL = { type: "distance", value: 100 };
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const reservedIds = new Set([...Object.getOwnPropertyNames(Object.prototype), "prototype"]);
  const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  function fail(message) { throw new Error(message); }
  function number(value, label, fallback) {
    if (value === undefined && fallback !== undefined) return fallback;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) fail(label + "必须是有限的非负数字");
    return value;
  }
  function text(value, label, fallback) {
    if (value === undefined && fallback !== undefined) return fallback;
    if (typeof value !== "string") fail(label + "必须是文字");
    return value;
  }
  function validId(id) {
    if (typeof id === "number") return Number.isSafeInteger(id) && id >= 0;
    return typeof id === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id) && !reservedIds.has(id);
  }
  function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    if (year < 1 || month < 1 || month > 12 || day < 1) return false;
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  }
  function normalizeGoal(raw) {
    if (raw === undefined) return { ...DEFAULT_GOAL };
    if (typeof raw === "number") raw = { type: "distance", value: raw / 1000 };
    if (!isObject(raw) || !["distance", "count", "days"].includes(raw.type)) fail("目标类型不正确");
    const value = number(raw.value, "目标");
    if (value <= 0 || (raw.type !== "distance" && !Number.isSafeInteger(value))) fail("目标须大于 0，次数和天数须为整数");
    return { type: raw.type, value };
  }
  function normalizePeriodGoals(raw) {
    if (raw === undefined) return [];
    if (!Array.isArray(raw)) fail("周期目标须为列表");
    const ids = new Set();
    const normalized = raw.map((goal) => {
      if (!isObject(goal) || !validId(goal.id) || ids.has(String(goal.id))) fail("周期目标编号无效或重复");
      ids.add(String(goal.id));
      if (!["week", "month"].includes(goal.period) || !["count", "distance"].includes(goal.type)) fail("周期目标类型不正确");
      const value = number(goal.value, "周期目标");
      if (value <= 0 || (goal.type === "count" && !Number.isSafeInteger(value))) fail("周期目标须大于 0，次数须为整数");
      const endDate = goal.endDate === undefined ? null : goal.endDate;
      if (!validDate(goal.startDate) || (endDate !== null && (!validDate(endDate) || endDate < goal.startDate))) fail("周期目标有效日期不正确");
      return { id: goal.id, period: goal.period, type: goal.type, value, startDate: goal.startDate, endDate };
    });
    for (const period of ["week", "month"]) {
      const goals = normalized.filter((goal) => goal.period === period).sort((a, b) => a.startDate.localeCompare(b.startDate));
      for (let index = 1; index < goals.length; index++) {
        const previous = goals[index - 1];
        if (previous.endDate === null || previous.endDate >= goals[index].startDate) fail("同一周期的目标有效日期不能重叠");
      }
    }
    return normalized;
  }
  function normalizeMeta(raw) {
    if (raw === undefined) return { lastBackupAt: null, backedUpRecordIds: [], lastBackupFingerprint: null };
    if (!isObject(raw)) fail("备份状态格式不正确");
    const at = raw.lastBackupAt === undefined ? null : raw.lastBackupAt;
    if (at !== null && (typeof at !== "string" || !validDate(at.slice(0, 10)) || !/^\d{4}-\d{2}-\d{2}T/.test(at) || !Number.isFinite(Date.parse(at)))) fail("最近备份时间不正确");
    const ids = raw.backedUpRecordIds === undefined ? [] : raw.backedUpRecordIds;
    if (!Array.isArray(ids) || ids.some((id) => !validId(id)) || new Set(ids.map(String)).size !== ids.length) fail("已备份记录编号不正确");
    const fingerprint = raw.lastBackupFingerprint === undefined ? null : raw.lastBackupFingerprint;
    if (fingerprint !== null && (typeof fingerprint !== "string" || !fingerprint)) fail("备份指纹不正确");
    return { lastBackupAt: at, backedUpRecordIds: [...ids], lastBackupFingerprint: fingerprint };
  }
  function normalizePreferences(raw, records) {
    if (raw === undefined) {
      const latest = [...records].filter((record) => record.swam).sort((a, b) => b.date.localeCompare(a.date))[0];
      return { stroke: latest && latest.stroke || "自由泳", pool: latest && latest.pool || "", durationMode: "elapsed" };
    }
    if (!isObject(raw)) fail("默认填写偏好格式不正确");
    const durationMode = raw.durationMode === undefined ? "elapsed" : raw.durationMode;
    if (!["elapsed", "moving", "unknown"].includes(durationMode)) fail("默认时长口径不正确");
    return { stroke: text(raw.stroke, "默认泳姿", "自由泳"), pool: text(raw.pool, "默认泳馆", ""), durationMode };
  }
  function validateState(raw) {
    if (!isObject(raw)) fail("备份须是一个对象");
    if (raw.version !== undefined && raw.version !== 1 && raw.version !== 2 && raw.version !== 3) fail("不支持此备份版本，请使用兼容版本的应用");
    if (!Array.isArray(raw.records)) fail("备份缺少有效的记录列表");
    const sourcePhotos = raw.photos === undefined ? {} : raw.photos;
    if (!isObject(sourcePhotos)) fail("照片列表格式不正确");
    const photos = {};
    for (const [id, value] of Object.entries(sourcePhotos)) {
      if (!validId(id)) fail("照片编号不正确");
      if (typeof value !== "string" || !/^data:image\/(?:jpeg|jpg|png|webp|gif|avif|bmp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value) || value.slice(value.indexOf(",") + 1).length % 4 !== 0) fail("照片 " + id + " 不是有效的图片数据");
      photos[id] = value;
    }
    const ids = new Set();
    const records = raw.records.map((record, index) => {
      const label = "第 " + (index + 1) + " 条记录：";
      if (!isObject(record) || !validId(record.id)) fail(label + "编号不正确");
      const key = String(record.id);
      if (ids.has(key)) fail(label + "编号重复");
      ids.add(key);
      if (!validDate(record.date)) fail(label + "日期不正确");
      if (typeof record.swam !== "boolean") fail(label + "游泳状态必须为布尔值");
      let mood = null;
      if (record.mood !== undefined && record.mood !== null) {
        if (!isObject(record.mood)) fail(label + "心情格式不正确");
        mood = { emoji: text(record.mood.emoji, label + "心情图标"), label: text(record.mood.label, label + "心情名称") };
      }
      const stroke = record.stroke === undefined || record.stroke === null ? null : text(record.stroke, label + "泳姿");
      if (record.hasPhoto !== undefined && typeof record.hasPhoto !== "boolean") fail(label + "照片状态不正确");
      const durationMode = record.durationMode === undefined ? "unknown" : record.durationMode;
      if (!["elapsed", "moving", "unknown"].includes(durationMode)) fail(label + "时长口径不正确");
      return {
        id: record.id,
        date: record.date,
        swam: record.swam,
        mood,
        stroke,
        distance: number(record.distance, label + "距离", 0),
        duration: number(record.duration, label + "时长", 0),
        durationMode,
        pool: text(record.pool, label + "泳馆", ""),
        note: text(record.note, label + "备注", ""),
        hasPhoto: own(photos, key),
      };
    });
    return { version: 3, records, goal: normalizeGoal(raw.goal), photos, periodGoals: normalizePeriodGoals(raw.periodGoals), meta: normalizeMeta(raw.meta), preferences: normalizePreferences(raw.preferences, records) };
  }

  function paceSeconds(distance, duration) {
    if (!Number.isFinite(distance) || !Number.isFinite(duration) || distance <= 0 || duration <= 0) return null;
    const pace = duration / distance * 6000;
    return Number.isFinite(pace) ? pace : null;
  }
  function fmtPace(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return null;
    const rounded = Math.round(seconds);
    return Math.floor(rounded / 60) + "'" + String(rounded % 60).padStart(2, "0") + '"';
  }
  function paceStr(distance, duration) { return fmtPace(paceSeconds(distance, duration)); }
  function summarize(records) {
    const sessions = records.filter((record) => record.swam);
    const paired = sessions.filter((record) => record.distance > 0 && record.duration > 0);
    return {
      sessionCount: sessions.length,
      dayCount: new Set(sessions.map((record) => record.date)).size,
      totalDistance: sessions.reduce((sum, record) => sum + record.distance, 0),
      totalTime: sessions.reduce((sum, record) => sum + record.duration, 0),
      avgPace: paceStr(paired.reduce((sum, record) => sum + record.distance, 0), paired.reduce((sum, record) => sum + record.duration, 0)),
    };
  }
  function csvCell(value) {
    let content = String(value == null ? "" : value);
    // Quoting alone does not prevent spreadsheet formula execution.
    if (/^[\s\u0000-\u001f]*[=+\-@]/.test(content) || /^[\t\r\n]/.test(content)) content = "'" + content;
    return '"' + content.replace(/"/g, '""') + '"';
  }
  function toCSV(records) {
    const header = ["日期", "是否游泳", "心情", "泳姿", "距离(米)", "时间(分钟)", "配速(每百米)", "游泳馆", "备注", "时长口径"];
    const rows = [...records].sort((a, b) => a.date.localeCompare(b.date)).map((record) => [
      record.date, record.swam ? "游了" : "没游", record.swam && record.mood ? record.mood.emoji + record.mood.label : "",
      record.swam ? record.stroke || "" : "", record.swam ? record.distance : "", record.swam ? record.duration : "",
      record.swam ? paceStr(record.distance, record.duration) || "" : "", record.pool || "", record.note || "",
      record.swam ? ({ elapsed: "含休息总时长", moving: "净游泳时长", unknown: "旧记录未标注" }[record.durationMode || "unknown"]) : "",
    ]);
    return "\ufeff" + [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  }

  function createRepository(environment) {
    const indexedDB = environment.indexedDB;
    const localStorage = environment.localStorage;
    let dbPromise;
    function open() {
      if (dbPromise) return dbPromise;
      dbPromise = new Promise((resolve, reject) => {
        if (!indexedDB || typeof indexedDB.open !== "function") return reject(new Error("无法使用本地数据库；请检查浏览器存储权限"));
        let request;
        let abandoned = false;
        const failed = (error) => { abandoned = true; reject(error || new Error("打开本地数据库失败")); };
        try { request = indexedDB.open("swim-journal", 1); } catch (error) { failed(error); return; }
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains("snapshots")) db.createObjectStore("snapshots");
        };
        request.onerror = () => failed(request.error);
        request.onblocked = () => failed(new Error("数据库升级被其他页面阻止，请关闭其他游泳记录页面后重试"));
        request.onsuccess = () => {
          const db = request.result;
          if (abandoned) { db.close(); return; }
          if (!db.objectStoreNames.contains("snapshots")) { db.close(); failed(new Error("本地数据库缺少记录存储区")); return; }
          db.onversionchange = () => { db.close(); dbPromise = undefined; };
          resolve(db);
        };
      });
      dbPromise = dbPromise.catch((error) => { dbPromise = undefined; throw error; });
      return dbPromise;
    }
    async function transaction(mode, state) {
      const db = await open();
      return new Promise((resolve, reject) => {
        let tx;
        let value;
        try {
          tx = db.transaction("snapshots", mode);
          tx.oncomplete = () => resolve(value);
          tx.onabort = () => reject(tx.error || new Error("保存已取消，原数据保持不变"));
          tx.onerror = () => reject(tx.error || new Error("本地数据库读写失败，原数据保持不变"));
          const store = tx.objectStore("snapshots");
          const request = mode === "readwrite" ? store.put(state, "current") : store.get("current");
          request.onsuccess = () => { value = mode === "readwrite" ? state : request.result; };
          request.onerror = () => { /* The transaction abort/error handlers report this failure. */ };
        } catch (error) {
          if (tx) { try { tx.abort(); } catch (_) { /* Already inactive. */ } }
          reject(error);
        }
      });
    }
    function readLegacyRaw() {
      if (!localStorage) fail("无法读取旧版本地存储，请检查浏览器存储权限");
      const raw = {};
      for (const key of ["swim-records", "swim-goal"]) {
        const value = localStorage.getItem(key);
        if (value !== null) raw[key] = value;
      }
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        if (key && key.startsWith("swim-photo:")) {
          const value = localStorage.getItem(key);
          if (value !== null) raw[key] = value;
        }
      }
      return raw;
    }
    async function save(raw) {
      const state = validateState(raw);
      await transaction("readwrite", state);
      return state;
    }
    async function load() {
      const current = await transaction("readonly");
      if (current !== undefined) return validateState(current);
      const raw = readLegacyRaw();
      const photos = {};
      for (const [key, value] of Object.entries(raw)) if (key.startsWith("swim-photo:")) Object.defineProperty(photos, key.slice(11), { value, enumerable: true, configurable: true, writable: true });
      let records;
      let goal;
      try {
        records = own(raw, "swim-records") ? JSON.parse(raw["swim-records"]) : [];
        goal = own(raw, "swim-goal") ? JSON.parse(raw["swim-goal"]) : undefined;
      } catch (_) { fail("旧版记录或目标数据损坏；请先导出原始数据，再恢复有效备份"); }
      const state = validateState({ version: 1, records, goal, photos });
      await save(state);
      return state;
    }
    return { load, save, readLegacyRaw };
  }

  return { validateState, validDate, paceSeconds, fmtPace, paceStr, summarize, toCSV, createRepository };
});

