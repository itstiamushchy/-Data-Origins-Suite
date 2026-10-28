// Витоки Даних — meta-add/png.js
// Додає tEXt-чанк (keyword "vytoky:added") безпосередньо перед IEND.
window.MetaAddWriters = window.MetaAddWriters || {};

(function () {
    'use strict';
    var SIG = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    function write(buffer, comment) {
        var bytes = new Uint8Array(buffer);
        for (var i = 0; i < 8; i++) if (bytes[i] !== SIG[i]) return { ok: false, reason: 'Не є коректним PNG (сигнатура не збігається).' };

        var view = new DataView(buffer);
        var p = 8;
        var iendStart = -1;
        while (p + 8 <= bytes.length) {
            var len = view.getUint32(p, false);
            var type = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
            if (type === 'IEND') { iendStart = p; break; }
            p += 8 + len + 4;
        }
        if (iendStart < 0) return { ok: false, reason: 'Не знайдено чанк IEND — файл пошкоджений або нестандартний.' };

        // iTXt (не tEXt): tEXt за специфікацією PNG підтримує лише Latin-1, а коментар
        // користувача та назва інструмента можуть містити кирилицю — потрібен UTF-8.
        var keyword = 'vytoky:added';
        var text = window.MetaAddCommon.buildAddedValue(comment);
        var kwBytes = new TextEncoder().encode(keyword);
        var txtBytes = new TextEncoder().encode(text);
        var data = window.MetaAddCommon.concatBytes([
            kwBytes, new Uint8Array([0]),       // keyword\0
            new Uint8Array([0, 0]),              // compression flag=0, method=0
            new Uint8Array([0]),                 // language tag (порожній)\0
            new Uint8Array([0]),                 // translated keyword (порожній)\0
            txtBytes
        ]);

        var typeBytes = new TextEncoder().encode('iTXt');
        var chunk = new Uint8Array(12 + data.length);
        var lenBE = new Uint8Array(4);
        new DataView(lenBE.buffer).setUint32(0, data.length, false);
        chunk.set(lenBE, 0);
        chunk.set(typeBytes, 4);
        chunk.set(data, 8);
        var crcInput = window.MetaAddCommon.concatBytes([typeBytes, data]);
        var crc = window.Crc32.compute(crcInput);
        var crcBytes = new Uint8Array(4);
        new DataView(crcBytes.buffer).setUint32(0, crc, false);
        chunk.set(crcBytes, 8 + data.length);

        var out = window.MetaAddCommon.concatBytes([bytes.subarray(0, iendStart), chunk, bytes.subarray(iendStart)]);
        return { ok: true, data: out };
    }

    window.MetaAddWriters.png = write;
})();
