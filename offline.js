/* Automatic updates never reload a page until that page explicitly reports safety. */
(function () {
  "use strict";
  const state = window.swimOffline = { ready: false, updateAvailable: false, updating: false, updateBlocked: false, error: "", version: "" };
  const scope = new URL("./", document.baseURI).href;
  const reloadKey = "swim-reloaded-version:" + scope;
  let safe = false, registration, registrationPromise, checkPromise;
  let controller = navigator.serviceWorker && navigator.serviceWorker.controller;
  let pendingController = null, pendingVersion = "", reloading = false, probe = null;
  function publish(next) {
    Object.assign(state, next);
    window.dispatchEvent(new CustomEvent("swim-offline-status", { detail: { ...state } }));
  }
  function maybeReload() {
    if (!pendingController || !pendingVersion || !safe || reloading) return;
    // The check is synchronous with reload; an edit started during activation can veto it.
    try {
      if (sessionStorage.getItem(reloadKey) === pendingVersion) {
        pendingController = null; pendingVersion = "";
        publish({ updating: false, updateBlocked: false, updateAvailable: false });
        return;
      }
      sessionStorage.setItem(reloadKey, pendingVersion);
    } catch (_) { /* The in-memory guard still prevents duplicate reloads. */ }
    reloading = true;
    window.location.reload();
  }
  function requestActivation() {
    const worker = registration && registration.waiting;
    if (!worker) return;
    publish({ updateAvailable: true, updating: true, updateBlocked: !safe });
    worker.postMessage({ type: "SWIM_TRY_ACTIVATE" });
  }
  function query() {
    const worker = pendingController || (registration && registration.active);
    if (worker) worker.postMessage({ type: "SWIM_CACHE_STATUS" });
    if (registration && registration.waiting) requestActivation();
    else if (!pendingController) {
      publish({ updateAvailable: false, updateBlocked: false });
      if (registration && !registration.installing && !checkPromise) publish({ updating: false });
    }
  }
  function setSafeToReload(value) {
    const next = value === true;
    if (safe === next) return;
    safe = next;
    // Retract an earlier vote immediately, including while other tabs are still answering.
    if (probe) probe.worker.postMessage({ type: "SWIM_UPDATE_STATE", token: probe.token, safe });
    if (pendingController) {
      publish({ updateAvailable: true, updateBlocked: !safe, updating: safe });
      maybeReload();
    }
    requestActivation();
  }
  async function check() {
    if (checkPromise) return checkPromise;
    if (!navigator.onLine) throw new Error("当前离线，联网后可检查更新。");
    if (!registrationPromise) throw new Error("当前浏览器不支持自动更新。");
    checkPromise = (async () => {
      publish({ updating: true });
      try {
        const reg = await registrationPromise;
        await reg.update();
        publish({ error: "" });
        query();
      } catch (error) {
        publish({ updating: false, error: "检查更新失败，已保存的离线版本仍可继续使用。" });
        throw error;
      } finally {
        if (!(registration && registration.waiting) && !pendingController) publish({ updating: false });
      }
    })();
    try { return await checkPromise; }
    finally { checkPromise = null; }
  }
  window.swimUpdates = { setSafeToReload, check, checkNow: check };
  if (!("serviceWorker" in navigator) || !window.isSecureContext) {
    publish({ error: "当前浏览器环境不支持离线缓存，请通过 HTTPS 打开。" });
    return;
  }
  function automaticCheck() {
    if (!document.hidden && navigator.onLine) check().catch(() => {});
  }
  navigator.serviceWorker.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.scope !== scope) return;
    if (data.type === "SWIM_UPDATE_PROBE" && event.source && typeof data.token === "string") {
      // First-install probes can arrive after this worker has already claimed the page.
      if (event.source === navigator.serviceWorker.controller && !pendingController) return;
      probe = { worker: event.source, token: data.token };
      publish({ updateAvailable: true, updating: true, updateBlocked: !safe });
      event.source.postMessage({ type: "SWIM_UPDATE_STATE", token: data.token, safe });
    } else if (data.type === "SWIM_UPDATE_PROGRESS") {
      // A late coordinator message must not put an already reloaded page back in updating state.
      if (event.source === navigator.serviceWorker.controller && !pendingController) return;
      publish({ updateAvailable: true, updating: !data.blocked, updateBlocked: !!data.blocked });
    } else if (data.type === "SWIM_OFFLINE_STATUS") {
      const active = navigator.serviceWorker.controller || (registration && registration.active);
      if (active && event.source !== active) return;
      publish({ ready: !!data.ready, version: data.version || "", error: data.ready ? "" : "离线资源尚未准备完成，请联网后重试。" });
      if (data.ready && !pendingController && !(registration && (registration.waiting || registration.installing))) {
        publish({ updateAvailable: false, updateBlocked: false });
        if (!checkPromise) publish({ updating: false });
      }
      if (pendingController === event.source && !data.ready) publish({ updating: false, updateBlocked: true });
      if (pendingController === event.source && data.ready && data.version) {
        pendingVersion = data.version;
        publish({ updateAvailable: true, updateBlocked: !safe, updating: safe });
        maybeReload();
      }
    }
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    const previous = controller;
    controller = navigator.serviceWorker.controller;
    if (previous && controller && previous !== controller) {
      pendingController = controller; pendingVersion = "";
      publish({ updateAvailable: true, updateBlocked: !safe, updating: safe });
    }
    // First installation only claims this page; it must not reload it.
    query();
  });
  window.addEventListener("online", automaticCheck);
  window.addEventListener("focus", automaticCheck);
  window.addEventListener("pageshow", () => { query(); automaticCheck(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { query(); automaticCheck(); } });
  // Browsers may suspend timers in the background. Visibility/online events resume checks.
  setInterval(automaticCheck, 5 * 60 * 1000);
  function watch(worker) {
    if (!worker) return;
    publish({ updating: true });
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" || worker.state === "activated") query();
      if (worker.state === "redundant") {
        publish({ updating: false });
        if (!(registration && registration.active)) publish({ ready: false, error: "离线缓存未完成，请保持网络连接后重新打开。" });
      }
    });
  }
  registrationPromise = navigator.serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" }).then((reg) => {
    registration = reg;
    watch(reg.installing);
    reg.addEventListener("updatefound", () => watch(reg.installing));
    query();
    return reg;
  });
  registrationPromise.then(() => {
    automaticCheck();
    return navigator.serviceWorker.ready;
  }).then((reg) => { registration = reg; query(); }).catch(() => {
    publish({ updating: false, error: "离线缓存未完成，请保持网络连接后重新打开。" });
  });
})();
