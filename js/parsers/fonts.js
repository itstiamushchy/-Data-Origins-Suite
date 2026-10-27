// Витоки Даних — parsers/fonts.js
window.Parsers = window.Parsers || {};

var NAME_ID_MAP = { 0: 'Copyright', 1: 'Family', 2: 'Subfamily', 4: 'FullName', 5: 'Version', 6: 'PostScriptName', 8: 'Manufacturer', 9: 'Designer', 13: 'License' };

function parseNameTable(view, bytes, tableStart) {
    var out = {};
    var count = view.getUint16(tableStart + 2, false);
    var stringOffset = tableStart + view.getUint16(tableStart + 4, false);
    for (var i = 0; i < count; i++) {
        var recOffset = tableStart + 6 + i * 12;
        if (recOffset + 12 > view.byteLength) break;
        var platformID = view.getUint16(recOffset, false);
        var nameID = view.getUint16(recOffset + 6, false);
        var length = view.getUint16(recOffset + 8, false);
        var offset = view.getUint16(recOffset + 10, false);
        var mapped = NAME_ID_MAP[nameID];
        if (!mapped || out['FONT:' + mapped]) continue;
        var strStart = stringOffset + offset;
        var value;
        if (platformID === 1) value = BinUtils.readLatin1(bytes, strStart, strStart + length); // Mac Roman (наближено)
        else { try { value = new TextDecoder('utf-16be').decode(bytes.slice(strStart, strStart + length)); } catch (e) { value = ''; } }
        if (value) out['FONT:' + mapped] = value.trim();
    }
    return out;
}

window.Parsers.fonts = function (buffer) {
    var view = new DataView(buffer);
    var bytes = new Uint8Array(buffer);
    var tag = view.getUint32(0, false);

    if (tag === 0x00010000 || tag === 0x4F54544F /* OTTO */ || tag === 0x74727565 /* true */) {
        var out = { 'Format:Name': tag === 0x4F54544F ? 'OpenType (CFF/OTF)' : 'TrueType (TTF)' };
        var numTables = view.getUint16(4, false);
        for (var i = 0; i < numTables; i++) {
            var rec = 12 + i * 16;
            if (rec + 16 > view.byteLength) break;
            var tableTag = BinUtils.readAsciiString(view, rec, 4);
            if (tableTag === 'name') {
                var nameOffset = view.getUint32(rec + 8, false);
                Object.assign(out, parseNameTable(view, bytes, nameOffset));
                break;
            }
        }
        return out;
    }

    if (BinUtils.readAsciiString(view, 0, 4) === 'wOFF') {
        var outWoff = { 'Format:Name': 'WOFF (Web Open Font Format 1)' };
        var numTablesW = view.getUint16(12, false);
        var dirOffset = 44;
        for (var j = 0; j < numTablesW; j++) {
            var e = dirOffset + j * 20;
            if (e + 20 > view.byteLength) break;
            var tTag = BinUtils.readAsciiString(view, e, 4);
            if (tTag === 'name') {
                var compOffset = view.getUint32(e + 4, false);
                var compLength = view.getUint32(e + 8, false);
                var origLength = view.getUint32(e + 12, false);
                var compressed = bytes.slice(compOffset, compOffset + compLength);
                if (compLength === origLength) {
                    Object.assign(outWoff, parseNameTable(view, bytes, compOffset));
                    return outWoff;
                }
                return BinUtils.inflateZlib(compressed).then(function (plain) {
                    if (plain) {
                        var pv = new DataView(plain.buffer, plain.byteOffset, plain.byteLength);
                        Object.assign(outWoff, parseNameTable(pv, plain, 0));
                    }
                    return outWoff;
                });
            }
        }
        return outWoff;
    }

    if (BinUtils.readAsciiString(view, 0, 4) === 'wOF2') {
        return { 'Format:Name': 'WOFF2 (Web Open Font Format 2)', 'FONT:Note': 'Таблиці стиснуто Brotli — браузер не підтримує розпакування, вміст name-таблиці недоступний.' };
    }
    return null;
};
