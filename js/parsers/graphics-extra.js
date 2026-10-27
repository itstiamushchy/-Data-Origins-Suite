// Витоки Даних — parsers/graphics-extra.js
window.Parsers = window.Parsers || {};

window.Parsers.eps = function (buffer, extHint) {
    if (extHint !== 'eps') return null;
    var bytes = new Uint8Array(buffer);
    var text = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 2000));
    if (text.indexOf('%!PS-Adobe') !== 0) return null;
    var out = { 'Format:Name': 'Encapsulated PostScript (EPS)' };
    var m;
    if ((m = text.match(/%%Title:\s*(.+)/))) out['EPS:Title'] = m[1].trim();
    if ((m = text.match(/%%Creator:\s*(.+)/))) out['EPS:Creator'] = m[1].trim();
    if ((m = text.match(/%%CreationDate:\s*(.+)/))) out['EPS:CreationDate'] = m[1].trim();
    if ((m = text.match(/%%BoundingBox:\s*(.+)/))) out['EPS:BoundingBox'] = m[1].trim();
    return out;
};

window.Parsers.xcf = function (buffer) {
    var view = new DataView(buffer);
    var head = BinUtils.readAsciiString(view, 0, 9); // "gimp xcf "
    if (head !== 'gimp xcf ') return null;
    var out = { 'Format:Name': 'GIMP Image (XCF)' };
    out['XCF:VersionTag'] = BinUtils.readAsciiString(view, 9, 4);
    out['XCF:Width'] = view.getUint32(14, false);
    out['XCF:Height'] = view.getUint32(18, false);
    return out;
};

window.Parsers.openraster = function (buffer, extHint) {
    if (extHint !== 'ora' && extHint !== 'kra') return null;
    var entries = window.ZipReader.listEntries(buffer);
    if (!entries) return null;
    var names = entries.map(function (e) { return e.name; });
    if (extHint === 'ora' && names.indexOf('stack.xml') === -1) return null;
    if (extHint === 'kra' && names.indexOf('maindoc.xml') === -1) return null;
    return { 'Format:Name': extHint === 'ora' ? 'OpenRaster (ORA)' : 'Krita (KRA)' };
};

window.Parsers.exr = function (buffer) {
    var view = new DataView(buffer);
    if (view.getUint32(0, true) !== 0x01312f76) return null;
    var out = { 'Format:Name': 'OpenEXR' };
    out['EXR:VersionByte'] = view.getUint8(4);
    // Читаємо список атрибутів заголовка: ім'я(0-term), тип(0-term), розмір(4), дані
    var bytes = new Uint8Array(buffer);
    var p = 8;
    var guard = 0;
    while (p < bytes.length && guard++ < 200) {
        var n0 = p; while (bytes[n0] !== 0 && n0 < bytes.length) n0++;
        if (n0 === p) break; // порожнє ім'я = кінець заголовка
        var name = BinUtils.readUtf8(bytes, p, n0);
        var t0 = n0 + 1; while (bytes[t0] !== 0 && t0 < bytes.length) t0++;
        var type = BinUtils.readUtf8(bytes, n0 + 1, t0);
        var sizeOff = t0 + 1;
        var size = view.getUint32(sizeOff, true);
        var valOff = sizeOff + 4;
        if (name === 'dataWindow' && type === 'box2i' && size === 16) {
            var xMin = view.getInt32(valOff, true), yMin = view.getInt32(valOff + 4, true);
            var xMax = view.getInt32(valOff + 8, true), yMax = view.getInt32(valOff + 12, true);
            out['EXR:Width'] = xMax - xMin + 1;
            out['EXR:Height'] = yMax - yMin + 1;
        } else if (name === 'compression' && type === 'compression') {
            var COMP_MAP = { 0: 'Без стиснення', 1: 'RLE', 2: 'ZIPS', 3: 'ZIP', 4: 'PIZ', 5: 'PXR24', 6: 'B44', 7: 'B44A', 8: 'DWAA', 9: 'DWAB' };
            out['EXR:Compression'] = COMP_MAP[bytes[valOff]] || 'код ' + bytes[valOff];
        }
        p = valOff + size;
    }
    return out;
};

window.Parsers.hdr = function (buffer, extHint) {
    if (extHint !== 'hdr' && extHint !== 'pic') return null;
    var bytes = new Uint8Array(buffer);
    var head = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 200));
    if (head.indexOf('#?RADIANCE') !== 0 && head.indexOf('#?RGBE') !== 0) return null;
    var out = { 'Format:Name': 'Radiance HDR' };
    var m = head.match(/SOFTWARE=(.+)/);
    if (m) out['HDR:Software'] = m[1].trim();
    var dimMatch = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 1000)).match(/([+-][XY])\s+(\d+)\s+([+-][XY])\s+(\d+)/);
    if (dimMatch) { out['HDR:Width'] = dimMatch[4]; out['HDR:Height'] = dimMatch[2]; }
    return out;
};
