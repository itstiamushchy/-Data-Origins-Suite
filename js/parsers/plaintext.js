// Витоки Даних — parsers/plaintext.js
// Текстові формати без формальних метаданих: подаємо структурну інформацію замість них.
window.Parsers = window.Parsers || {};
window.Parsers.plaintext = function (buffer, extHint) {
    var bytes = new Uint8Array(buffer);
    var out = {};

    var encoding = 'UTF-8 (без BOM, припущення)';
    var bodyStart = 0;
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) { encoding = 'UTF-8 (з BOM)'; bodyStart = 3; }
    else if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) { encoding = 'UTF-16LE (з BOM)'; bodyStart = 2; }
    else if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) { encoding = 'UTF-16BE (з BOM)'; bodyStart = 2; }
    else if (bytes.length >= 4 && bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 0xFE && bytes[3] === 0xFF) { encoding = 'UTF-32BE (з BOM)'; bodyStart = 4; }
    out['TEXT:Encoding'] = encoding;

    var text;
    try { text = BinUtils.readUtf8(bytes, bodyStart, bytes.length); } catch (e) { text = BinUtils.readLatin1(bytes, bodyStart, bytes.length); }
    out['TEXT:CharCount'] = text.length;
    out['TEXT:LineCount'] = text.length ? text.split(/\r\n|\r|\n/).length : 0;

    if (extHint === 'csv' || extHint === 'tsv') {
        var firstLine = text.split(/\r\n|\r|\n/)[0] || '';
        var candidates = [',', ';', '\t', '|'];
        var best = ',', bestCount = -1;
        candidates.forEach(function (d) {
            var count = firstLine.split(d).length - 1;
            if (count > bestCount) { bestCount = count; best = d; }
        });
        out['CSV:Delimiter'] = best === '\t' ? '(табуляція)' : best;
        out['CSV:ColumnCount'] = bestCount + 1;
    }

    if (extHint === 'json') {
        try { JSON.parse(text); out['JSON:Valid'] = true; } catch (e) { out['JSON:Valid'] = false; }
    }

    if (extHint === 'xml') {
        var decl = text.match(/<\?xml[^>]*encoding=["']([^"']+)["']/i);
        if (decl) out['XML:DeclaredEncoding'] = decl[1];
        var rootMatch = text.match(/<([a-zA-Z_][\w:.-]*)/);
        if (rootMatch) out['XML:RootElement'] = rootMatch[1];
    }

    return out;
};
