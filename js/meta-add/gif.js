// Витоки Даних — meta-add/gif.js
// Додає Comment Extension (0x21 0xFE) одразу після Logical Screen Descriptor
// (і Global Color Table, якщо є) — до першого блоку зображення/розширення.
window.MetaAddWriters = window.MetaAddWriters || {};

(function () {
    'use strict';

    function write(buffer, comment) {
        var bytes = new Uint8Array(buffer);
        var sig = String.fromCharCode.apply(null, bytes.subarray(0, 6));
        if (sig !== 'GIF87a' && sig !== 'GIF89a') return { ok: false, reason: 'Не є коректним GIF (сигнатура не збігається).' };
        if (bytes.length < 13) return { ok: false, reason: 'Файл закороткий для валідного GIF-заголовка.' };

        var packed = bytes[10];
        var hasGct = (packed & 0x80) !== 0;
        var gctSize = hasGct ? (3 * Math.pow(2, (packed & 0x07) + 1)) : 0;
        var insertAt = 13 + gctSize;
        if (insertAt > bytes.length) return { ok: false, reason: 'Некоректний розмір Global Color Table — файл, ймовірно, пошкоджений.' };

        var text = window.MetaAddCommon.buildAddedValue(comment);
        var textBytes = new TextEncoder().encode('vytoky:added ' + text);

        var subBlocks = [];
        for (var i = 0; i < textBytes.length; i += 255) {
            var chunk = textBytes.subarray(i, Math.min(i + 255, textBytes.length));
            subBlocks.push(new Uint8Array([chunk.length]));
            subBlocks.push(chunk);
        }
        var ext = window.MetaAddCommon.concatBytes([
            new Uint8Array([0x21, 0xFE]),
            window.MetaAddCommon.concatBytes(subBlocks),
            new Uint8Array([0x00])
        ]);

        var out = window.MetaAddCommon.concatBytes([bytes.subarray(0, insertAt), ext, bytes.subarray(insertAt)]);
        return { ok: true, data: out };
    }

    window.MetaAddWriters.gif = write;
})();
