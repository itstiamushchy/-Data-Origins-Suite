// Витоки Даних — zip-writer.js
// Безпечне додавання/заміна файлів у ZIP-контейнері (docx/xlsx/pptx/odt/ods/odp/zip):
// оригінальні байти жодного наявного запису НЕ чіпаються й не перестискаються.
// Нові/оновлені записи дописуються в кінець (store, без стиснення), центральний
// каталог перебудовується: незмінені записи копіюються "як є" (той самий offset
// у файлі, той самий вміст), змінені — замінюються новим записом в кінці файлу.
window.ZipWriter = (function () {
    'use strict';

    function findEOCD(view) {
        var minPos = Math.max(0, view.byteLength - 65557);
        for (var p = view.byteLength - 22; p >= minPos; p--) {
            if (view.getUint32(p, true) === 0x06054b50) return p;
        }
        return -1;
    }

    function dosDateTime(d) {
        var time = ((d.getHours() & 0x1F) << 11) | ((d.getMinutes() & 0x3F) << 5) | ((Math.floor(d.getSeconds() / 2)) & 0x1F);
        var date = (((d.getFullYear() - 1980) & 0x7F) << 9) | (((d.getMonth() + 1) & 0x0F) << 5) | (d.getDate() & 0x1F);
        return { time: time, date: date };
    }

    function utf8Bytes(str) { return new TextEncoder().encode(str); }

    // Повертає список {name, raw: Uint8Array (повний запис CD-заголовка), start, len} для оригінального каталогу.
    function listRawCentralDirRecords(buffer) {
        var view = new DataView(buffer);
        var bytes = new Uint8Array(buffer);
        var eocdPos = findEOCD(view);
        if (eocdPos < 0) return null;
        var cdOffset = view.getUint32(eocdPos + 16, true);
        var cdEntries = view.getUint16(eocdPos + 10, true);
        var records = [];
        var p = cdOffset;
        for (var i = 0; i < cdEntries; i++) {
            if (view.getUint32(p, true) !== 0x02014b50) break;
            var nameLen = view.getUint16(p + 28, true);
            var extraLen = view.getUint16(p + 30, true);
            var commentLen = view.getUint16(p + 32, true);
            var name = BinUtils.readUtf8(bytes, p + 46, p + 46 + nameLen);
            var recLen = 46 + nameLen + extraLen + commentLen;
            records.push({ name: name, raw: bytes.slice(p, p + recLen) });
            p += recLen;
        }
        return { records: records, cdOffset: cdOffset };
    }

    // entriesMap: { 'шлях/у/архіві': Uint8Array } — додає нові або замінює наявні записи з такою назвою.
    // Повертає Uint8Array повного нового файлу, або null якщо вхідний буфер не є коректним ZIP.
    function addOrReplaceEntries(buffer, entriesMap) {
        var parsed = listRawCentralDirRecords(buffer);
        if (!parsed) return null;

        var original = new Uint8Array(buffer);
        var keepRecords = parsed.records.filter(function (r) { return !(r.name in entriesMap); });

        var now = dosDateTime(new Date());
        var chunks = [];
        chunks.push(original.subarray(0, parsed.cdOffset)); // усі незмінені дані файлів "як є"

        var writeOffset = parsed.cdOffset;
        var newRecords = []; // {name, raw CD record bytes}

        Object.keys(entriesMap).forEach(function (name) {
            var data = entriesMap[name];
            var nameBytes = utf8Bytes(name);
            var crc = Crc32.compute(data);

            var local = new Uint8Array(30 + nameBytes.length + data.length);
            var lv = new DataView(local.buffer);
            lv.setUint32(0, 0x04034b50, true);
            lv.setUint16(4, 20, true);           // version needed
            lv.setUint16(6, 0, true);            // flags
            lv.setUint16(8, 0, true);            // method = store
            lv.setUint16(10, now.time, true);
            lv.setUint16(12, now.date, true);
            lv.setUint32(14, crc, true);
            lv.setUint32(18, data.length, true); // comp size
            lv.setUint32(22, data.length, true); // uncomp size
            lv.setUint16(26, nameBytes.length, true);
            lv.setUint16(28, 0, true);           // extra len
            local.set(nameBytes, 30);
            local.set(data, 30 + nameBytes.length);

            chunks.push(local);

            var cd = new Uint8Array(46 + nameBytes.length);
            var cv = new DataView(cd.buffer);
            cv.setUint32(0, 0x02014b50, true);
            cv.setUint16(4, 20, true);           // version made by
            cv.setUint16(6, 20, true);           // version needed
            cv.setUint16(8, 0, true);            // flags
            cv.setUint16(10, 0, true);           // method = store
            cv.setUint16(12, now.time, true);
            cv.setUint16(14, now.date, true);
            cv.setUint32(16, crc, true);
            cv.setUint32(20, data.length, true);
            cv.setUint32(24, data.length, true);
            cv.setUint16(28, nameBytes.length, true);
            cv.setUint16(30, 0, true);           // extra len
            cv.setUint16(32, 0, true);           // comment len
            cv.setUint16(34, 0, true);           // disk start
            cv.setUint16(36, 0, true);           // internal attrs
            cv.setUint32(38, 0, true);           // external attrs
            cv.setUint32(42, writeOffset, true); // local header offset
            cd.set(nameBytes, 46);

            newRecords.push(cd);
            writeOffset += local.length;
        });

        var cdStart = writeOffset;
        keepRecords.forEach(function (r) { chunks.push(r.raw); writeOffset += r.raw.length; });
        newRecords.forEach(function (r) { chunks.push(r); writeOffset += r.length; });
        var cdSize = writeOffset - cdStart;
        var totalEntries = keepRecords.length + newRecords.length;

        var eocd = new Uint8Array(22);
        var ev = new DataView(eocd.buffer);
        ev.setUint32(0, 0x06054b50, true);
        ev.setUint16(4, 0, true);
        ev.setUint16(6, 0, true);
        ev.setUint16(8, totalEntries, true);
        ev.setUint16(10, totalEntries, true);
        ev.setUint32(12, cdSize, true);
        ev.setUint32(16, cdStart, true);
        ev.setUint16(20, 0, true);
        chunks.push(eocd);

        var totalLen = chunks.reduce(function (s, c) { return s + c.length; }, 0);
        var out = new Uint8Array(totalLen);
        var pos = 0;
        chunks.forEach(function (c) { out.set(c, pos); pos += c.length; });
        return out;
    }

    return { addOrReplaceEntries: addOrReplaceEntries, listRawCentralDirRecords: listRawCentralDirRecords };
})();
