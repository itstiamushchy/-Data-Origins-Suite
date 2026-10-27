// Витоки Даних — parsers/ebook-extra.js
window.Parsers = window.Parsers || {};

window.Parsers.djvu = function (buffer) {
    var view = new DataView(buffer);
    if (BinUtils.readAsciiString(view, 0, 4) !== 'AT&T') return null;
    if (BinUtils.readAsciiString(view, 4, 4) !== 'FORM') return null;
    var sub = BinUtils.readAsciiString(view, 12, 4);
    if (sub !== 'DJVU' && sub !== 'DJVM') return null;
    return { 'Format:Name': 'DjVu', 'DJVU:Type': sub === 'DJVM' ? 'Багатосторінковий документ' : 'Одна сторінка' };
};

window.Parsers.fb2 = function (buffer, extHint) {
    if (extHint !== 'fb2') return null;
    var bytes = new Uint8Array(buffer);
    var head = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 500));
    if (head.indexOf('FictionBook') === -1) return null;
    var out = { 'Format:Name': 'FictionBook (FB2)' };
    try {
        var text = BinUtils.readUtf8(bytes, 0, Math.min(bytes.length, 5000));
        var doc = new DOMParser().parseFromString(text, 'application/xml');
        var get = function (ln) { var el = doc.getElementsByTagNameNS('*', ln)[0]; return el ? el.textContent.trim() : null; };
        var title = get('book-title'); if (title) out['FB2:Title'] = title;
        var first = get('first-name'), last = get('last-name');
        if (first || last) out['FB2:Author'] = (first || '') + ' ' + (last || '');
    } catch (e) {}
    return out;
};

window.Parsers.comicArchive = function (buffer, extHint) {
    if (extHint === 'cbz') {
        var entries = window.ZipReader.listEntries(buffer);
        if (!entries) return null;
        var imgCount = entries.filter(function (e) { return /\.(jpe?g|png|gif|webp)$/i.test(e.name); }).length;
        return { 'Format:Name': 'Comic Book Archive (CBZ)', 'COMIC:PageCount': imgCount };
    }
    if (extHint === 'cbr') {
        var rarResult = window.Parsers.rar(buffer);
        if (!rarResult) return null;
        return { 'Format:Name': 'Comic Book Archive (CBR)', 'COMIC:Note': rarResult['RAR:Note'] || '' };
    }
    return null;
};

window.Parsers.pdb = function (buffer, extHint) {
    if (extHint !== 'pdb') return null;
    var view = new DataView(buffer);
    var bytes = new Uint8Array(buffer);
    if (buffer.byteLength < 78) return null;
    var out = { 'Format:Name': 'Palm Database (PDB)' };
    out['PDB:Name'] = BinUtils.readLatin1(bytes, 0, 32).replace(/\0+$/, '').trim();
    out['PDB:Type'] = BinUtils.readAsciiString(view, 60, 4);
    out['PDB:Creator'] = BinUtils.readAsciiString(view, 64, 4);
    return out;
};
