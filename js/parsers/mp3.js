// Витоки Даних — parsers/mp3.js
window.Parsers = window.Parsers || {};
window.Parsers.mp3 = function (buffer) {
    var view = new DataView(buffer);
    var bytes = new Uint8Array(buffer);
    var out = {};
    var hasID3v2 = BinUtils.readAsciiString(view, 0, 3) === 'ID3';
    var hasID3v1 = buffer.byteLength >= 128 && BinUtils.readAsciiString(view, buffer.byteLength - 128, 3) === 'TAG';
    var hasFrameSync = buffer.byteLength > 2 && view.getUint8(0) === 0xFF && (view.getUint8(1) & 0xE0) === 0xE0;
    if (!hasID3v2 && !hasID3v1 && !hasFrameSync) return null; // не MP3

    if (hasID3v2) {
        var majorVer = view.getUint8(3);
        var flags = view.getUint8(5);
        var sizeBytes = [view.getUint8(6), view.getUint8(7), view.getUint8(8), view.getUint8(9)];
        var tagSize = (sizeBytes[0] << 21) | (sizeBytes[1] << 14) | (sizeBytes[2] << 7) | sizeBytes[3];
        var hasExtHeader = (flags & 0x40) !== 0;
        var offset = 10;
        if (hasExtHeader) {
            var extSize = majorVer === 4
                ? ((view.getUint8(offset) << 21) | (view.getUint8(offset + 1) << 14) | (view.getUint8(offset + 2) << 7) | view.getUint8(offset + 3))
                : view.getUint32(offset, false);
            offset += extSize;
        }
        var tagEnd = 10 + tagSize;
        var idSize = majorVer === 2 ? 3 : 4;
        var FRAME_MAP = {
            TIT2: 'Title', TT2: 'Title', TPE1: 'Artist', TP1: 'Artist',
            TALB: 'Album', TAL: 'Album', TYER: 'Year', TYE: 'Year', TDRC: 'Date',
            TCON: 'Genre', TCO: 'Genre', TRCK: 'TrackNumber', TRK: 'TrackNumber',
            COMM: 'Comment', COM: 'Comment', TCOM: 'Composer', TCM: 'Composer',
            TPE2: 'AlbumArtist', TBPM: 'BPM', TPOS: 'DiscNumber', TPUB: 'Publisher',
            TCOP: 'Copyright', TENC: 'EncodedBy', WXXX: 'URL', APIC: 'HasCoverArt', PIC: 'HasCoverArt'
        };
        while (offset < Math.min(tagEnd, view.byteLength) - idSize - (majorVer === 2 ? 3 : 8)) {
            var frameId = BinUtils.readAsciiString(view, offset, idSize);
            if (!frameId || frameId === '\0\0\0\0' || frameId.trim() === '') break;
            var frameSize, headerLen;
            if (majorVer === 2) {
                frameSize = (view.getUint8(offset + 3) << 16) | (view.getUint8(offset + 4) << 8) | view.getUint8(offset + 5);
                headerLen = 6;
            } else if (majorVer === 4) {
                var fs = [view.getUint8(offset + 4), view.getUint8(offset + 5), view.getUint8(offset + 6), view.getUint8(offset + 7)];
                frameSize = (fs[0] << 21) | (fs[1] << 14) | (fs[2] << 7) | fs[3];
                headerLen = 10;
            } else {
                frameSize = view.getUint32(offset + 4, false);
                headerLen = 10;
            }
            if (frameSize <= 0 || offset + headerLen + frameSize > view.byteLength) break;
            var dataStart = offset + headerLen;
            var mapped = FRAME_MAP[frameId];
            if (mapped === 'HasCoverArt') {
                out['ID3:HasCoverArt'] = true;
            } else if (mapped) {
                out['ID3:' + mapped] = readId3Text(bytes, dataStart, dataStart + frameSize);
            }
            offset = dataStart + frameSize;
        }
    }

    if (hasID3v1 && !out['ID3:Title']) {
        var p = buffer.byteLength - 128;
        out['ID3:Title'] = BinUtils.readLatin1(bytes, p + 3, p + 33).replace(/\0+$/, '').trim();
        out['ID3:Artist'] = BinUtils.readLatin1(bytes, p + 33, p + 63).replace(/\0+$/, '').trim();
        out['ID3:Album'] = BinUtils.readLatin1(bytes, p + 63, p + 93).replace(/\0+$/, '').trim();
        out['ID3:Year'] = BinUtils.readLatin1(bytes, p + 93, p + 97).replace(/\0+$/, '').trim();
    }
    return out;

    function readId3Text(bytes, start, end) {
        if (start >= end) return '';
        var encByte = bytes[start];
        var textStart = start + 1;
        var raw;
        if (encByte === 1) { // UTF-16 з BOM
            var bom = (bytes[textStart] << 8) | bytes[textStart + 1];
            var enc = bom === 0xFFFE ? 'utf-16le' : 'utf-16be';
            try { raw = new TextDecoder(enc).decode(bytes.slice(textStart + 2, end)); }
            catch (e) { raw = BinUtils.readLatin1(bytes, textStart, end); }
        } else if (encByte === 2) { // UTF-16BE без BOM
            try { raw = new TextDecoder('utf-16be').decode(bytes.slice(textStart, end)); }
            catch (e) { raw = BinUtils.readLatin1(bytes, textStart, end); }
        } else if (encByte === 3) { // UTF-8
            raw = BinUtils.readUtf8(bytes, textStart, end);
        } else {
            raw = BinUtils.readLatin1(bytes, textStart, end);
        }
        return raw.replace(/\0+$/, '').trim();
    }
};
