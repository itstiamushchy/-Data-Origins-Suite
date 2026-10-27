// Витоки Даних — ole2-reader.js
// Мінімальний рідер формату OLE2/CFB (Compound File Binary) — основа .doc/.xls/.ppt (97-2003).
// Реалізує: заголовок, FAT, directory-ланцюг, MiniFAT, доступ до потоків за назвою,
// розбір Property Set Stream (\x05SummaryInformation / \x05DocumentSummaryInformation).
window.Ole2Reader = (function () {
    'use strict';

    var SIG = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
    var FREESECT = 0xFFFFFFFF, ENDOFCHAIN = 0xFFFFFFFE, FATSECT = 0xFFFFFFFD, DIFSECT = 0xFFFFFFFC;

    function parse(buffer) {
        var view = new DataView(buffer);
        for (var i = 0; i < 8; i++) if (view.getUint8(i) !== SIG[i]) return null; // не OLE2/CFB

        var sectorShift = view.getUint16(30, true);
        var miniSectorShift = view.getUint16(32, true);
        var numFatSectors = view.getUint32(44, true);
        var firstDirSector = view.getUint32(48, true);
        var miniStreamCutoff = view.getUint32(56, true);
        var firstMiniFatSector = view.getUint32(60, true);
        var numMiniFatSectors = view.getUint32(64, true);
        var firstDifatSector = view.getUint32(68, true);
        var numDifatSectors = view.getUint32(72, true);
        var sectorSize = 1 << sectorShift;
        var miniSectorSize = 1 << miniSectorShift;

        function sectorOffset(secId) { return (secId + 1) * sectorSize; }

        // --- DIFAT: перші 109 записів у заголовку + продовження через ланцюг DIFAT-секторів ---
        var difat = [];
        for (var d = 0; d < 109; d++) {
            var v = view.getUint32(76 + d * 4, true);
            if (v !== FREESECT) difat.push(v);
        }
        var difatSec = firstDifatSector;
        var guard = 0;
        while (difatSec !== ENDOFCHAIN && difatSec !== FREESECT && guard++ < 100000) {
            var off = sectorOffset(difatSec);
            for (var k = 0; k < (sectorSize / 4) - 1; k++) {
                var vv = view.getUint32(off + k * 4, true);
                if (vv !== FREESECT) difat.push(vv);
            }
            difatSec = view.getUint32(off + sectorSize - 4, true);
        }

        // --- FAT: читаємо всі FAT-сектори, перелічені в DIFAT ---
        var fat = [];
        difat.slice(0, numFatSectors || difat.length).forEach(function (secId) {
            var off2 = sectorOffset(secId);
            for (var k2 = 0; k2 < sectorSize / 4; k2++) fat.push(view.getUint32(off2 + k2 * 4, true));
        });

        // totalSize === undefined означає "читати весь ланцюг до ENDOFCHAIN" (використовується для директорії,
        // чий розмір наперед невідомий).
        function readChain(startSec, totalSize) {
            var unbounded = totalSize === undefined;
            var chunks = [];
            var sec = startSec, remaining = unbounded ? Infinity : totalSize, guard2 = 0;
            while (sec !== ENDOFCHAIN && sec !== FREESECT && remaining > 0 && guard2++ < 1000000) {
                var off3 = sectorOffset(sec);
                var len = unbounded ? sectorSize : Math.min(sectorSize, remaining);
                chunks.push(new Uint8Array(buffer, off3, len));
                if (!unbounded) remaining -= len;
                sec = fat[sec];
            }
            var total = chunks.reduce(function (s, c) { return s + c.length; }, 0);
            var out = new Uint8Array(total);
            var p = 0;
            chunks.forEach(function (c) { out.set(c, p); p += c.length; });
            return out;
        }

        // --- Директорія (розмір наперед невідомий — читаємо весь ланцюг) ---
        var dirBytes = readChain(firstDirSector, undefined);
        var dirCount = Math.floor(dirBytes.length / 128);
        var entries = [];
        var dirView = new DataView(dirBytes.buffer, dirBytes.byteOffset, dirBytes.byteLength);
        for (var e = 0; e < dirCount; e++) {
            var base = e * 128;
            var nameLenBytes = dirView.getUint16(base + 64, true);
            if (nameLenBytes === 0) continue;
            var nameChars = Math.max(0, nameLenBytes / 2 - 1);
            var nameBytes = dirBytes.slice(base, base + nameChars * 2);
            var name = '';
            try { name = new TextDecoder('utf-16le').decode(nameBytes); } catch (ex) {}
            var objType = dirView.getUint8(base + 66);
            var startSector = dirView.getUint32(base + 116, true);
            var sizeLow = dirView.getUint32(base + 120, true);
            var sizeHigh = dirView.getUint32(base + 124, true);
            var size = sizeHigh * 0x100000000 + sizeLow;
            entries.push({ name: name, type: objType, startSector: startSector, size: size });
        }

        var root = entries.filter(function (en) { return en.type === 5; })[0];
        var miniStreamBytes = root ? readChain(root.startSector, root.size) : new Uint8Array(0);

        // --- MiniFAT ---
        var miniFat = [];
        if (numMiniFatSectors > 0) {
            var miniFatBytes = readChain(firstMiniFatSector, numMiniFatSectors * sectorSize);
            var mfView = new DataView(miniFatBytes.buffer, miniFatBytes.byteOffset, miniFatBytes.byteLength);
            for (var m = 0; m < miniFatBytes.length / 4; m++) miniFat.push(mfView.getUint32(m * 4, true));
        }

        function readMiniChain(startSec, totalSize) {
            var out = new Uint8Array(totalSize);
            var sec = startSec, pos = 0, guard3 = 0;
            while (sec !== ENDOFCHAIN && sec !== FREESECT && pos < totalSize && guard3++ < 1000000) {
                var off4 = sec * miniSectorSize;
                var len = Math.min(miniSectorSize, totalSize - pos);
                out.set(miniStreamBytes.slice(off4, off4 + len), pos);
                pos += len;
                sec = miniFat[sec];
            }
            return out;
        }

        function getStreamByEntry(entry) {
            if (!entry || entry.type !== 2) return null;
            if (entry.size < miniStreamCutoff) return readMiniChain(entry.startSector, entry.size);
            return readChain(entry.startSector, entry.size);
        }

        function getStream(name) {
            var entry = entries.filter(function (en) { return en.name === name; })[0];
            return getStreamByEntry(entry);
        }

        return {
            entries: entries,
            getStream: getStream,
            listStreamNames: function () { return entries.filter(function (en) { return en.type === 2; }).map(function (en) { return en.name; }); }
        };
    }

    // --- Property Set Stream (MS-OLEPS) — спільний розбір для SummaryInformation / DocumentSummaryInformation ---
    var VT_LPSTR = 30, VT_LPWSTR = 31, VT_FILETIME = 64, VT_I2 = 2, VT_I4 = 3, VT_BOOL = 11;

    function filetimeToDate(low, high) {
        var ms = (high * 0x100000000 + low) / 10000 - 11644473600000;
        if (!isFinite(ms) || ms <= 0) return null;
        try { return new Date(ms).toISOString(); } catch (e) { return null; }
    }

    function readProperty(view, bytes, offset) {
        var type = view.getUint32(offset, true);
        var valOffset = offset + 4;
        switch (type) {
            case VT_LPSTR: {
                var len = view.getUint32(valOffset, true);
                return BinUtils.readLatin1(bytes, valOffset + 4, valOffset + 4 + len).replace(/\0+$/, '');
            }
            case VT_LPWSTR: {
                var lenW = view.getUint32(valOffset, true);
                try { return new TextDecoder('utf-16le').decode(bytes.slice(valOffset + 4, valOffset + 4 + lenW * 2)).replace(/\0+$/, ''); }
                catch (e) { return null; }
            }
            case VT_FILETIME:
                return filetimeToDate(view.getUint32(valOffset, true), view.getUint32(valOffset + 4, true));
            case VT_I2: return view.getInt16(valOffset, true);
            case VT_I4: return view.getInt32(valOffset, true);
            case VT_BOOL: return view.getInt16(valOffset, true) !== 0;
            default: return null;
        }
    }

    function parsePropertySetStream(streamBytes, propertyIdMap) {
        if (!streamBytes || streamBytes.length < 28) return {};
        var view = new DataView(streamBytes.buffer, streamBytes.byteOffset, streamBytes.byteLength);
        var numSets = view.getUint32(24, true);
        if (numSets < 1) return {};
        var set0Offset = view.getUint32(44, true); // FMTID0(16б, offset 28) + Offset0(4б, offset 44)
        var size = view.getUint32(set0Offset, true);
        var numProps = view.getUint32(set0Offset + 4, true);
        var out = {};
        for (var i = 0; i < numProps; i++) {
            var idOff = set0Offset + 8 + i * 8;
            if (idOff + 8 > streamBytes.length) break;
            var propId = view.getUint32(idOff, true);
            var propOffset = view.getUint32(idOff + 4, true);
            var absOffset = set0Offset + propOffset;
            var name = propertyIdMap[propId];
            if (!name) continue;
            try {
                var val = readProperty(view, streamBytes, absOffset);
                if (val !== null && val !== undefined && val !== '') out[name] = val;
            } catch (e) { /* пошкоджена властивість — пропускаємо */ }
        }
        return out;
    }

    var SUMMARY_INFO_MAP = {
        2: 'Title', 3: 'Subject', 4: 'Author', 5: 'Keywords', 6: 'Comments',
        7: 'Template', 8: 'LastAuthor', 9: 'RevisionNumber', 10: 'EditTime',
        11: 'LastPrinted', 12: 'CreateTime', 13: 'LastSaveTime', 14: 'PageCount',
        15: 'WordCount', 16: 'CharCount', 18: 'AppName', 19: 'Security'
    };
    var DOC_SUMMARY_INFO_MAP = {
        14: 'Category', 15: 'PresentationFormat', 17: 'LineCount', 18: 'ParagraphCount',
        19: 'SlideCount', 22: 'Company', 23: 'LinksDirty'
    };

    return {
        parse: parse,
        parsePropertySetStream: parsePropertySetStream,
        SUMMARY_INFO_MAP: SUMMARY_INFO_MAP,
        DOC_SUMMARY_INFO_MAP: DOC_SUMMARY_INFO_MAP
    };
})();
