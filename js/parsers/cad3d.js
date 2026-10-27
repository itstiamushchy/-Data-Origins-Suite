// Витоки Даних — parsers/cad3d.js
window.Parsers = window.Parsers || {};

window.Parsers.stl = function (buffer, extHint) {
    if (extHint !== 'stl') return null;
    var bytes = new Uint8Array(buffer);
    var head = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 5)).toLowerCase();
    if (head === 'solid') {
        var text = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 500));
        var nameMatch = text.match(/solid\s+(\S+)/i);
        var facetCount = (BinUtils.readLatin1(bytes, 0, bytes.length).match(/facet normal/gi) || []).length;
        return { 'Format:Name': 'STL (ASCII)', 'STL:Name': nameMatch ? nameMatch[1] : '', 'STL:FacetCount': facetCount };
    }
    var view = new DataView(buffer);
    if (bytes.length < 84) return null;
    var triCount = view.getUint32(80, true);
    var expectedSize = 84 + triCount * 50;
    if (Math.abs(expectedSize - bytes.length) > 4) return null; // не схоже на бінарний STL
    return { 'Format:Name': 'STL (бінарний)', 'STL:TriangleCount': triCount, 'STL:HeaderComment': BinUtils.readLatin1(bytes, 0, 80).replace(/\0+$/, '').trim() };
};

window.Parsers.obj = function (buffer, extHint) {
    if (extHint !== 'obj') return null;
    var bytes = new Uint8Array(buffer);
    var text = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 200000));
    if (!/^[#vfgomus]/m.test(text)) return null;
    var out = { 'Format:Name': 'Wavefront OBJ' };
    var genMatch = text.match(/^#\s*(.+)/m);
    if (genMatch) out['OBJ:Comment'] = genMatch[1].trim();
    out['OBJ:VertexCount'] = (text.match(/^v\s/gm) || []).length;
    out['OBJ:FaceCount'] = (text.match(/^f\s/gm) || []).length;
    return out;
};

window.Parsers.fbx = function (buffer) {
    var view = new DataView(buffer);
    var bytes = new Uint8Array(buffer);
    var binSig = BinUtils.readAsciiString(view, 0, 20);
    if (binSig.indexOf('Kaydara FBX Binary') === 0) {
        var version = view.getUint32(23, true);
        return { 'Format:Name': 'FBX (бінарний)', 'FBX:Version': version };
    }
    var head = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 200));
    var m = head.match(/FBX\s*\(?.*?version[:\s]+(\d+)/i);
    if (head.indexOf('; FBX') === 0 || m) {
        return { 'Format:Name': 'FBX (ASCII)', 'FBX:Version': m ? m[1] : 'не визначено' };
    }
    return null;
};

window.Parsers.dwg = function (buffer, extHint) {
    if (extHint !== 'dwg') return null;
    var view = new DataView(buffer);
    var sig = BinUtils.readAsciiString(view, 0, 6);
    var VERSION_MAP = {
        AC1014: 'AutoCAD R14 (1997)', AC1015: 'AutoCAD 2000', AC1018: 'AutoCAD 2004',
        AC1021: 'AutoCAD 2007', AC1024: 'AutoCAD 2010', AC1027: 'AutoCAD 2013', AC1032: 'AutoCAD 2018+'
    };
    if (!VERSION_MAP[sig]) return null;
    return { 'Format:Name': 'AutoCAD DWG', 'DWG:Version': VERSION_MAP[sig] };
};

window.Parsers.dxf = function (buffer, extHint) {
    if (extHint !== 'dxf') return null;
    var bytes = new Uint8Array(buffer);
    var text = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 20000));
    if (text.indexOf('$ACADVER') === -1 && text.indexOf('SECTION') === -1) return null;
    var out = { 'Format:Name': 'AutoCAD DXF (ASCII)' };
    var verMatch = text.match(/\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*(\S+)/);
    if (verMatch) out['DXF:Version'] = verMatch[1].trim();
    return out;
};
