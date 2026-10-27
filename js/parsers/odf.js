// Витоки Даних — parsers/odf.js
window.Parsers = window.Parsers || {};
window.Parsers.odf = function (buffer) {
    var entries = window.ZipReader.listEntries(buffer);
    if (!entries) return null;
    var names = entries.map(function (e) { return e.name; });
    if (names.indexOf('mimetype') === -1 || names.indexOf('meta.xml') === -1) return null;

    return window.ZipReader.extractEntry(buffer, entries.filter(function (e) { return e.name === 'mimetype'; })[0])
        .then(function (mimeBytes) {
            var mime = mimeBytes ? BinUtils.readUtf8(mimeBytes, 0, mimeBytes.length) : '';
            var kindMap = {
                'application/vnd.oasis.opendocument.text': 'OpenDocument Text (ODT)',
                'application/vnd.oasis.opendocument.spreadsheet': 'OpenDocument Spreadsheet (ODS)',
                'application/vnd.oasis.opendocument.presentation': 'OpenDocument Presentation (ODP)'
            };
            var out = {};
            if (kindMap[mime]) out['Format:Name'] = kindMap[mime];

            return window.ZipReader.extractByName(buffer, entries, 'meta.xml').then(function (metaBytes) {
                if (!metaBytes) return out;
                try {
                    var text = BinUtils.readUtf8(metaBytes, 0, metaBytes.length);
                    var doc = new DOMParser().parseFromString(text, 'application/xml');
                    if (doc.querySelector && doc.querySelector('parsererror')) return out;
                    var get = function (localName) {
                        var el = doc.getElementsByTagNameNS('*', localName)[0];
                        return el && el.textContent.trim() ? el.textContent.trim() : null;
                    };
                    var map = {
                        'ODF:Title': get('title'), 'ODF:Creator': get('creator') || get('initial-creator'),
                        'ODF:Subject': get('subject'), 'ODF:Keyword': get('keyword'),
                        'ODF:Description': get('description'), 'ODF:Generator': get('generator'),
                        'ODF:CreationDate': get('creation-date'), 'ODF:Date': get('date'),
                        'ODF:EditingCycles': get('editing-cycles')
                    };
                    Object.keys(map).forEach(function (k) { if (map[k]) out[k] = map[k]; });
                } catch (e) { /* пошкоджений meta.xml */ }
                return out;
            });
        });
};
