// Витоки Даних — parsers/heic.js
// ISOBMFF-контейнер (HEIC/HEIF/AVIF): ftyp -> meta -> iinf (пошук item типу "Exif") -> iloc (офсет/розмір) -> TIFF-дані.
window.Parsers = window.Parsers || {};
window.Parsers.heic = function (buffer) {
    var view = new DataView(buffer);
    if (view.byteLength < 12) return null;
    var size0 = view.getUint32(0, false);
    var type0 = BinUtils.readAsciiString(view, 4, 4);
    if (type0 !== 'ftyp') return null; // не ISOBMFF

    var brand = BinUtils.readAsciiString(view, 8, 4);
    var out = { 'Format:Brand': brand };

    function readBoxes(start, end) {
        var boxes = [];
        var p = start;
        while (p + 8 <= end) {
            var size = view.getUint32(p, false);
            var type = BinUtils.readAsciiString(view, p + 4, 4);
            var headerLen = 8;
            if (size === 1) { headerLen = 16; /* 64-біт розмір — рідкісний випадок, пропускаємо точний розбір */ }
            var boxEnd = size === 0 ? end : p + (size || (end - p));
            boxes.push({ type: type, start: p, headerLen: headerLen, dataStart: p + headerLen, end: boxEnd });
            if (size <= 0) break;
            p = boxEnd;
        }
        return boxes;
    }

    var topBoxes = readBoxes(0, view.byteLength);
    var metaBox = topBoxes.filter(function (b) { return b.type === 'meta'; })[0];
    if (!metaBox) { out['RAW:Format'] = 'HEIC/HEIF контейнер (meta-блок не знайдено)'; return out; }

    // meta-box має 4-байтну full-box версію/флаги перед дочірніми боксами
    var metaChildren = readBoxes(metaBox.dataStart + 4, metaBox.end);
    var iinfBox = metaChildren.filter(function (b) { return b.type === 'iinf'; })[0];
    var ilocBox = metaChildren.filter(function (b) { return b.type === 'iloc'; })[0];

    var exifItemId = null;
    if (iinfBox) {
        var p2 = iinfBox.dataStart;
        var version = view.getUint8(p2);
        var entryCount = version === 0 ? view.getUint16(p2 + 4, false) : view.getUint32(p2 + 4, false);
        var infeStart = p2 + (version === 0 ? 6 : 8);
        var infeBoxes = readBoxes(infeStart, iinfBox.end);
        for (var i = 0; i < infeBoxes.length; i++) {
            var infe = infeBoxes[i];
            if (infe.type !== 'infe') continue;
            var ver = view.getUint8(infe.dataStart);
            var itemId = ver >= 2 ? view.getUint16(infe.dataStart + 4, false) : view.getUint16(infe.dataStart + 4, false);
            var itemType = BinUtils.readAsciiString(view, infe.dataStart + 8, 4);
            if (itemType === 'Exif') { exifItemId = itemId; }
        }
    }

    if (exifItemId !== null && ilocBox) {
        try {
            var p3 = ilocBox.dataStart;
            var offSize = view.getUint8(p3) >> 4, lenSize = view.getUint8(p3) & 0x0F;
            var baseOffSize = view.getUint8(p3 + 1) >> 4;
            var itemCount = view.getUint16(p3 + 2, false);
            var q = p3 + 4;
            for (var j = 0; j < itemCount; j++) {
                var itemId2 = view.getUint16(q, false); q += 2;
                q += 2; // construction_method + data_reference_index (спрощено для version 0)
                var baseOffset = baseOffSize === 4 ? view.getUint32(q, false) : 0; q += baseOffSize;
                var extentCount = view.getUint16(q, false); q += 2;
                var extOffset = 0, extLen = 0;
                for (var k = 0; k < extentCount; k++) {
                    extOffset = offSize === 4 ? view.getUint32(q, false) : 0; q += offSize;
                    extLen = lenSize === 4 ? view.getUint32(q, false) : 0; q += lenSize;
                }
                if (itemId2 === exifItemId) {
                    var dataPos = baseOffset + extOffset;
                    // Перші 4 байти Exif-item — offset до TIFF-заголовка (зазвичай "Exif\0\0")
                    var exifHeaderOffset = view.getUint32(dataPos, false);
                    var tiffStart = dataPos + 4 + exifHeaderOffset;
                    var tiffTags = TiffReader.parse(buffer, tiffStart);
                    if (tiffTags) Object.assign(out, tiffTags);
                    break;
                }
            }
        } catch (e) { /* нестандартна структура iloc — пропускаємо */ }
    }

    out['RAW:Format'] = brand.indexOf('avif') > -1 || brand.indexOf('av01') > -1 ? 'AVIF' : 'HEIC/HEIF';
    return out;
};
