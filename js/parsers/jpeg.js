// Витоки Даних — parsers/jpeg.js
window.Parsers = window.Parsers || {};
window.Parsers.jpeg = function (buffer) {
    var view = new DataView(buffer);
    var bytes = new Uint8Array(buffer);
    if (view.getUint16(0, false) !== 0xFFD8) return null; // не JPEG

    var out = {};
    var offset = 2;
    while (offset < view.byteLength - 4) {
        if (view.getUint8(offset) !== 0xFF) break;
        var marker = view.getUint8(offset + 1);
        if (marker === 0xD8 || marker === 0xD9) { offset += 2; continue; }
        if (marker >= 0xD0 && marker <= 0xD7) { offset += 2; continue; }
        var segLen = view.getUint16(offset + 2, false);
        var segStart = offset + 4;

        if (marker === 0xE1) { // APP1: EXIF або XMP
            var tag6 = BinUtils.readAsciiString(view, segStart, 6);
            if (tag6 === 'Exif\0\0' || tag6.indexOf('Exif') === 0) {
                var tiffTags = TiffReader.parse(buffer, segStart + 6);
                if (tiffTags) Object.assign(out, tiffTags);
            } else {
                var xmpStr = BinUtils.readUtf8(bytes, segStart, offset + 2 + segLen);
                if (xmpStr.indexOf('<?xpacket') === 0 || xmpStr.indexOf('xmlns:') > -1) {
                    out['XMP:Present'] = true;
                    var m = xmpStr.match(/dc:creator[^>]*>([^<]*)</);
                    if (m) out['XMP:Creator'] = m[1].trim();
                }
            }
        } else if (marker === 0xED) { // APP13: Photoshop IRB -> IPTC
            var sig = BinUtils.readAsciiString(view, segStart, 14);
            if (sig.indexOf('Photoshop') === 0) {
                out['IPTC:Present'] = true;
            }
        } else if (marker === 0xC0 || marker === 0xC2) { // SOF0/SOF2 — реальні розміри
            out['ImageHeight'] = view.getUint16(segStart + 1, false);
            out['ImageWidth'] = view.getUint16(segStart + 3, false);
        } else if (marker === 0xDA) {
            break; // початок стиснених даних — метаданих далі немає
        }
        if (segLen < 2) break;
        offset += 2 + segLen;
    }
    return out;
};
