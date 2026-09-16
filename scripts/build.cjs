#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const zlib = require("node:zlib");
const vm = require("node:vm");
const ROOT = path.resolve(__dirname, "..");
const checkOnly = process.argv.includes("--check");
const normalize = (text) => text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
const read = (file) => fs.readFileSync(path.join(ROOT, file));
const text = (file) => normalize(read(file).toString("utf8"));
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const dependencies = JSON.parse(text("vendor/sources.json"));
for (const item of dependencies) {
  const bytes = item.compression === "gzip" ? zlib.gunzipSync(read(item.name)) : read(item.name);
  if (sha256(bytes) !== item.sha256) throw new Error("Pinned dependency integrity check failed: " + item.name);
}
const compilerPath = "vendor/build/babel-standalone-7.23.2.min.js.gz";
const compilerModule = { exports: {} };
vm.runInNewContext(zlib.gunzipSync(read(compilerPath)).toString("utf8"), {
  module: compilerModule, exports: compilerModule.exports, console,
}, { filename: "babel-standalone-7.23.2.min.js" });
const Babel = compilerModule.exports;
if (Babel.version !== "7.23.2") throw new Error("Unexpected JSX compiler version");
const source = text("app.jsx");
const app = "// Generated from app.jsx by Babel 7.23.2; run node scripts/build.cjs.\n" + Babel.transform(source, {
  filename: "app.jsx", sourceType: "script", presets: [["react", { runtime: "classic", development: false }]],
  comments: false, compact: false, sourceMaps: false,
}).code + "\n";
const runtimeFiles = [
  "index.html", "app.css", "app.js", "offline.js", "swim-core.js", "swim-features.js",
  "manifest.webmanifest", "icons/swim-pixel-v2.svg", "icons/swim-pixel-v2-180.png",
  "icons/swim-pixel-v2-192.png", "icons/swim-pixel-v2-512.png", "icons/swim-pixel-v2-maskable-512.png",
  "icons/pixel-icons.svg", "icons/pixel-pool.svg", "fonts/swim-pixel.woff2",
  "vendor/react-18.2.0.production.min.js", "vendor/react-dom-18.2.0.production.min.js",
];
const assets = runtimeFiles.map((file) => {
  const isText = /\.(?:html|css|js|svg|webmanifest)$/.test(file);
  const bytes = file === "app.js" ? app : isText ? text(file) : read(file);
  return { path: "./" + file, sha256: sha256(bytes), text: isText };
});
const template = text("scripts/service-worker.template.js");
const release = sha256(JSON.stringify(assets) + "\n" + source + "\n" + template + "\n" + text("scripts/build.cjs")).slice(0, 20);
const worker = template.replace("__RELEASE__", JSON.stringify(release)).replace("__ASSETS__", JSON.stringify(assets, null, 2));
let stale = false;
for (const [name, contents] of [["app.js", app], ["sw.js", worker]]) {
  if (checkOnly) {
    if (!fs.existsSync(path.join(ROOT, name)) || text(name) !== contents) {
      console.error(name + " is out of date; run node scripts/build.cjs");
      stale = true;
    }
  } else fs.writeFileSync(path.join(ROOT, name), contents, "utf8");
}
if (stale) process.exitCode = 1;
else console.log((checkOnly ? "Verified" : "Built") + " app.js and sw.js; offline release " + release + " (" + assets.length + " assets)");
