// Витоки Даних — parsers/ooxml.js
window.Parsers = window.Parsers || {};
window.Parsers.ooxml = function (buffer, extHint) {
    var entries = window.ZipReader.listEntries(buffer);
    if (!entries) return null;
    var names = entries.map(function (e) { return e.name; });
    var isOoxml = names.indexOf('[Content_Types].xml') > -1 &&
        (names.indexOf('word/document.xml') > -1 || names.indexOf('xl/workbook.xml') > -1 || names.indexOf('ppt/presentation.xml') > -1);
    if (!isOoxml) return null;

    var out = {};
    var kindMap = { 'word/document.xml': 'Word (DOCX)', 'xl/workbook.xml': 'Excel (XLSX)', 'ppt/presentation.xml': 'PowerPoint (PPTX)' };
    for (var mainPart in kindMap) {
        if (names.indexOf(mainPart) > -1) { out['Format:Name'] = kindMap[mainPart]; break; }
    }
    if (names.some(function (n) { return n.indexOf('vbaProject.bin') > -1; })) {
        out['OOXML:HasMacros'] = true;
        if (out['Format:Name']) out['Format:Name'] += ' з макросами';
    }

    function parseXml(bytes) {
        if (!bytes) return null;
        try {
            var text = BinUtils.readUtf8(bytes, 0, bytes.length);
            var doc = new DOMParser().parseFromString(text, 'application/xml');
            if (doc.querySelector && doc.querySelector('parsererror')) return null;
            return doc;
        } catch (e) { return null; }
    }

    function text(doc, localName) {
        if (!doc) return null;
        var el = doc.getElementsByTagNameNS('*', localName)[0];
        return el && el.textContent.trim() ? el.textContent.trim() : null;
    }

    return Promise.all([
        window.ZipReader.extractByName(buffer, entries, 'docProps/core.xml'),
        window.ZipReader.extractByName(buffer, entries, 'docProps/app.xml')
    ]).then(function (results) {
        var coreDoc = parseXml(results[0]);
        var appDoc = parseXml(results[1]);

        var fields = {
            'OOXML:Title': text(coreDoc, 'title'), 'OOXML:Subject': text(coreDoc, 'subject'),
            'OOXML:Creator': text(coreDoc, 'creator'), 'OOXML:Keywords': text(coreDoc, 'keywords'),
            'OOXML:Description': text(coreDoc, 'description'), 'OOXML:LastModifiedBy': text(coreDoc, 'lastModifiedBy'),
            'OOXML:Created': text(coreDoc, 'created'), 'OOXML:Modified': text(coreDoc, 'modified'),
            'OOXML:Revision': text(coreDoc, 'revision'), 'OOXML:Category': text(coreDoc, 'category'),
            'OOXML:Application': text(appDoc, 'Application'), 'OOXML:Company': text(appDoc, 'Company'),
            'OOXML:Pages': text(appDoc, 'Pages'), 'OOXML:Words': text(appDoc, 'Words'),
            'OOXML:Characters': text(appDoc, 'Characters'), 'OOXML:Slides': text(appDoc, 'Slides'),
            'OOXML:TotalTime': text(appDoc, 'TotalTime')
        };
        Object.keys(fields).forEach(function (k) { if (fields[k]) out[k] = fields[k]; });
        return out;
    });
};
