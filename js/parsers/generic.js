// Витоки Даних — parsers/generic.js
// Викликається, коли жоден спеціалізований парсер не розпізнав формат.
window.Parsers = window.Parsers || {};
window.Parsers.generic = function (buffer) {
    var bytes = new Uint8Array(buffer);
    var out = {};
    var sampleLen = Math.min(bytes.length, 16);
    var hex = BinUtils.bytesToHex(bytes.slice(0, sampleLen));
    out['GENERIC:FirstBytesHex'] = hex;
    return out;
};
