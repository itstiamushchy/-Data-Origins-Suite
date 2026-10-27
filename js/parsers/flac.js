// Витоки Даних — parsers/flac.js
window.Parsers = window.Parsers || {};
window.Parsers.flac = function (buffer) {
    var view = new DataView(buffer);
    var bytes = new Uint8Array(buffer);
    if (BinUtils.readAsciiString(view, 0, 4) !== 'fLaC') return null;

    var out = {};
    var offset = 4;
    while (offset + 4 <= view.byteLength) {
        var header = view.getUint8(offset);
        var isLast = (header & 0x80) !== 0;
        var blockType = header & 0x7F;
        var blockSize = (view.getUint8(offset + 1) << 16) | (view.getUint8(offset + 2) << 8) | view.getUint8(offset + 3);
        var dataStart = offset + 4;

        if (blockType === 0) { // STREAMINFO
            var sampleRate = (view.getUint8(dataStart + 10) << 12) | (view.getUint8(dataStart + 11) << 4) | (view.getUint8(dataStart + 12) >> 4);
            var channels = ((view.getUint8(dataStart + 12) >> 1) & 0x07) + 1;
            var bps = ((view.getUint8(dataStart + 12) & 0x01) << 4 | (view.getUint8(dataStart + 13) >> 4)) + 1;
            var totalSamplesHi = view.getUint8(dataStart + 13) & 0x0F;
            var totalSamples = totalSamplesHi * 0x100000000 + view.getUint32(dataStart + 14, false);
            out['FLAC:SampleRate'] = sampleRate;
            out['FLAC:Channels'] = channels;
            out['FLAC:BitsPerSample'] = bps;
            if (sampleRate > 0) out['FLAC:Duration'] = (totalSamples / sampleRate).toFixed(2) + ' с';
        } else if (blockType === 4) { // VORBIS_COMMENT
            Object.assign(out, BinUtils.parseVorbisComment(bytes, dataStart, dataStart + blockSize, 'VORBIS:'));
        } else if (blockType === 6) { // PICTURE
            out['FLAC:HasCoverArt'] = true;
        }

        offset = dataStart + blockSize;
        if (isLast) break;
    }
    return out;
};
