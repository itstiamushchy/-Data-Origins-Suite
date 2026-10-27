// Витоки Даних — parsers/cad-extra.js
window.Parsers = window.Parsers || {};

window.Parsers.step = function (buffer, extHint) {
    if (extHint !== 'step' && extHint !== 'stp') return null;
    var bytes = new Uint8Array(buffer);
    var text = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 3000));
    if (text.indexOf('ISO-10303-21') === -1) return null;
    var out = { 'Format:Name': 'STEP (ISO 10303, CAD-обмін)' };
    var headerMatch = text.match(/FILE_DESCRIPTION\s*\(\s*\(\s*'([^']*)'/);
    if (headerMatch) out['STEP:Description'] = headerMatch[1];
    var nameMatch = text.match(/FILE_NAME\s*\(\s*'([^']*)'\s*,\s*'([^']*)'/);
    if (nameMatch) { out['STEP:Name'] = nameMatch[1]; out['STEP:TimeStamp'] = nameMatch[2]; }
    var schemaMatch = text.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']*)'/);
    if (schemaMatch) out['STEP:Schema'] = schemaMatch[1];
    return out;
};

window.Parsers.iges = function (buffer, extHint) {
    if (extHint !== 'iges' && extHint !== 'igs') return null;
    var bytes = new Uint8Array(buffer);
    var line1 = BinUtils.readLatin1(bytes, 0, 80);
    if (line1[72] !== 'S') return null; // перший рядок Start Section завжди позначений 'S' у 73 колонці
    var out = { 'Format:Name': 'IGES (CAD-обмін)' };
    var gLine = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 4000));
    var authMatch = gLine.match(/(\d+H[^,]*),(\d+H[^,]*)/);
    if (authMatch) out['IGES:Author'] = decodeHollerith(authMatch[2]) || decodeHollerith(authMatch[1]);
    return out;

    function decodeHollerith(s) {
        var m = s.match(/(\d+)H(.*)/);
        if (!m) return null;
        var len = parseInt(m[1], 10);
        return m[2].slice(0, len);
    }
};

window.Parsers.ifc = function (buffer, extHint) {
    if (extHint !== 'ifc') return null;
    var bytes = new Uint8Array(buffer);
    var text = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 3000));
    if (text.indexOf('ISO-10303-21') === -1 || text.indexOf('IFC') === -1) return null;
    var out = { 'Format:Name': 'IFC (BIM-обмін)' };
    var schemaMatch = text.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']*)'/);
    if (schemaMatch) out['IFC:Schema'] = schemaMatch[1];
    var appMatch = text.match(/FILE_NAME\s*\([^)]*?'[^']*'\s*,\s*'[^']*'\s*,[^,]*,[^,]*,\s*'([^']*)'/);
    if (appMatch) out['IFC:Application'] = appMatch[1];
    return out;
};
