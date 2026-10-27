// Витоки Даних — parsers/fonts-extra.js
window.Parsers = window.Parsers || {};

window.Parsers.eot = function (buffer, extHint) {
    if (extHint !== 'eot') return null;
    var view = new DataView(buffer);
    if (buffer.byteLength < 82) return null;
    var fontDataSize = view.getUint32(4, true);
    var version = view.getUint32(8, true);
    if (version !== 0x00010000 && version !== 0x00020001 && version !== 0x00020002) return null;
    var out = { 'Format:Name': 'Embedded OpenType (EOT)' };
    var familyNameSize = view.getUint16(82, true);
    if (82 + 2 + familyNameSize <= buffer.byteLength) {
        try { out['EOT:FamilyName'] = new TextDecoder('utf-16le').decode(new Uint8Array(buffer, 84, familyNameSize)).replace(/\0+$/, ''); } catch (e) {}
    }
    return out;
};

window.Parsers.fon = function (buffer, extHint) {
    if (extHint !== 'fon') return null;
    var view = new DataView(buffer);
    if (view.getUint16(0, true) !== 0x4D5A) return null; // "MZ" — NE/PE-обгортка
    return { 'Format:Name': 'Windows Bitmap Font (FON)', 'FON:Note': 'Ресурси шрифту зберігаються у NE/PE-секціях — розбір назви гарнітури не реалізовано.' };
};
