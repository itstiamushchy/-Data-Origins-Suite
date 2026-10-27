// Витоки Даних — parsers/misc-remaining.js
window.Parsers = window.Parsers || {};

window.Parsers.abiword = function (buffer, extHint) {
    if (extHint !== 'abw') return null;
    var bytes = new Uint8Array(buffer);
    var text = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 500));
    if (text.indexOf('<abiword') === -1) return null;
    var out = { 'Format:Name': 'AbiWord (ABW)' };
    var m = text.match(/version="([^"]+)"/);
    if (m) out['ABW:Version'] = m[1];
    return out;
};

window.Parsers.age = function (buffer, extHint) {
    if (extHint !== 'age') return null;
    var bytes = new Uint8Array(buffer);
    var text = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 50));
    if (text.indexOf('age-encryption.org/') !== 0) return null;
    var versionMatch = text.match(/age-encryption\.org\/(v\d+)/);
    return { 'Format:Name': 'age (сучасне шифрування файлів)', 'AGE:Version': versionMatch ? versionMatch[1] : 'невідомо' };
};

window.Parsers.ociImage = function (buffer, extHint) {
    if (extHint !== 'tar' && extHint !== 'oci') return null;
    var view = new DataView(buffer);
    if (BinUtils.readAsciiString(view, 257, 6).trim() !== 'ustar') return null;
    var tarResult = window.Parsers.tar(buffer);
    if (!tarResult || !tarResult['TAR:FirstEntries'] || tarResult['TAR:FirstEntries'].indexOf('oci-layout') === -1) return null;
    return { 'Format:Name': 'OCI Container Image', 'OCI:Note': 'TAR-архів з OCI-маніфестом — відкрийте index.json усередині для деталей образу.' };
};
