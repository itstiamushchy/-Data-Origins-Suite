// Витоки Даних — parsers/vectordesign.js
window.Parsers = window.Parsers || {};

window.Parsers.ai = function (buffer, extHint) {
    if (extHint !== 'ai') return null;
    var view = new DataView(buffer);
    var head = BinUtils.readAsciiString(view, 0, 5);
    if (head === '%PDF-') {
        var pdfResult = window.Parsers.pdf(buffer);
        if (pdfResult) { pdfResult['Format:Name'] = 'Adobe Illustrator (PDF-сумісний)'; }
        return pdfResult;
    }
    // Старий (докPDF) формат AI — заголовок коментарів PostScript DSC
    var bytes = new Uint8Array(buffer);
    var text = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 2000));
    if (text.indexOf('%!PS-Adobe') !== 0) return null;
    var out = { 'Format:Name': 'Adobe Illustrator (legacy PostScript)' };
    var m;
    if ((m = text.match(/%%Title:\s*(.+)/))) out['AI:Title'] = m[1].trim();
    if ((m = text.match(/%%Creator:\s*(.+)/))) out['AI:Creator'] = m[1].trim();
    if ((m = text.match(/%%CreationDate:\s*(.+)/))) out['AI:CreationDate'] = m[1].trim();
    if ((m = text.match(/%AI\d+_Version:\s*(.+)/))) out['AI:AIVersion'] = m[1].trim();
    return out;
};

window.Parsers.cdr = function (buffer) {
    var view = new DataView(buffer);
    if (BinUtils.readAsciiString(view, 0, 4) !== 'RIFF') return null;
    if (BinUtils.readAsciiString(view, 8, 4) !== 'CDR ') return null;
    var out = { 'Format:Name': 'CorelDRAW (CDR)' };
    var offset = 12;
    while (offset + 8 <= view.byteLength) {
        var fourcc = BinUtils.readAsciiString(view, offset, 4);
        var size = view.getUint32(offset + 4, true);
        if (fourcc === 'vrsn') out['CDR:Version'] = view.getUint16(offset + 8, true);
        offset += 8 + size + (size % 2);
        if (offset > 2048) break; // версія вказана близько до початку файлу
    }
    return out;
};

window.Parsers.indd = function (buffer, extHint) {
    if (extHint !== 'indd') return null;
    var view = new DataView(buffer);
    // INDD починається з 8-байтної сигнатури блокового формату Adobe (не документованого публічно)
    var sig = BinUtils.bytesToHex(new Uint8Array(buffer).slice(0, 8));
    if (sig !== '0606edf5d81d46e5') return null;
    return { 'Format:Name': 'Adobe InDesign (INDD)', 'INDD:Note': 'Закритий блоковий формат — детальні метадані документа не розшифровуються, підтверджено лише сигнатуру.' };
};
