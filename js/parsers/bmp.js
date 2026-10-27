// Витоки Даних — parsers/bmp.js
window.Parsers = window.Parsers || {};
window.Parsers.bmp = function (buffer) {
    var view = new DataView(buffer);
    if (view.getUint8(0) !== 0x42 || view.getUint8(1) !== 0x4D) return null; // "BM"

    var out = {};
    var dibHeaderSize = view.getUint32(14, true);
    out['BMP:Width'] = view.getInt32(18, true);
    out['BMP:Height'] = Math.abs(view.getInt32(22, true));
    if (dibHeaderSize >= 40) {
        out['BMP:BitsPerPixel'] = view.getUint16(28, true);
        out['BMP:Compression'] = view.getUint32(30, true);
        out['BMP:XPixelsPerMeter'] = view.getInt32(38, true);
        out['BMP:YPixelsPerMeter'] = view.getInt32(42, true);
        out['BMP:ColorsUsed'] = view.getUint32(46, true);
    }
    return out;
};
