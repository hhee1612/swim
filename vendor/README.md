# Pinned local dependencies

- React 18.2.0 and ReactDOM 18.2.0 are production UMD distributions and are loaded locally by the application. License: MIT; see `LICENSE-react.txt` and the source headers.
- Babel standalone 7.23.2 is used **only by Node during the build**. Its exact downloaded distribution is stored as `build/babel-standalone-7.23.2.min.js.gz` to keep repository size smaller. It is never referenced by HTML or cached by the service worker. License: MIT; see `LICENSE-babel.txt` and the preserved source notices inside the archive.
- `sources.json` records the pinned upstream URLs and SHA-256 digests. For gzip files, the digest describes the decompressed upstream source. The build verifies every dependency before compiling.

Rebuild using Node 20 or later:

```sh
node scripts/build.cjs
node scripts/build.cjs --check
```

No npm installation or network connection is needed. Only `app.js` and `sw.js` are generated. Edit `app.jsx`, `app.css`, or `scripts/service-worker.template.js`, then rebuild and commit the generated files.

The release identifier covers runtime assets, the JSX source, and the build/service-worker templates. Installation caches and verifies the whole release before activation. New workers wait while an existing tab is open, preserving unsaved forms; close all tabs for this site and reopen to switch versions.
