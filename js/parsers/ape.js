// Витоки Даних — parsers/ape.js
window.Parsers = window.Parsers || {};
window.Parsers.ape = function (buffer) {
    var view = new DataView(buffer);
    var bytes = new Uint8Array(buffer);
    if (BinUtils.readAsciiString(view, 0, 4) !== 'MAC ') return null; // Monkey's Audio сигнатура

    var out = { 'Format:Name': "Monkey's Audio" };
    if (buffer.byteLength < 32) return out;

    var footerStart = buffer.byteLength - 32;
    if (BinUtils.readAsciiString(view, footerStart, 8) !== 'APETAGEX') return out;

    var tagSize = view.getUint32(footerStart + 12, true);
    var itemCount = view.getUint32(footerStart + 16, true);
    var tagStart = buffer.byteLength - tagSize;
    var p = tagStart;

    for (var i = 0; i < itemCount && p < footerStart; i++) {
        var valueLen = view.getUint32(p, true);
        var flags = view.getUint32(p + 4, true);
        var isText = ((flags >> 1) & 0x03) === 0;
        var keyStart = p + 8;
        var k = keyStart;
        while (bytes[k] !== 0 && k < footerStart) k++;
        var key = BinUtils.readUtf8(bytes, keyStart, k);
        var valueStart = k + 1;
        if (isText) {
            out['APEv2:' + key] = BinUtils.readUtf8(bytes, valueStart, valueStart + valueLen);
        } else {
            out['APEv2:' + key] = '[бінарні дані, ' + valueLen + ' байт]';
        }
        p = valueStart + valueLen;
    }
    return out;
};
