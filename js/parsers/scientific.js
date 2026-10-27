// Витоки Даних — parsers/scientific.js
window.Parsers = window.Parsers || {};

window.Parsers.fits = function (buffer, extHint) {
    var bytes = new Uint8Array(buffer);
    var firstCard = BinUtils.readLatin1(bytes, 0, 80);
    if (firstCard.indexOf('SIMPLE') !== 0) return null;

    var out = { 'Format:Name': 'FITS (астрономічні дані)' };
    var KEY_MAP = { BITPIX: 'BitsPerPixel', NAXIS: 'Dimensions', 'DATE-OBS': 'ObservationDate', DATE: 'FileDate', TELESCOP: 'Telescope', INSTRUME: 'Instrument', OBJECT: 'Object', OBSERVER: 'Observer', ORIGIN: 'Origin' };
    for (var i = 0; i < 36 * 20; i++) { // до 20 блоків по 36 карток — достатньо для стандартного заголовка
        var off = i * 80;
        if (off + 80 > bytes.length) break;
        var card = BinUtils.readLatin1(bytes, off, off + 80);
        var key = card.slice(0, 8).trim();
        if (key === 'END') break;
        var mapped = KEY_MAP[key];
        if (mapped && card[8] === '=') {
            var val = card.slice(10).split('/')[0].trim().replace(/^'|'$/g, '').trim();
            out['FITS:' + mapped] = val;
        }
    }
    return out;
};

window.Parsers.netcdf = function (buffer) {
    var view = new DataView(buffer);
    var sig3 = BinUtils.readAsciiString(view, 0, 3);
    if (sig3 !== 'CDF') return null;
    var ver = view.getUint8(3);
    var verMap = { 1: 'Класичний формат', 2: '64-bit offset', 5: 'netCDF-4 (на базі HDF5)' };
    return { 'Format:Name': 'NetCDF', 'NETCDF:FormatVersion': verMap[ver] || 'код ' + ver,
        'NETCDF:Note': 'Структура даних (виміри/змінні/атрибути) потребує повного розбору — підтверджено лише сигнатуру й версію.' };
};

window.Parsers.hdf5 = function (buffer) {
    var bytes = new Uint8Array(buffer);
    var sig = [0x89, 0x48, 0x44, 0x46, 0x0D, 0x0A, 0x1A, 0x0A];
    for (var i = 0; i < 8; i++) if (bytes[i] !== sig[i]) return null;
    var view = new DataView(buffer);
    return { 'Format:Name': 'HDF5', 'HDF5:SuperblockVersion': view.getUint8(8),
        'HDF5:Note': 'Структура груп/датасетів потребує повного розбору — підтверджено лише сигнатуру й версію суперблоку.' };
};
