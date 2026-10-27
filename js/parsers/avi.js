// Витоки Даних — parsers/avi.js
window.Parsers = window.Parsers || {};
window.Parsers.avi = function (buffer) {
    var view = new DataView(buffer);
    var bytes = new Uint8Array(buffer);
    if (BinUtils.readAsciiString(view, 0, 4) !== 'RIFF') return null;
    if (BinUtils.readAsciiString(view, 8, 4) !== 'AVI ') return null;

    var out = {};
    var INFO_MAP = { INAM: 'Title', IART: 'Artist', ICMT: 'Comment', ICRD: 'Date', ISFT: 'Software' };
    var offset = 12;
    while (offset + 8 <= view.byteLength) {
        var fourcc = BinUtils.readAsciiString(view, offset, 4);
        var chunkSize = view.getUint32(offset + 4, true);
        var dataStart = offset + 8;

        if (fourcc === 'LIST') {
            var listType = BinUtils.readAsciiString(view, dataStart, 4);
            if (listType === 'hdrl') {
                var p = dataStart + 4;
                if (BinUtils.readAsciiString(view, p, 4) === 'avih') {
                    var h = p + 8;
                    out['AVI:FrameDelayMicrosec'] = view.getUint32(h, true);
                    out['AVI:TotalFrames'] = view.getUint32(h + 16, true);
                    out['AVI:Width'] = view.getUint32(h + 32, true);
                    out['AVI:Height'] = view.getUint32(h + 36, true);
                    var usPerFrame = out['AVI:FrameDelayMicrosec'];
                    if (usPerFrame > 0) out['AVI:FPS'] = Math.round(1000000 / usPerFrame * 100) / 100;
                }
            } else if (listType === 'INFO') {
                var q = dataStart + 4, listEnd = dataStart + chunkSize;
                while (q + 8 <= listEnd) {
                    var subId = BinUtils.readAsciiString(view, q, 4);
                    var subSize = view.getUint32(q + 4, true);
                    var mapped = INFO_MAP[subId];
                    if (mapped) out['AVI:' + mapped] = BinUtils.readLatin1(bytes, q + 8, q + 8 + subSize).replace(/\0+$/, '').trim();
                    q += 8 + subSize + (subSize % 2);
                }
            }
        }
        if (fourcc === 'LIST' && BinUtils.readAsciiString(view, dataStart, 4) === 'movi') break; // далі — лише відеодані
        offset = dataStart + chunkSize + (chunkSize % 2);
    }
    return out;
};
