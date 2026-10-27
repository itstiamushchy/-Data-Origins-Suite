// Витоки Даних — parsers/png.js
window.Parsers = window.Parsers || {};
window.Parsers.png = function (buffer) {
    var view = new DataView(buffer);
    var bytes = new Uint8Array(buffer);
    var sig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    for (var s = 0; s < 8; s++) if (bytes[s] !== sig[s]) return null; // не PNG

    var out = {};
    var offset = 8;
    var textJobs = []; // відкладені zTXt/iTXt потребують асинхронного inflate

    while (offset + 8 <= view.byteLength) {
        var length = view.getUint32(offset, false);
        var type = BinUtils.readAsciiString(view, offset + 4, 4);
        var dataStart = offset + 8;

        if (type === 'IHDR') {
            out['ImageWidth'] = view.getUint32(dataStart, false);
            out['ImageHeight'] = view.getUint32(dataStart + 4, false);
            out['BitsPerSample'] = view.getUint8(dataStart + 8);
        } else if (type === 'tEXt') {
            var raw = BinUtils.readLatin1(bytes, dataStart, dataStart + length);
            var idx = raw.indexOf('\0');
            if (idx > -1) out['PNG:' + raw.slice(0, idx)] = raw.slice(idx + 1);
        } else if (type === 'zTXt') {
            var zIdx = -1;
            for (var zi = 0; zi < length; zi++) { if (bytes[dataStart + zi] === 0) { zIdx = zi; break; } }
            if (zIdx > -1) {
                var keyword = BinUtils.readLatin1(bytes, dataStart, dataStart + zIdx);
                var compressed = bytes.slice(dataStart + zIdx + 2, dataStart + length);
                textJobs.push({ keyword: keyword, compressed: compressed });
            }
        } else if (type === 'iTXt') {
            var p = dataStart, end = dataStart + length;
            var k0 = p; while (bytes[p] !== 0 && p < end) p++;
            var keyword2 = BinUtils.readUtf8(bytes, k0, p); p++;
            var compFlag = bytes[p]; p += 2; // compression flag + method
            var lt0 = p; while (bytes[p] !== 0 && p < end) p++; p++; // language tag
            var tk0 = p; while (bytes[p] !== 0 && p < end) p++; p++; // translated keyword
            if (compFlag === 1) {
                textJobs.push({ keyword: keyword2, compressed: bytes.slice(p, end) });
            } else {
                out['PNG:' + keyword2] = BinUtils.readUtf8(bytes, p, end);
            }
        } else if (type === 'pHYs') {
            out['PNG:PixelsPerUnitX'] = view.getUint32(dataStart, false);
            out['PNG:PixelsPerUnitY'] = view.getUint32(dataStart + 4, false);
        } else if (type === 'tIME') {
            var y = view.getUint16(dataStart, false), mo = bytes[dataStart + 2], d = bytes[dataStart + 3];
            var h = bytes[dataStart + 4], mi = bytes[dataStart + 5], se = bytes[dataStart + 6];
            out['PNG:CreationTime'] = y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0') +
                ' ' + String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0') + ':' + String(se).padStart(2, '0') + ' UTC';
        } else if (type === 'iCCP') {
            out['PNG:HasICCProfile'] = true;
        } else if (type === 'eXIf') {
            var tiffTags = TiffReader.parse(buffer, dataStart);
            if (tiffTags) Object.assign(out, tiffTags);
        } else if (type === 'IEND') {
            break;
        }
        offset = dataStart + length + 4; // +4 = CRC
    }

    if (textJobs.length === 0) return Promise.resolve(out);
    return Promise.all(textJobs.map(function (job) {
        return BinUtils.inflateZlib(job.compressed).then(function (plain) {
            if (plain) out['PNG:' + job.keyword] = BinUtils.readUtf8(plain, 0, plain.length);
        });
    })).then(function () { return out; });
};
