// Витоки Даних — parsers/gameengine.js
window.Parsers = window.Parsers || {};

window.Parsers.unity = function (buffer, extHint) {
    if (extHint === 'unitypackage') {
        var view = new DataView(buffer);
        if (view.getUint8(0) !== 0x1F || view.getUint8(1) !== 0x8B) return null; // це gzip-упакований tar
        return { 'Format:Name': 'Unity Package', 'UNITY:Note': 'Це TAR.GZ-архів з asset-метаданими — відкрийте через загальний GZIP/TAR парсер для списку вмісту.' };
    }
    return null;
};

window.Parsers.godot = function (buffer, extHint) {
    if (extHint === 'pck') {
        var view = new DataView(buffer);
        if (view.getUint32(0, true) !== 0x43504447) return null; // "GDPC"
        var out = { 'Format:Name': 'Godot Engine Pack (PCK)' };
        out['GODOT:PackVersion'] = view.getUint32(4, true);
        out['GODOT:EngineVersion'] = view.getUint32(8, true) + '.' + view.getUint32(12, true) + '.' + view.getUint32(16, true);
        return out;
    }
    if (extHint === 'tres' || extHint === 'tscn') {
        var bytes = new Uint8Array(buffer);
        var text = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 300));
        if (text.indexOf('[gd_resource') !== 0 && text.indexOf('[gd_scene') !== 0) return null;
        var out2 = { 'Format:Name': extHint === 'tres' ? 'Godot Resource (TRES)' : 'Godot Scene (TSCN)' };
        var typeMatch = text.match(/type="([^"]+)"/);
        if (typeMatch) out2['GODOT:ResourceType'] = typeMatch[1];
        return out2;
    }
    return null;
};

window.Parsers.unreal = function (buffer, extHint) {
    if (extHint !== 'uasset' && extHint !== 'umap') return null;
    var view = new DataView(buffer);
    if (view.getUint32(0, true) !== 0x9E2A83C1) return null;
    return { 'Format:Name': extHint === 'uasset' ? 'Unreal Engine Asset (UASSET)' : 'Unreal Engine Map (UMAP)', 'UNREAL:Note': 'Структура пакета закрита — детальний розбір вмісту не реалізовано, підтверджено сигнатуру.' };
};

window.Parsers.wad = function (buffer, extHint) {
    if (extHint !== 'wad') return null;
    var view = new DataView(buffer);
    var sig = BinUtils.readAsciiString(view, 0, 4);
    if (sig !== 'IWAD' && sig !== 'PWAD') return null;
    var out = { 'Format:Name': 'Doom WAD (' + sig + ')' };
    out['WAD:LumpCount'] = view.getInt32(4, true);
    return out;
};

window.Parsers.appimage = function (buffer, extHint) {
    if (extHint !== 'appimage') return null;
    var elfResult = window.Parsers.elf ? window.Parsers.elf(buffer) : null;
    if (!elfResult) return null;
    var bytes = new Uint8Array(buffer);
    // AppImage ELF несе спеціальний магічний маркер 0x41 0x49 ('A','I') + версія на офсеті 8 у секції заголовка
    var out = { 'Format:Name': 'AppImage (Linux)' };
    if (bytes[8] === 0x41 && bytes[9] === 0x49) out['APPIMAGE:Version'] = bytes[10];
    Object.assign(out, elfResult);
    out['Format:Name'] = 'AppImage (Linux)';
    return out;
};

window.Parsers.linuxAppPkg = function (buffer, extHint) {
    if (extHint === 'flatpak' || extHint === 'flatpakref') {
        var bytes = new Uint8Array(buffer);
        var text = BinUtils.readLatin1(bytes, 0, Math.min(bytes.length, 500));
        if (extHint === 'flatpakref') {
            if (text.indexOf('[Flatpak Ref]') === -1) return null;
            return { 'Format:Name': 'Flatpak Reference' };
        }
        return { 'Format:Name': 'Flatpak Bundle', 'FLATPAK:Note': 'OSTree-репозиторій усередині — детальний розбір не реалізовано.' };
    }
    if (extHint === 'snap') {
        var view = new DataView(buffer);
        // snap — це squashfs-образ
        if (BinUtils.readAsciiString(view, 0, 4) !== 'hsqs') return null;
        return { 'Format:Name': 'Snap Package (squashfs)', 'SNAP:Note': 'SquashFS-образ — розбір вмісту файлової системи не реалізовано.' };
    }
    return null;
};
