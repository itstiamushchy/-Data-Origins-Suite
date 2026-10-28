// Витоки Даних — crc32.js
window.Crc32 = (function () {
    'use strict';
    var table = null;
    function buildTable() {
        table = new Uint32Array(256);
        for (var n = 0; n < 256; n++) {
            var c = n;
            for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            table[n] = c >>> 0;
        }
    }
    function compute(bytes) {
        if (!table) buildTable();
        var crc = 0xFFFFFFFF;
        for (var i = 0; i < bytes.length; i++) crc = table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }
    return { compute: compute };
})();
