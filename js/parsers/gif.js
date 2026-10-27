// Витоки Даних — parsers/gif.js
window.Parsers = window.Parsers || {};
window.Parsers.gif = function (buffer) {
    var bytes = new Uint8Array(buffer);
    var view = new DataView(buffer);
    var header = BinUtils.readAsciiString(view, 0, 6);
    if (header !== 'GIF87a' && header !== 'GIF89a') return null; // не GIF

    var out = {};
    out['ImageWidth'] = view.getUint16(6, true);
    out['ImageHeight'] = view.getUint16(8, true);

    var flags = bytes[10];
    var gctFlag = (flags & 0x80) !== 0;
    var gctSize = gctFlag ? 3 * Math.pow(2, (flags & 0x07) + 1) : 0;
    var offset = 13 + gctSize;
    var frameCount = 0, loopCount = null;

    function skipSubBlocks(off) {
        while (bytes[off] !== 0) off += bytes[off] + 1;
        return off + 1;
    }

    while (offset < bytes.length) {
        var b = bytes[offset];
        if (b === 0x21) { // Extension Introducer
            var label = bytes[offset + 1];
            if (label === 0xFE) { // Comment Extension
                var p = offset + 2, comment = '';
                while (bytes[p] !== 0) { comment += BinUtils.readLatin1(bytes, p + 1, p + 1 + bytes[p]); p += bytes[p] + 1; }
                out['GIF:Comment'] = comment;
                offset = p + 1;
            } else if (label === 0xFF) { // Application Extension
                var blockSize = bytes[offset + 2];
                out['GIF:ApplicationID'] = BinUtils.readLatin1(bytes, offset + 3, offset + 3 + blockSize);
                var sub = offset + 3 + blockSize;
                if (bytes[sub] === 3) loopCount = bytes[sub + 2] | (bytes[sub + 3] << 8);
                offset = skipSubBlocks(sub);
            } else if (label === 0xF9) { // Graphic Control Extension
                offset = skipSubBlocks(offset + 2);
            } else {
                offset = skipSubBlocks(offset + 2);
            }
        } else if (b === 0x2C) { // Image Descriptor
            frameCount++;
            var lf = bytes[offset + 9];
            var lctSize = (lf & 0x80) ? 3 * Math.pow(2, (lf & 0x07) + 1) : 0;
            offset += 10 + lctSize + 1; // +1 — LZW min code size
            offset = skipSubBlocks(offset);
        } else if (b === 0x3B) {
            break; // trailer
        } else {
            break;
        }
    }

    out['GIF:FrameCount'] = frameCount;
    if (loopCount !== null) out['GIF:LoopCount'] = loopCount;
    return out;
};
