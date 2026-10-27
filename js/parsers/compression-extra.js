// Витоки Даних — parsers/compression-extra.js
// DecompressionStream підтримує лише gzip/deflate/deflate-raw у браузері, тому bzip2/xz/zstd/lz4
// розпізнаються за сигнатурою, без розпакування вмісту.
window.Parsers = window.Parsers || {};

window.Parsers.bzip2 = function (buffer) {
    var view = new DataView(buffer);
    if (BinUtils.readAsciiString(view, 0, 3) !== 'BZh') return null;
    var level = String.fromCharCode(view.getUint8(3));
    return { 'Format:Name': 'BZip2', 'BZIP2:BlockSize': level + '00 КБ', 'BZIP2:Note': 'Розпакування bzip2 не підтримується Web-API браузера — підтверджено лише формат.' };
};

window.Parsers.xz = function (buffer) {
    var bytes = new Uint8Array(buffer);
    var XZ_MAGIC = [0xFD, 0x37, 0x7A, 0x58, 0x5A, 0x00];
    for (var i = 0; i < 6; i++) if (bytes[i] !== XZ_MAGIC[i]) return null;
    return { 'Format:Name': 'XZ', 'XZ:Note': 'Розпакування XZ (LZMA2) не підтримується Web-API браузера — підтверджено лише формат.' };
};

window.Parsers.zstd = function (buffer) {
    var view = new DataView(buffer);
    if (view.getUint32(0, true) !== 0xFD2FB528) return null;
    return { 'Format:Name': 'Zstandard (ZST)', 'ZSTD:Note': 'Розпакування Zstandard не підтримується Web-API браузера — підтверджено лише формат.' };
};

window.Parsers.lz4 = function (buffer) {
    var view = new DataView(buffer);
    if (view.getUint32(0, true) !== 0x184D2204) return null;
    return { 'Format:Name': 'LZ4', 'LZ4:Note': 'Розпакування LZ4 не підтримується Web-API браузера — підтверджено лише формат.' };
};

window.Parsers.cab = function (buffer) {
    var view = new DataView(buffer);
    if (BinUtils.readAsciiString(view, 0, 4) !== 'MSCF') return null;
    var out = { 'Format:Name': 'Windows Cabinet (CAB)' };
    out['CAB:TotalSize'] = view.getUint32(8, true);
    out['CAB:FileCount'] = view.getUint16(28, true);
    out['CAB:FolderCount'] = view.getUint16(26, true);
    return out;
};

window.Parsers.dmg = function (buffer, extHint) {
    if (extHint !== 'dmg') return null;
    if (buffer.byteLength < 512) return null;
    var view = new DataView(buffer);
    var trailerOffset = buffer.byteLength - 512;
    if (BinUtils.readAsciiString(view, trailerOffset, 4) !== 'koly') return null;
    var out = { 'Format:Name': 'Apple Disk Image (DMG)' };
    out['DMG:Version'] = view.getUint32(trailerOffset + 4, false);
    return out;
};
