// Витоки Даних — parsers/wma.js
// ASF-контейнер (WMA/WMV). Читаємо лише Content Description Object — базові поля,
// без повного розбору Extended Content Description (довільні GUID-об'єкти).
window.Parsers = window.Parsers || {};
window.Parsers.wma = function (buffer) {
    var view = new DataView(buffer);
    var bytes = new Uint8Array(buffer);
    // ASF Header Object GUID: 75B22630-668E-11CF-A6D9-00AA0062CE6C
    var HEADER_GUID = [0x30, 0x26, 0xB2, 0x75, 0x8E, 0x66, 0xCF, 0x11, 0xA6, 0xD9, 0x00, 0xAA, 0x00, 0x62, 0xCE, 0x6C];
    var CONTENT_DESC_GUID = [0x33, 0x26, 0xB2, 0x75, 0x8E, 0x66, 0xCF, 0x11, 0xA6, 0xD9, 0x00, 0xAA, 0x00, 0x62, 0xCE, 0x6C];

    function matchGuid(offset, guid) {
        for (var i = 0; i < 16; i++) if (view.getUint8(offset + i) !== guid[i]) return false;
        return true;
    }
    if (!matchGuid(0, HEADER_GUID)) return null;

    var out = {};
    var headerSize = view.getUint32(16, true);
    var numObjects = view.getUint32(24, true);
    var offset = 30; // 16 GUID + 8 size + 4 numObjects + 1 reserved + 1 reserved

    for (var i = 0; i < numObjects && offset + 24 <= headerSize; i++) {
        var objSizeLo = view.getUint32(offset + 16, true);
        var objSize = objSizeLo; // достатньо для розмірів у межах 32-біт
        if (matchGuid(offset, CONTENT_DESC_GUID)) {
            var p = offset + 24;
            var titleLen = view.getUint16(p, true);
            var authorLen = view.getUint16(p + 2, true);
            var copyrightLen = view.getUint16(p + 4, true);
            var descLen = view.getUint16(p + 6, true);
            var ratingLen = view.getUint16(p + 8, true);
            var q = p + 10;
            out['ASF:Title'] = readUtf16(q, titleLen); q += titleLen;
            out['ASF:Author'] = readUtf16(q, authorLen); q += authorLen;
            out['ASF:Copyright'] = readUtf16(q, copyrightLen); q += copyrightLen;
            out['ASF:Description'] = readUtf16(q, descLen); q += descLen;
            break;
        }
        offset += objSize;
        if (objSize <= 0) break;
    }
    return out;

    function readUtf16(offset, byteLen) {
        if (byteLen <= 0) return '';
        try { return new TextDecoder('utf-16le').decode(bytes.slice(offset, offset + byteLen)).replace(/\0+$/, '').trim(); }
        catch (e) { return ''; }
    }
};
