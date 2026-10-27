// Витоки Даних — parsers/caf.js
window.Parsers = window.Parsers || {};
window.Parsers.caf = function (buffer) {
    var view = new DataView(buffer);
    var bytes = new Uint8Array(buffer);
    if (BinUtils.readAsciiString(view, 0, 4) !== 'caff') return null;

    var out = {};
    var offset = 8; // caff(4) + version/flags(4)
    while (offset + 12 <= view.byteLength) {
        var chunkType = BinUtils.readAsciiString(view, offset, 4);
        var chunkSizeHi = view.getUint32(offset + 4, false);
        var chunkSizeLo = view.getUint32(offset + 8, false);
        var chunkSize = chunkSizeHi * 0x100000000 + chunkSizeLo;
        var dataStart = offset + 12;
        if (chunkSize < 0 || dataStart + chunkSize > view.byteLength) break;

        if (chunkType === 'info') {
            var numEntries = view.getUint32(dataStart, false);
            var p = dataStart + 4;
            for (var i = 0; i < numEntries && p < dataStart + chunkSize; i++) {
                var k0 = p; while (bytes[p] !== 0) p++; var key = BinUtils.readUtf8(bytes, k0, p); p++;
                var v0 = p; while (bytes[p] !== 0) p++; var val = BinUtils.readUtf8(bytes, v0, p); p++;
                out['CAF:' + key] = val;
            }
        } else if (chunkType === 'desc') {
            out['CAF:SampleRate'] = Math.round(readFloat64BE(view, dataStart));
            out['CAF:Channels'] = view.getUint32(dataStart + 28, false);
        }
        offset = dataStart + chunkSize;
    }
    return out;

    function readFloat64BE(view, offset) {
        return view.getFloat64(offset, false);
    }
};
