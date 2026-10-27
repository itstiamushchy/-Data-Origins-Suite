// Витоки Даних — zip-reader.js
// Мінімальний ZIP-рідер: читає центральний каталог і розпаковує окремі записи (store/deflate).
// Використовується OOXML (docx/xlsx/pptx), ODF (odt/ods/odp) та EPUB парсерами.
window.ZipReader = (function () {
    'use strict';

    function findEOCD(view) {
        var minPos = Math.max(0, view.byteLength - 65557);
        for (var p = view.byteLength - 22; p >= minPos; p--) {
            if (view.getUint32(p, true) === 0x06054b50) return p;
        }
        return -1;
    }

    // Повертає масив {name, method, compSize, uncompSize, localOffset} або null, якщо це не ZIP.
    function listEntries(buffer) {
        var view = new DataView(buffer);
        var bytes = new Uint8Array(buffer);
        if (view.getUint32(0, true) !== 0x04034b50) return null; // перший байт має бути локальним заголовком

        var eocdPos = findEOCD(view);
        if (eocdPos < 0) return null;
        var cdOffset = view.getUint32(eocdPos + 16, true);
        var cdEntries = view.getUint16(eocdPos + 10, true);

        var entries = [];
        var p = cdOffset;
        for (var i = 0; i < cdEntries; i++) {
            if (view.getUint32(p, true) !== 0x02014b50) break;
            var method = view.getUint16(p + 10, true);
            var compSize = view.getUint32(p + 20, true);
            var uncompSize = view.getUint32(p + 24, true);
            var nameLen = view.getUint16(p + 28, true);
            var extraLen = view.getUint16(p + 30, true);
            var commentLen = view.getUint16(p + 32, true);
            var localOffset = view.getUint32(p + 42, true);
            var name = BinUtils.readUtf8(bytes, p + 46, p + 46 + nameLen);
            entries.push({ name: name, method: method, compSize: compSize, uncompSize: uncompSize, localOffset: localOffset });
            p += 46 + nameLen + extraLen + commentLen;
        }
        return entries;
    }

    function inflateRaw(bytes) {
        if (typeof DecompressionStream === 'undefined') return Promise.resolve(null);
        try {
            var ds = new DecompressionStream('deflate-raw');
            var stream = new Blob([bytes]).stream().pipeThrough(ds);
            return new Response(stream).arrayBuffer().then(function (buf) { return new Uint8Array(buf); })
                .catch(function () { return null; });
        } catch (e) { return Promise.resolve(null); }
    }

    // Розпаковує один запис каталогу; повертає Promise<Uint8Array|null>.
    function extractEntry(buffer, entry) {
        var view = new DataView(buffer);
        var p = entry.localOffset;
        if (view.getUint32(p, true) !== 0x04034b50) return Promise.resolve(null);
        var nameLen = view.getUint16(p + 26, true);
        var extraLen = view.getUint16(p + 28, true);
        var dataStart = p + 30 + nameLen + extraLen;
        var compressed = new Uint8Array(buffer, dataStart, entry.compSize);
        if (entry.method === 0) return Promise.resolve(compressed.slice());
        if (entry.method === 8) return inflateRaw(compressed);
        return Promise.resolve(null); // непідтримуваний метод стиснення
    }

    // Зручний хелпер: знайти запис за назвою (точний збіг) і одразу розпакувати.
    function extractByName(buffer, entries, name) {
        var entry = entries.filter(function (e) { return e.name === name; })[0];
        if (!entry) return Promise.resolve(null);
        return extractEntry(buffer, entry);
    }

    return { listEntries: listEntries, extractEntry: extractEntry, extractByName: extractByName };
})();
