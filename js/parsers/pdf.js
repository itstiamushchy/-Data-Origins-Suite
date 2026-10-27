// Витоки Даних — parsers/pdf.js
window.Parsers = window.Parsers || {};
window.Parsers.pdf = function (buffer) {
    var bytes = new Uint8Array(buffer);
    var head = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 8));
    if (head.indexOf('%PDF-') !== 0) return null;

    var out = { 'PDF:Version': head.slice(5, 8).replace(/[^\d.]/g, '') };
    // Повний файл як latin1-рядок: безпечно для пошуку структурних токенів (назви ключів/посилань).
    var text = BinUtils.readLatin1(bytes, 0, bytes.length);

    var infoRefs = text.match(/\/Info\s+(\d+)\s+0\s+R/g);
    var infoObjNum = null;
    if (infoRefs && infoRefs.length) {
        var last = infoRefs[infoRefs.length - 1];
        infoObjNum = last.match(/\/Info\s+(\d+)\s+0\s+R/)[1];
    }

    if (infoObjNum) {
        var objRe = new RegExp('[^0-9]' + infoObjNum + '\\s+0\\s+obj([\\s\\S]{0,2000}?)endobj');
        var objMatch = text.match(objRe);
        if (objMatch) {
            var dict = objMatch[1];
            var map = {
                'PDF:Title': extractField(dict, 'Title'), 'PDF:Author': extractField(dict, 'Author'),
                'PDF:Subject': extractField(dict, 'Subject'), 'PDF:Keywords': extractField(dict, 'Keywords'),
                'PDF:Creator': extractField(dict, 'Creator'), 'PDF:Producer': extractField(dict, 'Producer'),
                'PDF:CreationDate': extractField(dict, 'CreationDate'), 'PDF:ModDate': extractField(dict, 'ModDate')
            };
            Object.keys(map).forEach(function (k) { if (map[k]) out[k] = map[k]; });
        }
    }

    if (text.indexOf('<?xpacket') > -1) out['PDF:HasXMP'] = true;
    else if (text.indexOf('/Metadata') > -1) out['PDF:HasMetadataRef'] = true;
    var encMatch = text.match(/\/Encrypt\s+\d+\s+0\s+R/);
    if (encMatch) out['PDF:Encrypted'] = true;

    return out;

    function extractField(dict, key) {
        var reParen = new RegExp('/' + key + '\\s*\\(((?:[^()\\\\]|\\\\.)*)\\)');
        var m = dict.match(reParen);
        if (m) return decodeLiteralString(m[1]);
        var reHex = new RegExp('/' + key + '\\s*<([0-9A-Fa-f]+)>');
        var mh = dict.match(reHex);
        if (mh) return decodeHexString(mh[1]);
        return null;
    }

    function decodeLiteralString(s) {
        var out2 = '';
        for (var i = 0; i < s.length; i++) {
            if (s[i] === '\\' && i + 1 < s.length) {
                var next = s[i + 1];
                if (next === 'n') { out2 += '\n'; i++; }
                else if (next === 'r') { out2 += '\r'; i++; }
                else if (next === 't') { out2 += '\t'; i++; }
                else if (next === '(' || next === ')' || next === '\\') { out2 += next; i++; }
                else if (/[0-7]/.test(next)) {
                    var oct = s.substr(i + 1, 3).match(/^[0-7]{1,3}/)[0];
                    out2 += String.fromCharCode(parseInt(oct, 8));
                    i += oct.length;
                } else { out2 += next; i++; }
            } else out2 += s[i];
        }
        return stripUtf16Bom(out2);
    }

    function decodeHexString(hex) {
        var byteArr = [];
        for (var i = 0; i < hex.length - 1; i += 2) byteArr.push(parseInt(hex.substr(i, 2), 16));
        var u8 = new Uint8Array(byteArr);
        if (u8.length >= 2 && u8[0] === 0xFE && u8[1] === 0xFF) {
            try { return new TextDecoder('utf-16be').decode(u8.slice(2)); } catch (e) {}
        }
        return BinUtils.readLatin1(u8, 0, u8.length);
    }

    function stripUtf16Bom(s) {
        if (s.length >= 2 && s.charCodeAt(0) === 0xFE && s.charCodeAt(1) === 0xFF) {
            var out3 = '';
            for (var i = 2; i + 1 < s.length; i += 2) out3 += String.fromCharCode((s.charCodeAt(i) << 8) | s.charCodeAt(i + 1));
            return out3;
        }
        return s;
    }
};
