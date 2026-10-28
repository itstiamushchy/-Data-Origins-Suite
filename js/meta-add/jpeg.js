// Витоки Даних — meta-add/jpeg.js
// Додає сегмент COM (0xFFFE) одразу після SOI (0xFFD8).
window.MetaAddWriters = window.MetaAddWriters || {};

(function () {
    'use strict';

    function write(buffer, comment) {
        var bytes = new Uint8Array(buffer);
        if (bytes.length < 4 || bytes[0] !== 0xFF || bytes[1] !== 0xD8) {
            return { ok: false, reason: 'Не є коректним JPEG (відсутній маркер SOI).' };
        }

        var text = window.MetaAddCommon.buildAddedValue(comment);
        var textBytes = new TextEncoder().encode('vytoky:added ' + text);
        if (textBytes.length > 65533) return { ok: false, reason: 'Коментар завеликий для одного COM-сегмента JPEG.' };

        var segLen = textBytes.length + 2; // довжина включно з двома байтами самої довжини
        var seg = new Uint8Array(4 + textBytes.length);
        seg[0] = 0xFF; seg[1] = 0xFE;
        new DataView(seg.buffer).setUint16(2, segLen, false);
        seg.set(textBytes, 4);

        var out = window.MetaAddCommon.concatBytes([bytes.subarray(0, 2), seg, bytes.subarray(2)]);
        return { ok: true, data: out };
    }

    window.MetaAddWriters.jpeg = write;
})();
