// Витоки Даних — parsers/dsf.js
window.Parsers = window.Parsers || {};
window.Parsers.dsf = function (buffer) {
    var view = new DataView(buffer);
    if (BinUtils.readAsciiString(view, 0, 4) !== 'DSD ') return null;

    var out = {};
    var id3PointerLo = view.getUint32(20, true);
    var id3PointerHi = view.getUint32(24, true);
    var id3Offset = id3PointerHi * 0x100000000 + id3PointerLo;

    if (BinUtils.readAsciiString(view, 28, 4) === 'fmt ') {
        out['DSF:Channels'] = view.getUint32(52, true);
        out['DSF:SampleRate'] = view.getUint32(56, true);
    }

    if (id3Offset > 0 && id3Offset < view.byteLength) {
        var id3Slice = buffer.slice(id3Offset);
        var id3Tags = window.Parsers.mp3 ? window.Parsers.mp3(id3Slice) : null;
        if (id3Tags) Object.assign(out, id3Tags);
    }
    return out;
};
