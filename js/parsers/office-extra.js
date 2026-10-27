// Витоки Даних — parsers/office-extra.js
window.Parsers = window.Parsers || {};

window.Parsers.xps = function (buffer, extHint) {
    if (extHint !== 'xps' && extHint !== 'oxps') return null;
    var entries = window.ZipReader.listEntries(buffer);
    if (!entries) return null;
    var names = entries.map(function (e) { return e.name; });
    var coreEntry = names.filter(function (n) { return /docprops\/core\.xml$/i.test(n); })[0];
    var out = { 'Format:Name': extHint === 'oxps' ? 'OpenXPS' : 'XML Paper Specification (XPS)' };
    if (!coreEntry) return out;
    return window.ZipReader.extractByName(buffer, entries, coreEntry).then(function (bytes) {
        if (!bytes) return out;
        try {
            var doc = new DOMParser().parseFromString(BinUtils.readUtf8(bytes, 0, bytes.length), 'application/xml');
            var get = function (ln) { var el = doc.getElementsByTagNameNS('*', ln)[0]; return el ? el.textContent.trim() : null; };
            var creator = get('creator'), title = get('title');
            if (creator) out['XPS:Creator'] = creator;
            if (title) out['XPS:Title'] = title;
        } catch (e) {}
        return out;
    });
};

window.Parsers.iwork = function (buffer, extHint) {
    var map = { numbers: 'Apple Numbers', pages: 'Apple Pages', key: 'Apple Keynote' };
    if (!map[extHint]) return null;
    var entries = window.ZipReader.listEntries(buffer);
    if (!entries) return null;
    var hasIwa = entries.some(function (e) { return /\.iwa$/i.test(e.name); });
    if (!hasIwa) return null;
    return { 'Format:Name': map[extHint], 'IWORK:Note': 'Вміст серіалізовано у закритому протобуф-форматі (IWA) — детальний розбір не реалізовано, підтверджено лише контейнер.' };
};

window.Parsers.idml = function (buffer, extHint) {
    if (extHint !== 'idml') return null;
    var entries = window.ZipReader.listEntries(buffer);
    if (!entries) return null;
    var hasDesignMap = entries.some(function (e) { return e.name === 'designmap.xml'; });
    if (!hasDesignMap) return null;
    return { 'Format:Name': 'Adobe InDesign Markup (IDML)' };
};

window.Parsers.xlsb = function (buffer, extHint) {
    if (extHint !== 'xlsb') return null;
    var entries = window.ZipReader.listEntries(buffer);
    if (!entries) return null;
    var names = entries.map(function (e) { return e.name; });
    if (names.indexOf('xl/workbook.bin') === -1) return null;
    return { 'Format:Name': 'Excel Binary (XLSB)', 'XLSB:Note': 'Вміст у бінарному BIFF12-форматі — розбір аркушів не реалізовано, підтверджено лише контейнер.' };
};
