// Generated from app.jsx by Babel 7.23.2; run node scripts/build.cjs.
function _extends() { _extends = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }
const {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo
} = React;
const holdUpdates = () => window.swimUpdates?.setSafeToReload(false);
const C = SwimCore,
  F = SwimFeatures;
const STROKES = ["自由泳", "蛙泳", "仰泳", "蝶泳", "混合"];
const MOODS = [{
  emoji: "😄",
  label: "超开心"
}, {
  emoji: "🙂",
  label: "还不错"
}, {
  emoji: "😮‍💨",
  label: "有点累"
}, {
  emoji: "😴",
  label: "好困"
}, {
  emoji: "💪",
  label: "超有劲"
}];
const MODES = {
  elapsed: "含休息",
  moving: "净游泳",
  unknown: "未注明"
};
const BADGES = [{
  d: 1,
  emoji: "🐣",
  name: "游泳萌新"
}, {
  d: 7,
  emoji: "🐠",
  name: "快乐小鱼"
}, {
  d: 21,
  emoji: "🐬",
  name: "灵动海豚"
}, {
  d: 50,
  emoji: "🐳",
  name: "深海鲸鱼"
}, {
  d: 100,
  emoji: "🥉",
  name: "铜牌泳将"
}, {
  d: 200,
  emoji: "🥈",
  name: "银牌健将"
}, {
  d: 365,
  emoji: "🥇",
  name: "金牌冠军"
}, {
  d: 500,
  emoji: "👑",
  name: "奥运传奇"
}];
const todayStr = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const shiftDate = (date, n) => {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const uuid = () => window.crypto?.randomUUID ? window.crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2);
const fmtNum = value => Number(value.toFixed(2)).toLocaleString("zh-CN");
const message = err => err?.name === "QuotaExceededError" ? "设备存储空间不足，请先导出备份，再释放空间重试。" : err?.message || "操作失败，请重试。";
function streaks(records, today) {
  const dates = [...new Set(records.filter(r => r.swam && r.date <= today).map(r => r.date))].sort();
  let longest = 0,
    run = 0,
    prev = null;
  for (const date of dates) {
    run = prev && shiftDate(prev, 1) === date ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = date;
  }
  const set = new Set(dates);
  let cursor = set.has(today) ? today : shiftDate(today, -1),
    current = 0;
  while (set.has(cursor)) {
    current++;
    cursor = shiftDate(cursor, -1);
  }
  return {
    current,
    longest
  };
}
function download(content, type, name) {
  const blob = new Blob([content], {
      type
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
async function compressImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error("照片无法读取，请换一张图片。"));
      img.src = url;
    });
    const scale = Math.min(1, 1000 / Math.max(img.width, img.height)),
      canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.72);
  } finally {
    URL.revokeObjectURL(url);
  }
}
function App() {
  const [data, setData] = useState(() => C.validateState({
    records: []
  }));
  const [loading, setLoading] = useState(true),
    [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [tab, setTab] = useState("records"),
    [modal, setModal] = useState(null),
    [form, setForm] = useState(null),
    [formError, setFormError] = useState("");
  const [deleted, setDeleted] = useState(null),
    [lightbox, setLightbox] = useState(null),
    [photoBusy, setPhotoBusy] = useState(false);
  const [month, setMonth] = useState(todayStr().slice(0, 7)),
    [selectedDate, setSelectedDate] = useState(null);
  const [filters, setFilters] = useState({
      query: "",
      stroke: "",
      pool: "",
      from: "",
      to: ""
    }),
    [filtersOpen, setFiltersOpen] = useState(false);
  const [trend, setTrend] = useState({
    period: "week",
    stroke: "自由泳",
    durationMode: "elapsed"
  });
  const [goalDraft, setGoalDraft] = useState({
    period: "week",
    type: "count",
    value: "3"
  });
  const [incoming, setIncoming] = useState(null),
    [importMode, setImportMode] = useState("merge"),
    [conflict, setConflict] = useState("keep"),
    [importReading, setImportReading] = useState(false);
  const [online, setOnline] = useState(navigator.onLine),
    [offline, setOffline] = useState(window.swimOffline || {
      ready: false,
      updateAvailable: false
    });
  const [today, setToday] = useState(todayStr());
  const [sharing, setSharing] = useState(false),
    [checkingUpdates, setCheckingUpdates] = useState(false);
  const safeToUpdate = !loading && !loadFailed && !busy && !modal && !photoBusy && !importReading && !deleted && !lightbox && !sharing;
  useLayoutEffect(() => {
    window.swimUpdates?.setSafeToReload(safeToUpdate);
  }, [safeToUpdate]);
  useEffect(() => () => holdUpdates(), []);
  const repo = useRef(null),
    lock = useRef(false),
    fields = useRef(null),
    photoRequest = useRef(0),
    importRef = useRef(null),
    importRequest = useRef(0);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        repo.current = C.createRepository({
          indexedDB: window.indexedDB,
          localStorage: window.localStorage
        });
        const state = await repo.current.load();
        if (active) setData(state);
      } catch (err) {
        if (active) {
          setLoadFailed(true);
          setError("读取失败：" + message(err) + " 原始数据仍保留，可导出原始数据或恢复备份。");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    const net = () => setOnline(navigator.onLine),
      off = e => setOffline(e.detail),
      date = () => setToday(todayStr());
    window.addEventListener("online", net);
    window.addEventListener("offline", net);
    window.addEventListener("swim-offline-status", off);
    window.addEventListener("focus", date);
    const timer = setInterval(date, 60000);
    return () => {
      active = false;
      window.removeEventListener("online", net);
      window.removeEventListener("offline", net);
      window.removeEventListener("swim-offline-status", off);
      window.removeEventListener("focus", date);
      clearInterval(timer);
    };
  }, []);
  async function persist(next, restoring = false) {
    if (lock.current || loading || loadFailed && !restoring) return false;
    holdUpdates();
    lock.current = true;
    setBusy(true);
    try {
      if (!repo.current) throw new Error("本机存储不可用，请检查浏览器权限。");
      const saved = await repo.current.save(C.validateState(next));
      setData(saved);
      setError("");
      setLoadFailed(false);
      return true;
    } catch (err) {
      setError("保存失败：" + message(err) + " 当前数据未更改。");
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function closeModal() {
    if (lock.current) return;
    photoRequest.current++;
    importRequest.current++;
    setPhotoBusy(false);
    setImportReading(false);
    setModal(null);
    setFormError("");
  }
  function openAdd(date = today) {
    if (loadFailed || lock.current) return;
    holdUpdates();
    const p = data.preferences || {
      stroke: "自由泳",
      pool: "",
      durationMode: "elapsed"
    };
    photoRequest.current++;
    setPhotoBusy(false);
    setFormError("");
    setForm({
      id: null,
      date,
      swam: true,
      mood: MOODS[0],
      stroke: p.stroke || "自由泳",
      distance: "",
      duration: "",
      durationMode: p.durationMode || "elapsed",
      pool: p.pool || "",
      note: "",
      photo: null
    });
    setModal("record");
  }
  function editRecord(r) {
    if (lock.current || loadFailed) return;
    holdUpdates();
    photoRequest.current++;
    setPhotoBusy(false);
    setFormError("");
    setForm({
      ...r,
      distance: r.distance ? String(r.distance) : "",
      duration: r.duration ? String(r.duration) : "",
      photo: data.photos[r.id] || null
    });
    setModal("record");
  }
  function setField(key, value) {
    setForm(prev => ({
      ...prev,
      [key]: value
    }));
  }
  async function pickPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const token = ++photoRequest.current;
    setPhotoBusy(true);
    setFormError("");
    try {
      const photo = await compressImage(file);
      if (token === photoRequest.current) setField("photo", photo);
    } catch (err) {
      if (token === photoRequest.current) setFormError(message(err));
    } finally {
      if (token === photoRequest.current) setPhotoBusy(false);
    }
  }
  async function saveRecord(e) {
    e.preventDefault();
    if (lock.current || photoBusy) return;
    if ([...fields.current.querySelectorAll("input")].some(input => input.validity.badInput)) {
      setFormError("请填写完整有效的日期和数字。");
      return;
    }
    if (!C.validDate(form.date)) {
      setFormError("请选择有效日期。");
      return;
    }
    if (form.date > today) {
      setFormError("游泳日记暂不记录未来的日期。");
      return;
    }
    const distance = form.swam ? Number(form.distance) : 0,
      duration = form.swam ? Number(form.duration) : 0;
    if (!Number.isFinite(distance) || distance < 0 || !Number.isFinite(duration) || duration < 0) {
      setFormError("距离和时间须为非负数字，未记录的项目可留空。");
      return;
    }
    const editing = form.id !== null,
      id = editing ? form.id : uuid();
    const record = {
      id,
      date: form.date,
      swam: form.swam,
      mood: form.swam ? form.mood : null,
      stroke: form.swam ? form.stroke : null,
      distance,
      duration,
      durationMode: form.durationMode || "unknown",
      pool: form.swam ? form.pool.trim() : "",
      note: form.note.trim(),
      hasPhoto: !!form.photo
    };
    const photos = {
      ...data.photos
    };
    if (form.photo) photos[id] = form.photo;else delete photos[id];
    const records = [record, ...data.records.filter(r => r.id !== id)].sort((a, b) => b.date.localeCompare(a.date));
    const preferences = !editing && form.swam ? {
      stroke: form.stroke,
      pool: form.pool.trim(),
      durationMode: form.durationMode
    } : data.preferences;
    const next = {
      ...data,
      records,
      photos,
      preferences
    };
    try {
      C.validateState(next);
    } catch (err) {
      setFormError(message(err));
      return;
    }
    if (await persist(next)) {
      const oldBest = data.records.filter(r => r.swam).reduce((best, r) => Math.max(best, r.distance), 0);
      setModal(null);
      setNotice(editing ? "记录已更新" : form.swam && oldBest > 0 && distance > oldBest ? "记录已保存 · 最长距离新纪录 🎉" : "记录已保存");
      setSelectedDate(record.date);
    }
  }
  async function removeRecord(record) {
    const photos = {
      ...data.photos
    };
    delete photos[record.id];
    if (await persist({
      ...data,
      records: data.records.filter(r => r.id !== record.id),
      photos
    })) {
      setDeleted({
        record,
        photo: data.photos[record.id] || null
      });
      setNotice("");
    }
  }
  async function undoDelete() {
    if (!deleted) return;
    const {
        record,
        photo
      } = deleted,
      photos = {
        ...data.photos
      };
    if (photo) photos[record.id] = photo;
    if (data.records.some(r => r.id === record.id)) return;
    if (await persist({
      ...data,
      records: [record, ...data.records].sort((a, b) => b.date.localeCompare(a.date)),
      photos
    })) {
      setDeleted(null);
      setNotice("记录和照片已恢复");
    }
  }
  function openGoal(period = "week") {
    holdUpdates();
    const found = period === "all" ? data.goal : data.periodGoals.find(g => g.period === period && g.startDate <= today && (!g.endDate || g.endDate >= today));
    setGoalDraft({
      period,
      type: found?.type || (period === "month" ? "distance" : "count"),
      value: String(found?.value || (period === "month" ? 10 : 3))
    });
    setFormError("");
    setModal("goal");
  }
  async function saveGoal(e) {
    e.preventDefault();
    const value = Number(goalDraft.value),
      type = goalDraft.type,
      period = goalDraft.period;
    if (!Number.isFinite(value) || value <= 0 || type !== "distance" && !Number.isSafeInteger(value)) {
      setFormError("距离须大于0，次数和天数须为正整数。");
      return;
    }
    let next;
    if (period === "all") next = {
      ...data,
      goal: {
        type,
        value
      }
    };else {
      const startDate = F.periodBounds(period, today).start;
      const periodGoals = data.periodGoals.flatMap(g => {
        if (g.period !== period || g.endDate && g.endDate < startDate) return [g];
        if (g.startDate >= startDate) return [];
        return [{
          ...g,
          endDate: shiftDate(startDate, -1)
        }];
      });
      periodGoals.push({
        id: uuid(),
        period,
        type,
        value,
        startDate,
        endDate: null
      });
      next = {
        ...data,
        periodGoals
      };
    }
    if (await persist(next)) {
      setModal(null);
      setNotice("目标已更新，已结束周期的目标保持不变");
    }
  }
  async function exportBackup() {
    if (lock.current || loadFailed) return;
    try {
      const exported = F.markBackup(data, new Date().toISOString());
      download(JSON.stringify({
        ...exported,
        exportedAt: new Date().toISOString()
      }), "application/json", "游泳备份_" + today + ".json");
      if (await persist(exported)) setNotice("已发起完整备份下载，请确认文件已保存");else setNotice("下载已发起，但导出时间未能保存");
    } catch (err) {
      setFormError("导出失败：" + message(err));
    }
  }
  function exportCSV() {
    download(C.toCSV(data.records), "text/csv;charset=utf-8;", "游泳记录_" + today + ".csv");
  }
  function exportRaw() {
    try {
      download(JSON.stringify({
        format: "swim-legacy-raw",
        data: repo.current.readLegacyRaw()
      }), "application/json", "游泳原始数据_" + today + ".json");
    } catch (err) {
      setError("导出失败：" + message(err));
    }
  }
  async function readImport(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || lock.current) return;
    const request = ++importRequest.current;
    setImportReading(true);
    setFormError("");
    setIncoming(null);
    try {
      const state = C.validateState(JSON.parse(await file.text()));
      if (request !== importRequest.current) return;
      setIncoming(state);
      setImportMode(loadFailed ? "replace" : "merge");
      setConflict("keep");
    } catch (err) {
      if (request === importRequest.current) setFormError("无法导入：" + message(err));
    } finally {
      if (request === importRequest.current) setImportReading(false);
    }
  }
  async function confirmImport() {
    if (!incoming || lock.current) return;
    if (importMode === "replace" && !confirm("将用备份替换当前全部记录、照片和目标。确定继续吗？")) return;
    try {
      const next = F.applyImport(data, incoming, {
        mode: importMode,
        conflict
      });
      if (await persist(next, true)) {
        setModal(null);
        setIncoming(null);
        setDeleted(null);
        setNotice(importMode === "merge" ? "备份已合并，重复记录未重复添加" : "备份已恢复");
      }
    } catch (err) {
      setFormError("导入失败：" + message(err));
    }
  }
  async function shareCard() {
    if (sharing) return;
    holdUpdates();
    setSharing(true);
    try {
      const sum = C.summarize(data.records.filter(r => r.date <= today)),
        c = document.createElement("canvas");
      c.width = 1080;
      c.height = 1350;
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#F1ECE0";
      ctx.fillRect(0, 0, 1080, 1350);
      ctx.fillStyle = "#117C0D";
      ctx.fillRect(70, 70, 32, 32);
      ctx.fillRect(102, 102, 16, 16);
      ctx.textAlign = "left";
      ctx.font = "bold 36px sans-serif";
      ctx.fillText("游进奥运", 140, 108);
      ctx.textAlign = "center";
      ctx.font = "bold 76px sans-serif";
      ctx.fillText("每一次下水，", 540, 250);
      ctx.fillText("都算数。", 540, 350);
      const poolImage = new Image();
      await new Promise((resolve, reject) => {
        poolImage.onload = resolve;
        poolImage.onerror = () => reject(new Error("分享插画未能加载"));
        poolImage.src = "./icons/pixel-pool.svg";
      });
      ctx.drawImage(poolImage, 300, 405, 480, 330);
      await document.fonts?.load("64px SwimPixel", "0123456789.,/:+-");
      const metrics = [{
        x: 220,
        value: fmtNum(sum.totalDistance / 1000),
        label: "累计公里"
      }, {
        x: 540,
        value: String(sum.sessionCount),
        label: "游泳次数"
      }, {
        x: 860,
        value: String(sum.dayCount),
        label: "打卡天数"
      }];
      for (const metric of metrics) {
        ctx.fillStyle = "#117C0D";
        ctx.font = "64px SwimPixel, monospace";
        ctx.fillText(metric.value, metric.x, 845);
        ctx.fillStyle = "#5D6558";
        ctx.font = "30px sans-serif";
        ctx.fillText(metric.label, metric.x, 912);
      }
      ctx.fillStyle = "#FAC75E";
      ctx.fillRect(88, 987, 904, 105);
      ctx.fillStyle = "#26352B";
      ctx.font = "bold 34px sans-serif";
      ctx.fillText("最长连续 " + streaks(data.records, today).longest + " 天，每一步都算数", 540, 1054);
      ctx.fillStyle = "#5D6558";
      ctx.font = "30px sans-serif";
      ctx.fillText(today + " · 我的游泳日记", 540, 1222);
      const blob = await new Promise(resolve => c.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("分享图片生成失败，请重试。");
      const file = new File([blob], "游泳打卡.png", {
        type: "image/png"
      });
      if (navigator.canShare?.({
        files: [file]
      })) {
        try {
          await navigator.share({
            files: [file],
            title: "我的游泳打卡"
          });
          return;
        } catch (err) {
          if (err.name === "AbortError") return;
        }
      }
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = "游泳打卡.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      setNotice("分享失败：" + message(err));
    } finally {
      setSharing(false);
    }
  }
  async function checkForUpdates() {
    if (checkingUpdates) return;
    if (!online) {
      setNotice("联网后会自动检查更新");
      return;
    }
    if (!window.swimUpdates) {
      setNotice("请关闭网站后重新打开，以启用自动更新");
      return;
    }
    setCheckingUpdates(true);
    try {
      await window.swimUpdates.check();
      setNotice("已检查更新，新版准备完成后会自动启用");
    } catch (err) {
      setNotice("暂时无法检查更新，恢复网络后会自动重试");
    } finally {
      setCheckingUpdates(false);
    }
  }
  const all = C.summarize(data.records.filter(r => r.date <= today)),
    week = F.periodBounds("week", today),
    weekStats = C.summarize(F.filterRecords(data.records, {
      from: week.start,
      to: today
    }));
  const streak = streaks(data.records, today),
    badge = BADGES.filter(b => b.d <= all.dayCount).at(-1),
    nextBadge = BADGES.find(b => b.d > all.dayCount);
  const validFilters = (!filters.from || C.validDate(filters.from)) && (!filters.to || C.validDate(filters.to));
  const backup = useMemo(() => F.backupInfo(data), [data]),
    filtered = validFilters ? F.filterRecords(data.records, filters) : [],
    pools = [...new Set(data.records.map(r => r.pool).filter(Boolean))].sort();
  const activeGoals = ["week", "month"].map(period => ({
    period,
    goal: data.periodGoals.find(g => g.period === period && g.startDate <= today && (!g.endDate || g.endDate >= today))
  }));
  const history = F.goalHistory(data.records, data.periodGoals, today, 6);
  const comparison = F.comparePeriods(data.records, {
      ...trend,
      date: today
    }),
    points = F.paceSeries(data.records, trend);
  const swims = data.records.filter(r => r.swam && r.date <= today);
  const maxDistance = swims.reduce((n, r) => Math.max(n, r.distance), 0),
    maxTime = swims.reduce((n, r) => Math.max(n, r.duration), 0);
  const sameMode = swims.filter(r => r.stroke === trend.stroke && r.durationMode === trend.durationMode);
  const paces = sameMode.map(r => C.paceSeconds(r.distance, r.duration)).filter(p => p !== null);
  const monthDistances = Array.from({
    length: 6
  }, (_, i) => {
    const d = new Date(today + "T12:00:00Z");
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - 5 + i);
    const key = d.toISOString().slice(0, 7);
    return {
      label: key.slice(5) + "月",
      value: swims.filter(r => r.date.startsWith(key)).reduce((n, r) => n + r.distance, 0) / 1000
    };
  });
  const recentDistances = [...swims].filter(r => r.distance > 0).sort((a, b) => a.date.localeCompare(b.date)).slice(-10).map(r => ({
    label: r.date.slice(5),
    value: r.distance
  }));
  const importPreview = useMemo(() => incoming ? F.mergePreview(data, incoming) : null, [data, incoming]);
  const cumulative = data.goal.type === "distance" ? all.totalDistance / 1000 : data.goal.type === "count" ? all.sessionCount : streak.current;
  const cumulativeUnit = data.goal.type === "distance" ? "km" : data.goal.type === "count" ? "次" : "天";
  const monthRecords = data.records.filter(r => r.date.startsWith(month) && r.date <= today),
    monthStats = C.summarize(monthRecords);
  function openBackup() {
    holdUpdates();
    importRequest.current++;
    setImportReading(false);
    setFormError("");
    setIncoming(null);
    setModal("backup");
  }
  if (loading) return React.createElement("main", {
    className: "loading",
    role: "status"
  }, React.createElement(Icon, {
    name: "swim"
  }), "\u6B63\u5728\u8BFB\u53D6\u6E38\u6CF3\u8BB0\u5F55\u2026");
  return React.createElement("main", {
    className: "app-shell tab-" + tab
  }, React.createElement("header", {
    className: "app-header"
  }, React.createElement("div", {
    className: "brand"
  }, React.createElement("span", {
    className: "brand-icon"
  }, React.createElement(Icon, {
    name: "swim"
  })), React.createElement("h1", null, "\u6E38\u8FDB\u5965\u8FD0")), React.createElement("div", {
    className: "header-actions"
  }, React.createElement(Btn, {
    small: true,
    onClick: shareCard,
    disabled: loadFailed || sharing
  }, React.createElement(Icon, {
    name: "share"
  }), "\u5206\u4EAB"), React.createElement(Btn, {
    small: true,
    onClick: openBackup
  }, React.createElement(Icon, {
    name: "backup"
  }), "\u5907\u4EFD", backup.changed && data.records.length > 0 && React.createElement("i", {
    className: "dot"
  })))), React.createElement("div", {
    className: "connection-line",
    role: "status"
  }, React.createElement("span", {
    className: online ? "online-dot" : "offline-dot"
  }), online ? offline.ready ? "已可离线使用" : offline.error ? "离线资源未就绪" : "正在准备离线使用" : "当前离线", offline.updating ? React.createElement("span", null, " \xB7 \u6B63\u5728\u66F4\u65B0\u81F3\u65B0\u7248\u2026") : offline.updateAvailable && React.createElement("span", null, " \xB7 ", safeToUpdate ? offline.updateBlocked ? "新版已就绪，请先完成或关闭其他页面" : "新版已就绪，即将自动更新" : "新版已就绪，当前操作结束后自动更新")), loadFailed && React.createElement("section", {
    className: "alert",
    role: "alert"
  }, React.createElement("p", null, error), React.createElement("div", {
    className: "button-row"
  }, React.createElement(Btn, {
    small: true,
    onClick: exportRaw
  }, "\u5BFC\u51FA\u539F\u59CB\u6570\u636E"), React.createElement(Btn, {
    small: true,
    onClick: openBackup
  }, "\u4ECE\u5907\u4EFD\u6062\u590D"))), !loadFailed && error && React.createElement("p", {
    className: "alert",
    role: "alert"
  }, error), notice && React.createElement("div", {
    className: "notice",
    role: "status"
  }, React.createElement("span", null, notice), React.createElement("button", {
    "aria-label": "\u5173\u95ED\u63D0\u793A",
    onClick: () => setNotice("")
  }, "\xD7")), tab === "records" && React.createElement(React.Fragment, null, React.createElement("section", {
    className: "welcome"
  }, React.createElement("div", {
    className: "hero-row"
  }, React.createElement("div", {
    className: "hero-copy"
  }, React.createElement("h2", null, "\u6BCF\u4E00\u6B21\u4E0B\u6C34\uFF0C", React.createElement("br", null), "\u90FD\u7B97\u6570\u3002"), React.createElement("p", null, "\u6162\u6162\u6E38\uFF0C\u4E5F\u5728\u524D\u8FDB\u3002")), React.createElement("img", {
    className: "hero-pool",
    src: "./icons/pixel-pool.svg",
    width: "160",
    height: "110",
    alt: "\u50CF\u7D20\u98CE\u5C0F\u6CF3\u6C60"
  })), React.createElement(Btn, {
    primary: true,
    onClick: () => openAdd(),
    disabled: busy || loadFailed,
    "aria-label": "\uFF0B \u8BB0\u5F55\u4ECA\u5929"
  }, React.createElement(Icon, {
    name: "plus"
  }), "\u8BB0\u5F55\u4ECA\u5929")), React.createElement("section", {
    className: "week-summary",
    "aria-label": "\u672C\u5468\u6982\u51B5"
  }, React.createElement("div", {
    className: "section-top"
  }, React.createElement("h2", null, "\u672C\u5468\u6982\u51B5"), React.createElement("span", {
    className: "muted small"
  }, week.start.slice(5), " \u2014 ", week.end.slice(5))), React.createElement("div", {
    className: "metrics three"
  }, React.createElement(Metric, {
    label: "\u6E38\u6CF3\u8DDD\u79BB",
    value: fmtNum(weekStats.totalDistance / 1000),
    unit: "km"
  }), React.createElement(Metric, {
    label: "\u6E38\u6CF3\u6B21\u6570",
    value: weekStats.sessionCount,
    unit: "\u6B21"
  }), React.createElement(Metric, {
    label: "\u6253\u5361\u5929\u6570",
    value: weekStats.dayCount,
    unit: "\u5929"
  }))), React.createElement("section", {
    className: "period-goals",
    "aria-label": "\u5468\u671F\u76EE\u6807"
  }, activeGoals.filter(({
    period
  }) => period === "week").map(({
    period,
    goal
  }) => goal ? React.createElement(GoalCard, {
    key: period,
    period: period,
    goal: goal,
    progress: F.periodProgress(data.records, goal, today),
    onEdit: () => openGoal(period),
    disabled: busy || loadFailed
  }) : React.createElement("button", {
    key: period,
    className: "goal-placeholder",
    onClick: () => openGoal(period),
    disabled: busy || loadFailed
  }, React.createElement("span", null, React.createElement(Icon, {
    name: "medal"
  }), "\u672C\u5468\u76EE\u6807"), React.createElement("strong", null, "\uFF0B \u8BBE\u5B9A\u6BCF\u5468\u6B21\u6570"))))), tab !== "records" && React.createElement("div", {
    className: "page-intro"
  }, React.createElement("div", null, React.createElement("p", {
    className: "eyebrow"
  }, "\u6211\u7684\u6E38\u6CF3\u65E5\u8BB0"), React.createElement("h2", null, {
    calendar: "日历",
    data: "一点点进步",
    badges: "我的勋章"
  }[tab])), React.createElement(Btn, {
    small: true,
    onClick: () => openAdd(),
    disabled: busy || loadFailed,
    "aria-label": "\uFF0B \u8BB0\u5F55\u4ECA\u5929"
  }, React.createElement(Icon, {
    name: "plus"
  }), "\u8BB0\u4E00\u6B21")), backup.changed && data.records.length > 0 && React.createElement("button", {
    className: "backup-nudge",
    onClick: openBackup
  }, React.createElement("span", null, React.createElement(Icon, {
    name: "backup"
  }), backup.unbackedCount > 0 ? backup.unbackedCount + " 条新增记录待备份" : "记录或目标有更新，建议备份"), React.createElement("span", null, "\u53BB\u5907\u4EFD \u203A")), React.createElement("nav", {
    className: "tabs",
    "aria-label": "\u4E3B\u89C6\u56FE"
  }, [["records", "记录", "record"], ["calendar", "日历", "calendar"], ["data", "进步", "chart"], ["badges", "勋章", "medal"]].map(([key, label, icon]) => React.createElement("button", {
    key: key,
    "aria-pressed": tab === key,
    className: tab === key ? "active" : "",
    onClick: () => setTab(key)
  }, React.createElement(Icon, {
    name: icon
  }), React.createElement("span", null, label)))), tab === "records" && React.createElement("section", {
    "aria-label": "\u5386\u53F2\u8BB0\u5F55",
    className: "section-stack"
  }, React.createElement("div", {
    className: "records-heading"
  }, React.createElement("div", null, React.createElement("h2", null, "\u6700\u8FD1\u8BB0\u5F55"), React.createElement("span", {
    className: "small muted"
  }, Object.values(filters).some(Boolean) ? "显示 " + filtered.length + " / " + data.records.length + " 条" : "共 " + data.records.length + " 条记录")), React.createElement("button", {
    className: "filter-toggle " + (Object.values(filters).some(Boolean) ? "has-filter" : ""),
    "aria-expanded": filtersOpen,
    onClick: () => setFiltersOpen(!filtersOpen)
  }, React.createElement(Icon, {
    name: "search"
  }), filtersOpen ? "收起筛选" : "筛选记录")), filtersOpen && React.createElement("div", {
    className: "card filters"
  }, React.createElement("label", {
    className: "search-field"
  }, React.createElement(Icon, {
    name: "search"
  }), React.createElement("input", {
    "aria-label": "\u641C\u7D22\u5907\u6CE8\u6216\u6CF3\u9986",
    placeholder: "\u641C\u7D22\u5907\u6CE8\u3001\u6CF3\u9986\u2026",
    value: filters.query,
    onChange: e => setFilters({
      ...filters,
      query: e.target.value
    })
  })), React.createElement("div", {
    className: "filter-grid"
  }, React.createElement(Field, {
    label: "\u6CF3\u59FF"
  }, React.createElement("select", {
    "aria-label": "\u7B5B\u9009\u6CF3\u59FF",
    value: filters.stroke,
    onChange: e => setFilters({
      ...filters,
      stroke: e.target.value
    })
  }, React.createElement("option", {
    value: ""
  }, "\u5168\u90E8\u6CF3\u59FF"), STROKES.map(s => React.createElement("option", {
    key: s
  }, s)))), React.createElement(Field, {
    label: "\u6CF3\u9986"
  }, React.createElement("select", {
    "aria-label": "\u7B5B\u9009\u6CF3\u9986",
    value: filters.pool,
    onChange: e => setFilters({
      ...filters,
      pool: e.target.value
    })
  }, React.createElement("option", {
    value: ""
  }, "\u5168\u90E8\u6CF3\u9986"), pools.map(p => React.createElement("option", {
    key: p
  }, p)))), React.createElement(Field, {
    label: "\u5F00\u59CB\u65E5\u671F"
  }, React.createElement("input", {
    "aria-label": "\u7B5B\u9009\u5F00\u59CB\u65E5\u671F",
    type: "date",
    value: filters.from,
    onChange: e => setFilters({
      ...filters,
      from: e.target.value
    })
  })), React.createElement(Field, {
    label: "\u7ED3\u675F\u65E5\u671F"
  }, React.createElement("input", {
    "aria-label": "\u7B5B\u9009\u7ED3\u675F\u65E5\u671F",
    type: "date",
    value: filters.to,
    onChange: e => setFilters({
      ...filters,
      to: e.target.value
    })
  })), !validFilters && React.createElement("p", {
    role: "alert",
    className: "field-error full"
  }, "\u8BF7\u8F93\u5165\u6709\u6548\u7684\u56DB\u4F4D\u5E74\u4EFD\u65E5\u671F\u3002"), filters.from && filters.to && filters.from > filters.to && React.createElement("p", {
    className: "field-error full"
  }, "\u7ED3\u675F\u65E5\u671F\u5E94\u4E0D\u65E9\u4E8E\u5F00\u59CB\u65E5\u671F\u3002"), React.createElement("button", {
    className: "text-button full",
    onClick: () => setFilters({
      query: "",
      stroke: "",
      pool: "",
      from: "",
      to: ""
    })
  }, "\u6E05\u9664\u5168\u90E8\u7B5B\u9009"))), filtered.length ? filtered.map(r => React.createElement(RecordCard, {
    key: r.id,
    record: r,
    photo: data.photos[r.id],
    disabled: busy,
    onEdit: () => editRecord(r),
    onDelete: () => removeRecord(r),
    onPhoto: () => {
      holdUpdates();
      setLightbox(data.photos[r.id]);
    }
  })) : React.createElement("div", {
    className: "card empty"
  }, React.createElement(Icon, {
    name: "swim"
  }), React.createElement("h3", null, data.records.length ? "没有符合条件的记录" : "从今天的游泳开始"), React.createElement("p", null, data.records.length ? "换个条件试试，原记录都还在。" : "记下距离、感受，或只记下一次坚持。"), !data.records.length && React.createElement(Btn, {
    onClick: () => openAdd(),
    disabled: loadFailed
  }, "\u8BB0\u5F55\u7B2C\u4E00\u6B21\u6E38\u6CF3"))), tab === "calendar" && React.createElement("section", {
    className: "section-stack"
  }, React.createElement("div", {
    className: "card"
  }, React.createElement(Calendar, {
    month: month,
    setMonth: setMonth,
    records: data.records,
    today: today,
    selected: selectedDate,
    onSelect: date => {
      setSelectedDate(date);
      if (!data.records.some(r => r.date === date)) openAdd(date);
    },
    disabled: busy || loadFailed
  }), React.createElement("p", {
    className: "small muted"
  }, "\u70B9\u9009\u65E5\u671F\u53EF\u8865\u8BB0\uFF0C\u540C\u4E00\u5929\u652F\u6301\u591A\u6B21\u6E38\u6CF3\u3002")), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "section-top"
  }, React.createElement("h2", null, month, " \u6708\u5C0F\u7ED3")), React.createElement("div", {
    className: "metrics three"
  }, React.createElement(Metric, {
    label: "\u6E38\u6CF3",
    value: monthStats.sessionCount,
    unit: "\u6B21"
  }), React.createElement(Metric, {
    label: "\u8DDD\u79BB",
    value: fmtNum(monthStats.totalDistance / 1000),
    unit: "km"
  }), React.createElement(Metric, {
    label: "\u65F6\u957F",
    value: fmtNum(monthStats.totalTime),
    unit: "\u5206"
  }))), selectedDate && React.createElement("div", {
    className: "section-stack"
  }, React.createElement("div", {
    className: "section-top"
  }, React.createElement("h2", null, selectedDate), React.createElement(Btn, {
    small: true,
    onClick: () => openAdd(selectedDate),
    disabled: busy || loadFailed || selectedDate > today
  }, "\uFF0B \u518D\u8BB0\u4E00\u6B21")), data.records.filter(r => r.date === selectedDate).map(r => React.createElement(RecordCard, {
    key: r.id,
    record: r,
    photo: data.photos[r.id],
    onEdit: () => editRecord(r),
    onDelete: () => removeRecord(r),
    onPhoto: () => {
      holdUpdates();
      setLightbox(data.photos[r.id]);
    },
    disabled: busy
  })))), tab === "data" && React.createElement("section", {
    className: "section-stack"
  }, React.createElement("section", {
    className: "period-goals month-goal",
    "aria-label": "\u672C\u6708\u76EE\u6807"
  }, activeGoals.filter(({
    period
  }) => period === "month").map(({
    period,
    goal
  }) => goal ? React.createElement(GoalCard, {
    key: period,
    period: period,
    goal: goal,
    progress: F.periodProgress(data.records, goal, today),
    onEdit: () => openGoal(period),
    disabled: busy || loadFailed
  }) : React.createElement("button", {
    key: period,
    className: "goal-placeholder",
    onClick: () => openGoal(period),
    disabled: busy || loadFailed
  }, React.createElement("span", null, React.createElement(Icon, {
    name: "medal"
  }), "\u672C\u6708\u76EE\u6807"), React.createElement("strong", null, "\uFF0B \u8BBE\u5B9A\u6BCF\u6708\u8DDD\u79BB")))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "section-top"
  }, React.createElement("h2", null, "\u770B\u89C1\u4F60\u7684\u8FDB\u6B65")), React.createElement("div", {
    className: "filter-grid"
  }, React.createElement(Field, {
    label: "\u6BD4\u8F83\u5468\u671F"
  }, React.createElement("select", {
    "aria-label": "\u6BD4\u8F83\u5468\u671F",
    value: trend.period,
    onChange: e => setTrend({
      ...trend,
      period: e.target.value
    })
  }, React.createElement("option", {
    value: "week"
  }, "\u672C\u5468 / \u4E0A\u5468"), React.createElement("option", {
    value: "month"
  }, "\u672C\u6708 / \u4E0A\u6708"))), React.createElement(Field, {
    label: "\u6CF3\u59FF"
  }, React.createElement("select", {
    "aria-label": "\u8D8B\u52BF\u6CF3\u59FF",
    value: trend.stroke,
    onChange: e => setTrend({
      ...trend,
      stroke: e.target.value
    })
  }, STROKES.map(s => React.createElement("option", {
    key: s
  }, s)))), React.createElement(Field, {
    label: "\u65F6\u957F\u53E3\u5F84",
    className: "full"
  }, React.createElement("select", {
    "aria-label": "\u8D8B\u52BF\u65F6\u957F\u53E3\u5F84",
    value: trend.durationMode,
    onChange: e => setTrend({
      ...trend,
      durationMode: e.target.value
    })
  }, Object.entries(MODES).map(([key, label]) => React.createElement("option", {
    key: key,
    value: key
  }, label, key === "unknown" ? "（旧记录）" : ""))))), React.createElement("div", {
    className: "comparison"
  }, React.createElement("div", null, React.createElement("span", null, trend.period === "week" ? "本周" : "本月"), React.createElement("strong", null, React.createElement("span", {
    className: "metric-value"
  }, fmtNum(comparison.current.totalDistance / 1000)), " ", React.createElement("small", null, "km")), React.createElement("p", null, comparison.current.sessionCount, " \u6B21 \xB7 ", comparison.current.avgPace || "—", " /100m")), React.createElement("div", null, React.createElement("span", null, trend.period === "week" ? "上周" : "上月"), React.createElement("strong", null, React.createElement("span", {
    className: "metric-value"
  }, fmtNum(comparison.previous.totalDistance / 1000)), " ", React.createElement("small", null, "km")), React.createElement("p", null, comparison.previous.sessionCount, " \u6B21 \xB7 ", comparison.previous.avgPace || "—", " /100m"))), React.createElement("p", {
    className: "small muted"
  }, "\u4EC5\u6BD4\u8F83\u6240\u9009\u6CF3\u59FF\u4E0E\u8BA1\u65F6\u65B9\u5F0F\u3002\u5F53\u524D\u5468\u671F\u672A\u7ED3\u675F\u65F6\uFF0C\u6570\u636E\u4E3A\u9636\u6BB5\u7ED3\u679C\u3002")), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "section-top"
  }, React.createElement("h2", null, "\u914D\u901F\u8D8B\u52BF"), React.createElement("span", {
    className: "small muted"
  }, "\u6700\u8FD1 ", points.length, " \u4E2A\u8BAD\u7EC3\u65E5")), React.createElement(PaceChart, {
    points: points
  }), React.createElement("p", {
    className: "small muted"
  }, "\u6570\u503C\u8D8A\u5C0F\uFF0C\u914D\u901F\u8D8A\u5FEB\uFF1B\u672A\u586B\u5199\u8DDD\u79BB\u6216\u65F6\u957F\u7684\u8BB0\u5F55\u4E0D\u8BA1\u5165\u3002")), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "section-top"
  }, React.createElement("h2", null, "\u7D2F\u8BA1\u76EE\u6807"), React.createElement(Btn, {
    small: true,
    onClick: () => openGoal("all"),
    disabled: busy || loadFailed
  }, "\u4FEE\u6539")), React.createElement(Progress, {
    current: cumulative,
    target: data.goal.value
  }), React.createElement("p", {
    className: "goal-copy"
  }, fmtNum(cumulative), " / ", fmtNum(data.goal.value), " ", cumulativeUnit, cumulative >= data.goal.value ? " · 已达成 🎉" : ""), React.createElement("div", {
    className: "metrics three"
  }, React.createElement(Metric, {
    label: "\u603B\u8DDD\u79BB",
    value: fmtNum(all.totalDistance / 1000),
    unit: "km"
  }), React.createElement(Metric, {
    label: "\u603B\u6B21\u6570",
    value: all.sessionCount,
    unit: "\u6B21"
  }), React.createElement(Metric, {
    label: "\u6700\u957F\u8FDE\u7EED",
    value: streak.longest,
    unit: "\u5929"
  }))), React.createElement("div", {
    className: "card"
  }, React.createElement("div", {
    className: "section-top"
  }, React.createElement("h2", null, "\u76EE\u6807\u8FBE\u6210\u8BB0\u5F55")), history.length ? React.createElement("ul", {
    className: "goal-history"
  }, history.map((h, i) => React.createElement("li", {
    key: h.goalId + "-" + h.start + "-" + i
  }, React.createElement("div", null, React.createElement("strong", null, h.label || h.start + " — " + h.end), React.createElement("span", null, fmtNum(h.current), " / ", fmtNum(h.target), " ", h.type === "distance" ? "km" : "次")), React.createElement("b", {
    className: h.done ? "achieved" : ""
  }, h.done ? "已达成" : "未达成")))) : React.createElement("p", {
    className: "muted"
  }, "\u8BBE\u5B9A\u5468/\u6708\u76EE\u6807\u540E\uFF0C\u5DF2\u7ED3\u675F\u5468\u671F\u7684\u7ED3\u679C\u4F1A\u4FDD\u7559\u5728\u8FD9\u91CC\u3002")), React.createElement("details", {
    className: "card more-stats"
  }, React.createElement("summary", null, "\u4E2A\u4EBA\u6700\u4F73\u4E0E\u66F4\u591A\u7EDF\u8BA1"), React.createElement("div", {
    className: "metrics three"
  }, React.createElement(Metric, {
    label: "\u6700\u957F\u8DDD\u79BB",
    value: fmtNum(maxDistance),
    unit: "\u7C73"
  }), React.createElement(Metric, {
    label: "\u6700\u957F\u65F6\u957F",
    value: fmtNum(maxTime),
    unit: "\u5206"
  }), React.createElement(Metric, {
    label: "\u6700\u957F\u8FDE\u7EED",
    value: streak.longest,
    unit: "\u5929"
  })), React.createElement("p", {
    className: "helper"
  }, "\u6240\u9009\u6CF3\u59FF / \u8BA1\u65F6\u65B9\u5F0F\u7684\u6700\u5FEB\u914D\u901F\uFF1A", paces.length ? C.fmtPace(Math.min(...paces)) + " /100m" : "暂无"), React.createElement("h3", null, "\u8FD1 6 \u4E2A\u6708\u8DDD\u79BB\uFF08km\uFF09"), React.createElement(DistanceBars, {
    items: monthDistances
  }), React.createElement("h3", null, "\u8FD1\u671F\u6BCF\u6B21\u8DDD\u79BB\uFF08\u7C73\uFF09"), React.createElement(DistanceBars, {
    items: recentDistances
  }), React.createElement("h3", null, "\u6CF3\u59FF\u7EDF\u8BA1"), React.createElement("ul", {
    className: "stroke-counts"
  }, STROKES.map(stroke => React.createElement("li", {
    key: stroke
  }, React.createElement("span", null, stroke), React.createElement("b", null, swims.filter(r => r.stroke === stroke).length, " \u6B21")))))), tab === "badges" && React.createElement("section", {
    className: "section-stack"
  }, React.createElement("div", {
    className: "card badge-hero"
  }, React.createElement("span", null, badge?.emoji || "🌱"), React.createElement("h2", null, badge?.name || "等待第一次打卡"), React.createElement("p", null, "\u7D2F\u8BA1 ", all.dayCount, " \u5929 \xB7 \u5171 ", all.sessionCount, " \u6B21\u6E38\u6CF3"), React.createElement("p", {
    className: "muted"
  }, "\u5F53\u524D\u8FDE\u7EED ", streak.current, " \u5929"), nextBadge && React.createElement("p", {
    className: "muted"
  }, "\u518D\u6E38 ", nextBadge.d - all.dayCount, " \u5929\uFF0C\u89E3\u9501\u300C", nextBadge.name, "\u300D")), React.createElement("div", {
    className: "card badge-grid"
  }, BADGES.map(b => React.createElement("div", {
    key: b.d,
    className: all.dayCount >= b.d ? "badge unlocked" : "badge"
  }, React.createElement("span", null, all.dayCount >= b.d ? b.emoji : "🔒"), React.createElement("strong", null, b.name), React.createElement("small", null, all.dayCount >= b.d ? "已获得" : b.d + " 天"))))), React.createElement("footer", null, "\u6570\u636E\u4FDD\u5B58\u5728\u5F53\u524D\u6D4F\u89C8\u5668 \xB7 ", React.createElement("button", {
    className: "text-button",
    onClick: openBackup
  }, "\u5B9A\u671F\u5BFC\u51FA\u5907\u4EFD"), React.createElement("br", null), React.createElement("button", {
    className: "text-button",
    onClick: checkForUpdates,
    disabled: checkingUpdates
  }, checkingUpdates ? "正在检查更新…" : "检查更新"), " \xB7 \u8054\u7F51\u65F6\u81EA\u52A8\u66F4\u65B0"), deleted && React.createElement("div", {
    className: "undo-toast",
    role: "status"
  }, React.createElement("span", null, "\u5DF2\u5220\u9664 ", deleted.record.date, " \u7684\u8BB0\u5F55"), React.createElement(Btn, {
    small: true,
    onClick: undoDelete,
    disabled: busy
  }, "\u64A4\u9500\u5220\u9664"), React.createElement("button", {
    "aria-label": "\u5173\u95ED\u64A4\u9500\u63D0\u793A",
    onClick: () => setDeleted(null)
  }, "\xD7")), modal === "record" && form && React.createElement(Modal, {
    title: form.id === null ? "记录一次游泳" : "编辑游泳记录",
    onClose: closeModal,
    busy: busy
  }, React.createElement("form", {
    onSubmit: saveRecord,
    noValidate: true
  }, formError && React.createElement("p", {
    className: "alert",
    role: "alert"
  }, formError), error && React.createElement("p", {
    className: "alert",
    role: "alert"
  }, error), React.createElement("fieldset", {
    ref: fields,
    disabled: busy
  }, React.createElement(Field, {
    label: "\u65E5\u671F"
  }, React.createElement("input", {
    "aria-label": "\u65E5\u671F",
    type: "date",
    value: form.date,
    max: today,
    required: true,
    onChange: e => setField("date", e.target.value)
  })), React.createElement("div", {
    className: "segments"
  }, React.createElement("button", {
    type: "button",
    className: form.swam ? "active" : "",
    onClick: () => setField("swam", true)
  }, "\uD83C\uDFCA \u6E38\u4E86"), React.createElement("button", {
    type: "button",
    className: !form.swam ? "active" : "",
    onClick: () => setField("swam", false)
  }, "\uD83D\uDECB\uFE0F \u4F11\u606F")), form.swam && React.createElement(React.Fragment, null, React.createElement(Field, {
    label: "\u6CF3\u59FF"
  }, React.createElement("div", {
    className: "chips"
  }, STROKES.map(s => React.createElement("button", {
    type: "button",
    key: s,
    "aria-pressed": form.stroke === s,
    onClick: () => setField("stroke", s),
    className: form.stroke === s ? "selected" : ""
  }, s)))), React.createElement("div", {
    className: "filter-grid"
  }, React.createElement(Field, {
    label: "\u8DDD\u79BB\uFF08\u7C73\uFF09"
  }, React.createElement("input", {
    "aria-label": "\u8DDD\u79BB (\u7C73)",
    type: "number",
    min: "0",
    step: "any",
    inputMode: "decimal",
    value: form.distance,
    placeholder: "\u53EF\u7559\u7A7A",
    onChange: e => setField("distance", e.target.value)
  })), React.createElement(Field, {
    label: "\u65F6\u95F4\uFF08\u5206\u949F\uFF09"
  }, React.createElement("input", {
    "aria-label": "\u65F6\u95F4 (\u5206\u949F)",
    type: "number",
    min: "0",
    step: "any",
    inputMode: "decimal",
    value: form.duration,
    placeholder: "\u53EF\u7559\u7A7A",
    onChange: e => setField("duration", e.target.value)
  }))), React.createElement("div", {
    className: "chips quick-distances",
    "aria-label": "\u5E38\u7528\u8DDD\u79BB"
  }, [500, 1000, 1500, 2000].map(d => React.createElement("button", {
    type: "button",
    key: d,
    onClick: () => setField("distance", String(d))
  }, d, " \u7C73"))), React.createElement(Field, {
    label: "\u8FD9\u6BB5\u65F6\u95F4\u5982\u4F55\u8BA1\u65F6\uFF1F"
  }, React.createElement("select", {
    "aria-label": "\u65F6\u957F\u53E3\u5F84",
    value: form.durationMode,
    onChange: e => setField("durationMode", e.target.value)
  }, React.createElement("option", {
    value: "elapsed"
  }, "\u542B\u4F11\u606F\uFF1A\u4ECE\u5F00\u59CB\u5230\u7ED3\u675F"), React.createElement("option", {
    value: "moving"
  }, "\u51C0\u6E38\u6CF3\uFF1A\u5DF2\u6263\u9664\u4F11\u606F"), React.createElement("option", {
    value: "unknown"
  }, "\u672A\u6CE8\u660E / \u4E0D\u786E\u5B9A"))), C.paceStr(Number(form.distance), Number(form.duration)) && React.createElement("p", {
    className: "pace-preview"
  }, "\u914D\u901F ", C.paceStr(Number(form.distance), Number(form.duration)), " /100m \xB7 ", MODES[form.durationMode]), React.createElement(Field, {
    label: "\u6CF3\u9986"
  }, React.createElement("input", {
    "aria-label": "\u6E38\u6CF3\u9986",
    list: "pool-options",
    value: form.pool,
    onChange: e => setField("pool", e.target.value),
    placeholder: "\u4F8B\u5982\uFF1A\u5E02\u4F53\u80B2\u4E2D\u5FC3"
  }), React.createElement("datalist", {
    id: "pool-options"
  }, pools.map(p => React.createElement("option", {
    key: p,
    value: p
  })))), React.createElement(Field, {
    label: "\u4ECA\u5929\u7684\u611F\u53D7"
  }, React.createElement("div", {
    className: "chips moods"
  }, MOODS.map(m => React.createElement("button", {
    type: "button",
    key: m.label,
    className: form.mood?.label === m.label ? "selected" : "",
    "aria-label": m.label,
    "aria-pressed": form.mood?.label === m.label,
    onClick: () => setField("mood", m)
  }, React.createElement("span", null, m.emoji), m.label))))), React.createElement(Field, {
    label: "\u5907\u6CE8"
  }, React.createElement("textarea", {
    "aria-label": "\u5907\u6CE8",
    rows: "3",
    value: form.note,
    onChange: e => setField("note", e.target.value),
    placeholder: form.swam ? "今天练了什么，有什么小进步？" : "休息一下，也给自己留句话。"
  })), React.createElement(Field, {
    label: "\u7167\u7247"
  }, React.createElement("input", {
    "aria-label": "\u6DFB\u52A0\u7167\u7247",
    type: "file",
    accept: "image/*",
    onChange: pickPhoto
  }), form.photo && React.createElement("div", {
    className: "photo-preview"
  }, React.createElement("img", {
    src: form.photo,
    alt: "\u6240\u9009\u7167\u7247\u9884\u89C8"
  }), React.createElement("button", {
    type: "button",
    onClick: () => {
      photoRequest.current++;
      setPhotoBusy(false);
      setField("photo", null);
    }
  }, "\u79FB\u9664\u7167\u7247"))), photoBusy && React.createElement("p", {
    role: "status",
    className: "muted"
  }, "\u6B63\u5728\u5904\u7406\u7167\u7247\u2026"), React.createElement(Btn, {
    primary: true,
    wide: true,
    type: "submit",
    disabled: busy || photoBusy
  }, busy ? "正在保存…" : form.id === null ? "保存记录" : "保存修改")))), modal === "goal" && React.createElement(Modal, {
    title: "\u8BBE\u5B9A\u4F60\u7684\u76EE\u6807",
    onClose: closeModal,
    busy: busy
  }, React.createElement("form", {
    onSubmit: saveGoal,
    noValidate: true
  }, formError && React.createElement("p", {
    className: "alert",
    role: "alert"
  }, formError), error && React.createElement("p", {
    className: "alert",
    role: "alert"
  }, error), React.createElement("fieldset", {
    disabled: busy
  }, React.createElement(Field, {
    label: "\u76EE\u6807\u5468\u671F"
  }, React.createElement("select", {
    "aria-label": "\u76EE\u6807\u5468\u671F",
    value: goalDraft.period,
    onChange: e => setGoalDraft({
      ...goalDraft,
      period: e.target.value,
      type: goalDraft.type === "days" && e.target.value !== "all" ? "count" : goalDraft.type
    })
  }, React.createElement("option", {
    value: "week"
  }, "\u6BCF\u5468"), React.createElement("option", {
    value: "month"
  }, "\u6BCF\u6708"), React.createElement("option", {
    value: "all"
  }, "\u7D2F\u8BA1"))), React.createElement(Field, {
    label: "\u76EE\u6807\u7C7B\u578B"
  }, React.createElement("select", {
    "aria-label": "\u76EE\u6807\u7C7B\u578B",
    value: goalDraft.type,
    onChange: e => setGoalDraft({
      ...goalDraft,
      type: e.target.value
    })
  }, React.createElement("option", {
    value: "count"
  }, "\u6E38\u6CF3\u6B21\u6570"), React.createElement("option", {
    value: "distance"
  }, "\u6E38\u6CF3\u8DDD\u79BB\uFF08km\uFF09"), goalDraft.period === "all" && React.createElement("option", {
    value: "days"
  }, "\u8FDE\u7EED\u6253\u5361\u5929\u6570"))), React.createElement(Field, {
    label: "目标数值（" + (goalDraft.type === "distance" ? "km" : goalDraft.type === "count" ? "次" : "天") + "）"
  }, React.createElement("input", {
    "aria-label": "\u76EE\u6807\u6570\u503C",
    type: "number",
    min: "0",
    step: goalDraft.type === "distance" ? "any" : "1",
    value: goalDraft.value,
    onChange: e => setGoalDraft({
      ...goalDraft,
      value: e.target.value
    })
  })), React.createElement("p", {
    className: "helper"
  }, goalDraft.period === "all" ? "累计目标使用全部记录；连续天数使用当前连续打卡。" : "目标从当前周期开始，之后每周 / 每月继续使用。修改不会改变已结束周期的目标。"), React.createElement(Btn, {
    primary: true,
    wide: true,
    type: "submit",
    disabled: busy
  }, busy ? "正在保存…" : "保存目标")))), modal === "backup" && React.createElement(Modal, {
    title: "\u5907\u4EFD\u4E0E\u6062\u590D",
    onClose: closeModal,
    busy: busy
  }, React.createElement("p", {
    className: "helper"
  }, "\u5B8C\u6574\u5907\u4EFD\u5305\u542B\u8BB0\u5F55\u3001\u7167\u7247\u3001\u76EE\u6807\u548C\u504F\u597D\u3002\u6570\u636E\u53EA\u4FDD\u5B58\u5728\u8FD9\u53F0\u8BBE\u5907\u7684\u5F53\u524D\u6D4F\u89C8\u5668\uFF0C\u8BF7\u786E\u8BA4\u4E0B\u8F7D\u540E\u6587\u4EF6\u5DF2\u4FDD\u5B58\u3002"), React.createElement("div", {
    className: "backup-summary"
  }, React.createElement("span", null, "\u6700\u8FD1\u5BFC\u51FA"), React.createElement("strong", null, backup.lastBackupAt ? new Date(backup.lastBackupAt).toLocaleString("zh-CN") : "尚未导出"), React.createElement("p", null, backup.unbackedCount, " \u6761\u65B0\u589E\u8BB0\u5F55\u5F85\u5907\u4EFD", backup.changed && backup.unbackedCount === 0 ? " · 有其他内容更新" : "")), formError && React.createElement("p", {
    className: "alert",
    role: "alert"
  }, formError), error && React.createElement("p", {
    className: "alert",
    role: "alert"
  }, error), React.createElement("div", {
    className: "section-stack"
  }, React.createElement(Btn, {
    primary: true,
    wide: true,
    onClick: exportBackup,
    disabled: busy || loadFailed
  }, "\u5BFC\u51FA\u5B8C\u6574\u5907\u4EFD\uFF08\u542B\u7167\u7247\uFF09"), React.createElement(Btn, {
    wide: true,
    onClick: exportCSV,
    disabled: busy || loadFailed
  }, "\u5BFC\u51FA CSV \u8868\u683C"), React.createElement("input", {
    ref: importRef,
    "aria-label": "\u5BFC\u5165\u5907\u4EFD\u6587\u4EF6",
    type: "file",
    accept: ".json,application/json",
    onChange: readImport,
    disabled: busy
  })), importReading && React.createElement("p", {
    role: "status",
    className: "helper"
  }, "\u6B63\u5728\u8BFB\u53D6\u5907\u4EFD\u6587\u4EF6\u2026"), incoming && React.createElement("section", {
    className: "import-preview"
  }, React.createElement("h3", null, "\u5BFC\u5165\u9884\u89C8"), React.createElement("p", null, "\u6587\u4EF6\u5185\u5171 ", incoming.records.length, " \u6761\u8BB0\u5F55"), React.createElement("div", {
    className: "segments"
  }, React.createElement("button", {
    type: "button",
    disabled: loadFailed || busy,
    className: importMode === "merge" ? "active" : "",
    onClick: () => setImportMode("merge")
  }, "\u5408\u5E76\u5230\u672C\u673A"), React.createElement("button", {
    type: "button",
    disabled: busy,
    className: importMode === "replace" ? "active" : "",
    onClick: () => setImportMode("replace")
  }, "\u66FF\u6362\u5168\u90E8")), importMode === "merge" ? React.createElement(React.Fragment, null, React.createElement("div", {
    className: "import-counts"
  }, React.createElement("span", null, "\u65B0\u589E ", React.createElement("b", null, importPreview.added)), React.createElement("span", null, "\u91CD\u590D ", React.createElement("b", null, importPreview.duplicates)), React.createElement("span", null, "\u5185\u5BB9\u4E0D\u540C ", React.createElement("b", null, importPreview.conflicts))), React.createElement("p", {
    className: "helper"
  }, "\u5B8C\u5168\u76F8\u540C\u7684\u8BB0\u5F55\u4F1A\u8DF3\u8FC7\u3002\u672C\u673A\u76EE\u6807\u4E0E\u504F\u597D\u4FDD\u6301\u4E0D\u53D8\u3002"), importPreview.conflicts > 0 && React.createElement(Field, {
    label: "\u76F8\u540C\u8BB0\u5F55\u6709\u4E0D\u540C\u5185\u5BB9\u65F6"
  }, React.createElement("select", {
    "aria-label": "\u51B2\u7A81\u5904\u7406",
    value: conflict,
    disabled: busy,
    onChange: e => setConflict(e.target.value)
  }, React.createElement("option", {
    value: "keep"
  }, "\u4FDD\u7559\u672C\u673A\u7248\u672C"), React.createElement("option", {
    value: "incoming"
  }, "\u4F7F\u7528\u5907\u4EFD\u7248\u672C\uFF08\u542B\u7167\u7247\uFF09")), React.createElement("ul", {
    className: "conflict-list"
  }, importPreview.conflictIds.slice(0, 5).map(id => {
    const r = incoming.records.find(r => String(r.id) === String(id));
    return React.createElement("li", {
      key: String(id)
    }, r?.date, " \xB7 ", r?.stroke || "休息", " \xB7 ", r?.distance || 0, "\u7C73");
  })), importPreview.conflicts > 5 && React.createElement("p", {
    className: "small muted"
  }, "\u53E6\u6709 ", importPreview.conflicts - 5, " \u6761\uFF0C\u7EDF\u4E00\u4F7F\u7528\u4E0A\u65B9\u9009\u62E9\u3002"))) : React.createElement("p", {
    className: "alert"
  }, "\u66FF\u6362\u4F1A\u8986\u76D6\u672C\u673A\u5168\u90E8\u8BB0\u5F55\u3001\u7167\u7247\u548C\u76EE\u6807\u3002\u5EFA\u8BAE\u5148\u5BFC\u51FA\u5F53\u524D\u5907\u4EFD\u3002"), React.createElement(Btn, {
    primary: true,
    wide: true,
    onClick: confirmImport,
    disabled: busy
  }, busy ? "正在保存…" : importMode === "merge" ? "确认合并" : "确认替换全部数据"))), lightbox && React.createElement(Modal, {
    title: "\u6E38\u6CF3\u7167\u7247",
    onClose: () => setLightbox(null)
  }, React.createElement("img", {
    className: "lightbox-image",
    src: lightbox,
    alt: "\u6E38\u6CF3\u7167\u7247"
  })));
}
function Icon({
  name,
  className = ""
}) {
  return React.createElement("svg", {
    className: "pixel-icon " + className,
    viewBox: "0 0 24 24",
    "aria-hidden": "true",
    focusable: "false"
  }, React.createElement("use", {
    href: "./icons/pixel-icons.svg#" + name
  }));
}
function Btn({
  children,
  primary,
  small,
  wide,
  className = "",
  type = "button",
  ...props
}) {
  return React.createElement("button", _extends({
    type: type,
    className: ["btn", primary && "primary", small && "small-btn", wide && "wide", className].filter(Boolean).join(" ")
  }, props), children);
}
function Field({
  label,
  children,
  className = ""
}) {
  return React.createElement("div", {
    className: "field " + className,
    role: "group",
    "aria-label": label
  }, React.createElement("span", null, label), children);
}
function Metric({
  label,
  value,
  unit
}) {
  return React.createElement("div", {
    className: "metric"
  }, React.createElement("strong", null, React.createElement("span", {
    className: "metric-value"
  }, value), React.createElement("small", null, unit)), React.createElement("span", null, label));
}
function Progress({
  current,
  target
}) {
  const pct = Math.min(100, Math.max(0, current / target * 100));
  return React.createElement("div", {
    className: "progress",
    role: "progressbar",
    "aria-label": "\u76EE\u6807\u8FDB\u5EA6",
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    "aria-valuenow": Number(pct.toFixed(1))
  }, React.createElement("i", {
    style: {
      width: pct + "%"
    }
  }));
}
function GoalCard({
  period,
  goal,
  progress,
  onEdit,
  disabled
}) {
  return React.createElement("div", {
    className: "goal-card " + (progress.done ? "goal-done" : "")
  }, React.createElement("div", {
    className: "goal-line"
  }, React.createElement("span", {
    className: "goal-caption"
  }, React.createElement(Icon, {
    name: "medal"
  }), period === "week" ? "本周" : "本月", "\u76EE\u6807", progress.done ? " ✓" : ""), React.createElement("button", {
    className: "goal-value",
    onClick: onEdit,
    disabled: disabled,
    "aria-label": "修改" + (period === "week" ? "本周" : "本月") + "目标"
  }, React.createElement("strong", {
    className: "metric-value"
  }, fmtNum(progress.current), " / ", fmtNum(goal.value)), React.createElement("small", null, goal.type === "distance" ? "km" : "次"), React.createElement(Icon, {
    name: "settings"
  }))), React.createElement(Progress, {
    current: progress.current,
    target: goal.value
  }));
}
function Modal({
  title,
  children,
  onClose,
  busy = false
}) {
  const element = useRef(null),
    close = useRef(onClose),
    saving = useRef(busy);
  close.current = onClose;
  saving.current = busy;
  useEffect(() => {
    const previous = document.activeElement,
      oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => [...element.current.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(el => el.getClientRects().length);
    const timer = setTimeout(() => focusable()[0]?.focus(), 0);
    const key = e => {
      if (e.key === "Escape" && !saving.current) {
        e.preventDefault();
        close.current();
      }
      if (e.key === "Tab") {
        const elements = focusable(),
          first = elements[0],
          last = elements.at(-1);
        if (!first) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", key);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return React.createElement("div", {
    className: "modal-backdrop"
  }, React.createElement("section", {
    ref: element,
    className: "modal",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": title
  }, React.createElement("div", {
    className: "modal-heading"
  }, React.createElement("h2", null, title), React.createElement("button", {
    className: "close-button",
    "aria-label": "\u5173\u95ED\u7A97\u53E3",
    disabled: busy,
    onClick: onClose
  }, "\xD7")), React.createElement("div", {
    className: "modal-body"
  }, children)));
}
function RecordCard({
  record: r,
  photo,
  disabled,
  onEdit,
  onDelete,
  onPhoto
}) {
  const pace = r.swam ? C.paceStr(r.distance, r.duration) : null;
  return React.createElement("article", {
    className: "card record-card"
  }, React.createElement("div", {
    className: "section-top"
  }, React.createElement("time", {
    dateTime: r.date
  }, r.date), React.createElement("div", {
    className: "record-actions"
  }, React.createElement("button", {
    onClick: onEdit,
    disabled: disabled,
    "aria-label": "编辑 " + r.date + " 的记录"
  }, "\u7F16\u8F91"), React.createElement("button", {
    onClick: onDelete,
    disabled: disabled,
    "aria-label": "删除 " + r.date + " 的记录"
  }, "\u5220\u9664"))), React.createElement("div", {
    className: "record-heading"
  }, React.createElement("span", null, r.swam ? r.mood?.emoji || "🏊" : "🛋️"), React.createElement("h3", null, r.swam ? r.stroke || "游泳" : "休息日"), React.createElement("span", {
    className: "record-mood"
  }, r.swam ? r.mood?.label : "给自己一点恢复时间")), r.swam && React.createElement("div", {
    className: "record-stats"
  }, r.distance > 0 && React.createElement("strong", null, React.createElement("span", {
    className: "metric-value"
  }, fmtNum(r.distance)), " ", React.createElement("small", null, "\u7C73")), r.duration > 0 && React.createElement("span", null, fmtNum(r.duration), " \u5206\u949F \xB7 ", MODES[r.durationMode || "unknown"]), pace && React.createElement("span", {
    className: "record-pace"
  }, pace, " /100m")), r.pool && React.createElement("p", {
    className: "record-pool"
  }, "\u6CF3\u9986 \xB7 ", r.pool), r.note && React.createElement("p", {
    className: "record-note"
  }, r.note), photo && React.createElement("button", {
    className: "photo-button",
    onClick: onPhoto,
    "aria-label": "查看 " + r.date + " 的游泳照片"
  }, React.createElement("img", {
    src: photo,
    alt: "\u6E38\u6CF3\u7167\u7247",
    loading: "lazy"
  })));
}
function Calendar({
  month,
  setMonth,
  records,
  today,
  selected,
  onSelect,
  disabled
}) {
  const [year, m] = month.split("-").map(Number),
    offset = (new Date(Date.UTC(year, m - 1, 1)).getUTCDay() + 6) % 7,
    days = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const counts = {};
  for (const r of records) {
    if (!counts[r.date]) counts[r.date] = {
      swam: 0,
      rest: 0
    };
    counts[r.date][r.swam ? "swam" : "rest"]++;
  }
  function move(n) {
    const date = new Date(Date.UTC(year, m - 1 + n, 1));
    setMonth(date.toISOString().slice(0, 7));
  }
  return React.createElement(React.Fragment, null, React.createElement("div", {
    className: "calendar-heading"
  }, React.createElement("button", {
    "aria-label": "\u4E0A\u4E2A\u6708",
    onClick: () => move(-1)
  }, "\u2039"), React.createElement("h2", null, year, " \u5E74 ", m, " \u6708"), React.createElement("button", {
    "aria-label": "\u4E0B\u4E2A\u6708",
    onClick: () => move(1)
  }, "\u203A")), React.createElement("div", {
    className: "calendar-grid"
  }, ["一", "二", "三", "四", "五", "六", "日"].map(x => React.createElement("span", {
    key: x,
    className: "weekday"
  }, x)), Array.from({
    length: offset
  }, (_, i) => React.createElement("span", {
    key: "blank" + i
  })), Array.from({
    length: days
  }, (_, i) => {
    const day = i + 1,
      date = month + "-" + String(day).padStart(2, "0"),
      count = counts[date];
    return React.createElement("button", {
      key: date,
      className: ["calendar-day", count?.swam && "swam-day", count?.rest && !count?.swam && "rest-day", date === today && "today", date === selected && "selected-day"].filter(Boolean).join(" "),
      "aria-label": date + (count?.swam ? "，游泳 " + count.swam + " 次" : ""),
      "aria-pressed": date === selected,
      disabled: disabled || date > today,
      onClick: () => onSelect(date)
    }, React.createElement("strong", {
      className: "metric-value"
    }, day), React.createElement("small", null, count?.swam ? count.swam + "次" : count?.rest ? "休息" : "·"));
  })));
}
function PaceChart({
  points
}) {
  if (!points.length) return React.createElement("div", {
    className: "chart-empty"
  }, "\u6240\u9009\u6CF3\u59FF\u548C\u8BA1\u65F6\u65B9\u5F0F\u8FD8\u6CA1\u6709\u6709\u6548\u914D\u901F\u8BB0\u5F55\u3002");
  const values = points.map(p => p.seconds),
    min = Math.min(...values),
    max = Math.max(...values),
    range = Math.max(15, max - min),
    lower = Math.max(0, min - range * .15),
    upper = max + range * .15;
  const x = i => points.length === 1 ? 190 : 62 + i * (268 / (points.length - 1)),
    y = value => 24 + (upper - value) / (upper - lower) * 132;
  const path = points.map((p, i) => (i ? "L" : "M") + x(i) + "," + y(p.seconds)).join(" ");
  return React.createElement(React.Fragment, null, React.createElement("svg", {
    viewBox: "0 0 360 198",
    className: "pace-chart",
    role: "img",
    "aria-label": "最近" + points.length + "个训练日的每百米配速"
  }, [lower, (lower + upper) / 2, upper].map(v => React.createElement("g", {
    key: v
  }, React.createElement("line", {
    x1: "58",
    x2: "338",
    y1: y(v),
    y2: y(v),
    stroke: "#D9DDCB",
    strokeDasharray: "3 4"
  }), React.createElement("text", {
    x: "50",
    y: y(v) + 4,
    textAnchor: "end",
    className: "chart-label"
  }, C.fmtPace(v)))), React.createElement("path", {
    d: path,
    fill: "none",
    stroke: "#117C0D",
    strokeWidth: "3",
    strokeLinejoin: "miter"
  }), points.map((p, i) => React.createElement("rect", {
    key: p.date,
    x: x(i) - 3,
    y: y(p.seconds) - 3,
    width: "6",
    height: "6",
    fill: "#117C0D"
  }, React.createElement("title", null, p.date + "：" + C.fmtPace(p.seconds) + "/100m"))), React.createElement("text", {
    x: "62",
    y: "186",
    className: "chart-label"
  }, points[0].date.slice(5)), React.createElement("text", {
    x: "338",
    y: "186",
    textAnchor: "end",
    className: "chart-label"
  }, points.at(-1).date.slice(5))), React.createElement("details", {
    className: "chart-details"
  }, React.createElement("summary", null, "\u67E5\u770B\u6BCF\u65E5\u914D\u901F"), React.createElement("table", null, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "\u65E5\u671F"), React.createElement("th", null, "\u914D\u901F /100m"))), React.createElement("tbody", null, points.map(p => React.createElement("tr", {
    key: p.date
  }, React.createElement("td", null, p.date), React.createElement("td", null, C.fmtPace(p.seconds))))))));
}
function DistanceBars({
  items
}) {
  if (!items.length) return React.createElement("p", {
    className: "helper"
  }, "\u8BB0\u5F55\u8DDD\u79BB\u540E\uFF0C\u8FD9\u91CC\u4F1A\u51FA\u73B0\u56FE\u8868\u3002");
  const max = Math.max(1, ...items.map(p => p.value));
  return React.createElement("div", {
    className: "distance-bars",
    role: "img",
    "aria-label": items.map(p => p.label + "：" + p.value).join("；")
  }, items.map((p, i) => React.createElement("div", {
    key: i
  }, React.createElement("span", null, fmtNum(p.value)), React.createElement("i", {
    style: {
      height: Math.max(3, p.value / max * 82) + "px"
    }
  }), React.createElement("small", null, p.label))));
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App, null));
