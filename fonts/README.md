# Swim Pixel

An original 5 x 7 grid font for the journal's numeric metrics. It contains only digits and basic numeric punctuation; Chinese text uses the system font.

The WOFF2 is served locally and included in the offline cache. No external font service is required. Its editable bitmap source is `scripts/build-pixel-font.py`.

Regenerate only when changing the glyph design (not part of the normal application build):

```sh
python -m pip install fonttools brotli
python scripts/build-pixel-font.py
node scripts/build.cjs
```
