"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const ROOT = path.resolve(__dirname, "..");
const SCOPE = "https://example.test/swim/";
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(setImmediate); };
class Events {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, fn) { const list = this.listeners.get(type) || []; list.push(fn); this.listeners.set(type, list); }
  dispatchEvent(event) { for (const fn of this.listeners.get(event.type) || []) fn(event); }
}
function workerHarness() {
  const handlers = new Map(), cacheMaps = new Map(), timers = new Map();
  const clients = [], messages = [];
  const release = "new-release", cacheName = "swim-offline:" + encodeURIComponent(SCOPE) + ":" + release;
  let skipped = 0, fetchStatus = 200, timerId = 0;
  const contents = "<!doctype html><title>new app</title>";
  const assets = [{ path: "./index.html", sha256: crypto.createHash("sha256").update(contents).digest("hex"), text: true }];
  const caches = {
    has: async name => cacheMaps.has(name),
    keys: async () => [...cacheMaps.keys()],
    delete: async name => cacheMaps.delete(name),
    open: async name => {
      if (!cacheMaps.has(name)) cacheMaps.set(name, new Map());
      const data = cacheMaps.get(name);
      return { match: async key => data.get(typeof key === "string" ? key : key.url)?.clone(), put: async (key, response) => { data.set(typeof key === "string" ? key : key.url, response.clone()); } };
    },
  };
  const self = {
    registration: { scope: SCOPE },
    addEventListener: (type, fn) => handlers.set(type, fn),
    clients: { matchAll: async () => [...clients], claim: async () => {} },
    skipWaiting: async () => { skipped++; },
  };
  const script = fs.readFileSync(path.join(ROOT, "scripts/service-worker.template.js"), "utf8").replace("__RELEASE__", JSON.stringify(release)).replace("__ASSETS__", JSON.stringify(assets));
  vm.runInNewContext(script, {
    self, caches, URL, Request, Response, TextDecoder, TextEncoder, crypto: crypto.webcrypto,
    fetch: async () => new Response(fetchStatus === 200 ? contents : "not found", { status: fetchStatus }),
    setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  function dispatch(type, event = {}) {
    const promises = [];
    handlers.get(type)({ ...event, waitUntil: promise => promises.push(promise) });
    const done = Promise.all(promises); done.catch(() => {}); return done;
  }
  function client(id, url = SCOPE) {
    const value = { id, url, postMessage: data => messages.push({ id, data }) };
    clients.push(value); return value;
  }
  return {
    clients, messages, caches, cacheMaps, cacheName, client, dispatch,
    skipped: () => skipped,
    setFetchStatus: value => { fetchStatus = value; },
    install: () => dispatch("install"),
    activate: source => dispatch("message", { source, data: { type: "SWIM_TRY_ACTIVATE" } }),
    vote: (source, token, safe) => dispatch("message", { source, data: { type: "SWIM_UPDATE_STATE", token, safe } }),
    token: id => messages.filter(item => item.id === id && item.data.type === "SWIM_UPDATE_PROBE").at(-1)?.data.token,
    timeout: async () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(timer => timer.fn()); await settle(); },
  };
}
function clientHarness({ initialController = true, installing = false } = {}) {
  const window = new Events(), document = new Events(), sw = new Events();
  const messages = [], intervals = [], storage = new Map();
  let reloads = 0, checks = 0, updateError = null;
  function worker(version) {
    const value = new Events(); value.scriptURL = SCOPE + "sw.js"; value.version = version;
    value.postMessage = data => {
      messages.push({ worker: value, data });
      if (data.type === "SWIM_CACHE_STATUS") queueMicrotask(() => sw.dispatchEvent({ type: "message", source: value, data: { type: "SWIM_OFFLINE_STATUS", scope: SCOPE, version, ready: true } }));
    };
    return value;
  }
  const old = worker("old-release");
  const registration = new Events();
  Object.assign(registration, { active: old, waiting: null, installing: installing ? worker("installing") : null, update: async () => { checks++; if (updateError) throw updateError; } });
  Object.assign(sw, { controller: initialController ? old : null, register: async () => registration, ready: Promise.resolve(registration) });
  const navigator = { serviceWorker: sw, onLine: true };
  Object.assign(window, { isSecureContext: true, location: { reload: () => { reloads++; } } });
  Object.assign(document, { baseURI: SCOPE, hidden: false });
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "offline.js"), "utf8"), {
    window, document, navigator, URL,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    sessionStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    setInterval: (fn, ms) => { intervals.push({ fn, ms }); },
  });
  return {
    window, document, navigator, sw, registration, old, worker, messages, intervals, storage,
    reloads: () => reloads, checks: () => checks,
    failUpdate: error => { updateError = error; },
    probe: (source, token = "nonce") => sw.dispatchEvent({ type: "message", source, data: { type: "SWIM_UPDATE_PROBE", token, scope: SCOPE, version: source.version } }),
    change: source => { registration.active = source; registration.waiting = null; sw.controller = source; sw.dispatchEvent({ type: "controllerchange" }); },
  };
}

test("failed non-200 installation leaves existing and unrelated caches intact", async () => {
  const h = workerHarness();
  await h.caches.open("swim-offline:" + encodeURIComponent(SCOPE) + ":old-release");
  await h.caches.open("another-project");
  h.setFetchStatus(404);
  await assert.rejects(h.install(), /HTTP 404/);
  assert.equal(h.skipped(), 0);
  assert.equal(await h.caches.has(h.cacheName), false);
  assert.equal(await h.caches.has("another-project"), true);
  assert.equal(await h.caches.has("swim-offline:" + encodeURIComponent(SCOPE) + ":old-release"), true);
});
test("installation alone never activates; every current in-scope tab must explicitly consent", async () => {
  const h = workerHarness(), a = h.client("a"), b = h.client("b"), unrelated = h.client("other", "https://example.test/other/");
  await h.install(); assert.equal(h.skipped(), 0);
  const request = h.activate(a); await settle();
  assert.ok(h.token("a")); assert.equal(h.token(unrelated.id), undefined);
  await h.vote(a, h.token("a"), true); assert.equal(h.skipped(), 0);
  await h.vote(b, h.token("b"), true); await request;
  assert.equal(h.skipped(), 1);
});
test("unresponsive legacy tabs stay blocked after timeout", async () => {
  const h = workerHarness(), a = h.client("new"), old = h.client("legacy");
  await h.install(); const request = h.activate(a); await settle();
  await h.vote(a, h.token(a.id), true); await h.timeout(); await request;
  assert.equal(h.skipped(), 0);
  assert.ok(h.messages.some(item => item.id === old.id && item.data.type === "SWIM_UPDATE_PROGRESS" && item.data.blocked));
  assert.equal(await h.caches.has(h.cacheName), true);
});
test("an unsafe vote revokes earlier consent and late/stale votes cannot activate", async () => {
  const h = workerHarness(), a = h.client("a"), b = h.client("b");
  await h.install(); const request = h.activate(a); await settle(); const token = h.token("a");
  await h.vote(a, token, true); await h.vote(a, token, false); await request;
  await h.vote(b, token, true); assert.equal(h.skipped(), 0);
  const next = h.activate(a); await settle(); assert.notEqual(h.token("a"), token);
  await h.vote(a, token, true); await h.vote(b, h.token("b"), true); assert.equal(h.skipped(), 0);
  await h.vote(a, h.token("a"), true); await next; assert.equal(h.skipped(), 1);
});
test("a page appearing during the handshake is asked in a new round", async () => {
  const h = workerHarness(), a = h.client("a"), b = h.client("b");
  await h.install(); const request = h.activate(a); await settle(); const token = h.token("a");
  await h.vote(a, token, true); const newcomer = h.client("new"); await h.vote(b, token, true); await settle();
  assert.equal(h.skipped(), 0); assert.ok(h.token(newcomer.id)); assert.notEqual(h.token("a"), token);
  await h.vote(a, h.token("a"), true); await h.vote(b, h.token("b"), true); await h.vote(newcomer, h.token(newcomer.id), true); await request;
  assert.equal(h.skipped(), 1);
});
test("an incomplete release refuses activation before requesting consent", async () => {
  const h = workerHarness(), a = h.client("a");
  await h.activate(a); assert.equal(h.token("a"), undefined); assert.equal(h.skipped(), 0);
});
test("activation removes only old caches in this exact project scope", async () => {
  const h = workerHarness(); await h.install();
  const old = "swim-offline:" + encodeURIComponent(SCOPE) + ":old";
  const other = "swim-offline:" + encodeURIComponent("https://example.test/other/") + ":old";
  await h.caches.open(old); await h.caches.open(other); await h.dispatch("activate");
  assert.equal(await h.caches.has(old), false); assert.equal(await h.caches.has(other), true); assert.equal(await h.caches.has(h.cacheName), true);
});
test("page safety defaults to false, and an edit immediately retracts its safe vote", async () => {
  const h = clientHarness(); await settle(); const waiting = h.worker("new-release"); h.registration.waiting = waiting;
  h.probe(waiting); assert.equal(h.messages.at(-1).data.safe, false);
  h.window.swimUpdates.setSafeToReload(true); h.probe(waiting, "second"); assert.equal(h.messages.at(-1).data.safe, true);
  h.window.swimUpdates.setSafeToReload(false);
  assert.ok(h.messages.some(item => item.data.type === "SWIM_UPDATE_STATE" && item.data.token === "second" && item.data.safe === false));
});
test("first installation claims the page without reloading or leaving updating stuck", async () => {
  const h = clientHarness({ initialController: false, installing: true }); await settle();
  h.window.swimUpdates.setSafeToReload(true); h.registration.installing = null; h.change(h.old); await settle();
  assert.equal(h.reloads(), 0); assert.equal(h.window.swimOffline.ready, true); assert.equal(h.window.swimOffline.updating, false);
});
test("controller changes defer reload until a draft is safe, then reload only once per version", async () => {
  const h = clientHarness(); await settle(); const next = h.worker("new-release");
  h.change(next); await settle(); assert.equal(h.reloads(), 0); assert.equal(h.window.swimOffline.updateBlocked, true);
  h.window.swimUpdates.setSafeToReload(true); assert.equal(h.reloads(), 1);
  h.change(next); await settle(); assert.equal(h.reloads(), 1);
  assert.equal(h.storage.get("swim-reloaded-version:" + SCOPE), "new-release");
});
test("an edit started during the controller transition vetoes reload before status arrives", async () => {
  const h = clientHarness(); await settle(); h.window.swimUpdates.setSafeToReload(true);
  h.change(h.worker("new-release")); h.window.swimUpdates.setSafeToReload(false); await settle();
  assert.equal(h.reloads(), 0); assert.equal(h.window.swimOffline.updateBlocked, true);
  h.window.swimUpdates.setSafeToReload(true); assert.equal(h.reloads(), 1);
});
test("foreground/online checks resume, hidden timer checks pause, and network errors preserve readiness", async () => {
  const h = clientHarness(); await settle(); assert.ok(h.checks() >= 1);
  const interval = h.intervals.find(item => item.ms === 300000); assert.ok(interval);
  let count = h.checks(); h.document.hidden = true; interval.fn(); await settle(); assert.equal(h.checks(), count);
  h.document.hidden = false; h.document.dispatchEvent({ type: "visibilitychange" }); await settle(); assert.ok(h.checks() > count);
  count = h.checks(); h.window.dispatchEvent({ type: "online" }); await settle(); assert.ok(h.checks() > count);
  assert.equal(h.window.swimOffline.ready, true); h.failUpdate(new Error("network failure"));
  await assert.rejects(h.window.swimUpdates.check(), /network failure/); assert.equal(h.window.swimOffline.ready, true); assert.equal(h.window.swimOffline.updating, false);
});

test("late activation progress cannot leave an already loaded active page updating", async () => {
  const h = clientHarness(); await settle();
  assert.equal(h.window.swimOffline.updating, false);
  h.sw.dispatchEvent({ type: "message", source: h.old, data: { type: "SWIM_UPDATE_PROGRESS", scope: SCOPE, version: "old-release", blocked: false } });
  assert.equal(h.window.swimOffline.updating, false);
  assert.equal(h.window.swimOffline.updateAvailable, false);
});
