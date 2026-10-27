// Витоки Даних — parsers/wav.js
window.Parsers = window.Parsers || {};
window.Parsers.wav = function (buffer) {
    var view = new DataView(buffer);
    var bytes = new Uint8Array(buffer);
    if (BinUtils.readAsciiString(view, 0, 4) !== 'RIFF') return null;
    if (BinUtils.readAsciiString(view, 8, 4) !== 'WAVE') return null;

    var out = {};
    var INFO_MAP = {
        INAM: 'Title', IART: 'Artist', IPRD: 'Album', ICMT: 'Comment',
        ICRD: 'Date', IGNR: 'Genre', ICOP: 'Copyright', ISFT: 'Software', IENG: 'Engineer'
    };

    var offset = 12;
    while (offset + 8 <= view.byteLength) {
        var fourcc = BinUtils.readAsciiString(view, offset, 4);
        var chunkSize = view.getUint32(offset + 4, true);
        var dataStart = offset + 8;

        if (fourcc === 'fmt ') {
            out['WAV:Channels'] = view.getUint16(dataStart + 2, true);
            out['WAV:SampleRate'] = view.getUint32(dataStart + 4, true);
            out['WAV:BitsPerSample'] = view.getUint16(dataStart + 14, true);
        } else if (fourcc === 'LIST') {
            var listType = BinUtils.readAsciiString(view, dataStart, 4);
            if (listType === 'INFO') {
                var p = dataStart + 4;
                var listEnd = dataStart + chunkSize;
                while (p + 8 <= listEnd) {
                    var subId = BinUtils.readAsciiString(view, p, 4);
                    var subSize = view.getUint32(p + 4, true);
                    var mapped = INFO_MAP[subId];
                    if (mapped) {
                        out['WAV:' + mapped] = BinUtils.readLatin1(bytes, p + 8, p + 8 + subSize).replace(/\0+$/, '').trim();
                    }
                    p += 8 + subSize + (subSize % 2);
                }
            }
        } else if (fourcc === 'bext') { // Broadcast Wave Format
            out['BWF:Description'] = BinUtils.readLatin1(bytes, dataStart, dataStart + 256).replace(/\0+$/, '').trim();
            out['BWF:Originator'] = BinUtils.readLatin1(bytes, dataStart + 256, dataStart + 288).replace(/\0+$/, '').trim();
            out['BWF:OriginationDate'] = BinUtils.readLatin1(bytes, dataStart + 320, dataStart + 330).replace(/\0+$/, '').trim();
            out['BWF:OriginationTime'] = BinUtils.readLatin1(bytes, dataStart + 330, dataStart + 338).replace(/\0+$/, '').trim();
        } else if (fourcc === 'id3 ' || fourcc === 'ID3 ') {
            var id3Slice = buffer.slice(dataStart, dataStart + chunkSize);
            var id3Tags = window.Parsers.mp3 ? window.Parsers.mp3(id3Slice) : null;
            if (id3Tags) Object.assign(out, id3Tags);
        }
        offset = dataStart + chunkSize + (chunkSize % 2);
    }
    return out;
};
