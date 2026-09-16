/* Keeps offline readiness separate from the browser's online/offline signal. */
(function () {
  "use strict";
  const state = window.swimOffline = { ready: false, updateAvailable: false, error: "", version: "" };
  function publish(next) {
    Object.assign(state, next);
    window.dispatchEvent(new CustomEvent("swim-offline-status", { detail: { ...state } }));
  }
  if (!("serviceWorker" in navigator) || !window.isSecureContext) {
    publish({ error: "当前浏览器环境不支持离线缓存，请通过 HTTPS 打开。" });
    return;
  }
  const scope = new URL("./", document.baseURI).href;
  let registration;
  function query() {
    const worker = registration && registration.active;
    if (worker) worker.postMessage({ type: "SWIM_CACHE_STATUS" });
    if (registration) publish({ updateAvailable: !!registration.waiting });
  }
  navigator.serviceWorker.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.type !== "SWIM_OFFLINE_STATUS" || data.scope !== scope) return;
    publish({ ready: !!data.ready, version: data.version || "", error: data.ready ? "" : (data.error || "离线资源尚未准备完成，请联网后重试。") });
  });
  navigator.serviceWorker.addEventListener("controllerchange", query);
  window.addEventListener("online", query);
  window.addEventListener("pageshow", query);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) query(); });
  function watch(worker) {
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" || worker.state === "activated") query();
      if (worker.state === "redundant" && !(registration && registration.active)) {
        publish({ ready: false, error: "离线缓存未完成，请保持网络连接后重新打开。" });
      }
    });
  }
  navigator.serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" }).then((reg) => {
    registration = reg;
    watch(reg.installing);
    reg.addEventListener("updatefound", () => watch(reg.installing));
    query();
    return navigator.serviceWorker.ready;
  }).then((reg) => {
    registration = reg;
    query();
  }).catch(() => publish({ ready: false, error: "离线缓存未完成，请保持网络连接后重新打开。" }));
  // No skipWaiting or automatic reload: unsaved forms remain intact during an update.
})();
