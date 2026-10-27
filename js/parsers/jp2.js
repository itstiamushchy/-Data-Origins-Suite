// Витоки Даних — parsers/jp2.js
window.Parsers = window.Parsers || {};
window.Parsers.jp2 = function (buffer) {
    var view = new DataView(buffer);
    if (view.byteLength < 12) return null;
    var sigType = BinUtils.readAsciiString(view, 4, 4);
    if (sigType !== 'jP  ' && sigType !== 'jP2 ') return null; // не JP2

    var out = {};
    // UUID для вбудованого Exif у JP2 (специфікація JPEG2000/Exif): JpgTiffExif->JP2
    var EXIF_UUID = [0x4A, 0x70, 0x67, 0x54, 0x69, 0x66, 0x66, 0x45, 0x78, 0x69, 0x66, 0x2D, 0x3E, 0x4A, 0x50, 0x32];
    var p = 0;
    while (p + 8 <= view.byteLength) {
        var size = view.getUint32(p, false);
        var type = BinUtils.readAsciiString(view, p + 4, 4);
        var boxEnd = size === 0 ? view.byteLength : p + size;
        if (type === 'uuid' && p + 24 <= boxEnd) {
            var match = true;
            for (var i = 0; i < 16; i++) if (view.getUint8(p + 8 + i) !== EXIF_UUID[i]) { match = false; break; }
            if (match) {
                var tiffTags = TiffReader.parse(buffer, p + 24);
                if (tiffTags) Object.assign(out, tiffTags);
                out['JP2:HasEXIF'] = true;
            }
        } else if (type === 'xml ') {
            out['JP2:HasXMP'] = true;
        }
        if (size <= 0) break;
        p = boxEnd;
    }
    return out;
};
