// Витоки Даних — parsers/ico.js
window.Parsers = window.Parsers || {};
window.Parsers.ico = function (buffer) {
    var view = new DataView(buffer);
    if (view.getUint16(0, true) !== 0 || view.getUint16(2, true) !== 1) return null; // reserved=0, type=1 (icon)

    var out = {};
    var count = view.getUint16(4, true);
    out['ICO:ImageCount'] = count;
    var sizes = [];
    for (var i = 0; i < count; i++) {
        var entryOffset = 6 + i * 16;
        if (entryOffset + 16 > view.byteLength) break;
        var w = view.getUint8(entryOffset) || 256;
        var h = view.getUint8(entryOffset + 1) || 256;
        sizes.push(w + 'x' + h);
    }
    out['ICO:Sizes'] = sizes.join(', ');
    return out;
};
