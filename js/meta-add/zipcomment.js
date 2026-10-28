// Витоки Даних — meta-add/zipcomment.js
// Для звичайних .zip (не docx/xlsx/pptx/odt/ods/odp — ті йдуть через власні
// writer'и, що додають частину всередину архіву): дописуємо запис у коментар
// EOCD, НЕ видаляючи наявний.
window.MetaAddWriters = window.MetaAddWriters || {};

(function () {
    'use strict';

    function findEOCD(view) {
        var minPos = Math.max(0, view.byteLength - 65557);
        for (var p = view.byteLength - 22; p >= minPos; p--) {
            if (view.getUint32(p, true) === 0x06054b50) return p;
        }
        return -1;
    }

    function write(buffer, comment) {
        var view = new DataView(buffer);
        var bytes = new Uint8Array(buffer);
        var eocdPos = findEOCD(view);
        if (eocdPos < 0) return { ok: false, reason: 'Не знайдено End Of Central Directory — некоректний ZIP.' };

        var oldCommentLen = view.getUint16(eocdPos + 20, true);
        var oldComment = oldCommentLen > 0 ? BinUtils.readUtf8(bytes, eocdPos + 22, eocdPos + 22 + oldCommentLen) : '';

        var added = window.MetaAddCommon.buildAddedValue(comment);
        var newCommentStr = oldComment ? (oldComment + '\n[vytoky:added] ' + added) : ('[vytoky:added] ' + added);
        var newCommentBytes = new TextEncoder().encode(newCommentStr);
        if (newCommentBytes.length > 65535) return { ok: false, reason: 'Сумарний коментар перевищує ліміт ZIP (65535 байт).' };

        var head = bytes.subarray(0, eocdPos + 20);
        var lenField = new Uint8Array(2);
        new DataView(lenField.buffer).setUint16(0, newCommentBytes.length, true);

        var out = window.MetaAddCommon.concatBytes([head, lenField, newCommentBytes]);
        return { ok: true, data: out };
    }

    window.MetaAddWriters.zipcomment = write;
})();
