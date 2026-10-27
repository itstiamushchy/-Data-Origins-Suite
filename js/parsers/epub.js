// Витоки Даних — parsers/epub.js
window.Parsers = window.Parsers || {};
window.Parsers.epub = function (buffer) {
    var entries = window.ZipReader.listEntries(buffer);
    if (!entries) return null;
    var names = entries.map(function (e) { return e.name; });
    if (names.indexOf('META-INF/container.xml') === -1) return null;

    function parseXml(bytes) {
        if (!bytes) return null;
        try {
            var text = BinUtils.readUtf8(bytes, 0, bytes.length);
            var doc = new DOMParser().parseFromString(text, 'application/xml');
            return (doc.querySelector && doc.querySelector('parsererror')) ? null : doc;
        } catch (e) { return null; }
    }

    var out = { 'Format:Name': 'EPUB' };
    return window.ZipReader.extractByName(buffer, entries, 'META-INF/container.xml').then(function (containerBytes) {
        var containerDoc = parseXml(containerBytes);
        var rootfile = containerDoc && containerDoc.getElementsByTagNameNS('*', 'rootfile')[0];
        var opfPath = rootfile && rootfile.getAttribute('full-path');
        if (!opfPath) return out;

        return window.ZipReader.extractByName(buffer, entries, opfPath).then(function (opfBytes) {
            var opfDoc = parseXml(opfBytes);
            if (!opfDoc) return out;
            var get = function (localName) {
                var el = opfDoc.getElementsByTagNameNS('*', localName)[0];
                return el && el.textContent.trim() ? el.textContent.trim() : null;
            };
            var map = {
                'EPUB:Title': get('title'), 'EPUB:Creator': get('creator'), 'EPUB:Language': get('language'),
                'EPUB:Publisher': get('publisher'), 'EPUB:Date': get('date'), 'EPUB:Identifier': get('identifier'),
                'EPUB:Description': get('description'), 'EPUB:Rights': get('rights')
            };
            Object.keys(map).forEach(function (k) { if (map[k]) out[k] = map[k]; });
            return out;
        });
    });
};
