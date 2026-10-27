// Витоки Даних — parsers/ole2doc.js
// Спільний парсер для .doc/.xls/.ppt (97-2003) — усі базуються на контейнері OLE2/CFB.
window.Parsers = window.Parsers || {};
window.Parsers.ole2doc = function (buffer) {
    var cfb = window.Ole2Reader.parse(buffer);
    if (!cfb) return null;

    var streamNames = cfb.listStreamNames();
    var kindMap = [
        { stream: 'WordDocument', label: 'Word 97-2003 (DOC)' },
        { stream: 'Workbook', label: 'Excel 97-2003 (XLS)' },
        { stream: 'Book', label: 'Excel 95 (XLS)' },
        { stream: 'PowerPoint Document', label: 'PowerPoint 97-2003 (PPT)' }
    ];
    var detected = kindMap.filter(function (k) { return streamNames.indexOf(k.stream) > -1; })[0];
    if (!detected) return null; // OLE2-контейнер, але не впізнаний офісний формат

    var out = { 'Format:Name': detected.label };

    var summaryBytes = cfb.getStream('\u0005SummaryInformation');
    if (summaryBytes) {
        var summary = window.Ole2Reader.parsePropertySetStream(summaryBytes, window.Ole2Reader.SUMMARY_INFO_MAP);
        Object.keys(summary).forEach(function (k) { out['DOC:' + k] = summary[k]; });
    }
    var docSummaryBytes = cfb.getStream('\u0005DocumentSummaryInformation');
    if (docSummaryBytes) {
        var docSummary = window.Ole2Reader.parsePropertySetStream(docSummaryBytes, window.Ole2Reader.DOC_SUMMARY_INFO_MAP);
        Object.keys(docSummary).forEach(function (k) { out['DOC:' + k] = docSummary[k]; });
    }
    return out;
};
