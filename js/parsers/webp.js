// Витоки Даних — parsers/webp.js
window.Parsers = window.Parsers || {};
window.Parsers.webp = function (buffer) {
    var view = new DataView(buffer);
    if (BinUtils.readAsciiString(view, 0, 4) !== 'RIFF') return null;
    if (BinUtils.readAsciiString(view, 8, 4) !== 'WEBP') return null;

    var out = {};
    var offset = 12;
    while (offset + 8 <= view.byteLength) {
        var fourcc = BinUtils.readAsciiString(view, offset, 4);
        var chunkSize = view.getUint32(offset + 4, true);
        var dataStart = offset + 8;

        if (fourcc === 'VP8X') {
            var flags = view.getUint8(dataStart);
            out['WEBP:HasICC'] = (flags & 0x20) !== 0;
            out['WEBP:HasAlpha'] = (flags & 0x10) !== 0;
            out['WEBP:HasEXIF'] = (flags & 0x08) !== 0;
            out['WEBP:HasXMP'] = (flags & 0x04) !== 0;
            out['WEBP:HasAnimation'] = (flags & 0x02) !== 0;
        } else if (fourcc === 'VP8 ') {
            out['WEBP:Lossless'] = false;
        } else if (fourcc === 'VP8L') {
            out['WEBP:Lossless'] = true;
        } else if (fourcc === 'EXIF') {
            var tiffStart = dataStart;
            var tag6 = BinUtils.readAsciiString(view, dataStart, 6);
            if (tag6 === 'Exif\0\0') tiffStart = dataStart + 6;
            var tiffTags = TiffReader.parse(buffer, tiffStart);
            if (tiffTags) Object.assign(out, tiffTags);
        } else if (fourcc === 'XMP ') {
            out['XMP:Present'] = true;
        } else if (fourcc === 'ICCP') {
            out['WEBP:HasICC'] = true;
        }
        offset = dataStart + chunkSize + (chunkSize % 2); // вирівнювання до парного байта
    }
    return out;
};
