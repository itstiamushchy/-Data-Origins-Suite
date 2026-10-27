// Витоки Даних — parsers/mobi.js
window.Parsers = window.Parsers || {};
window.Parsers.mobi = function (buffer) {
    var view = new DataView(buffer);
    var bytes = new Uint8Array(buffer);
    if (view.byteLength < 78) return null;
    var type = BinUtils.readAsciiString(view, 60, 4);
    var creator = BinUtils.readAsciiString(view, 64, 4);
    if (!((type === 'BOOK' && creator === 'MOBI') || (type === 'TEXt' && creator === 'REAd'))) return null;

    var out = { 'Format:Name': creator === 'MOBI' ? 'MOBI/AZW' : 'PalmDOC' };
    out['MOBI:DatabaseName'] = BinUtils.readLatin1(bytes, 0, 32).replace(/\0+$/, '').trim();

    var numRecords = view.getUint16(76, false);
    if (numRecords < 1) return out;
    var record0Offset = view.getUint32(78, false);

    if (BinUtils.readAsciiString(view, record0Offset + 16, 4) === 'MOBI') {
        var headerLength = view.getUint32(record0Offset + 20, false);
        var fullNameOffset = view.getUint32(record0Offset + 84, false);
        var fullNameLength = view.getUint32(record0Offset + 88, false);
        if (fullNameOffset && fullNameLength) {
            out['MOBI:FullTitle'] = BinUtils.readUtf8(bytes, record0Offset + fullNameOffset, record0Offset + fullNameOffset + fullNameLength);
        }
        var exthFlags = view.getUint32(record0Offset + 128, false);
        if (exthFlags & 0x40) {
            var exthStart = record0Offset + 16 + headerLength;
            if (BinUtils.readAsciiString(view, exthStart, 4) === 'EXTH') {
                var exthCount = view.getUint32(exthStart + 8, false);
                var EXTH_MAP = { 100: 'Author', 101: 'Publisher', 103: 'Description', 104: 'ISBN', 105: 'Subject', 106: 'PublishDate', 108: 'Contributor', 109: 'Rights', 503: 'UpdatedTitle' };
                var p = exthStart + 12;
                for (var i = 0; i < exthCount; i++) {
                    if (p + 8 > view.byteLength) break;
                    var recType = view.getUint32(p, false);
                    var recLen = view.getUint32(p + 4, false);
                    var mapped = EXTH_MAP[recType];
                    if (mapped) {
                        var val = BinUtils.readUtf8(bytes, p + 8, p + recLen);
                        out['MOBI:' + mapped] = val.trim();
                    }
                    p += recLen;
                }
            }
        }
    }
    return out;
};
