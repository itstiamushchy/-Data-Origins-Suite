// Витоки Даних — binary-utils.js
    // Низькорівневі хелпери читання бінарних даних, спільні для всіх парсерів.
window.BinUtils = (function () {
    'use strict';

    function fileToArrayBuffer(file) {
        return file.arrayBuffer();
    }

    function readAsciiString(view, offset, length) {
        var out = '';
        for (var i = 0; i < length; i++) {
            var c = view.getUint8(offset + i);
            if (c === 0) break;
            out += String.fromCharCode(c);
        }
        return out;
    }

    function readLatin1(bytes, start, end) {
        var out = '';
        for (var i = start; i < end; i++) out += String.fromCharCode(bytes[i]);
        return out;
    }

    function readUtf8(bytes, start, end) {
        try {
            return new TextDecoder('utf-8').decode(bytes.subarray(start, end));
        } catch (e) {
            return readLatin1(bytes, start, end);
        }
    }

    function bytesToHex(bytes) {
        var out = '';
        for (var i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
        return out;
    }

    // Пошук маркера 4-байтного типу (FourCC) у буфері, повертає індекс або -1.
    function indexOfBytes(bytes, needle, from) {
        outer:
        for (var i = from || 0; i <= bytes.length - needle.length; i++) {
            for (var j = 0; j < needle.length; j++) {
                if (bytes[i + j] !== needle.charCodeAt(j)) continue outer;
            }
            return i;
        }
        return -1;
    }

    // Розпакування zlib/deflate-потоку (PNG zTXt/iTXt) через нативний DecompressionStream.
    function inflateZlib(bytes) {
        if (typeof DecompressionStream === 'undefined') return Promise.resolve(null);
        try {
            var ds = new DecompressionStream('deflate');
            var stream = new Blob([bytes]).stream().pipeThrough(ds);
            return new Response(stream).arrayBuffer().then(function (buf) {
                return new Uint8Array(buf);
            }).catch(function () { return null; });
        } catch (e) {
            return Promise.resolve(null);
        }
    }

    // Спільний формат тегів Vorbis Comment (використовується і в FLAC, і в Ogg Vorbis/Opus).
    function parseVorbisComment(bytes, start, end, prefix) {
        var o = {};
        var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        var p = start;
        var vendorLen = dv.getUint32(p, true); p += 4 + vendorLen;
        if (p + 4 > end) return o;
        var count = dv.getUint32(p, true); p += 4;
        for (var i = 0; i < count && p + 4 <= end; i++) {
            var len = dv.getUint32(p, true); p += 4;
            if (p + len > end) break;
            var entry = readUtf8(bytes, p, p + len);
            p += len;
            var eq = entry.indexOf('=');
            if (eq > -1) o[prefix + entry.slice(0, eq)] = entry.slice(eq + 1);
        }
        return o;
    }

    return {
        fileToArrayBuffer: fileToArrayBuffer,
        readAsciiString: readAsciiString,
        readLatin1: readLatin1,
        readUtf8: readUtf8,
        bytesToHex: bytesToHex,
        indexOfBytes: indexOfBytes,
        inflateZlib: inflateZlib,
        parseVorbisComment: parseVorbisComment
    };
})();
