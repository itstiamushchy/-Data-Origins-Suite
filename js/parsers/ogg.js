// Витоки Даних — parsers/ogg.js
window.Parsers = window.Parsers || {};
window.Parsers.ogg = function (buffer) {
    var view = new DataView(buffer);
    var bytes = new Uint8Array(buffer);
    if (BinUtils.readAsciiString(view, 0, 4) !== 'OggS') return null;

    var out = {};
    var offset = 0;
    var codec = null;
    var pagesScanned = 0;

    while (offset + 27 <= view.byteLength && pagesScanned < 6) {
        if (BinUtils.readAsciiString(view, offset, 4) !== 'OggS') break;
        var segCount = view.getUint8(offset + 26);
        var segTable = offset + 27;
        var pageDataStart = segTable + segCount;
        var pageSize = 0;
        for (var i = 0; i < segCount; i++) pageSize += view.getUint8(segTable + i);

        var packetStart = pageDataStart;
        var sig5 = BinUtils.readAsciiString(view, packetStart + 1, 6);
        var sig8 = BinUtils.readAsciiString(view, packetStart, 8);

        if (sig5 === 'vorbis' && view.getUint8(packetStart) === 1) {
            codec = 'Vorbis';
            out['OGG:Codec'] = 'Vorbis';
            out['OGG:Channels'] = view.getUint8(packetStart + 11);
            out['OGG:SampleRate'] = view.getUint32(packetStart + 12, true);
        } else if (sig5 === 'vorbis' && view.getUint8(packetStart) === 3) {
            Object.assign(out, BinUtils.parseVorbisComment(bytes, packetStart + 7, pageDataStart + pageSize, 'VORBIS:'));
        } else if (sig8 === 'OpusHead') {
            codec = 'Opus';
            out['OGG:Codec'] = 'Opus';
            out['OGG:Channels'] = view.getUint8(packetStart + 9);
            out['OGG:SampleRate'] = view.getUint32(packetStart + 12, true);
        } else if (sig8 === 'OpusTags') {
            Object.assign(out, BinUtils.parseVorbisComment(bytes, packetStart + 8, pageDataStart + pageSize, 'OPUSTAG:'));
        } else if (BinUtils.readAsciiString(view, packetStart, 5) === '\x7FFLAC') {
            codec = 'FLAC-in-Ogg';
            out['OGG:Codec'] = 'FLAC';
        }

        offset = pageDataStart + pageSize;
        pagesScanned++;
    }
    if (!codec) out['OGG:Codec'] = 'невідомий/недостатньо даних у перших сторінках';
    return out;
};
