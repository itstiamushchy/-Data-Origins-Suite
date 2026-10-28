// Витоки Даних — meta-add/webp.js
// Додає власний (приватний) RIFF-чанк "vTKY" у кінець контейнера WebP
// та коригує загальний розмір у заголовку RIFF.
window.MetaAddWriters = window.MetaAddWriters || {};

(function () {
    'use strict';

    function fourcc(bytes, off) { return String.fromCharCode(bytes[off], bytes[off + 1], bytes[off + 2], bytes[off + 3]); }

    function write(buffer, comment) {
        var bytes = new Uint8Array(buffer);
        var view = new DataView(buffer);
        if (bytes.length < 12 || fourcc(bytes, 0) !== 'RIFF' || fourcc(bytes, 8) !== 'WEBP') {
            return { ok: false, reason: 'Не є коректним WebP (відсутні сигнатури RIFF/WEBP).' };
        }

        var text = window.MetaAddCommon.buildAddedValue(comment);
        var data = new TextEncoder().encode(text);
        var pad = (data.length % 2 === 1) ? 1 : 0;

        var chunk = new Uint8Array(8 + data.length + pad);
        chunk.set(new TextEncoder().encode('vTKY'), 0);
        new DataView(chunk.buffer).setUint32(4, data.length, true);
        chunk.set(data, 8);

        var out = window.MetaAddCommon.concatBytes([bytes, chunk]);
        var newRiffSize = out.length - 8;
        new DataView(out.buffer).setUint32(4, newRiffSize, true);

        return { ok: true, data: out };
    }

    window.MetaAddWriters.webp = write;
})();
