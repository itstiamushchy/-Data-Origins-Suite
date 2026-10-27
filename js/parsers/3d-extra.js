// Витоки Даних — parsers/3d-extra.js
window.Parsers = window.Parsers || {};

window.Parsers.gltf = function (buffer, extHint) {
    var bytes = new Uint8Array(buffer);
    if (extHint === 'glb') {
        var view = new DataView(buffer);
        if (BinUtils.readAsciiString(view, 0, 4) !== 'glTF') return null;
        var out = { 'Format:Name': 'glTF (бінарний, GLB)' };
        out['GLTF:Version'] = view.getUint32(4, true);
        var jsonLength = view.getUint32(12, true);
        try {
            var json = JSON.parse(BinUtils.readUtf8(bytes, 20, 20 + jsonLength));
            if (json.asset) { if (json.asset.generator) out['GLTF:Generator'] = json.asset.generator; if (json.asset.version) out['GLTF:AssetVersion'] = json.asset.version; }
            if (json.meshes) out['GLTF:MeshCount'] = json.meshes.length;
            if (json.materials) out['GLTF:MaterialCount'] = json.materials.length;
        } catch (e) {}
        return out;
    }
    if (extHint === 'gltf') {
        var text = BinUtils.readUtf8(bytes, 0, bytes.length);
        try {
            var j = JSON.parse(text);
            if (!j.asset) return null;
            var out2 = { 'Format:Name': 'glTF (ASCII/JSON)' };
            if (j.asset.generator) out2['GLTF:Generator'] = j.asset.generator;
            if (j.asset.version) out2['GLTF:AssetVersion'] = j.asset.version;
            if (j.meshes) out2['GLTF:MeshCount'] = j.meshes.length;
            return out2;
        } catch (e) { return null; }
    }
    return null;
};

window.Parsers.blend = function (buffer) {
    var bytes = new Uint8Array(buffer);
    var head = BinUtils.readLatin1(bytes, 0, 7);
    if (head !== 'BLENDER') return null;
    var out = { 'Format:Name': 'Blender (BLEND)' };
    out['BLEND:PointerSize'] = bytes[7] === 0x2D ? '64-біт' : '32-біт'; // '-' = 8 байт, '_' = 4 байти
    out['BLEND:Endianness'] = bytes[8] === 0x76 ? 'Little-endian' : 'Big-endian'; // 'v'=little, 'V'=big
    out['BLEND:Version'] = BinUtils.readLatin1(bytes, 9, 12);
    return out;
};

window.Parsers.dae = function (buffer, extHint) {
    if (extHint !== 'dae') return null;
    var bytes = new Uint8Array(buffer);
    var head = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 300));
    if (head.indexOf('COLLADA') === -1) return null;
    var out = { 'Format:Name': 'COLLADA (DAE)' };
    try {
        var text = BinUtils.readUtf8(bytes, 0, Math.min(bytes.length, 3000));
        var doc = new DOMParser().parseFromString(text, 'application/xml');
        var authEl = doc.getElementsByTagNameNS('*', 'author')[0];
        var toolEl = doc.getElementsByTagNameNS('*', 'authoring_tool')[0];
        if (authEl) out['DAE:Author'] = authEl.textContent.trim();
        if (toolEl) out['DAE:Tool'] = toolEl.textContent.trim();
    } catch (e) {}
    return out;
};

window.Parsers.usd = function (buffer, extHint) {
    if (extHint === 'usdz') {
        var entries = window.ZipReader.listEntries(buffer);
        if (!entries) return null;
        return { 'Format:Name': 'USDZ (Pixar/Apple AR)', 'USD:Note': 'Вміст у бінарному Crate-форматі — детальний розбір не реалізовано.' };
    }
    if (extHint === 'usd' || extHint === 'usda' || extHint === 'usdc') {
        var view = new DataView(buffer);
        var head = BinUtils.readAsciiString(view, 0, 8);
        if (head.indexOf('#usda') === 0 || BinUtils.readLatin1(new Uint8Array(buffer), 0, 10).indexOf('#usda') === 0) {
            return { 'Format:Name': 'USD (ASCII, usda)' };
        }
        if (head === 'PXR-USDC') return { 'Format:Name': 'USD (бінарний Crate, usdc)', 'USD:Note': 'Бінарний формат — детальний розбір не реалізовано.' };
        return null;
    }
    return null;
};

window.Parsers.skp = function (buffer, extHint) {
    if (extHint !== 'skp') return null;
    var bytes = new Uint8Array(buffer);
    var head = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 64));
    if (head.indexOf('SketchUp') === -1 && head.indexOf('Trimble') === -1) return null;
    return { 'Format:Name': 'SketchUp (SKP)', 'SKP:Note': 'Закритий бінарний формат — підтверджено лише сигнатуру.' };
};

window.Parsers.revit = function (buffer, extHint) {
    if (extHint !== 'rvt' && extHint !== 'rfa') return null;
    var cfb = window.Ole2Reader.parse(buffer);
    if (!cfb) return null;
    return { 'Format:Name': extHint === 'rvt' ? 'Autodesk Revit (RVT)' : 'Revit Family (RFA)', 'REVIT:Note': 'OLE2-контейнер підтверджено — спеціалізовані властивості проєкту Revit не розшифровуються.' };
};
