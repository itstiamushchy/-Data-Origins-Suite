// Витоки Даних — meta-add/common.js
window.MetaAddCommon = (function () {
    'use strict';

    var TOOL_SIGNATURE = 'Витоки Даних (ITS_tiamushchy) v0.0.18';

    // Шаблон обов'язкового запису: коли додано, чим додано, довільний коментар.
    function buildAddedValue(comment) {
        var iso = new Date().toISOString();
        return 'date=' + iso + '; tool=' + TOOL_SIGNATURE + '; comment=' + (comment || '');
    }

    function escapeXml(str) {
        return String(str).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c];
        });
    }

    function outputFileName(originalName) {
        var dot = originalName.lastIndexOf('.');
        if (dot < 0) return originalName + '_vytoky-added';
        return originalName.slice(0, dot) + '_vytoky-added' + originalName.slice(dot);
    }

    function downloadBytes(bytes, filename) {
        var blob = new Blob([bytes], { type: 'application/octet-stream' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    }

    // Синхробезпечне 28-бітне ціле (ID3v2 size): 4 байти, старший біт кожного = 0.
    function encodeSyncsafe32(n) {
        return new Uint8Array([
            (n >>> 21) & 0x7F, (n >>> 14) & 0x7F, (n >>> 7) & 0x7F, n & 0x7F
        ]);
    }
    function decodeSyncsafe32(b, off) {
        return ((b[off] & 0x7F) << 21) | ((b[off + 1] & 0x7F) << 14) | ((b[off + 2] & 0x7F) << 7) | (b[off + 3] & 0x7F);
    }

    function concatBytes(arrays) {
        var total = arrays.reduce(function (s, a) { return s + a.length; }, 0);
        var out = new Uint8Array(total);
        var pos = 0;
        arrays.forEach(function (a) { out.set(a, pos); pos += a.length; });
        return out;
    }

    return {
        TOOL_SIGNATURE: TOOL_SIGNATURE,
        buildAddedValue: buildAddedValue,
        escapeXml: escapeXml,
        outputFileName: outputFileName,
        downloadBytes: downloadBytes,
        encodeSyncsafe32: encodeSyncsafe32,
        decodeSyncsafe32: decodeSyncsafe32,
        concatBytes: concatBytes
    };
})();
