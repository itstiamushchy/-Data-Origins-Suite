// Витоки Даних — parsers/3d-extra2.js
window.Parsers = window.Parsers || {};

window.Parsers.max3ds = function (buffer, extHint) {
    if (extHint !== '3ds') return null;
    var view = new DataView(buffer);
    if (view.getUint16(0, true) !== 0x4D4D) return null; // MAIN3DS chunk ID
    return { 'Format:Name': '3D Studio (3DS)' };
};

window.Parsers.maya = function (buffer, extHint) {
    if (extHint === 'ma') {
        var bytes = new Uint8Array(buffer);
        var text = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 500));
        if (text.indexOf('//Maya ASCII') !== 0) return null;
        var out = { 'Format:Name': 'Maya ASCII (MA)' };
        var m = text.match(/\/\/Maya ASCII (\S+) scene/);
        if (m) out['MAYA:Version'] = m[1];
        var reqMatch = text.match(/requires maya "([^"]+)"/);
        if (reqMatch) out['MAYA:RequiresVersion'] = reqMatch[1];
        return out;
    }
    if (extHint === 'mb') {
        var cfb = window.Ole2Reader.parse(buffer);
        if (cfb) return { 'Format:Name': 'Maya Binary (MB, OLE2)' };
        var view = new DataView(buffer);
        if (BinUtils.readAsciiString(view, 4, 4) === 'FOR4' || BinUtils.readAsciiString(view, 0, 4) === 'FOR4') {
            return { 'Format:Name': 'Maya Binary (MB, IFF)', 'MAYA:Note': 'Бінарний IFF-контейнер — детальний розбір вузлів сцени не реалізовано.' };
        }
        return null;
    }
    return null;
};

window.Parsers.maxFile = function (buffer, extHint) {
    if (extHint !== 'max') return null;
    var cfb = window.Ole2Reader.parse(buffer);
    if (!cfb) return null;
    return { 'Format:Name': '3ds Max (MAX)', 'MAX:Note': 'OLE2-контейнер підтверджено — специфічні властивості сцени 3ds Max не розшифровуються.' };
};
