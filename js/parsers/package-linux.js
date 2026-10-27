// Витоки Даних — parsers/package-linux.js
window.Parsers = window.Parsers || {};

// Читач формату "ar" (спільна основа .deb та статичних бібліотек .a)
function readArArchive(bytes) {
    var sig = '!<arch>\n';
    for (var i = 0; i < sig.length; i++) if (String.fromCharCode(bytes[i]) !== sig[i]) return null;
    var entries = [];
    var p = 8;
    while (p + 60 <= bytes.length) {
        var name = BinUtils.readLatin1(bytes, p, p + 16).trim();
        var sizeStr = BinUtils.readLatin1(bytes, p + 48, p + 58).trim();
        var size = parseInt(sizeStr, 10) || 0;
        var dataStart = p + 60;
        entries.push({ name: name, dataStart: dataStart, size: size });
        p = dataStart + size + (size % 2);
    }
    return entries;
}

window.Parsers.deb = function (buffer, extHint) {
    if (extHint !== 'deb') return null;
    var bytes = new Uint8Array(buffer);
    var entries = readArArchive(bytes);
    if (!entries) return null;
    var out = { 'Format:Name': 'Debian Package (DEB)' };
    var controlEntry = entries.filter(function (e) { return e.name.indexOf('control.tar') === 0; })[0];
    if (!controlEntry) return out;
    var controlBytes = bytes.slice(controlEntry.dataStart, controlEntry.dataStart + controlEntry.size);

    function finish(tarBytes) {
        if (!tarBytes) return out;
        var tarView = new DataView(tarBytes.buffer, tarBytes.byteOffset, tarBytes.byteLength);
        if (BinUtils.readAsciiString(tarView, 257, 6).trim() !== 'ustar') return out;
        var p2 = 0;
        while (p2 + 512 <= tarBytes.length) {
            var name = BinUtils.readAsciiString(tarView, p2, 100);
            var sizeOctal = BinUtils.readAsciiString(tarView, p2 + 124, 12).trim();
            var size = parseInt(sizeOctal, 8) || 0;
            if (name === './control' || name === 'control') {
                var text = BinUtils.readUtf8(tarBytes, p2 + 512, p2 + 512 + size);
                var FIELD_MAP = { Package: 'Package', Version: 'Version', Architecture: 'Architecture', Maintainer: 'Maintainer', Description: 'Description', 'Installed-Size': 'InstalledSize' };
                Object.keys(FIELD_MAP).forEach(function (key) {
                    var m = text.match(new RegExp('^' + key + ':\\s*(.+)', 'm'));
                    if (m) out['DEB:' + FIELD_MAP[key]] = m[1].trim();
                });
                break;
            }
            p2 += 512 + Math.ceil(size / 512) * 512;
        }
        return out;
    }

    if (controlEntry.name.indexOf('.gz') > -1 && typeof DecompressionStream !== 'undefined') {
        try {
            var ds = new DecompressionStream('gzip');
            var stream = new Blob([controlBytes]).stream().pipeThrough(ds);
            return new Response(stream).arrayBuffer().then(function (ab) { return finish(new Uint8Array(ab)); }).catch(function () { return out; });
        } catch (e) { return out; }
    }
    if (controlEntry.name.indexOf('.xz') > -1 || controlEntry.name.indexOf('.zst') > -1) {
        out['DEB:Note'] = 'control.tar стиснуто xz/zstd — розпакування цих алгоритмів не підтримується браузером.';
        return out;
    }
    return finish(controlBytes); // control.tar без стиснення
};

window.Parsers.rpm = function (buffer, extHint) {
    if (extHint !== 'rpm') return null;
    var view = new DataView(buffer);
    if (view.getUint32(0, false) !== 0xEDABEEDB) return null;
    var out = { 'Format:Name': 'RPM Package' };
    out['RPM:MajorVersion'] = view.getUint8(4);
    out['RPM:MinorVersion'] = view.getUint8(5);
    var nameBytes = new Uint8Array(buffer, 10, 66);
    out['RPM:Name'] = BinUtils.readLatin1(nameBytes, 0, 66).replace(/\0+$/, '').trim();
    return out;
};
