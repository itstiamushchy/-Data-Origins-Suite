// Витоки Даних — parsers/raw.js
// CR2/NEF/ARW/DNG — стандартний TIFF-контейнер. ORF — TIFF з нестандартним маркером "IIRO"/"MMOR" замість "II*\0"/"MM\0*".
window.Parsers = window.Parsers || {};
window.Parsers.raw = function (buffer, extHint) {
    var view = new DataView(buffer);
    var b0 = view.getUint8(0), b1 = view.getUint8(1), b2 = view.getUint8(2), b3 = view.getUint8(3);
    var isStdTiff = (b0 === 0x49 && b1 === 0x49 && b2 === 0x2A && b3 === 0) ||
        (b0 === 0x4D && b1 === 0x4D && b2 === 0 && b3 === 0x2A);
    var isOrf = (b0 === 0x49 && b1 === 0x49 && b2 === 0x52 && b3 === 0x4F) ||
        (b0 === 0x4D && b1 === 0x4D && b2 === 0x4F && b3 === 0x52);

    if (!isStdTiff && !isOrf) return null;

    var out = {};
    if (isOrf) {
        // ORF: другий маркер нестандартний, але структура IFD0 відповідає звичайному TIFF
        // із офсетом IFD0, що зчитується так само з позиції 4. Підміняємо magic на 42 вручну.
        var littleEndian = b0 === 0x49;
        var ifd0Offset = view.getUint32(4, littleEndian);
        var patched = TiffReader.parse(buffer, 0);
        if (!patched) {
            // запасний шлях: власний прохід IFD0, якщо стандартний parse відкинув нестандартний magic
            out['RAW:Format'] = 'Olympus ORF';
            return out;
        }
        Object.assign(out, patched);
    } else {
        var tiffTags = TiffReader.parse(buffer, 0);
        if (tiffTags) Object.assign(out, tiffTags);
    }

    var formatNames = { cr2: 'Canon CR2', nef: 'Nikon NEF', arw: 'Sony ARW', dng: 'Adobe DNG', orf: 'Olympus ORF', raf: 'Fujifilm RAF', rw2: 'Panasonic RW2' };
    out['RAW:Format'] = formatNames[extHint] || 'TIFF-подібний RAW';
    return out;
};
