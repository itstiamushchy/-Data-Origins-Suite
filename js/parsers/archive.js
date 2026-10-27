// Витоки Даних — parsers/archive.js
window.Parsers = window.Parsers || {};

window.Parsers.zipArchive = function (buffer, extHint) {
    if (['docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp', 'epub', 'jar'].indexOf(extHint) > -1) return null; // це оброблять спеціалізовані парсери
    var entries = window.ZipReader.listEntries(buffer);
    if (!entries) return null;
    var out = { 'Format:Name': 'ZIP-архів' };
    out['ZIP:EntryCount'] = entries.length;
    var totalComp = 0, totalUncomp = 0;
    entries.forEach(function (e) { totalComp += e.compSize; totalUncomp += e.uncompSize; });
    out['ZIP:CompressedTotal'] = totalComp;
    out['ZIP:UncompressedTotal'] = totalUncomp;
    out['ZIP:FirstEntries'] = entries.slice(0, 10).map(function (e) { return e.name; }).join(', ');
    return out;
};

window.Parsers.tar = function (buffer) {
    var view = new DataView(buffer);
    if (BinUtils.readAsciiString(view, 257, 6).trim() !== 'ustar') return null;
    var bytes = new Uint8Array(buffer);
    var out = { 'Format:Name': 'TAR' };
    var names = [];
    var offset = 0, guard = 0;
    while (offset + 512 <= view.byteLength && guard++ < 10000) {
        var name = BinUtils.readAsciiString(view, offset, 100);
        if (!name) break;
        var sizeOctal = BinUtils.readAsciiString(view, offset + 124, 12).trim();
        var size = parseInt(sizeOctal, 8) || 0;
        names.push(name);
        var blocks = Math.ceil(size / 512);
        offset += 512 + blocks * 512;
    }
    out['TAR:EntryCount'] = names.length;
    out['TAR:FirstEntries'] = names.slice(0, 10).join(', ');
    return out;
};

window.Parsers.gzip = function (buffer) {
    var view = new DataView(buffer);
    if (view.getUint8(0) !== 0x1F || view.getUint8(1) !== 0x8B) return null;
    var out = { 'Format:Name': 'GZIP' };
    var flags = view.getUint8(3);
    var mtime = view.getUint32(4, true);
    if (mtime > 0) out['GZIP:ModifiedTime'] = new Date(mtime * 1000).toISOString();
    if (flags & 0x08) {
        var p = 10;
        if (flags & 0x04) p += 2 + view.getUint16(p, true); // extra field
        var bytes = new Uint8Array(buffer);
        var nameEnd = p; while (bytes[nameEnd] !== 0 && nameEnd < bytes.length) nameEnd++;
        out['GZIP:OriginalFilename'] = BinUtils.readLatin1(bytes, p, nameEnd);
    }
    if (typeof DecompressionStream === 'undefined') return out;
    try {
        var ds = new DecompressionStream('gzip');
        var stream = new Blob([buffer]).stream().pipeThrough(ds);
        return new Response(stream).arrayBuffer().then(function (ab) {
            var inner = new Uint8Array(ab);
            if (BinUtils.readAsciiString(new DataView(ab), 257, 6).trim() === 'ustar') {
                var tarResult = window.Parsers.tar(ab);
                if (tarResult) { tarResult['Format:Name'] = 'TAR.GZ'; Object.assign(out, tarResult); }
            }
            return out;
        }).catch(function () { return out; });
    } catch (e) { return out; }
};

window.Parsers.rar = function (buffer) {
    var view = new DataView(buffer);
    var sig4 = BinUtils.readAsciiString(view, 0, 4);
    if (sig4 !== 'Rar!') return null;
    var isRar5 = view.getUint8(6) === 0x01 && view.getUint8(7) === 0x00;
    return { 'Format:Name': isRar5 ? 'RAR5' : 'RAR 1.5-4.0', 'RAR:Note': 'Пропрієтарний формат стиснення — перелік вмісту без розпакування бібліотеки не реалізовано.' };
};

window.Parsers.sevenZip = function (buffer) {
    var view = new DataView(buffer);
    if (view.getUint8(0) !== 0x37 || view.getUint8(1) !== 0x7A || view.getUint8(2) !== 0xBC || view.getUint8(3) !== 0xAF) return null;
    return {
        'Format:Name': '7-Zip',
        'SEVENZIP:Version': view.getUint8(6) + '.' + view.getUint8(7),
        'SEVENZIP:Note': 'Заголовок з переліком вмісту сам стиснутий (зазвичай LZMA) — розбір без кодека не реалізовано.'
    };
};
