// Витоки Даних — parsers/aiff.js
window.Parsers = window.Parsers || {};
window.Parsers.aiff = function (buffer) {
    var view = new DataView(buffer);
    var bytes = new Uint8Array(buffer);
    if (BinUtils.readAsciiString(view, 0, 4) !== 'FORM') return null;
    var formType = BinUtils.readAsciiString(view, 8, 4);
    if (formType !== 'AIFF' && formType !== 'AIFC') return null;

    var out = { 'AIFF:Type': formType };
    var CHUNK_MAP = { NAME: 'Title', AUTH: 'Author', '(c) ': 'Copyright', ANNO: 'Annotation' };

    var offset = 12;
    while (offset + 8 <= view.byteLength) {
        var fourcc = BinUtils.readAsciiString(view, offset, 4);
        var chunkSize = view.getUint32(offset + 4, false);
        var dataStart = offset + 8;

        var mapped = CHUNK_MAP[fourcc];
        if (mapped) {
            out['AIFF:' + mapped] = BinUtils.readLatin1(bytes, dataStart, dataStart + chunkSize).trim();
        } else if (fourcc === 'COMM') {
            out['AIFF:Channels'] = view.getUint16(dataStart, false);
            // SampleRate зберігається як 80-біт IEEE 754 extended — спрощено: беремо старші 32 біти мантиси
            var expBits = view.getUint16(dataStart + 8, false);
            var hiMant = view.getUint32(dataStart + 10, false);
            var exponent = (expBits & 0x7FFF) - 16383 - 31;
            var sampleRate = hiMant * Math.pow(2, exponent);
            out['AIFF:SampleRate'] = Math.round(sampleRate);
            out['AIFF:BitsPerSample'] = view.getUint16(dataStart + 6, false);
        } else if (fourcc === 'ID3 ') {
            var id3Slice = buffer.slice(dataStart, dataStart + chunkSize);
            var id3Tags = window.Parsers.mp3 ? window.Parsers.mp3(id3Slice) : null;
            if (id3Tags) Object.assign(out, id3Tags);
        }
        offset = dataStart + chunkSize + (chunkSize % 2);
    }
    return out;
};
