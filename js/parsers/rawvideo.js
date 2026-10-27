// Витоки Даних — parsers/rawvideo.js
window.Parsers = window.Parsers || {};

window.Parsers.ari = function (buffer, extHint) {
    if (extHint !== 'ari') return null;
    var bytes = new Uint8Array(buffer);
    var head = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 256));
    if (head.indexOf('ARRI') === -1) return null;
    var out = { 'Format:Name': 'ARRIRAW (ARI)', 'ARI:Note': 'Закритий формат ARRI — детальний розбір заголовка кадру не реалізовано, підтверджено сигнатуру.' };
    // Частина заголовка ARRIRAW побудована на TIFF-подібній структурі — пробуємо додатково, якщо є.
    try {
        var tiffTags = window.TiffReader.parse(buffer, 0);
        if (tiffTags && Object.keys(tiffTags).length) Object.assign(out, tiffTags);
    } catch (e) {}
    return out;
};

window.Parsers.r3d = function (buffer, extHint) {
    if (extHint !== 'r3d') return null;
    var view = new DataView(buffer);
    var chunkType = BinUtils.readAsciiString(view, 4, 4);
    if (chunkType !== 'RED1' && chunkType !== 'RED2') return null;
    return { 'Format:Name': 'RED RAW (R3D)', 'R3D:Note': 'Закритий формат RED Digital Cinema — детальний розбір метаданих кадру не реалізовано, підтверджено сигнатуру.' };
};

window.Parsers.braw = function (buffer, extHint) {
    if (extHint !== 'braw') return null;
    var bytes = new Uint8Array(buffer);
    var head = BinUtils.readLatin1(bytes, 0, 8);
    if (head.indexOf('BRAW') === -1 && BinUtils.bytesToHex(bytes.slice(0, 4)) !== '42524157') return null;
    return { 'Format:Name': 'Blackmagic RAW (BRAW)', 'BRAW:Note': 'Закритий формат Blackmagic Design — детальний розбір метаданих кадру не реалізовано, підтверджено сигнатуру.' };
};
