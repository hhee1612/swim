#!/usr/bin/env python3
"""Build the original Swim Pixel numeric font. Optional tooling: fonttools[woff], brotli."""
from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

# Original 5 x 7 grid glyphs. No third-party font files are used.
BITMAPS = {
    '0': ['01110','11011','11011','11011','11011','11011','01110'],
    '1': ['00100','01100','00100','00100','00100','00100','01110'],
    '2': ['01110','11011','00011','00110','01100','11000','11111'],
    '3': ['11110','00011','00011','01110','00011','00011','11110'],
    '4': ['00011','00111','01111','11011','11111','00011','00011'],
    '5': ['11111','11000','11000','11110','00011','00011','11110'],
    '6': ['01110','11000','11000','11110','11011','11011','01110'],
    '7': ['11111','00011','00110','00110','01100','01100','01100'],
    '8': ['01110','11011','11011','01110','11011','11011','01110'],
    '9': ['01110','11011','11011','01111','00011','00011','01110'],
    '.': ['00','00','00','00','00','11','11'],
    ',': ['00','00','00','00','00','11','01','10'],
    ':': ['00','11','11','00','11','11','00'],
    '/': ['00001','00011','00110','00110','01100','11000','10000'],
    '-': ['00000','00000','00000','11111','00000','00000','00000'],
    '+': ['00000','00100','00100','11111','00100','00100','00000'],
}

def make_font(destination):
    names = {char: 'uni%04X' % ord(char) for char in BITMAPS}
    order = ['.notdef', 'space'] + list(names.values())
    glyphs = {'.notdef': TTGlyphPen(None).glyph(), 'space': TTGlyphPen(None).glyph()}
    metrics = {'.notdef': (600, 0), 'space': (300, 0)}
    for char, rows in BITMAPS.items():
        pen = TTGlyphPen(None)
        for row, bits in enumerate(rows):
            for col, bit in enumerate(bits):
                if bit != '1':
                    continue
                x, y = 50 + col * 100, 600 - row * 100
                pen.moveTo((x, y))
                pen.lineTo((x, y + 100))
                pen.lineTo((x + 100, y + 100))
                pen.lineTo((x + 100, y))
                pen.closePath()
        glyphs[names[char]] = pen.glyph()
        metrics[names[char]] = ((len(rows[0]) + 1) * 100, 50)
    fb = FontBuilder(1000, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap({ord(char): name for char, name in names.items()} | {32: 'space'})
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=800, descent=-200)
    fb.setupNameTable({
        'familyName': 'Swim Pixel', 'styleName': 'Regular',
        'uniqueFontIdentifier': 'SwimPixel-1.0', 'fullName': 'Swim Pixel',
        'psName': 'SwimPixel-Regular', 'version': 'Version 1.0',
        'copyright': 'Original grid glyphs created for the Swim Journal project.',
    })
    fb.setupOS2(sTypoAscender=800, sTypoDescender=-200, usWinAscent=800, usWinDescent=200)
    fb.setupPost()
    fb.setupMaxp()
    fb.font['head'].created = fb.font['head'].modified = 2082844800
    fb.font.recalcTimestamp = False
    fb.font.flavor = 'woff2'
    fb.save(destination)
    print('Generated', destination, '(' + str(destination.stat().st_size) + ' bytes)')

if __name__ == '__main__':
    destination = Path(__file__).resolve().parents[1] / 'fonts' / 'swim-pixel.woff2'
    destination.parent.mkdir(exist_ok=True)
    make_font(destination)
