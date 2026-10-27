// Витоки Даних — parsers/rtf.js
window.Parsers = window.Parsers || {};
window.Parsers.rtf = function (buffer) {
    var bytes = new Uint8Array(buffer);
    var head = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 6));
    if (head.indexOf('{\\rtf') !== 0) return null;

    // \info-група зазвичай близько до початку файлу — достатньо прочитати перші ~20КБ
    var text = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 20000));
    var infoMatch = text.match(/\{\\info([\s\S]*?)\}\s*(\{\\\*|\{\\fonttbl|\{\\stylesheet|\\viewkind)/);
    var infoText = infoMatch ? infoMatch[1] : text;

    function field(tag) {
        var re = new RegExp('\\\\' + tag + '\\s?\\{([^}]*)\\}');
        var m = infoText.match(re);
        return m ? decodeRtfText(m[1]) : null;
    }
    function decodeRtfText(s) {
        return s.replace(/\\'[0-9a-fA-F]{2}/g, function (h) { return String.fromCharCode(parseInt(h.slice(2), 16)); })
            .replace(/\\\\/g, '\\').replace(/\\{/g, '{').replace(/\\}/g, '}').trim();
    }
    function dateField(tag) {
        var re = new RegExp('\\\\' + tag + '\\{\\\\yr(\\d+)\\\\mo(\\d+)\\\\dy(\\d+)(?:\\\\hr(\\d+))?(?:\\\\min(\\d+))?');
        var m = infoText.match(re);
        if (!m) return null;
        return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0') +
            (m[4] ? ' ' + m[4].padStart(2, '0') + ':' + (m[5] || '00').padStart(2, '0') : '');
    }

    var out = {};
    var map = {
        'RTF:Title': field('title'), 'RTF:Subject': field('subject'), 'RTF:Author': field('author'),
        'RTF:Operator': field('operator'), 'RTF:Company': field('company'), 'RTF:Keywords': field('keywords'),
        'RTF:Comment': field('doccomm'), 'RTF:Created': dateField('creatim'), 'RTF:Revised': dateField('revtim')
    };
    Object.keys(map).forEach(function (k) { if (map[k]) out[k] = map[k]; });
    return out;
};
